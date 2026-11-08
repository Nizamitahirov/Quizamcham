/**
 * Sadə yaddaşdaxili sürət limiti (bir server üçün kifayətdir).
 * Sinif otaqlarında bütün oyunçular eyni IP-dən gəlir, ona görə anonim giriş limiti genişdir.
 */
import type { FastifyRequest } from 'fastify'

const buckets = new Map<string, { n: number; reset: number }>()
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k) }, 60_000).unref()

export function limit(name: string, max: number, windowMs: number, key: (req: FastifyRequest) => string = (r) => r.ip) {
  return async (req: FastifyRequest) => {
    const k = `${name}:${key(req)}`
    const now = Date.now()
    const b = buckets.get(k)
    if (!b || b.reset < now) { buckets.set(k, { n: 1, reset: now + windowMs }); return }
    if (++b.n > max) throw Object.assign(new Error('auth/too-many-requests'), { statusCode: 429, code: 'auth/too-many-requests' })
  }
}
