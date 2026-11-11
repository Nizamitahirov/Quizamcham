/**
 * Realtime (onSnapshot-un əvəzi) — WebSocket üzərindən sənəd və sorğu abunələri.
 * Klient mesajları:
 *   { t: 'auth', token? , test? }                       — sessiyanı təyin edir (yenidən göndərilə bilər)
 *   { t: 'sub', id, kind: 'doc', path }                 — sənədə abunə
 *   { t: 'sub', id, kind: 'query', query }              — sorğuya abunə
 *   { t: 'unsub', id }
 *   { t: 'ping' }
 * Server mesajları:
 *   { t: 'doc', id, path, data|null }  { t: 'query', id, docs: [{path,data}] }  { t: 'error', id, code }  { t: 'pong', now }
 * Dəyişiklik gələndə yalnız təsirlənən abunələr yenidən hesablanır (icazələr daxil).
 */
import type { FastifyInstance } from 'fastify'
import websocket from '@fastify/websocket'
import type { WebSocket } from 'ws'
import { authFrom } from './auth.js'
import { changes, DbError, getDoc, runQuery, type Caller, type Query } from './store.js'
import { deepEqual, type Doc } from './values.js'

type Sub =
  | { kind: 'doc'; path: string; last?: string }
  | { kind: 'query'; query: Query; last?: string }

interface Conn { ws: WebSocket; caller: Caller; subs: Map<string, Sub>; queue: Promise<void> }
const conns = new Set<Conn>()
/** Hədlər: bir bağlantıda abunə sayı, saniyədə mesaj sayı, bir IP-dən bağlantı sayı (böyük auditoriya bir NAT arxasında ola bilər). */
const MAX_SUBS = 300, MAX_MSGS_PER_SEC = 60, MAX_CONNS_PER_IP = 2000
const perIp = new Map<string, number>()

const send = (c: Conn, m: unknown) => { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(m)) }
const codeOf = (e: unknown) => (e instanceof DbError ? e.code : 'internal')

async function evalSub(c: Conn, id: string, s: Sub, force = false) {
  try {
    if (s.kind === 'doc') {
      const data = await getDoc(c.caller, s.path)
      const key = JSON.stringify(data)
      if (!force && key === s.last) return
      s.last = key
      send(c, { t: 'doc', id, path: s.path, data })
    } else {
      const docs = await runQuery(c.caller, s.query)
      const key = JSON.stringify(docs)
      if (!force && key === s.last) return
      s.last = key
      send(c, { t: 'query', id, docs })
    }
  } catch (e) {
    s.last = undefined
    send(c, { t: 'error', id, code: codeOf(e) })
    c.subs.delete(id) // Firestore kimi: xəta abunəni bitirir
  }
}

/** Hər bağlantı üçün ardıcıl iş növbəsi (mesajların sırası qorunur). */
const enqueue = (c: Conn, fn: () => Promise<void>) => { c.queue = c.queue.then(fn, fn) }

const affects = (s: Sub, path: string, parent: string) => (s.kind === 'doc' ? s.path === path : s.query.parent === parent)

/**
 * Sənəd dəyişəndə: həmin sənədə və ya onun kolleksiyasına baxan abunələr yenidən hesablanır.
 * Qaydalar başqa sənədlərdən də asılı ola bilər (məs. oyunçu sənədi yaranandan sonra oyun oxuna bilər),
 * ona görə əvvəllər rədd edilmiş abunələr klient tərəfindən yenidən cəhd olunur.
 */
changes.on('change', ({ path }: { path: string; data: Doc | null }) => {
  const parent = path.split('/').slice(0, -1).join('/')
  for (const c of conns) {
    for (const [id, s] of c.subs) if (affects(s, path, parent)) enqueue(c, () => evalSub(c, id, s))
  }
})

export async function realtimeRoutes(app: FastifyInstance) {
  await app.register(websocket, { options: { maxPayload: 256 * 1024 } })
  app.get('/api/ws', { websocket: true }, (ws, req) => {
    const ip = req.ip
    if ((perIp.get(ip) ?? 0) >= MAX_CONNS_PER_IP) { ws.close(1013, 'too many connections'); return }
    perIp.set(ip, (perIp.get(ip) ?? 0) + 1)
    const c: Conn = { ws, caller: { auth: null }, subs: new Map(), queue: Promise.resolve() }
    conns.add(c)
    let win = Date.now(), msgs = 0
    ws.on('message', (raw) => {
      const now = Date.now()
      if (now - win > 1000) { win = now; msgs = 0 }
      if (++msgs > MAX_MSGS_PER_SEC) { ws.close(1008, 'rate limit'); return }
      let m: { t: string; id?: string; kind?: string; path?: string; query?: Query; token?: string; test?: string }
      try { m = JSON.parse(String(raw)) } catch { return }
      enqueue(c, async () => {
        switch (m.t) {
          case 'auth': {
            const prev = JSON.stringify(c.caller)
            c.caller = await authFrom(m.token, m.test)
            send(c, { t: 'authed', uid: c.caller.auth?.uid ?? null })
            // istifadəçi dəyişibsə bütün abunələr yeni icazələrlə yenidən hesablanır
            if (prev !== JSON.stringify(c.caller)) for (const [id, s] of c.subs) await evalSub(c, id, s, true)
            break
          }
          case 'sub': {
            if (!m.id || typeof m.id !== 'string' || m.id.length > 64) return
            if (!c.subs.has(m.id) && c.subs.size >= MAX_SUBS) { send(c, { t: 'error', id: m.id, code: 'resource-exhausted' }); return }
            const s: Sub = m.kind === 'doc' ? { kind: 'doc', path: String(m.path) } : { kind: 'query', query: m.query as Query }
            c.subs.set(m.id, s)
            await evalSub(c, m.id, s, true)
            break
          }
          case 'unsub': if (m.id) c.subs.delete(m.id); break
          case 'ping': send(c, { t: 'pong', now: Date.now() }); break
        }
      })
    })
    ws.on('close', () => { conns.delete(c); c.subs.clear(); const n = (perIp.get(ip) ?? 1) - 1; if (n <= 0) perIp.delete(ip); else perIp.set(ip, n) })
    ws.on('error', () => ws.close())
  })
}

export const realtimeStats = () => ({ connections: conns.size, subscriptions: [...conns].reduce((n, c) => n + c.subs.size, 0) })
export { deepEqual }
