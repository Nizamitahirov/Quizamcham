/**
 * Tələbə: "Kurslarım" — başladığı kurslar (courses/{id}/progress/{uid} sənədləri üzrə).
 * Klient SDK-da collectionGroup sorğusu yoxdur; server yalnız çağıranın öz irəliləyişini oxuyur.
 */
import type { FastifyInstance } from 'fastify'
import { authFrom, bearer, testHeader } from './auth.js'
import { pool } from './store.js'
import type { Doc } from './values.js'

export function learnRoutes(app: FastifyInstance) {
  app.get('/api/learn/courses', async (req) => {
    const { auth } = await authFrom(bearer(req), testHeader(req))
    if (!auth) throw Object.assign(new Error('auth/unauthenticated'), { statusCode: 401, code: 'auth/unauthenticated' })
    const r = await pool.query<{ parent: string; data: Doc; course: Doc | null }>(
      `select p.parent, p.data, c.data as course from docs p
       left join docs c on c.path = split_part(p.parent, '/', 1) || '/' || split_part(p.parent, '/', 2)
       where p.parent like 'courses/%/progress' and p.id = $1 order by p.updated_at desc limit 50`, [auth.uid])
    const items = r.rows.filter((x) => x.course).map((x) => {
      const id = x.parent.split('/')[1]
      const course = { id, ...(x.course as Doc) } as Doc & { items?: { quizId: string }[] }
      const done = Array.isArray(x.data.done) ? (x.data.done as string[]) : []
      const n = (course.items ?? []).filter((i) => done.includes(i.quizId)).length
      return { course, done: n, completed: !!x.data.completedAt || (n > 0 && n === (course.items ?? []).length) }
    })
    return { items }
  })
}
