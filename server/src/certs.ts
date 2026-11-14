/**
 * Sertifikatlar: server buraxır və qeydə alır — hər sertifikatın unikal kodu var, jabr.az/verify/<kod> ilə yoxlanılır.
 *   POST /api/certs { kind: 'game' | 'practice' | 'course', ref }  → uyğunluq serverdə yoxlanılır, eyni (uid, kind, ref) üçün eyni kod qaytarılır
 *   GET  /verify/:id                                                → ictimai təsdiq səhifəsi (HTML, noindex)
 * Dizayn (şablon, rəng, başlıq, imza) buraxan təlimçinin profilindən gəlir: profiles/{uid}.cert — yalnız Business planında.
 * "Jabr" loqosu dizayndan asılı olmayaraq həmişə sertifikatın sabit yerində qalır (klient çəkir).
 */
import { randomBytes } from 'node:crypto'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { authFrom, bearer, testHeader } from './auth.js'
import { brandFor } from './media.js'
import { tierOf } from './ai.js'
import { limit } from './ratelimit.js'
import { loadDoc, pool } from './store.js'
import type { Doc } from './values.js'

const SITE = () => process.env.PUBLIC_URL ?? 'https://jabr.az'
const fail = (code: string, statusCode = 400) => Object.assign(new Error(code), { statusCode, code })
const ms = (v: unknown) => (v && typeof v === 'object' && typeof (v as { __t?: number }).__t === 'number' ? (v as { __t: number }).__t : 0)
const HEX = /^#[0-9a-fA-F]{6}$/
const ID = /^[A-HJ-NP-Z2-9]{10}$/
const REF = /^[\w-]{1,64}$/
const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n)
/** Oxunaqlı kod: 10 simvol, qarışdırıla bilən (0/O, 1/I) simvollar yoxdur. */
function newId() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = randomBytes(10)
  return Array.from(b, (x) => A[x % A.length]).join('')
}

export async function migrateCerts() {
  await pool.query(`create table if not exists certificates (
    id text primary key, uid text not null, kind text not null, ref text not null, issuer text not null default '',
    data jsonb not null, created_at timestamptz not null default now(), revoked boolean not null default false,
    unique (uid, kind, ref))`)
  await pool.query('create index if not exists certificates_issuer on certificates (issuer)')
}

export type Template = 'classic' | 'modern' | 'minimal'
export interface CertDesign { template: Template; color: string; title: string; signer: string; signerTitle: string; signature: string; logo: string; org: string }
export interface CertData {
  id: string; kind: 'game' | 'practice' | 'course'; name: string; title: string; date: number
  place: number; total: number; score: number; correct: number; questions: number
  trainer: string; org: string; url: string; design: CertDesign | null
}

/** Buraxanın sertifikat dizaynı (Business planı). Loqo və təşkilat adı — şirkət brendindən. */
export async function designFor(issuer: string): Promise<CertDesign | null> {
  if (!issuer || (await tierOf(issuer).catch(() => null)) !== 'business') return null
  const me = await loadDoc(`admins/${issuer}`)
  const owner = me?.source === 'org' && typeof me.orgId === 'string' ? me.orgId : issuer
  const p = await loadDoc(`profiles/${owner}`)
  const c = (p?.cert ?? {}) as Record<string, unknown>
  const brand = await brandFor(issuer)
  const sig = typeof c.signature === 'string' && c.signature.startsWith(`/api/media/sign/${owner}`) ? c.signature.slice(0, 200) : ''
  if (c.on !== true && !brand) return null
  return {
    template: (['classic', 'modern', 'minimal'] as const).find((x) => x === c.template) ?? 'classic',
    color: HEX.test(String(c.color ?? '')) ? String(c.color) : brand?.color || '',
    title: c.on === true ? str(c.title, 60) : '', signer: c.on === true ? str(c.signer, 60) : '', signerTitle: c.on === true ? str(c.signerTitle, 60) : '',
    signature: c.on === true ? sig : '', logo: brand?.logo ?? '', org: brand?.name ?? '',
  }
}

