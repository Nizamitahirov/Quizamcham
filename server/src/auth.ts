/**
 * Giriş sistemi (Firebase Auth-un əvəzi): anonim oyunçu, e-poçt + şifrə, Google, sessiyalar, şifrə sıfırlama.
 * Şifrələr scrypt ilə hash-lənir; sessiya tokeni bazada yalnız SHA-256 hash kimi saxlanılır.
 */
import { createCipheriv, createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { pool } from './store.js'
import type { Auth } from './rules.js'
import { limit } from './ratelimit.js'

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>
const TEST_AUTH = process.env.ALLOW_TEST_AUTH === '1' // YALNIZ testlər üçün — istehsalda heç vaxt
const SESSION_DAYS = 90

export async function migrateAuth() {
  await pool.query(`
    create table if not exists auth_users (
      uid text primary key,
      email text unique,
      password_hash text,
      provider text not null,
      google_sub text unique,
      display_name text,
      photo_url text,
      disabled boolean not null default false,
      created_at timestamptz not null default now(),
      last_login_at timestamptz
    );
    create table if not exists sessions (
      id text primary key,
      uid text not null references auth_users(uid) on delete cascade,
      provider text not null,
      created_at timestamptz not null default now(),
      expires_at timestamptz not null
    );
    create index if not exists sessions_uid on sessions (uid);
    create table if not exists password_resets (
      id text primary key,
      uid text not null references auth_users(uid) on delete cascade,
      expires_at timestamptz not null,
      used boolean not null default false
    );
  `)
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex')
/** Firebase uid-ləri ilə eyni format: 28 simvol. */
export const newUid = () => randomBytes(21).toString('base64url').slice(0, 28)
const newToken = () => randomBytes(32).toString('base64url')

export async function hashPassword(pw: string) {
  const salt = randomBytes(16)
  const key = await scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 })
  return `scrypt$16384$8$1$${salt.toString('base64')}$${key.toString('base64')}`
}
/**
 * Firebase-dən köçürülmüş şifrələr: "fbscrypt$<salt>$<hash>" (Firebase-in dəyişdirilmiş scrypt alqoritmi).
 * Parametrlər Firebase konsolundan (Authentication → Password hash parameters) — yalnız serverin .env faylında:
 * FIREBASE_HASH_CONFIG (konsoldakı hash_config blokunun özü).
 */
function firebaseHashParams() {
  const raw = process.env.FIREBASE_HASH_CONFIG ?? ''
  const pick = (k: string) => raw.match(new RegExp(`${k}\\s*[:=]\\s*"?([^",\\s}]+)`))?.[1]
  const key = pick('base64_signer_key'), sep = pick('base64_salt_separator'), rounds = pick('rounds'), mem = pick('mem_cost')
  if (!key || !sep || !rounds || !mem) return null
  return { key: Buffer.from(key, 'base64'), sep: Buffer.from(sep, 'base64'), rounds: Number(rounds), mem: Number(mem) }
}
export async function verifyFirebase(pw: string, salt: string, hash: string) {
  const p = firebaseHashParams()
  if (!p) return false
  const derived = await scrypt(pw, Buffer.concat([Buffer.from(salt, 'base64'), p.sep]), 32, { N: 2 ** p.mem, r: p.rounds, p: 1, maxmem: 256 * 1024 * 1024 })
  const c = createCipheriv('aes-256-ctr', derived, Buffer.alloc(16, 0))
  const out = Buffer.concat([c.update(p.key), c.final()])
  const want = Buffer.from(hash, 'base64')
  return want.length === out.length && timingSafeEqual(want, out)
}

async function verifyPassword(pw: string, stored: string | null, uid?: string) {
  if (stored?.startsWith('fbscrypt$')) {
    const [, salt, hash] = stored.split('$')
    const ok = await verifyFirebase(pw, salt, hash)
    // uğurlu girişdə öz formatımıza keçirilir
    if (ok && uid) await pool.query('update auth_users set password_hash = $2 where uid = $1', [uid, await hashPassword(pw)])
    return ok
  }
  if (!stored?.startsWith('scrypt$')) return false
  const [, N, r, p, salt, hash] = stored.split('$')
  const key = await scrypt(pw, Buffer.from(salt, 'base64'), 64, { N: Number(N), r: Number(r), p: Number(p) })
  const want = Buffer.from(hash, 'base64')
  return want.length === key.length && timingSafeEqual(want, key)
}

export interface UserRow { uid: string; email: string | null; provider: string; display_name: string | null; photo_url: string | null; disabled: boolean; password_hash?: string | null }
const publicUser = (u: UserRow) => ({
  uid: u.uid, email: u.email, displayName: u.display_name, photoURL: u.photo_url,
  isAnonymous: u.provider === 'anonymous', provider: u.provider,
})

