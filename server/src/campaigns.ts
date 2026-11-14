/**
 * E-poçt: xoş gəldin məktubu, marketinq kampaniyaları (seqmentlərlə) və abunəlikdən çıxma.
 *  - Kampaniyalar yalnız super admin üçündür; marketinq məktubları yalnız razılıq verənlərə gedir (users.marketing === true).
 *  - Hər marketinq məktubunda imzalı abunəlikdən çıxma keçidi və List-Unsubscribe (bir kliklə) başlığı var.
 *  - Göndərmə fon rejimində gedir; gedişat campaigns/{id} sənədində saxlanılır.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { authFrom, bearer, testHeader } from './auth.js'
import { limit } from './ratelimit.js'
import { SUPER } from './rules.js'
import { commit, loadDoc, pool } from './store.js'
import { ts, type Doc, type J } from './values.js'
import { mailConfig, resetMailConfigCache, sendMail, smtp } from './mailer.js'
import { promises as dns } from 'node:dns'
import { readFile } from 'node:fs/promises'
import net from 'node:net'
import { campaignEmail, pickLang, welcomeEmail, type CampaignContent, type Lang } from './emails.js'

const BYPASS = { auth: null, bypass: true }
const base = () => process.env.PUBLIC_URL ?? ''
const fail = (code: string, statusCode = 400) => Object.assign(new Error(code), { statusCode, code })
const millis = (v: J | undefined) => (v && typeof v === 'object' && !Array.isArray(v) && typeof v.__t === 'number' ? v.__t : 0)
const str = (v: unknown, max = 2000) => String(v ?? '').slice(0, max)

// ---------- abunəlikdən çıxma tokeni (uid + HMAC) ----------
const key = () => createHmac('sha256', 'jabr-unsubscribe').update(process.env.MAIL_SECRET ?? process.env.BREVO_API_KEY ?? 'dev').digest()
const sig = (uid: string) => createHmac('sha256', key()).update(uid).digest('base64url').slice(0, 32)
export const unsubToken = (uid: string) => `${uid}.${sig(uid)}`
export function verifyUnsub(token: string): string | null {
  const i = token.lastIndexOf('.')
  if (i < 1) return null
  const uid = token.slice(0, i), a = Buffer.from(token.slice(i + 1)), b = Buffer.from(sig(uid))
  return a.length === b.length && timingSafeEqual(a, b) ? uid : null
}
const unsubUrl = (uid: string) => `${base() || 'https://jabr.az'}/api/mail/unsubscribe?t=${encodeURIComponent(unsubToken(uid))}`

async function caller(req: FastifyRequest) {
  const { auth } = await authFrom(bearer(req), testHeader(req))
  if (!auth) throw fail('auth/unauthenticated', 401)
  return auth
}
async function requireSuper(req: FastifyRequest) {
  const auth = await caller(req)
  if (auth.uid === SUPER) return auth
  const me = await loadDoc(`admins/${auth.uid}`)
  if (me?.role !== 'super' || me.disabled === true) throw fail('permission-denied', 403)
  return auth
}

// ---------- seqmentlər ----------
export type Tier = 'trial' | 'free' | 'trainer' | 'pro' | 'business' | 'team'
export interface Filter {
  audience: 'all' | 'students' | 'trainers' | 'custom'
  tiers?: Tier[]        // təlimçilər üçün plan (boş — hamısı)
  langs?: Lang[]        // interfeys dili (boş — hamısı)
  joinedDays?: number   // son N gündə qeydiyyatdan keçənlər (0 — hamısı)
  emails?: string[]     // audience = custom
  exclude?: string[]    // bu ünvanlar çıxarılır (siyahıdan əl ilə)
  /** təlimçilər: lisenziya vəziyyəti — bitib / yaxında bitir / sınaq bitib (any — hamısı) */
  license?: LicenseState
  /** expiring: növbəti N gün; expired/trialEnded: son N gündə bitənlər (0 — istənilən vaxt) */
  licenseDays?: number
  kind: 'marketing' | 'service' // service: vacib xidməti elan, razılıq tələb etmir (abunə keçidi olmur)
}
export type LicenseState = 'any' | 'expired' | 'expiring' | 'trialEnded'
export interface Recipient { uid: string; email: string; name: string; lang: Lang; type: string; tier: Tier | null; until?: number }

