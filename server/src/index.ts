/**
 * Jabr API — Firebase-in əvəzi.
 *  /api/health          sağlamlıq yoxlaması
 *  /api/auth/*          giriş (anonim, e-poçt+şifrə, Google), sessiyalar, şifrə sıfırlama
 *  /api/db/get|query|count|commit   sənəd anbarı (bütün əməliyyatlar Security Rules portu ilə yoxlanılır)
 *  /api/ws              realtime abunələr
 */
import Fastify, { type FastifyReply } from 'fastify'
import { authFrom, authRoutes, bearer, migrateAuth, testHeader } from './auth.js'
import { realtimeRoutes, realtimeStats } from './realtime.js'
import { limit } from './ratelimit.js'
import { aiRoutes, migrateAi } from './ai.js'
import { mailRoutes } from './campaigns.js'
import { learnRoutes } from './learn.js'
import { fileRoutes, migrateFiles } from './files.js'
import { clearAll, commit, DbError, getDoc, migrate, pool, runQuery, type Query, type Write } from './store.js'

const PORT = Number(process.env.PORT ?? 3000)
const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' }, trustProxy: true, bodyLimit: 4 * 1024 * 1024 })
const startedAt = new Date()

const STATUS: Record<string, number> = { 'permission-denied': 403, 'not-found': 404, 'invalid-argument': 400, 'failed-precondition': 412, unauthenticated: 401 }
app.setErrorHandler((e: Error & { statusCode?: number; code?: string }, _req, reply: FastifyReply) => {
  if (e instanceof DbError) return reply.code(STATUS[e.code] ?? 400).send({ code: e.code, message: e.message })
  if (e.code?.startsWith('auth/') || e.code?.startsWith('ai-') || e.code === 'plan-required') return reply.code(e.statusCode ?? 400).send({ code: e.code, message: e.message })
  if (e.code && e.statusCode && ['unauthenticated', 'permission-denied', 'invalid-argument'].includes(e.code)) return reply.code(e.statusCode).send({ code: e.code, message: e.message })
  if (e.statusCode && e.statusCode < 500) return reply.code(e.statusCode).send({ code: 'invalid-argument', message: e.message })
  app.log.error(e)
  return reply.code(500).send({ code: 'internal', message: 'internal error' })
})

app.get('/api/health', async (_req, reply) => {
  try {
    const r = await pool.query<{ ok: number }>('select 1 as ok')
    return { ok: true, service: 'jabr-api', startedAt, realtime: realtimeStats(), db: { ok: !!r.rows[0] } }
  } catch (e) {
    app.log.error(e)
    reply.code(503)
    return { ok: false, service: 'jabr-api', db: { ok: false } }
  }
})
app.get('/api/time', async () => ({ now: Date.now() }))

const caller = (req: Parameters<typeof bearer>[0]) => authFrom(bearer(req), testHeader(req))

// sürət limiti: sessiya (və ya IP) üzrə — bir sinifdə hamı eyni IP-dən gələ bilər, ona görə əsas açar tokendir
const who = (r: Parameters<typeof bearer>[0]) => bearer(r)?.slice(0, 24) ?? `ip:${r.ip}`
const readLimit = limit('db-read', 1200, 60_000, who), writeLimit = limit('db-write', 600, 60_000, who), ipLimit = limit('db-ip', 20_000, 60_000)
app.addHook('preHandler', async (req) => {
  if (!req.url.startsWith('/api/db/') || testHeader(req)) return // test rejimi (ALLOW_TEST_AUTH) istehsalda heç vaxt açıq deyil
  await ipLimit(req)
  await (req.url.startsWith('/api/db/commit') ? writeLimit : readLimit)(req)
})
app.post<{ Body: { path: string } }>('/api/db/get', async (req) => ({ data: await getDoc(await caller(req), String(req.body?.path)) }))
app.post<{ Body: { query: Query } }>('/api/db/query', async (req) => ({ docs: await runQuery(await caller(req), req.body.query) }))
app.post<{ Body: { query: Query } }>('/api/db/count', async (req) => ({ count: (await runQuery(await caller(req), req.body.query)).length }))
app.post<{ Body: { writes: Write[] } }>('/api/db/commit', async (req) => commit(await caller(req), req.body?.writes))

if (process.env.ALLOW_TEST_AUTH === '1') {
  app.post('/api/test/clear', async () => { await clearAll(); return { ok: true } })
}

authRoutes(app)
aiRoutes(app)
mailRoutes(app)
learnRoutes(app)
fileRoutes(app)
await realtimeRoutes(app)

const shutdown = async () => { await app.close(); await pool.end(); process.exit(0) }
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

await migrate()
await migrateAuth()
await migrateAi()
await migrateFiles()
await app.listen({ port: PORT, host: process.env.HOST ?? '0.0.0.0' })