async function issueSession(u: UserRow, provider = u.provider) {
  const token = newToken()
  await pool.query(`insert into sessions (id, uid, provider, expires_at) values ($1, $2, $3, now() + interval '${SESSION_DAYS} days')`, [sha(token), u.uid, provider])
  await pool.query('update auth_users set last_login_at = now() where uid = $1', [u.uid])
  return { token, user: { ...publicUser(u), provider, isAnonymous: provider === 'anonymous' } }
}

/** Sorğudan istifadəçini müəyyən edir (Bearer token; testlərdə x-test-auth). */
export async function authFrom(token: string | undefined, testHeader?: string): Promise<{ auth: Auth | null; bypass: boolean }> {
  if (TEST_AUTH && testHeader) {
    if (testHeader === 'bypass') return { auth: null, bypass: true }
    if (testHeader === 'none') return { auth: null, bypass: false }
    const t = JSON.parse(Buffer.from(testHeader, 'base64').toString('utf8')) as { uid: string; token?: Record<string, unknown> }
    const claims = t.token ?? {}
    const fb = (claims.firebase as { sign_in_provider?: string } | undefined) ?? {}
    return { auth: { uid: t.uid, token: { ...claims, email: claims.email as string | undefined, firebase: { sign_in_provider: fb.sign_in_provider ?? 'custom' } } }, bypass: false }
  }
  if (!token) return { auth: null, bypass: false }
  const r = await pool.query<UserRow & { sp: string }>(
    `select u.*, s.provider as sp from sessions s join auth_users u on u.uid = s.uid
     where s.id = $1 and s.expires_at > now() and not u.disabled`, [sha(token)])
  const u = r.rows[0]
  if (!u) return { auth: null, bypass: false }
  return { auth: { uid: u.uid, token: { email: u.email ?? undefined, firebase: { sign_in_provider: u.sp } } }, bypass: false }
}

export const bearer = (req: FastifyRequest) => {
  const h = req.headers.authorization
  return h?.startsWith('Bearer ') ? h.slice(7) : undefined
}
export const testHeader = (req: FastifyRequest) => (TEST_AUTH ? (req.headers['x-test-auth'] as string | undefined) : undefined)

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const err = (code: string, status = 400) => Object.assign(new Error(code), { statusCode: status, code })