const DAY_MS = 86_400_000
/** Öz qeydiyyatı ilə gələn təlimçinin lisenziya/sınaq bitmə tarixi və vəziyyəti (komanda üzvləri — təşkilatın lisenziyasındadır, burada yox). */
export function licenseOf(a: Doc | null, now: number): { state: Exclude<LicenseState, 'any'> | 'active' | 'trial' | null; until: number } {
  if (!a || a.source !== 'signup') return { state: null, until: 0 }
  const lic = millis(a.licenseUntil)
  if (lic) return { state: lic > now ? 'active' : 'expired', until: lic }
  const trialEnd = millis(a.trialEndsAt) || (millis(a.createdAt) ? millis(a.createdAt) + 3 * DAY_MS : 0)
  if (!trialEnd) return { state: null, until: 0 }
  return { state: trialEnd > now ? 'trial' : 'trialEnded', until: trialEnd }
}
export function matchLicense(want: LicenseState | undefined, days: number, a: Doc | null, now: number): { ok: boolean; until: number } {
  const l = licenseOf(a, now)
  if (!want || want === 'any') return { ok: true, until: l.until }
  if (want === 'expiring') return { ok: l.state === 'active' && l.until <= now + (days || 7) * DAY_MS, until: l.until }
  const ok = l.state === want && (!days || l.until >= now - days * DAY_MS)
  return { ok, until: l.until }
}

/** Rules/klientdəki planInfo ilə eyni məntiq (sadələşdirilmiş). */
function tierOf(a: Doc | null, owner: Doc | null, now: number): Tier {
  if (!a) return 'free'
  if (a.source === 'org') return owner?.plan === 'institution' && now < millis(owner.licenseUntil) ? 'business' : 'free'
  if (a.source !== 'signup') return 'team'
  const lic = millis(a.licenseUntil)
  if (now < lic) return a.plan === 'trainer' ? 'trainer' : a.plan === 'business' || a.plan === 'institution' ? 'business' : 'pro'
  const end = lic || millis(a.trialEndsAt) || (millis(a.createdAt) ? millis(a.createdAt) + 3 * 86_400_000 : 0)
  return now < end ? 'trial' : 'free'
}

