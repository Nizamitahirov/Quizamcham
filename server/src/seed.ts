/**
 * Hazır ictimai quizlər (server/seed/catalog.json) kataloqa yazılır — yalnız olmayanlar.
 * Super admin sonradan dəyişsə/gizlətsə, təkrar işə salma onları dəyişmir. Köçürmədən sonra da işə düşür.
 *   node dist/seed.js
 */
import { readFileSync } from 'node:fs'
import { migrate, pool } from './store.js'

const items = JSON.parse(readFileSync(new URL('../seed/catalog.json', import.meta.url), 'utf8')) as { id: string; data: Record<string, unknown> }[]
await migrate()
let added = 0
for (const it of items) {
  const r = await pool.query(
    "insert into docs (path, parent, id, data) values ($1, 'catalog', $2, $3) on conflict (path) do nothing",
    [`catalog/${it.id}`, it.id, JSON.stringify({ ...it.data, publishedAt: { __t: Date.now() } })],
  )
  added += r.rowCount ?? 0
}
console.log(JSON.stringify({ ok: true, seed: items.length, added }))
await pool.end()