type Issue = Omit<CertData, 'id' | 'url' | 'design'> & { issuer: string }
/** Uyğunluq yoxlaması və sertifikat məlumatı — hər növ üçün yalnız serverdəki qeydlərə əsasən. */
async function eligible(uid: string, kind: CertData['kind'], ref: string): Promise<Issue> {
  if (kind === 'game') {
    const g = await loadDoc(`games/${ref}`)
    const me = await loadDoc(`games/${ref}/players/${uid}`)
    if (!g || !me || me.kicked === true) throw fail('not-eligible', 403)
    if (!['podium', 'finished'].includes(String(g.phase))) throw fail('not-finished', 409)
    const r = await pool.query<{ data: Doc }>(`select data from docs where parent = $1`, [`games/${ref}/players`])
    const players = r.rows.map((x) => x.data).filter((p) => p.kicked !== true)
    const score = Number(me.score) || 0
    const place = 1 + players.filter((p) => (Number(p.score) || 0) > score).length
    const host = (g.host ?? {}) as Doc
    return {
      kind, issuer: String(g.hostUid ?? ''), name: str(`${me.firstName ?? ''} ${me.lastName ?? ''}`, 80), title: str(g.title, 120),
      date: ms(g.finishedAt) || Date.now(), place, total: players.length, score, correct: Number(me.correctCount) || 0, questions: 0,
      trainer: str(host.name, 80), org: str(host.org, 80),
    }
  }
  const u = await loadDoc(`users/${uid}`)
  if (!u) throw fail('not-eligible', 403)
  const name = str(`${u.firstName ?? ''} ${u.lastName ?? ''}`, 80)
  if (kind === 'practice') {
    const q = await loadDoc(`catalog/${ref}`)
    if (!q) throw fail('not-eligible', 403)
    // ən yaxşı cəhd ≥ 70%
    const r = await pool.query<{ data: Doc }>(`select data from docs where parent = 'attempts' and data->>'uid' = $1 and data->>'quizId' = $2`, [uid, ref])
    const best = r.rows.map((x) => x.data).filter((a) => Number(a.total) > 0 && Number(a.correct) / Number(a.total) >= 0.7)
      .sort((a, b) => Number(b.correct) / Number(b.total) - Number(a.correct) / Number(a.total) || Number(b.score) - Number(a.score))[0]
    if (!best) throw fail('not-eligible', 403)
    return { kind, issuer: String(q.publishedBy ?? ''), name, title: str(q.title, 120), date: ms(best.at) || Date.now(), place: 0, total: 0,
      score: Number(best.score) || 0, correct: Number(best.correct) || 0, questions: Number(best.total) || 0, trainer: str(q.author, 80), org: '' }
  }
  // course
  const c = await loadDoc(`courses/${ref}`)
  const p = await loadDoc(`courses/${ref}/progress/${uid}`)
  const items = Array.isArray(c?.items) ? (c!.items as Doc[]) : []
  const done = Array.isArray(p?.done) ? (p!.done as string[]) : []
  if (!c || !p || !items.length || !items.every((i) => done.includes(String(i.quizId)))) throw fail('not-eligible', 403)
  return { kind, issuer: String(c.ownerUid ?? ''), name, title: str(c.title, 120), date: ms(p.completedAt) || ms(p.at) || Date.now(), place: 0, total: 0,
    score: 0, correct: items.length, questions: items.length, trainer: str(c.ownerName, 80), org: '' }
}

export async function issue(uid: string, kind: CertData['kind'], ref: string): Promise<CertData> {
  const old = await pool.query<{ id: string; data: Issue }>('select id, data from certificates where uid = $1 and kind = $2 and ref = $3', [uid, kind, ref])
  let id: string, data: Issue
  if (old.rows[0]) { id = old.rows[0].id; data = old.rows[0].data }
  else {
    data = await eligible(uid, kind, ref)
    if (!data.name) throw fail('no-name', 400)
    id = newId()
    const ins = await pool.query<{ id: string }>(
      `insert into certificates (id, uid, kind, ref, issuer, data) values ($1,$2,$3,$4,$5,$6)
       on conflict (uid, kind, ref) do update set uid = excluded.uid returning id`, [id, uid, kind, ref, data.issuer, data])
    id = ins.rows[0].id
  }
  const { issuer, ...rest } = data
  return { ...rest, id, url: `${SITE()}/verify/${id}`, design: await designFor(issuer) }
}

