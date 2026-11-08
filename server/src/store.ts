/**
 * Sənəd anbarı (PostgreSQL) — Firestore modeli: kolleksiya/sənəd yolları, JSON sənədlər, sorğular, atomik batch yazılar.
 * Hər oxu və yazı rules.ts ilə yoxlanılır (bypass yalnız server daxili işlər və testlər üçündür).
 */
import { EventEmitter } from 'node:events'
import pg from 'pg'
import { allowed, type Auth, type Op } from './rules.js'
import { applyUpdate, isMap, mergeSet, resolve, type Doc, type J } from './values.js'

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 20 })
/** Dəyişiklik hadisələri: realtime abunələr üçün. */
export const changes = new EventEmitter()
changes.setMaxListeners(0)

export class DbError extends Error {
  constructor(public code: 'permission-denied' | 'not-found' | 'invalid-argument' | 'failed-precondition' | 'unauthenticated', message?: string) { super(message ?? code) }
}

export async function migrate() {
  await pool.query(`
    create table if not exists docs (
      path text primary key,
      parent text not null,
      id text not null,
      data jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index if not exists docs_parent on docs (parent);
    create index if not exists docs_data on docs using gin (data jsonb_path_ops);
  `)
}

// ---------- yollar ----------
const SEG = /^[^/]+$/
export function splitPath(path: string): string[] {
  const parts = path.split('/')
  if (!parts.length || parts.some((p) => !SEG.test(p) || p === '.' || p === '..')) throw new DbError('invalid-argument', `bad path: ${path}`)
  return parts
}
const docParts = (path: string) => {
  const parts = splitPath(path)
  if (parts.length % 2 !== 0) throw new DbError('invalid-argument', `not a document path: ${path}`)
  return { parts, parent: parts.slice(0, -1).join('/'), id: parts[parts.length - 1] }
}

export async function loadDoc(path: string, client: pg.Pool | pg.PoolClient = pool): Promise<Doc | null> {
  const r = await client.query<{ data: Doc }>('select data from docs where path = $1', [path])
  return r.rows[0]?.data ?? null
}

// ---------- oxu ----------
export interface Caller { auth: Auth | null; bypass?: boolean }

async function check(caller: Caller, op: Op, path: string, resource: Doc | null, next: Doc | null, time: number, load: (p: string) => Promise<Doc | null> = (p) => loadDoc(p)) {
  if (caller.bypass) return
  const ok = await allowed({ op, path: splitPath(path), resource, next, auth: caller.auth, time, load })
  if (!ok) throw new DbError('permission-denied', `Missing or insufficient permissions (${op} ${path})`)
}

export async function getDoc(caller: Caller, path: string) {
  docParts(path)
  const data = await loadDoc(path)
  await check(caller, 'get', path, data, null, Date.now())
  return data
}

