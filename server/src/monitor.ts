/**
 * Daxili monitorinq: hər 15 dəqiqədən bir disk yeri, ehtiyat nüsxəsinin yaşı/uğuru, kənar nüsxə və baza ölçüsü yoxlanılır.
 * Problem olanda ALERT_EMAIL ünvanına məktub gedir (eyni problem üçün 12 saatda bir dəfə). Bərpa olanda da xəbər verilir.
 * Super admin üçün vəziyyət: GET /api/monitor
 */
import { readFile, statfs } from 'node:fs/promises'
import type { FastifyInstance } from 'fastify'
import { authFrom, bearer, testHeader } from './auth.js'
import { sendMail } from './mailer.js'
import { SUPER } from './rules.js'
import { loadDoc, pool } from './store.js'

export interface Check { id: string; ok: boolean; level: 'ok' | 'warn' | 'crit'; text: string }
const HOUR = 3_600_000

async function disk(path: string, label: string): Promise<Check> {
  try {
    const s = await statfs(path)
    const free = s.bavail * s.bsize, total = s.blocks * s.bsize, pct = total ? (free / total) * 100 : 100
    const gb = (free / 1024 ** 3).toFixed(1)
    const level = pct < 5 || free < 1024 ** 3 ? 'crit' : pct < 12 ? 'warn' : 'ok'
    return { id: `disk:${label}`, ok: level === 'ok', level, text: `${label}: ${gb} GB boş (${pct.toFixed(0)}%)` }
  } catch { return { id: `disk:${label}`, ok: true, level: 'ok', text: `${label}: yoxlanılmadı` } }
}

/** /backups/status: "time=… file=… size=… offsite=ok|failed|off" (backup.sh yazır). */
async function backup(): Promise<Check[]> {
  const dir = process.env.BACKUPS_DIR
  if (!dir) return []
  const raw = await readFile(`${dir}/status`, 'utf8').catch(() => '')
  const kv = Object.fromEntries(raw.trim().split(/\s+/).filter(Boolean).map((x) => x.split('=') as [string, string]))
  const at = Number(kv.time ?? 0) * 1000, age = at ? (Date.now() - at) / HOUR : Infinity
  const out: Check[] = []
  if (!raw) out.push({ id: 'backup', ok: true, level: 'ok', text: 'Ehtiyat nüsxə: hələ ilk nüsxə yoxdur' })
  else if (kv.error || !kv.file) out.push({ id: 'backup', ok: false, level: 'crit', text: `Ehtiyat nüsxə alınmadı (${kv.error ?? 'naməlum'})` })
  else if (age > 30) out.push({ id: 'backup', ok: false, level: 'crit', text: `Son ehtiyat nüsxə ${Math.round(age)} saat əvvəldir` })
  else out.push({ id: 'backup', ok: true, level: 'ok', text: `Son nüsxə: ${kv.file} (${(Number(kv.size) / 1024 ** 2).toFixed(1)} MB, ${Math.round(age)} saat əvvəl)` })
  if (kv.offsite === 'failed') out.push({ id: 'offsite', ok: false, level: 'warn', text: 'Kənar saxlanca göndərmə alınmadı (S3 açarlarını yoxlayın)' })
  else if (kv.offsite === 'off') out.push({ id: 'offsite', ok: false, level: 'warn', text: 'Kənar ehtiyat nüsxə qurulmayıb — nüsxələr yalnız bu serverdədir' })
  else if (kv.offsite === 'ok') out.push({ id: 'offsite', ok: true, level: 'ok', text: 'Kənar nüsxə: göndərilib' })
  return out
}

async function database(): Promise<Check> {
  try {
    const r = await pool.query<{ s: string }>("select pg_database_size(current_database())::text as s")
    const mb = Number(r.rows[0].s) / 1024 ** 2
    return { id: 'db', ok: true, level: 'ok', text: `Baza: ${mb.toFixed(0)} MB` }
  } catch (e) { return { id: 'db', ok: false, level: 'crit', text: `Baza cavab vermir: ${(e as Error).message.slice(0, 120)}` } }
}

export async function runChecks(): Promise<Check[]> {
  const list = [await database(), await disk(process.env.FILES_DIR ?? '/data/files', 'Fayllar diski')]
  if (process.env.BACKUPS_DIR) list.push(await disk(process.env.BACKUPS_DIR, 'Ehtiyat diski'))
  return [...list, ...(await backup())]
}

// ───────── xəbərdarlıq (12 saatda bir; bərpa olanda bir dəfə)
const sent = new Map<string, number>()
async function alert(checks: Check[]) {
  const to = process.env.ALERT_EMAIL
  if (!to) return
  const now = Date.now()
  const bad = checks.filter((c) => !c.ok && c.level !== 'ok' && now - (sent.get(c.id) ?? 0) > 12 * HOUR)
  // kənar nüsxə qurulmayıbsa — yalnız həftədə bir xatırlatma
  const due = bad.filter((c) => !(c.id === 'offsite' && c.text.includes('qurulmayıb') && now - (sent.get(c.id) ?? 0) < 7 * 24 * HOUR))
  const healed = [...sent.keys()].filter((id) => checks.some((c) => c.id === id && c.ok))
  healed.forEach((id) => sent.delete(id))
  if (!due.length) return
  due.forEach((c) => sent.set(c.id, now))
  const crit = due.some((c) => c.level === 'crit')
  const lines = checks.map((c) => `${c.ok ? '✓' : c.level === 'crit' ? '✕' : '!'} ${c.text}`).join('\n')
  await sendMail(to, `${crit ? '🔴' : '🟠'} Jabr server: ${due.map((c) => c.text).join('; ').slice(0, 140)}`,
    `Jabr serverinin avtomatik yoxlaması problem tapdı:\n\n${due.map((c) => `• ${c.text}`).join('\n')}\n\nBütün yoxlamalar:\n${lines}\n\nVaxt: ${new Date().toISOString()}`,
    undefined, { tags: ['monitor'] }).catch(() => {})
}

export function startMonitor() {
  if (process.env.ALLOW_TEST_AUTH === '1') return // testlərdə yox
  const tick = () => { void runChecks().then(alert).catch((e) => console.error('[monitor]', e)) }
  setTimeout(tick, 60_000)
  setInterval(tick, 15 * 60_000).unref()
}

export function monitorRoutes(app: FastifyInstance) {
  app.get('/api/monitor', async (req) => {
    const { auth } = await authFrom(bearer(req), testHeader(req))
    const me = auth ? await loadDoc(`admins/${auth.uid}`) : null
    if (!auth || (auth.uid !== SUPER && me?.role !== 'super')) throw Object.assign(new Error('permission-denied'), { statusCode: 403, code: 'permission-denied' })
    return { checks: await runChecks(), at: Date.now() }
  })
}
