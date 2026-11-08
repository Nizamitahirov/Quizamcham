/**
 * Jabr API — Firebase-in əvəzi (mərhələ 1: skelet).
 * Mərhələlər: sağlamlıq yoxlaması → giriş (Google/e-poçt/anonim) → məlumat API-ləri → WebSocket oyun mühərriki.
 */
import Fastify from 'fastify'
import pg from 'pg'

const PORT = Number(process.env.PORT ?? 3000)
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 })
const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' }, trustProxy: true })
const startedAt = new Date()

app.get('/api/health', async (_req, reply) => {
  try {
    const r = await pool.query<{ now: Date; version: string }>('select now() as now, version() as version')
    return { ok: true, service: 'jabr-api', startedAt, db: { ok: true, now: r.rows[0].now, version: r.rows[0].version.split(' ').slice(0, 2).join(' ') } }
  } catch (e) {
    reply.code(503)
    return { ok: false, service: 'jabr-api', db: { ok: false, error: (e as Error).message } }
  }
})

const shutdown = async () => { await app.close(); await pool.end(); process.exit(0) }
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

app.listen({ port: PORT, host: '0.0.0.0' }).catch((e) => { app.log.error(e); process.exit(1) })
