/**
 * Serverdə birdəfəlik/təkrarlana bilən məlumat düzəlişləri (hər deploy-da işə düşür, artıq düzəldilibsə heç nə etmir).
 *   node dist/maintenance.js
 */
import { pool } from './store.js'

const FIXES: { name: string; sql: string }[] = [
  // Köhnə təşkilat adı (AmCham) profil və oyun qeydlərindən çıxarılır
  { name: 'profiles.org: amcham', sql: `update docs set data = jsonb_set(data, '{org}', '""') where parent = 'profiles' and data->>'org' ilike '%amcham%'` },
  { name: 'games.host.org: amcham', sql: `update docs set data = jsonb_set(data, '{host,org}', '""') where parent = 'games' and data #>> '{host,org}' ilike '%amcham%'` },
  // köhnə anonim oyunçu hesabları (30 gündən çox girişsiz) və vaxtı keçmiş sessiyalar / sıfırlama linkləri
  { name: 'auth: stale anonymous', sql: `delete from auth_users where provider = 'anonymous' and coalesce(last_login_at, created_at) < now() - interval '30 days'` },
  { name: 'auth: expired sessions', sql: `delete from sessions where expires_at < now()` },
  { name: 'auth: old resets', sql: `delete from password_resets where expires_at < now() - interval '1 day'` },
]
const done: Record<string, number> = {}
for (const f of FIXES) done[f.name] = (await pool.query(f.sql)).rowCount ?? 0
console.log(JSON.stringify({ ok: true, maintenance: done }))
await pool.end()