// ───────────── ictimai yoxlama səhifəsi ─────────────
const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const L = {
  az: { ok: 'Sertifikat təsdiqləndi', bad: 'Sertifikat tapılmadı', badText: 'Bu kodla sertifikat yoxdur və ya ləğv edilib. Kodu yoxlayın.', revoked: 'Sertifikat ləğv edilib',
    name: 'Ad', title: { game: 'Canlı quiz', practice: 'Quiz', course: 'Kurs' }, date: 'Tarix', issuer: 'Verən', trainer: 'Təlimçi', result: 'Nəticə', code: 'Kod',
    place: (p: number, t: number) => `${p}-ci yer (${t} iştirakçıdan)`, correct: (c: number, q: number) => `${c}/${q} düzgün`, done: 'Tam keçilib', note: 'Bu sertifikat Jabr platformasında buraxılıb və qeydiyyatdadır.' },
}
function page(reply: FastifyReply, code: number, body: string) {
  return reply.code(code).type('text/html; charset=utf-8').header('cache-control', 'no-store').send(`<!doctype html><html lang="az"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Sertifikatın yoxlanması · Jabr</title><link rel="icon" type="image/png" href="/icons/favicon-64.png">
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;background:#090A13;background-image:radial-gradient(60rem 30rem at 100% -10%,rgba(255,122,26,.16),transparent 60%),radial-gradient(50rem 30rem at -10% 110%,rgba(240,38,47,.14),transparent 60%);font:15px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#C3C6DC}
.c{width:100%;max-width:520px;background:#10122A;border:1px solid #23263F;border-radius:22px;padding:28px}.top{display:flex;align-items:center;gap:12px;margin-bottom:22px}.l{font:800 26px/1 system-ui,sans-serif;color:#fff;letter-spacing:-1px;text-decoration:none}.l span{color:#FF7A1A}
.sep{width:1px;height:26px;background:#2E3150}.org{max-height:30px;max-width:160px;object-fit:contain}.orgn{color:#fff;font-weight:700}
.st{display:flex;align-items:center;gap:10px;font-weight:800;font-size:20px;color:#fff;margin:0 0 4px}.ok{width:30px;height:30px;border-radius:50%;background:#16A34A;display:flex;align-items:center;justify-content:center;color:#fff;font-size:17px}.no{background:#DC2626}
dl{display:grid;grid-template-columns:110px 1fr;gap:10px 14px;margin:20px 0 0}dt{color:#8C90AE;font-size:13px}dd{margin:0;color:#F3F4FB;font-weight:600;word-break:break-word}.m{color:#8C90AE;font-size:13px;margin-top:20px}code{color:#FFB37A}</style></head><body><div class="c">${body}</div></body></html>`)
}

export function certRoutes(app: FastifyInstance) {
  app.post<{ Body: { kind?: string; ref?: string } }>('/api/certs', { preHandler: limit('certs', 60, 600_000) }, async (req) => {
    const { auth } = await authFrom(bearer(req), testHeader(req))
    if (!auth) throw fail('auth/unauthenticated', 401)
    const kind = (['game', 'practice', 'course'] as const).find((k) => k === req.body?.kind)
    const ref = String(req.body?.ref ?? '')
    if (!kind || !REF.test(ref)) throw fail('invalid-argument')
    return issue(auth.uid, kind, ref)
  })

  app.get<{ Params: { id: string } }>('/verify/:id', { preHandler: limit('verify', 120, 60_000) }, async (req, reply) => {
    const T = L.az, id = String(req.params.id).toUpperCase()
    const r = ID.test(id) ? await pool.query<{ data: Issue; revoked: boolean; issuer: string }>('select data, revoked, issuer from certificates where id = $1', [id]) : null
    const row = r?.rows[0]
    const head = (brand: { logo: string; org: string } | null) => `<div class="top"><a class="l" href="/">Jabr<span>.</span></a>${brand && (brand.logo || brand.org) ? `<span class="sep"></span>${brand.logo ? `<img class="org" src="${esc(brand.logo)}" alt="${esc(brand.org)}">` : `<span class="orgn">${esc(brand.org)}</span>`}` : ''}</div>`
    if (!row || row.revoked) return page(reply, 404, `${head(null)}<p class="st"><span class="ok no">✕</span>${row?.revoked ? T.revoked : T.bad}</p><p>${T.badText}</p><p class="m">${T.code}: <code>${esc(id)}</code></p>`)
    const d = row.data, design = await designFor(row.issuer).catch(() => null)
    const result = d.kind === 'game' ? T.place(d.place, d.total) : d.kind === 'practice' ? T.correct(d.correct, d.questions) : T.done
    const issuerName = design?.org || d.org
    return page(reply, 200, `${head(design ? { logo: design.logo, org: design.org } : null)}
<p class="st"><span class="ok">✓</span>${T.ok}</p>
<dl><dt>${T.name}</dt><dd>${esc(d.name)}</dd>
<dt>${T.title[d.kind]}</dt><dd>${esc(d.title)}</dd>
<dt>${T.result}</dt><dd>${esc(result)}</dd>
<dt>${T.date}</dt><dd>${esc(new Date(d.date).toLocaleDateString('az-AZ', { timeZone: 'Asia/Baku', day: 'numeric', month: 'long', year: 'numeric' }))}</dd>
${issuerName ? `<dt>${T.issuer}</dt><dd>${esc(issuerName)}</dd>` : ''}${d.trainer ? `<dt>${T.trainer}</dt><dd>${esc(d.trainer)}</dd>` : ''}
<dt>${T.code}</dt><dd><code>${esc(id)}</code></dd></dl><p class="m">${T.note}</p>`)
  })
}