export type Filter = { field: string; op: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains'; value: J }
export interface Query { parent: string; where?: Filter[]; orderBy?: { field: string; dir?: 'asc' | 'desc' }[]; limit?: number }

const fieldPath = (f: string) => f.split('.')
const OPS: Record<string, string> = { '==': '=', '!=': '<>', '<': '<', '<=': '<=', '>': '>', '>=': '>=' }

export async function runQuery(caller: Caller, q: Query): Promise<{ path: string; data: Doc }[]> {
  const parts = splitPath(q.parent)
  if (parts.length % 2 !== 1) throw new DbError('invalid-argument', 'not a collection path')
  const args: unknown[] = [q.parent]
  const conds = ['parent = $1']
  for (const w of q.where ?? []) {
    args.push(fieldPath(w.field))
    const fp = `data #> $${args.length}::text[]`
    if (w.op === 'in') {
      args.push(JSON.stringify(w.value))
      conds.push(`${fp} in (select value from jsonb_array_elements($${args.length}::jsonb))`)
    } else if (w.op === 'array-contains') {
      args.push(JSON.stringify([w.value]))
      conds.push(`jsonb_typeof(${fp}) = 'array' and ${fp} @> $${args.length}::jsonb`)
    } else {
      args.push(JSON.stringify(w.value))
      const v = `$${args.length}::jsonb`
      // Firestore kimi: tipi fərqli olan sənədlər süzülür
      conds.push(`${fp} is not null and jsonb_typeof(${fp}) = jsonb_typeof(${v}) and ${fp} ${OPS[w.op]} ${v}`)
    }
  }
  const order: string[] = []
  for (const o of q.orderBy ?? []) {
    args.push(fieldPath(o.field))
    conds.push(`data #> $${args.length}::text[] is not null`)
    order.push(`data #> $${args.length}::text[] ${o.dir === 'desc' ? 'desc' : 'asc'}`)
  }
  order.push('id asc')
  let sql = `select path, data from docs where ${conds.join(' and ')} order by ${order.join(', ')}`
  if (q.limit) { args.push(Math.max(0, Math.min(10000, Math.floor(q.limit)))); sql += ` limit $${args.length}` }
  const r = await pool.query<{ path: string; data: Doc }>(sql, args)
  // Firestore kimi: nəticədəki hər sənəd üçün "list" icazəsi olmalıdır, əks halda bütün sorğu rədd olunur
  if (!caller.bypass) {
    const now = Date.now()
    for (const row of r.rows) await check(caller, 'list', row.path, row.data, null, now)
    // Nəticə boşdursa, Firestore kimi sorğunun özü yoxlanılır: "==" süzgəcləri ilə qurulmuş nümunə sənədə icazə olmalıdır
    if (r.rows.length === 0) {
      const probe: Doc = {}
      for (const w of q.where ?? []) {
        if (w.op !== '==') continue
        const ks = w.field.split('.')
        let node = probe
        ks.slice(0, -1).forEach((k) => { node = (isMap(node[k]) ? node[k] : (node[k] = {})) as Doc })
        node[ks[ks.length - 1]] = w.value
      }
      await check(caller, 'list', `${q.parent}/__query__`, probe, null, now)
    }
  }
  return r.rows
}

// ---------- yazı ----------
export type Write =
  | { op: 'set'; path: string; data: Doc; merge?: boolean }
  | { op: 'update'; path: string; data: Doc }
  | { op: 'delete'; path: string }

/** Atomik batch: bütün yazılar yoxlanılır (yazıdan ƏVVƏLKİ vəziyyətə görə), sonra bir tranzaksiyada tətbiq olunur. */
export async function commit(caller: Caller, writes: Write[]): Promise<{ time: number }> {
  if (!Array.isArray(writes) || writes.length === 0 || writes.length > 500) throw new DbError('invalid-argument', 'writes: 1..500')
  const now = Date.now()
  const client = await pool.connect()
  const applied: { path: string; data: Doc | null }[] = []
  try {
    await client.query('begin')
    // eyni yol bir batch-da bir neçə dəfə yazıla bilər — ardıcıl tətbiq üçün yaddaşda saxlayırıq
    const state = new Map<string, Doc | null>()
    const current = async (path: string) => {
      if (state.has(path)) return state.get(path)!
      const r = await client.query<{ data: Doc }>('select data from docs where path = $1 for update', [path])
      return r.rows[0]?.data ?? null
    }
    // 1) hər yazının nəticəsi hesablanır
    const planned: { w: Write; parent: string; id: string; op: Op; before: Doc | null; after: Doc | null }[] = []
    for (const w of writes) {
      const { parent, id } = docParts(w.path)
      const before = await current(w.path)
      let after: Doc | null
      let op: Op
      if (w.op === 'delete') { after = null; op = 'delete' }
      else if (w.op === 'update') {
        if (!before) throw new DbError('not-found', `No document to update: ${w.path}`)
        if (!isMap(w.data)) throw new DbError('invalid-argument', 'data')
        after = applyUpdate(before, w.data, now); op = 'update'
      } else {
        if (!isMap(w.data)) throw new DbError('invalid-argument', 'data')
        after = w.merge && before ? mergeSet(before, w.data, now) : (resolve(w.data, now) as Doc)
        op = before ? 'update' : 'create'
      }
      state.set(w.path, after)
      planned.push({ w, parent, id, op, before, after })
    }
    // 2) qaydalar: Firestore batch semantikası — get() eyni batch-dakı digər sənədləri yazılmış kimi görür
    const load = async (p: string) => (state.has(p) ? state.get(p)! : loadDoc(p, client))
    for (const x of planned) await check(caller, x.op, x.w.path, x.before, x.after, now, load)
    // 3) tətbiq
    for (const x of planned) {
      if (x.after === null) await client.query('delete from docs where path = $1', [x.w.path])
      else await client.query(
        `insert into docs (path, parent, id, data) values ($1, $2, $3, $4)
         on conflict (path) do update set data = excluded.data, updated_at = now()`,
        [x.w.path, x.parent, x.id, JSON.stringify(x.after)],
      )
      applied.push({ path: x.w.path, data: x.after })
    }
    await client.query('commit')
  } catch (e) {
    await client.query('rollback').catch(() => {})
    throw e
  } finally {
    client.release()
  }
  for (const a of applied) changes.emit('change', a)
  return { time: now }
}

/** Kolleksiyanı tamamilə təmizləmək (yalnız testlər üçün). */
export async function clearAll() {
  await pool.query('truncate docs')
}