export async function audience(f: Filter): Promise<{ list: Recipient[]; noConsent: number; noConsentEmails: string[]; notFound: string[]; excluded: number }> {
  const now = Date.now()
  const [users, admins, authUsers] = await Promise.all([
    pool.query<{ id: string; data: Doc }>("select id, data from docs where parent = 'users'"),
    pool.query<{ id: string; data: Doc }>("select id, data from docs where parent = 'admins'"),
    pool.query<{ uid: string; email: string | null; disabled: boolean }>('select uid, email, disabled from auth_users'),
  ])
  const adm = new Map(admins.rows.map((r) => [r.id, r.data]))
  const au = new Map(authUsers.rows.map((r) => [r.uid, r]))
  const wanted = new Set((f.emails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean))
  const skip = new Set((f.exclude ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean))
  const seen = new Set<string>()
  const found = new Set<string>()
  const list: Recipient[] = []
  const noConsentEmails: string[] = []
  let noConsent = 0, excluded = 0
  for (const { id: uid, data: u } of users.rows) {
    const a = au.get(uid)
    if (a?.disabled) continue
    const email = String(a?.email || u.email || '').trim().toLowerCase()
    if (!email || seen.has(email)) continue
    const ad = adm.get(uid) ?? null
    if (ad?.disabled === true) continue
    const type = String(u.type ?? 'student')
    const student = type === 'student'
    const tier = student ? null : tierOf(ad, typeof ad?.orgId === 'string' ? adm.get(ad.orgId) ?? null : null, now)
    const lang = pickLang(u.lang)
    if (f.audience === 'custom') { if (!wanted.has(email)) continue; found.add(email) }
    else {
      if (f.audience === 'students' && !student) continue
      if (f.audience === 'trainers' && student) continue
      // plan və lisenziya filtrləri yalnız "Təlimçilər" auditoriyasında (panelda da yalnız orada görünür)
      if (f.audience === 'trainers' && f.tiers?.length && !f.tiers.includes(tier!)) continue
      if (f.langs?.length && !f.langs.includes(lang)) continue
      if (f.joinedDays && millis(u.createdAt) < now - f.joinedDays * 86_400_000) continue
    }
    let until = 0
    if (f.audience === 'trainers' && f.license && f.license !== 'any') {
      const m = matchLicense(f.license, f.licenseDays ?? 0, ad, now)
      if (!m.ok) continue
      until = m.until
    } else if (!student) until = licenseOf(ad, now).until
    if (skip.has(email)) { excluded++; continue }
    if (f.kind !== 'service' && u.marketing !== true) { noConsent++; if (noConsentEmails.length < 200) noConsentEmails.push(email); continue }
    seen.add(email)
    list.push({ uid, email, name: String(u.firstName ?? '').trim() || String(u.displayName ?? '').split(' ')[0] || '', lang, type, tier, until: until || undefined })
  }
  const notFound = f.audience === 'custom' ? [...wanted].filter((e) => !found.has(e)) : []
  return { list, noConsent, noConsentEmails, notFound, excluded }
}

function parseFilter(v: unknown): Filter {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const arr = (x: unknown) => (Array.isArray(x) ? x.map(String) : [])
  const aud = ['all', 'students', 'trainers', 'custom'].includes(String(o.audience)) ? (o.audience as Filter['audience']) : 'all'
  return {
    audience: aud,
    tiers: arr(o.tiers).filter((x): x is Tier => ['trial', 'free', 'trainer', 'pro', 'business', 'team'].includes(x)),
    langs: arr(o.langs).filter((x): x is Lang => ['az', 'ru', 'en'].includes(x)),
    joinedDays: Math.max(0, Math.min(3650, Number(o.joinedDays) || 0)),
    emails: arr(o.emails).slice(0, 2000).map((e) => e.slice(0, 200)),
    exclude: arr(o.exclude).slice(0, 5000).map((e) => e.slice(0, 200)),
    license: (['expired', 'expiring', 'trialEnded'] as const).find((x) => x === o.license) ?? 'any',
    licenseDays: Math.max(0, Math.min(3650, Number(o.licenseDays) || 0)),
    kind: o.kind === 'service' ? 'service' : 'marketing',
  }
}
function parseContent(v: unknown): CampaignContent {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const feats = Array.isArray(o.features) ? o.features.slice(0, 4).map((f) => { const x = (f ?? {}) as Record<string, unknown>; return { emoji: str(x.emoji, 8), title: str(x.title, 120), text: str(x.text, 400) } }) : []
  const c: CampaignContent = {
    subject: str(o.subject, 200).trim(), preheader: str(o.preheader, 200), title: str(o.title, 200).trim(), body: str(o.body, 8000),
    hero: str(o.hero, 1000).trim(), features: feats, ctaLabel: str(o.ctaLabel, 80).trim(), ctaUrl: str(o.ctaUrl, 1000).trim(), lang: pickLang(o.lang),
  }
  if (!c.subject || !c.title) throw fail('invalid-argument')
  return c
}

/** Tək ünvanlı fərdi məktub (konsol): önizləmə və test həmin alıcının adı və bitmə tarixi ilə. */
async function singleTarget(f: Filter): Promise<Recipient | null> {
  if (f.audience !== 'custom' || (f.emails ?? []).length !== 1) return null
  const { list } = await audience({ ...f, kind: 'service', exclude: [] })
  return list[0] ?? null
}

