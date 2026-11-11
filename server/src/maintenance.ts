/**
 * Serverdə birdəfəlik/təkrarlana bilən məlumat düzəlişləri (hər deploy-da işə düşür, artıq düzəldilibsə heç nə etmir).
 *   node dist/maintenance.js
 */
import { pool } from './store.js'

const FIXES: { name: string; sql: string }[] = [
  // Köhnə təşkilat adı (AmCham) profil və oyun qeydlərindən çıxarılır
  { name: 'profiles.org: amcham', sql: `update docs set data = jsonb_set(data, '{org}', '""') where parent = 'profiles' and data->>'org' ilike '%amcham%'` },
  { name: 'games.host.org: amcham', sql: `update docs set data = jsonb_set(data, '{host,org}', '""') where parent = 'games' and data #>> '{host,org}' ilike '%amcham%'` },
]
const done: Record<string, number> = {}
for (const f of FIXES) done[f.name] = (await pool.query(f.sql)).rowCount ?? 0
console.log(JSON.stringify({ ok: true, maintenance: done }))
await pool.end()