export function authRoutes(app: FastifyInstance) {
  // Anonim oyunçu
  app.post('/api/auth/anonymous', { preHandler: limit('anon', 300, 60_000) }, async () => {
    const uid = newUid()
    const r = await pool.query<UserRow>("insert into auth_users (uid, provider) values ($1, 'anonymous') returning *", [uid])
    return issueSession(r.rows[0])
  })

  // E-poçt + şifrə ilə hesab yaratmaq (admin üzv yaradanda ikinci "app" ilə çağırılır)
  app.post<{ Body: { email: string; password: string; displayName?: string } }>('/api/auth/signup', { preHandler: limit('signup', 20, 600_000) }, async (req) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase()
    const pw = String(req.body?.password ?? '')
    if (!EMAIL.test(email)) throw err('auth/invalid-email')
    if (pw.length < 6) throw err('auth/weak-password')
    const exists = await pool.query('select 1 from auth_users where email = $1', [email])
    if (exists.rowCount) throw err('auth/email-already-in-use')
    const r = await pool.query<UserRow>("insert into auth_users (uid, email, password_hash, provider, display_name) values ($1, $2, $3, 'password', $4) returning *",
      [newUid(), email, await hashPassword(pw), req.body?.displayName ?? null])
    return issueSession(r.rows[0])
  })

  app.post<{ Body: { email: string; password: string } }>('/api/auth/signin', { preHandler: [limit('signin-ip', 60, 600_000), limit('signin', 10, 600_000, (r) => `${r.ip}:${String((r.body as { email?: string } | undefined)?.email ?? '').toLowerCase()}`)] }, async (req) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase()
    const r = await pool.query<UserRow>('select * from auth_users where email = $1 and password_hash is not null', [email])
    const u = r.rows[0]
    if (!u || !(await verifyPassword(String(req.body?.password ?? ''), u.password_hash ?? null, u.uid))) throw err('auth/invalid-credential', 401)
    if (u.disabled) throw err('auth/user-disabled', 403)
    return issueSession(u, 'password')
  })

  // Google: Google Identity Services ID tokeni yoxlanılır
  app.post<{ Body: { idToken: string } }>('/api/auth/google', async (req) => {
    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) throw err('auth/operation-not-allowed', 503)
    const { OAuth2Client } = await import('google-auth-library')
    const ticket = await new OAuth2Client(clientId).verifyIdToken({ idToken: String(req.body?.idToken ?? ''), audience: clientId }).catch(() => null)
    const p = ticket?.getPayload()
    if (!p?.sub || !p.email || !p.email_verified) throw err('auth/invalid-credential', 401)
    const email = p.email.toLowerCase()
    let r = await pool.query<UserRow>('select * from auth_users where google_sub = $1', [p.sub])
    if (!r.rows[0]) {
      // köçürülmüş Google istifadəçisi (e-poçt üzrə) və ya yeni hesab
      // e-poçt Google tərəfindən təsdiqlənib — eyni e-poçtlu mövcud hesaba bağlanır (köçürülmüş istifadəçilər daxil)
      r = await pool.query<UserRow>("select * from auth_users where email = $1 and provider <> 'anonymous'", [email])
      if (r.rows[0]) await pool.query('update auth_users set google_sub = $1 where uid = $2', [p.sub, r.rows[0].uid])
      else r = await pool.query<UserRow>("insert into auth_users (uid, email, provider, google_sub, display_name, photo_url) values ($1, $2, 'google.com', $3, $4, $5) returning *",
        [newUid(), email, p.sub, p.name ?? null, p.picture ?? null])
    }
    const u = r.rows[0]
    if (u.disabled) throw err('auth/user-disabled', 403)
    await pool.query('update auth_users set display_name = coalesce($2, display_name), photo_url = coalesce($3, photo_url) where uid = $1', [u.uid, p.name ?? null, p.picture ?? null])
    return issueSession({ ...u, display_name: p.name ?? u.display_name, photo_url: p.picture ?? u.photo_url }, 'google.com')
  })

  app.get('/api/auth/me', async (req) => {
    const { auth } = await authFrom(bearer(req))
    if (!auth) throw err('auth/unauthenticated', 401)
    const r = await pool.query<UserRow>('select * from auth_users where uid = $1', [auth.uid])
    return { user: publicUser(r.rows[0]) }
  })

  app.post('/api/auth/signout', async (req) => {
    const t = bearer(req)
    if (t) await pool.query('delete from sessions where id = $1', [sha(t)])
    return { ok: true }
  })

  // Şifrə dəyişmə (cari şifrə ilə təsdiq)
  app.post<{ Body: { currentPassword: string; newPassword: string } }>('/api/auth/password', { preHandler: limit('pwchange', 10, 600_000) }, async (req) => {
    const { auth } = await authFrom(bearer(req))
    if (!auth) throw err('auth/unauthenticated', 401)
    const r = await pool.query<UserRow>('select * from auth_users where uid = $1', [auth.uid])
    const u = r.rows[0]
    if (!(await verifyPassword(String(req.body?.currentPassword ?? ''), u.password_hash ?? null, u.uid))) throw err('auth/wrong-password', 401)
    const pw = String(req.body?.newPassword ?? '')
    if (pw.length < 6) throw err('auth/weak-password')
    await pool.query('update auth_users set password_hash = $2 where uid = $1', [u.uid, await hashPassword(pw)])
    // digər sessiyalar bağlanır, cari qalır
    await pool.query('delete from sessions where uid = $1 and id <> $2', [u.uid, sha(bearer(req)!)])
    return { ok: true }
  })

  // Şifrə sıfırlama: link e-poçtla göndərilir (göndərmə mailer.ts-dən; hələlik jurnal)
  app.post<{ Body: { email: string } }>('/api/auth/reset/request', { preHandler: limit('reset', 5, 600_000, (r) => `${r.ip}:${String((r.body as { email?: string } | undefined)?.email ?? '').toLowerCase()}`) }, async (req) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase()
    const r = await pool.query<UserRow>('select * from auth_users where email = $1 and password_hash is not null', [email])
    if (r.rows[0]) {
      const token = newToken()
      await pool.query("insert into password_resets (id, uid, expires_at) values ($1, $2, now() + interval '1 hour')", [sha(token), r.rows[0].uid])
      const { sendMail } = await import('./mailer.js')
      const base = process.env.PUBLIC_URL ?? ''
      await sendMail(email, 'Jabr — şifrəni sıfırlama', `Şifrənizi sıfırlamaq üçün keçid (1 saat etibarlıdır):\n${base}/reset?token=${token}\n\nSiz istəməmisinizsə, bu məktubu nəzərə almayın.`)
    }
    return { ok: true } // e-poçtun mövcudluğu açıqlanmır
  })
  app.post<{ Body: { token: string; newPassword: string } }>('/api/auth/reset/confirm', { preHandler: limit('resetc', 20, 600_000) }, async (req) => {
    const pw = String(req.body?.newPassword ?? '')
    if (pw.length < 6) throw err('auth/weak-password')
    const r = await pool.query<{ uid: string }>("update password_resets set used = true where id = $1 and not used and expires_at > now() returning uid", [sha(String(req.body?.token ?? ''))])
    if (!r.rows[0]) throw err('auth/expired-action-code')
    await pool.query('update auth_users set password_hash = $2 where uid = $1', [r.rows[0].uid, await hashPassword(pw)])
    await pool.query('delete from sessions where uid = $1', [r.rows[0].uid])
    return { ok: true }
  })

  // Öz hesabını silmək (Firestore məlumatlarını klient əvvəlcədən silir)
  app.post('/api/auth/delete', async (req) => {
    const { auth } = await authFrom(bearer(req))
    if (!auth) throw err('auth/unauthenticated', 401)
    await pool.query('delete from auth_users where uid = $1', [auth.uid])
    return { ok: true }
  })
}