/** Önizləmə və "özümə test" üçün {tarix}: seçilmiş lisenziya filtrinə uyğun nümunə tarix (öz tarixiniz uyğundursa — o). */
function sampleUntil(f: Filter, me: Doc | null): number {
  const now = Date.now()
  const m = matchLicense(f.license, f.licenseDays ?? 0, me, now)
  if (f.license && f.license !== 'any' && m.ok && m.until) return m.until
  if (f.license === 'expiring') return now + 3 * DAY_MS
  if (f.license === 'expired' || f.license === 'trialEnded') return now - 2 * DAY_MS
  return licenseOf(me, now).until || now + 7 * DAY_MS
}

const unsubHeaders = (uid: string) => ({ 'List-Unsubscribe': `<${unsubUrl(uid)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' })

async function runCampaign(id: string, content: CampaignContent, list: Recipient[], kind: Filter['kind']) {
  let sent = 0, failed = 0, last = Date.now()
  const errors: string[] = []
  const save = (status: string) => commit(BYPASS, [{ op: 'update', path: `campaigns/${id}`, data: { sent, failed, status, errors: errors.slice(0, 5), updatedAt: ts(Date.now()) } }]).catch(() => {})
  for (let i = 0; i < list.length; i += 4) {
    await Promise.all(list.slice(i, i + 4).map(async (r) => {
      const m = campaignEmail(content, { name: r.name, until: r.until, unsubscribe: kind === 'marketing' ? unsubUrl(r.uid) : undefined }, base())
      const res = await sendMail(r.email, m.subject, m.text, m.html, { headers: kind === 'marketing' ? unsubHeaders(r.uid) : undefined, tags: ['campaign', id] }).catch((e: Error) => ({ sent: false, status: 0, error: e.message }))
      if (res.sent) sent++
      else { failed++; if (res.error && errors.length < 5) errors.push(`${res.status}: ${res.error}`.slice(0, 200)) }
    }))
    if (Date.now() - last > 2000) { last = Date.now(); await save('sending') }
    await new Promise((r) => setTimeout(r, 250))
  }
  await save('done')
}

// ---------- abunəlikdən çıxma səhifəsi (saytın üslubunda, minimal) ----------
const PAGE: Record<Lang, { title: string; ask: string; btn: string; done: string; bad: string; back: string }> = {
  az: { title: 'Abunəlikdən çıxma', ask: 'Jabr-ın marketinq məktublarını artıq almaq istəmirsiniz?', btn: 'Abunəlikdən çıx', done: 'Hazırdır — artıq marketinq məktubları göndərilməyəcək. Hesab məktubları (məs. şifrə sıfırlama) gəlməyə davam edəcək. Fikrinizi dəyişsəniz, "Hesabım" bölməsindən yenidən qoşula bilərsiniz.', bad: 'Keçid etibarsızdır.', back: 'Jabr-a qayıt' },
  ru: { title: 'Отписка', ask: 'Больше не хотите получать маркетинговые письма Jabr?', btn: 'Отписаться', done: 'Готово — маркетинговые письма больше не придут. Служебные письма (например, сброс пароля) продолжат приходить. Подписаться снова можно в разделе «Мой аккаунт».', bad: 'Ссылка недействительна.', back: 'Вернуться в Jabr' },
  en: { title: 'Unsubscribe', ask: 'Stop receiving marketing emails from Jabr?', btn: 'Unsubscribe', done: 'Done — you will no longer receive marketing emails. Account emails (like password resets) will still arrive. You can opt back in under "My account".', bad: 'This link is not valid.', back: 'Back to Jabr' },
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
function page(reply: FastifyReply, lang: Lang, body: string) {
  const T = PAGE[lang]
  return reply.type('text/html; charset=utf-8').header('cache-control', 'no-store').send(`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${T.title} · Jabr</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#090A13;background-image:radial-gradient(60rem 30rem at 100% -10%,rgba(255,122,26,.18),transparent 60%),radial-gradient(50rem 30rem at -10% 110%,rgba(240,38,47,.16),transparent 60%);font:15px/1.6 Inter,'Segoe UI',Roboto,Arial,sans-serif;color:#C3C6DC;padding:16px}
.c{max-width:440px;width:100%;background:#10122A;border:1px solid #23263F;border-radius:20px;padding:32px}.l{font:800 28px/1 Montserrat,Inter,Arial,sans-serif;color:#fff;letter-spacing:-1px;text-decoration:none}.l span{color:#FF7A1A}
h1{font:800 22px/1.3 Montserrat,Inter,Arial,sans-serif;color:#F3F4FB;margin:22px 0 10px}.b{display:inline-block;border:0;cursor:pointer;margin-top:18px;padding:13px 24px;border-radius:12px;font:700 15px/1 Inter,Arial,sans-serif;color:#fff;background:linear-gradient(135deg,#EE1D2C,#FF4D1F 52%,#FF8A1A);text-decoration:none}.m{color:#8C90AE;font-size:13px}</style></head>
<body><div class="c"><a class="l" href="${esc(base() || '/')}">Jabr<span>.</span></a>${body}</div></body></html>`)
}
async function unsubscribe(uid: string) {
  const u = await loadDoc(`users/${uid}`)
  if (!u) return
  const now = Date.now()
  await commit(BYPASS, [
    { op: 'update', path: `users/${uid}`, data: { marketing: false, marketingAt: ts(now) } },
    { op: 'set', path: `consents/${randomBytes(10).toString('hex')}`, data: { uid, type: 'marketing', granted: false, version: 'unsubscribe-link', at: ts(now) } },
  ])
}

export function mailRoutes(app: FastifyInstance) {
  // Gmail/Apple "bir kliklə abunəlikdən çıx" POST-u form-urlencoded göndərir
  if (!app.hasContentTypeParser('application/x-www-form-urlencoded')) {
    app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string', bodyLimit: 4096 }, (_r, body, done) => done(null, body))
  }

  // Xoş gəldin: qeydiyyat (onboarding) bitəndə klient çağırır; hər istifadəçiyə yalnız bir dəfə
  app.post<{ Body: { lang?: string } }>('/api/mail/welcome', { preHandler: limit('welcome', 5, 600_000) }, async (req) => {
    const auth = await caller(req)
    const u = await loadDoc(`users/${auth.uid}`)
    if (!u || u.onboarded !== true) return { sent: false, reason: 'no-profile' }
    const flags = await loadDoc(`mailFlags/${auth.uid}`)
    if (flags?.welcome) return { sent: false, reason: 'already' }
    const r = await pool.query<{ email: string | null }>('select email from auth_users where uid = $1', [auth.uid])
    const to = r.rows[0]?.email || (typeof u.email === 'string' ? u.email : '')
    if (!to) return { sent: false, reason: 'no-email' }
    // bayraq əvvəlcə yazılır — paralel sorğularda iki məktub getməsin
    await commit(BYPASS, [{ op: 'set', path: `mailFlags/${auth.uid}`, data: { welcome: ts(Date.now()) }, merge: true }])
    const student = u.type === 'student'
    let trialEnds: Date | null = null
    let trial = false
    if (!student) {
      const a = await loadDoc(`admins/${auth.uid}`)
      trial = a?.source === 'signup' && !millis(a.licenseUntil)
      if (trial) trialEnds = new Date(millis(a?.trialEndsAt) || (millis(a?.createdAt) || Date.now()) + 3 * 86_400_000)
    }
    const m = welcomeEmail(pickLang(req.body?.lang ?? u.lang), { name: String(u.firstName ?? '').trim(), student, trialEnds, trial }, base())
    const res = await sendMail(to, m.subject, m.text, m.html, { tags: ['welcome'] })
    return { sent: res.sent }
  })

  // ---- kampaniyalar (super admin) ----
  app.post<{ Body: { filter: unknown } }>('/api/campaigns/audience', { preHandler: limit('camp-aud', 60, 60_000) }, async (req) => {
    await requireSuper(req)
    const { list, noConsent, noConsentEmails, notFound, excluded } = await audience(parseFilter(req.body?.filter))
    // tam siyahı (5000-ə qədər) — panelda axtarış və əl ilə çıxarmaq üçün
    const rows = list.slice(0, 5000).map((r) => ({ email: r.email, name: r.name, type: r.type, tier: r.tier, lang: r.lang, until: r.until ?? null }))
    return { count: list.length, noConsent, noConsentEmails, notFound, excluded, sample: rows }
  })
  app.post<{ Body: { content: unknown; filter?: unknown } }>('/api/campaigns/preview', { preHandler: limit('camp-prev', 120, 60_000) }, async (req) => {
    const auth = await requireSuper(req)
    const content = parseContent(req.body?.content)
    const me = await loadDoc(`users/${auth.uid}`)
    const f = parseFilter(req.body?.filter)
    const one = await singleTarget(f)
    const m = campaignEmail(content, { name: one ? one.name : String(me?.firstName ?? 'Aysel'), until: one ? one.until : sampleUntil(f, await loadDoc(`admins/${auth.uid}`)), unsubscribe: f.kind === 'marketing' ? unsubUrl(auth.uid) : undefined }, base())
    return { subject: m.subject, html: m.html }
  })
  app.post<{ Body: { content: unknown; filter: unknown; test?: boolean } }>('/api/campaigns/send', { preHandler: limit('camp-send', 20, 600_000) }, async (req) => {
    const auth = await requireSuper(req)
    const content = parseContent(req.body?.content)
    const filter = parseFilter(req.body?.filter)
    if (req.body?.test) {
      const r = await pool.query<{ email: string | null }>('select email from auth_users where uid = $1', [auth.uid])
      const to = r.rows[0]?.email
      if (!to) throw fail('auth/invalid-email')
      const me = await loadDoc(`users/${auth.uid}`)
      const one = await singleTarget(filter)
      const until = one ? one.until : sampleUntil(filter, await loadDoc(`admins/${auth.uid}`))
      const m = campaignEmail(content, { name: one ? one.name : String(me?.firstName ?? ''), until, unsubscribe: filter.kind === 'marketing' ? unsubUrl(auth.uid) : undefined }, base())
      const res = await sendMail(to, `[TEST] ${m.subject}`, m.text, m.html)
      return { test: true, to, ...res }
    }
    const { list } = await audience(filter)
    if (!list.length) throw fail('empty-audience')
    if (list.length > 20000) throw fail('audience-too-large')
    const running = await pool.query("select 1 from docs where parent = 'campaigns' and data->>'status' = 'sending' and updated_at > now() - interval '30 minutes' limit 1")
    if (running.rowCount) throw fail('campaign-running', 409)
    const id = `${Date.now().toString(36)}${randomBytes(4).toString('hex')}`
    await commit(BYPASS, [{ op: 'set', path: `campaigns/${id}`, data: {
      subject: content.subject, title: content.title, lang: content.lang, filter: filter as unknown as J, kind: filter.kind,
      total: list.length, sent: 0, failed: 0, status: 'sending', by: auth.uid, createdAt: ts(Date.now()), updatedAt: ts(Date.now()),
    } }])
    void runCampaign(id, content, list, filter.kind).catch((e) => console.error('[campaign]', id, e))
    return { id, total: list.length }
  })
  app.get('/api/campaigns', async (req) => {
    await requireSuper(req)
    const r = await pool.query<{ id: string; data: Doc }>("select id, data from docs where parent = 'campaigns' order by created_at desc limit 30")
    return { items: r.rows.map(({ id, data: d }) => ({ id, subject: d.subject, kind: d.kind, lang: d.lang, total: d.total, sent: d.sent, failed: d.failed, status: d.status, errors: d.errors ?? [], createdAt: millis(d.createdAt) })) }
  })

  // ---- göndərmə provayderi (super admin: Ayarlar) ----
  app.get('/api/mail/config', async (req) => {
    await requireSuper(req)
    return { ...(await mailConfig()), brevoConfigured: !!process.env.BREVO_API_KEY }
  })
  app.post<{ Body: { provider?: string; fallback?: boolean } }>('/api/mail/config', { preHandler: limit('mail-cfg', 30, 600_000) }, async (req) => {
    const auth = await requireSuper(req)
    const provider = req.body?.provider === 'smtp' ? 'smtp' : 'brevo'
    const fallback = req.body?.fallback !== false
    await commit(BYPASS, [{ op: 'set', path: 'mailConfig/main', data: { provider, fallback, updatedAt: ts(Date.now()), updatedBy: auth.uid } }])
    resetMailConfigCache()
    return { provider, fallback, brevoConfigured: !!process.env.BREVO_API_KEY }
  })
  // Öz mail serverinin hazırlıq yoxlaması: SMTP, DKIM, SPF, PTR, 25-ci port
  app.get('/api/mail/diagnostics', { preHandler: limit('mail-diag', 30, 600_000) }, async (req) => {
    await requireSuper(req)
    return diagnostics()
  })

  // ---- abunəlikdən çıxma ----
  app.get<{ Querystring: { t?: string } }>('/api/mail/unsubscribe', async (req, reply) => {
    const uid = verifyUnsub(String(req.query.t ?? ''))
    const lang = uid ? pickLang((await loadDoc(`users/${uid}`))?.lang) : 'az'
    const T = PAGE[lang]
    if (!uid) return page(reply, lang, `<h1>${T.title}</h1><p>${T.bad}</p>`)
    // GET heç nəyi dəyişmir (poçt skanerləri keçidləri açır) — təsdiq düyməsi POST göndərir
    return page(reply, lang, `<h1>${T.title}</h1><p>${T.ask}</p><form method="post"><input type="hidden" name="t" value="${esc(String(req.query.t))}"><button class="b" type="submit">${T.btn}</button></form>`)
  })
  app.post<{ Querystring: { t?: string } }>('/api/mail/unsubscribe', { preHandler: limit('unsub', 30, 600_000) }, async (req, reply) => {
    const form = typeof req.body === 'string' ? new URLSearchParams(req.body) : null
    const token = String(req.query.t ?? form?.get('t') ?? '')
    const uid = verifyUnsub(token)
    const lang = uid ? pickLang((await loadDoc(`users/${uid}`))?.lang) : 'az'
    const T = PAGE[lang]
    if (!uid) return reply.code(400).send({ ok: false })
    await unsubscribe(uid)
    if (form?.get('List-Unsubscribe') === 'One-Click') return { ok: true }
    return page(reply, lang, `<h1>✓ ${T.title}</h1><p>${T.done}</p><a class="b" href="${esc(base() || '/')}">${T.back}</a>`)
  })
}

// ---------- öz mail serverinin diaqnostikası ----------
export interface Check { id: 'smtp' | 'port25' | 'aRecord' | 'ptr' | 'spf' | 'dkim' | 'dmarc'; ok: boolean; value?: string; expected?: { type: string; name: string; value: string } }
const DOMAIN = () => (process.env.MAIL_FROM ?? 'noreply@jabr.az').split('@')[1] ?? 'jabr.az'
const HOST = () => process.env.MAIL_HOSTNAME ?? `mail.${DOMAIN()}`
const SELECTOR = () => process.env.DKIM_SELECTOR ?? 'jabr'
const txt = async (name: string) => (await dns.resolveTxt(name).catch(() => [] as string[][])).map((r) => r.join(''))

function port25(): Promise<{ ok: boolean; value: string }> {
  return new Promise((resolve) => {
    const s = net.connect({ host: 'gmail-smtp-in.l.google.com', port: 25 })
    const done = (ok: boolean, value: string) => { s.destroy(); resolve({ ok, value }) }
    s.setTimeout(8000, () => done(false, 'timeout'))
    s.once('data', (b) => done(b.toString().startsWith('220'), b.toString().slice(0, 60).trim()))
    s.once('error', (e) => done(false, e.message))
  })
}

export async function diagnostics() {
  const ip = process.env.SERVER_IP ?? ''
  const domain = DOMAIN(), host = HOST(), sel = SELECTOR()
  const checks: Check[] = []
  // 1) Postfix konteyneri cavab verir?
  checks.push(await smtp().verify().then(() => ({ id: 'smtp' as const, ok: true, value: `${process.env.SMTP_HOST ?? 'mail'}:${process.env.SMTP_PORT ?? 587}` }), (e: Error) => ({ id: 'smtp' as const, ok: false, value: e.message.slice(0, 120) })))
  // 2) Çıxan 25-ci port (Contabo bəzən bağlayır)
  checks.push({ id: 'port25', ...(await port25()) })
  // 3) mail.<domen> A qeydi → server IP
  const a = await dns.resolve4(host).catch(() => [] as string[])
  checks.push({ id: 'aRecord', ok: !!ip && a.includes(ip), value: a.join(', ') || '—', expected: { type: 'A', name: host, value: ip || '<server IP>' } })
  // 4) PTR (rDNS) — Contabo panelində təyin olunur
  const ptr = ip ? await dns.reverse(ip).catch(() => [] as string[]) : []
  checks.push({ id: 'ptr', ok: ptr.some((p) => p.replace(/\.$/, '').toLowerCase() === host), value: ptr.join(', ') || '—', expected: { type: 'PTR', name: ip || '<server IP>', value: host } })
  // 5) SPF: server IP icazəlidir?
  const spf = (await txt(domain)).find((r) => r.toLowerCase().startsWith('v=spf1')) ?? ''
  const spfOk = !!ip && spf.includes(`ip4:${ip}`)
  const spfWant = spf ? (spfOk ? spf : spf.replace(/^v=spf1/i, `v=spf1 ip4:${ip || '<server IP>'}`)) : `v=spf1 ip4:${ip || '<server IP>'} include:spf.brevo.com include:_spf.mx.cloudflare.net ~all`
  checks.push({ id: 'spf', ok: spfOk, value: spf || '—', expected: { type: 'TXT', name: domain, value: spfWant } })
  // 6) DKIM: konteynerin yaratdığı açar DNS-də dərc olunub?
  const raw = await readFile(`${process.env.DKIM_DIR ?? '/dkim'}/${domain}.${sel}.txt`, 'utf8').catch(() => '')
  const p = (raw.match(/"([^"]*)"/g) ?? []).map((x) => x.slice(1, -1)).join('').replace(/\s+/g, ' ').trim()
  const pub = (await txt(`${sel}._domainkey.${domain}`)).join('')
  const key = (v: string) => (v.match(/p=([A-Za-z0-9+/=]+)/) ?? [])[1] ?? ''
  checks.push({ id: 'dkim', ok: !!key(p) && key(pub) === key(p), value: pub ? `${pub.slice(0, 40)}…` : '—', expected: { type: 'TXT', name: `${sel}._domainkey.${domain}`, value: p || '(açar hələ yaradılmayıb — mail konteyneri işə düşəndə yaranır)' } })
  // 7) DMARC
  const dmarc = (await txt(`_dmarc.${domain}`)).find((r) => r.toLowerCase().startsWith('v=dmarc1')) ?? ''
  checks.push({ id: 'dmarc', ok: !!dmarc, value: dmarc || '—', expected: { type: 'TXT', name: `_dmarc.${domain}`, value: dmarc || `v=DMARC1; p=none; rua=mailto:office@${domain}` } })
  return { ip, host, domain, checks, ready: checks.every((c) => c.ok) }
}
