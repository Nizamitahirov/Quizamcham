/**
 * İctimai kiçik şəkillər: profil şəkli və şirkət loqosu.
 *  - Yükləmə: POST /api/media/photo | /api/media/logo (application/octet-stream, ≤ 400 KB; PNG / JPEG / WebP — məzmuna görə yoxlanılır).
 *    Klient şəkli əvvəlcədən kiçildir (kvadrat 320 px, loqo ≤ 512 px).
 *  - Baxış: GET /api/media/photo/:uid, /api/media/logo/:uid — girişsiz (oyunçular təlimçinin şəklini və loqonu lobbidə görür).
 *  - Brend: GET /api/brand — çağıranın (və ya təşkilat sahibinin) brendi; yalnız Business planında aktivdir.
 * Fayllar FILES_DIR/public altında saxlanılır (istifadəçiyə bir şəkil + bir loqo), ona görə kvota lazım deyil.
 */
import { createReadStream } from 'node:fs'
import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authFrom, bearer, testHeader } from './auth.js'
import { tierOf } from './ai.js'
import { limit } from './ratelimit.js'
import { loadDoc } from './store.js'

const DIR = () => path.join(process.env.FILES_DIR ?? '/data/files', 'public')
const MAX = 400 * 1024
const KINDS = ['photo', 'logo'] as const
type Kind = (typeof KINDS)[number]
const TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }
const fail = (code: string, statusCode = 400) => Object.assign(new Error(code), { statusCode, code })
const UID = /^[\w-]{1,64}$/

/** Fayl növü məzmunun ilk baytlarına görə (ad və ya başlığa etibar edilmir; SVG/HTML qəbul olunmur). */
export function sniff(b: Buffer): string | null {
  if (b.length > 8 && b[0] === 0x89 && b.toString('latin1', 1, 4) === 'PNG') return 'png'
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp'
  return null
}
async function find(kind: Kind, uid: string) {
  for (const ext of Object.keys(TYPES)) {
    const p = path.join(DIR(), `${kind}_${uid}.${ext}`), st = await stat(p).catch(() => null)
    if (st) return { p, ext, st }
  }
  return null
}
const clear = (kind: Kind, uid: string) => Promise.all(Object.keys(TYPES).map((ext) => rm(path.join(DIR(), `${kind}_${uid}.${ext}`), { force: true })))

async function who(req: FastifyRequest) {
  const { auth } = await authFrom(bearer(req), testHeader(req))
  if (!auth || auth.token.firebase?.sign_in_provider === 'anonymous') throw fail('auth/unauthenticated', 401)
  return auth.uid
}

const HEX = /^#[0-9a-fA-F]{6}$/
export interface Brand { name: string; color: string; logo: string }
/** Təlimçinin effektiv brendi: təşkilat üzvü üçün — sahibin brendi. Plan icazə vermirsə və ya söndürülübsə null. */
export async function brandFor(uid: string): Promise<Brand | null> {
  if (!(await tierOf(uid).then((t) => t === 'business').catch(() => false))) return null
  const me = await loadDoc(`admins/${uid}`)
  const owner = me?.source === 'org' && typeof me.orgId === 'string' ? me.orgId : uid
  const b = (await loadDoc(`profiles/${owner}`))?.brand as { on?: boolean; name?: string; color?: string; logo?: string } | undefined
  if (!b || b.on !== true) return null
  const name = String(b.name ?? '').trim().slice(0, 60), color = HEX.test(String(b.color ?? '')) ? String(b.color) : ''
  const logo = typeof b.logo === 'string' && b.logo.startsWith(`/api/media/logo/${owner}`) ? b.logo.slice(0, 200) : ''
  return name || logo || color ? { name, color, logo } : null
}

export function mediaRoutes(app: FastifyInstance) {
  if (!app.hasContentTypeParser('application/octet-stream')) {
    app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: 25 * 1024 * 1024 }, (_r, body, done) => done(null, body))
  }
  for (const kind of KINDS) {
    app.post(`/api/media/${kind}`, { bodyLimit: MAX, preHandler: limit(`media-${kind}`, 30, 600_000) }, async (req) => {
      const uid = await who(req)
      // loqo yalnız təlimçi/admin hesabları üçündür
      if (kind === 'logo' && !(await loadDoc(`admins/${uid}`))) throw fail('permission-denied', 403)
      const body = req.body as Buffer
      if (!Buffer.isBuffer(body) || !body.length) throw fail('file-empty')
      if (body.length > MAX) throw fail('file-too-large', 413)
      const ext = sniff(body)
      if (!ext) throw fail('file-type')
      await mkdir(DIR(), { recursive: true })
      await clear(kind, uid)
      await writeFile(path.join(DIR(), `${kind}_${uid}.${ext}`), body)
      return { url: `/api/media/${kind}/${uid}?v=${Date.now().toString(36)}` }
    })
    app.delete(`/api/media/${kind}`, async (req) => { await clear(kind, await who(req)); return { ok: true } })
    app.get<{ Params: { uid: string } }>(`/api/media/${kind}/:uid`, { preHandler: limit(`media-get`, 1200, 60_000) }, async (req, reply) => {
      const f = UID.test(req.params.uid) ? await find(kind, req.params.uid) : null
      if (!f) throw fail('not-found', 404)
      return reply.header('content-type', TYPES[f.ext]).header('content-length', f.st.size).header('x-content-type-options', 'nosniff')
        .header('cache-control', 'public, max-age=31536000, immutable').header('content-security-policy', "default-src 'none'; sandbox")
        .header('cross-origin-resource-policy', 'cross-origin').send(createReadStream(f.p))
    })
  }
  app.get('/api/brand', async (req) => ({ brand: await brandFor(await who(req)) }))
}
