/**
 * Fayllar (sinif tapşırıqları): müəllim materialları və tələbə təhvilləri.
 *  - Diskdə saxlanılır (FILES_DIR, docker həcmi), metadata — Postgres "files" cədvəlində.
 *  - Giriş yoxlanılır: material (resource) — sinfin sahibi və üzvləri; təhvil (submission) — yükləyən tələbə və sinfin sahibi.
 *  - Yükləmə: POST /api/files (application/octet-stream, ≤ 25 MB), endirmə: GET /api/files/:id (Bearer ilə; klient blob kimi açır).
 *  - Təhlükəsizlik: icazəli genişlənmələr, HTML/SVG/JS yoxdur, nosniff, attachment (şəkil/PDF istisna).
 */
import { createReadStream } from 'node:fs'
import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authFrom, bearer, testHeader } from './auth.js'
import { limit } from './ratelimit.js'
import { loadDoc, pool } from './store.js'

const DIR = () => process.env.FILES_DIR ?? '/data/files'
export const MAX_FILE = 25 * 1024 * 1024
const USER_QUOTA = 500 * 1024 * 1024
const TYPES: Record<string, string> = {
  pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  odt: 'application/vnd.oasis.opendocument.text', ods: 'application/vnd.oasis.opendocument.spreadsheet', odp: 'application/vnd.oasis.opendocument.presentation',
  txt: 'text/plain; charset=utf-8', csv: 'text/csv; charset=utf-8', md: 'text/plain; charset=utf-8', rtf: 'application/rtf',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  zip: 'application/zip', '7z': 'application/x-7z-compressed', rar: 'application/vnd.rar',
}
const INLINE = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'mp3', 'm4a', 'wav', 'mp4', 'webm', 'txt'])
const ext = (name: string) => (name.toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1] ?? '')
const fail = (code: string, statusCode = 400) => Object.assign(new Error(code), { statusCode, code })
// eslint-disable-next-line no-control-regex
const cleanName = (s: string) => s.normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 140) || 'file'

export async function migrateFiles() {
  await pool.query(`create table if not exists files (
    id text primary key, owner text not null, name text not null, ext text not null, size bigint not null,
    class_id text not null, kind text not null, task_id text, created_at timestamptz not null default now())`)
  await pool.query('create index if not exists files_owner on files (owner)')
  await mkdir(DIR(), { recursive: true }).catch(() => {})
}

async function who(req: FastifyRequest) {
  const { auth } = await authFrom(bearer(req), testHeader(req))
  if (!auth) throw fail('auth/unauthenticated', 401)
  return auth.uid
}
const classOwner = async (cid: string, uid: string) => (await loadDoc(`classes/${cid}`))?.ownerUid === uid
const classMember = async (cid: string, uid: string) => !!(await loadDoc(`classes/${cid}/members/${uid}`))

type Row = { id: string; owner: string; name: string; ext: string; size: string; class_id: string; kind: string }
async function canRead(f: Row, uid: string) {
  if (f.owner === uid || (await classOwner(f.class_id, uid))) return true
  return f.kind === 'resource' && (await classMember(f.class_id, uid))
}

export function fileRoutes(app: FastifyInstance) {
  if (!app.hasContentTypeParser('application/octet-stream')) {
    app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: MAX_FILE }, (_r, body, done) => done(null, body))
  }

  app.post<{ Querystring: { name?: string; classId?: string; kind?: string; taskId?: string } }>('/api/files',
    { bodyLimit: MAX_FILE, preHandler: limit('files-up', 60, 600_000) }, async (req) => {
      const uid = await who(req)
      const q = req.query
      const name = cleanName(String(q.name ?? ''))
      const e = ext(name)
      if (!TYPES[e]) throw fail('file-type')
      const body = req.body as Buffer
      if (!Buffer.isBuffer(body) || !body.length) throw fail('file-empty')
      if (body.length > MAX_FILE) throw fail('file-too-large', 413)
      const cid = String(q.classId ?? '')
      const kind = q.kind === 'submission' ? 'submission' : 'resource'
      if (!/^[\w-]{1,64}$/.test(cid)) throw fail('invalid-argument')
      if (kind === 'resource' ? !(await classOwner(cid, uid)) : !(await classMember(cid, uid))) throw fail('permission-denied', 403)
      const used = await pool.query<{ s: string | null }>('select sum(size) as s from files where owner = $1', [uid])
      if (Number(used.rows[0]?.s ?? 0) + body.length > USER_QUOTA) throw fail('file-quota', 413)
      const id = randomBytes(16).toString('hex')
      await writeFile(path.join(DIR(), id), body)
      const taskId = /^[\w-]{1,64}$/.test(String(q.taskId ?? '')) ? String(q.taskId) : null
      await pool.query('insert into files (id, owner, name, ext, size, class_id, kind, task_id) values ($1,$2,$3,$4,$5,$6,$7,$8)', [id, uid, name, e, body.length, cid, kind, taskId])
      return { id, name, size: body.length, type: e }
    })

  app.get<{ Params: { id: string }; Querystring: { dl?: string } }>('/api/files/:id', { preHandler: limit('files-dl', 300, 600_000) }, async (req, reply) => {
    const uid = await who(req)
    if (!/^[a-f0-9]{32}$/.test(req.params.id)) throw fail('not-found', 404)
    const r = await pool.query<Row>('select * from files where id = $1', [req.params.id])
    const f = r.rows[0]
    if (!f) throw fail('not-found', 404)
    if (!(await canRead(f, uid))) throw fail('permission-denied', 403)
    const p = path.join(DIR(), f.id)
    const st = await stat(p).catch(() => null)
    if (!st) throw fail('not-found', 404)
    const inline = INLINE.has(f.ext) && req.query.dl !== '1'
    return reply
      .header('content-type', TYPES[f.ext] ?? 'application/octet-stream')
      .header('content-length', st.size)
      .header('x-content-type-options', 'nosniff')
      .header('cache-control', 'private, max-age=300')
      .header('content-security-policy', "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox")
      .header('content-disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.name)}`)
      .send(createReadStream(p))
  })

  app.delete<{ Params: { id: string } }>('/api/files/:id', async (req) => {
    const uid = await who(req)
    const r = await pool.query<Row>('select * from files where id = $1', [req.params.id])
    const f = r.rows[0]
    if (!f) return { ok: true }
    if (f.owner !== uid && !(await classOwner(f.class_id, uid))) throw fail('permission-denied', 403)
    await pool.query('delete from files where id = $1', [f.id])
    await rm(path.join(DIR(), f.id), { force: true })
    return { ok: true }
  })
}
