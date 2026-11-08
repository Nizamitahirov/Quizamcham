/**
 * Firebase → Jabr köçürmə, 2-ci addım: NDJSON (scripts/migrate/export.mjs) bazaya yazılır.
 *   docker compose exec -T api node dist/import.js < dump.ndjson
 * Sənədlər: tam əvəzlənir (bir tranzaksiyada köhnələr silinir, yenilər yazılır) — təkrar işə salmaq təhlükəsizdir.
 * Hesablar: uid saxlanılır; mövcud olanlar yenilənir, sessiyalara toxunulmur. Dump natamamdırsa heç nə dəyişmir.
 */
import { createInterface } from 'node:readline'
import { migrate, pool } from './store.js'
import { migrateAuth } from './auth.js'

interface UserLine {
  uid: string; email: string | null; providers: string[]; disabled: boolean; displayName: string | null; photoURL: string | null
  passwordHash: string | null; passwordSalt: string | null; googleSub: string | null; createdAt: number | null
}

await migrate()
await migrateAuth()
const client = await pool.connect()
let docs = 0, users = 0
let meta: { docs?: number; users?: number } | null = null
try {
  await client.query('begin')
  await client.query('truncate docs')
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity })
  for await (const line of rl) {
    if (!line.trim()) continue
    const o = JSON.parse(line)
    if (o.k === 'doc') {
      const parts = String(o.path).split('/')
      await client.query('insert into docs (path, parent, id, data) values ($1, $2, $3, $4)',
        [o.path, parts.slice(0, -1).join('/'), parts[parts.length - 1], JSON.stringify(o.data)])
      docs++
    } else if (o.k === 'user') {
      const u = o as UserLine
      const hash = u.passwordHash && u.passwordSalt ? `fbscrypt$${u.passwordSalt}$${u.passwordHash}` : null
      const provider = u.providers.includes('password') ? 'password' : u.providers.includes('google.com') ? 'google.com' : (u.providers[0] ?? 'password')
      await client.query(
        `insert into auth_users (uid, email, password_hash, provider, google_sub, display_name, photo_url, disabled, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, coalesce(to_timestamp($9::double precision / 1000), now()))
         on conflict (uid) do update set email = excluded.email, provider = excluded.provider, disabled = excluded.disabled,
           google_sub = coalesce(auth_users.google_sub, excluded.google_sub),
           display_name = coalesce(excluded.display_name, auth_users.display_name),
           photo_url = coalesce(excluded.photo_url, auth_users.photo_url),
           password_hash = case when auth_users.password_hash like 'scrypt$%' then auth_users.password_hash else excluded.password_hash end`,
        [u.uid, u.email, hash, provider, u.googleSub, u.displayName, u.photoURL, u.disabled, u.createdAt],
      )
      users++
    } else if (o.k === 'meta') meta = o
  }
  if (!meta) throw new Error('dump natamamdır (meta sətri yoxdur) — heç nə dəyişdirilmədi')
  if (meta.docs !== docs || meta.users !== users) throw new Error(`say uyğun deyil: ${docs}/${meta.docs} sənəd, ${users}/${meta.users} istifadəçi`)
  await client.query('commit')
  console.log(JSON.stringify({ ok: true, docs, users }))
} catch (e) {
  await client.query('rollback').catch(() => {})
  console.error('import failed:', (e as Error).message)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
