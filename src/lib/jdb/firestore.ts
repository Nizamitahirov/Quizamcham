/**
 * "firebase/firestore" uyğun interfeys — Jabr serverinin sənəd anbarı üçün.
 * Oxu/yazı HTTP ilə, realtime (onSnapshot) WebSocket ilə. Bütün icazələr serverdə yoxlanılır.
 */
import { apiBase, FirebaseError, getApp, http, type FirebaseApp } from './app'
import { getAuth, onAuthStateChanged } from './auth'

// ======================= dəyərlər =======================
export class Timestamp {
  constructor(public readonly seconds: number, public readonly nanoseconds: number) {}
  static fromMillis(ms: number) { const s = Math.floor(ms / 1000); return new Timestamp(s, Math.round((ms - s * 1000) * 1e6)) }
  static fromDate(d: Date) { return Timestamp.fromMillis(d.getTime()) }
  static now() { return Timestamp.fromMillis(Date.now()) }
  toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6) }
  toDate() { return new Date(this.toMillis()) }
  isEqual(o: Timestamp) { return o instanceof Timestamp && o.seconds === this.seconds && o.nanoseconds === this.nanoseconds }
  valueOf() { return String(this.toMillis()).padStart(16, '0') }
  toJSON() { return { seconds: this.seconds, nanoseconds: this.nanoseconds } }
  toString() { return `Timestamp(seconds=${this.seconds}, nanoseconds=${this.nanoseconds})` }
}

export class FieldValue {
  constructor(public readonly _kind: 'ts' | 'del' | 'au' | 'ar', public readonly _v?: unknown[]) {}
  isEqual(o: FieldValue) { return o instanceof FieldValue && o._kind === this._kind && JSON.stringify(o._v) === JSON.stringify(this._v) }
}
export const serverTimestamp = () => new FieldValue('ts')
export const deleteField = () => new FieldValue('del')
export const arrayUnion = (...v: unknown[]) => new FieldValue('au', v)
export const arrayRemove = (...v: unknown[]) => new FieldValue('ar', v)
export const increment = (n: number) => { void n; throw new FirebaseError('unimplemented', 'increment') }

type Wire = null | boolean | number | string | Wire[] | { [k: string]: Wire }

function toWire(v: unknown): Wire | undefined {
  if (v === undefined) return undefined
  if (v === null || typeof v === 'boolean' || typeof v === 'string') return v
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (v instanceof Timestamp) return { __t: v.toMillis() }
  if (v instanceof Date) return { __t: v.getTime() }
  if (v instanceof FieldValue) return v._v ? { __sv: v._kind, v: v._v.map((x) => toWire(x) ?? null) } : { __sv: v._kind }
  if (v instanceof DocumentReference) return v.path
  if (Array.isArray(v)) return v.map((x) => toWire(x) ?? null)
  if (typeof v === 'object') {
    const out: { [k: string]: Wire } = {}
    for (const [k, x] of Object.entries(v as object)) { const w = toWire(x); if (w !== undefined) out[k] = w }
    return out
  }
  return null
}
function fromWire(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(fromWire)
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (typeof o.__t === 'number' && Object.keys(o).length === 1) return Timestamp.fromMillis(o.__t)
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(o)) out[k] = fromWire(x)
    return out
  }
  return v
}

// ======================= instans =======================
type Headers = () => Promise<Record<string, string>>
export class Firestore {
  readonly type = 'firestore'
  _rt: Realtime | null = null
  _online = true
  constructor(public app: FirebaseApp, public _base: string, public _headers: Headers, public _authKey: (cb: () => void) => () => void) {}
  get _realtime() { return (this._rt ??= new Realtime(this)) }
  _terminate() { this._rt?.close(); this._rt = null }
  toJSON() { return { app: this.app.name } }
}

export function initializeFirestore(app: FirebaseApp = getApp(), _settings?: unknown): Firestore {
  return getFirestore(app)
}
export function getFirestore(app: FirebaseApp = getApp()): Firestore {
  let f = app._services.get('firestore') as Firestore | undefined
  if (!f) {
    const auth = getAuth(app)
    f = new Firestore(app, apiBase(app), () => auth._headers(), (cb) => onAuthStateChanged(auth, () => cb()))
    app._services.set('firestore', f)
  }
  return f
}
/** Testlər üçün: auth başlığı birbaşa verilir. */
export const _customFirestore = (base: string, headers: Record<string, string>) =>
  new Firestore({ name: 'test', options: {}, _services: new Map() }, base.replace(/\/$/, ''), async () => headers, () => () => {})

// keş parametrləri — serverimizdə lazımsızdır (interfeys uyğunluğu üçün)
export const memoryLocalCache = (_?: unknown) => ({ kind: 'memory' })
export const persistentLocalCache = (_?: unknown) => ({ kind: 'persistent' })
export const persistentMultipleTabManager = () => ({ kind: 'multi-tab' })
export const persistentSingleTabManager = (_?: unknown) => ({ kind: 'single-tab' })

export async function disableNetwork(db: Firestore) { db._online = false; db._rt?.pause() }
export async function enableNetwork(db: Firestore) { db._online = true; db._rt?.resume() }

// ======================= istinadlar =======================
const AUTO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const autoId = () => Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => AUTO[b % AUTO.length]).join('')
const norm = (segs: string[]) => segs.flatMap((s) => String(s).split('/')).filter(Boolean)

export class DocumentReference<T = DocumentData> {
  readonly type = 'document'
  constructor(public firestore: Firestore, public path: string) {}
  get id() { return this.path.slice(this.path.lastIndexOf('/') + 1) }
  get parent(): CollectionReference<T> { return new CollectionReference<T>(this.firestore, this.path.slice(0, this.path.lastIndexOf('/'))) }
  withConverter() { return this }
}
export class Query<T = DocumentData> {
  readonly type: 'query' | 'collection' = 'query'
  declare readonly _phantom?: T
  constructor(public firestore: Firestore, public _q: QuerySpec) {}
  withConverter() { return this }
}
export class CollectionReference<T = DocumentData> extends Query<T> {
  override readonly type = 'collection' as const
  constructor(firestore: Firestore, public path: string) { super(firestore, { parent: path }) }
  get id() { return this.path.slice(this.path.lastIndexOf('/') + 1) }
  get parent(): DocumentReference | null {
    const i = this.path.lastIndexOf('/')
    return i < 0 ? null : new DocumentReference(this.firestore, this.path.slice(0, i))
  }
}
export type DocumentData = { [field: string]: any } // eslint-disable-line @typescript-eslint/no-explicit-any
interface QuerySpec { parent: string; where?: { field: string; op: string; value: Wire }[]; orderBy?: { field: string; dir: 'asc' | 'desc' }[]; limit?: number }

export function doc(parent: Firestore | CollectionReference | DocumentReference, ...segs: string[]): DocumentReference {
  if (parent instanceof Firestore) {
    const p = norm(segs)
    if (p.length % 2) throw new FirebaseError('invalid-argument', `Invalid document reference: ${p.join('/')}`)
    return new DocumentReference(parent, p.join('/'))
  }
  const base = parent.path
  const p = segs.length ? norm(segs) : [autoId()]
  const full = [...base.split('/'), ...p]
  if (full.length % 2) throw new FirebaseError('invalid-argument', `Invalid document reference: ${full.join('/')}`)
  return new DocumentReference(parent.firestore, full.join('/'))
}
export function collection(parent: Firestore | DocumentReference | CollectionReference, ...segs: string[]): CollectionReference {
  const db = parent instanceof Firestore ? parent : parent.firestore
  const full = [...(parent instanceof Firestore ? [] : parent.path.split('/')), ...norm(segs)]
  if (full.length % 2 === 0) throw new FirebaseError('invalid-argument', `Invalid collection reference: ${full.join('/')}`)
  return new CollectionReference(db, full.join('/'))
}

// ---- sorğu məhdudiyyətləri ----
type Constraint = { _apply(q: QuerySpec): QuerySpec }
const OPS = new Set(['==', '!=', '<', '<=', '>', '>=', 'in', 'array-contains'])
export function where(field: string, op: string, value: unknown): Constraint {
  if (!OPS.has(op)) throw new FirebaseError('unimplemented', `where op ${op}`)
  return { _apply: (q) => ({ ...q, where: [...(q.where ?? []), { field, op, value: toWire(value) ?? null }] }) }
}
export function orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): Constraint {
  return { _apply: (q) => ({ ...q, orderBy: [...(q.orderBy ?? []), { field, dir }] }) }
}
export function limit(n: number): Constraint { return { _apply: (q) => ({ ...q, limit: n }) } }
export function query<T>(base: Query<T>, ...cs: Constraint[]): Query<T> {
  return new Query<T>(base.firestore, cs.reduce((q, c) => c._apply(q), base._q))
}

// ======================= snapshotlar =======================
const META = Object.freeze({ fromCache: false, hasPendingWrites: false, isEqual: () => true })
export class DocumentSnapshot<T = DocumentData> {
  readonly metadata = META
  constructor(public ref: DocumentReference<T>, private _data: DocumentData | null) {}
  get id() { return this.ref.id }
  exists(): this is QueryDocumentSnapshot<T> { return this._data !== null }
  data(_opts?: unknown): T | undefined { return this._data === null ? undefined : (fromWire(this._data) as T) }
  get(field: string): any { // eslint-disable-line @typescript-eslint/no-explicit-any
    let v: unknown = this._data
    for (const p of field.split('.')) v = v && typeof v === 'object' ? (v as Record<string, unknown>)[p] : undefined
    return fromWire(v)
  }
}
export class QueryDocumentSnapshot<T = DocumentData> extends DocumentSnapshot<T> {
  override data(): T { return super.data() as T }
}
export interface DocumentChange<T = DocumentData> { type: 'added' | 'modified' | 'removed'; doc: QueryDocumentSnapshot<T>; oldIndex: number; newIndex: number }
export class QuerySnapshot<T = DocumentData> {
  readonly metadata = META
  constructor(public query: Query<T>, public docs: QueryDocumentSnapshot<T>[], private _changes: DocumentChange<T>[]) {}
  get size() { return this.docs.length }
  get empty() { return this.docs.length === 0 }
  forEach(cb: (d: QueryDocumentSnapshot<T>) => void) { this.docs.forEach(cb) }
  docChanges() { return this._changes }
}

type Row = { path: string; data: DocumentData }
const rowsToSnap = <T>(q: Query<T>, rows: Row[], prev: Row[] | null) => {
  const docs = rows.map((r) => new QueryDocumentSnapshot<T>(new DocumentReference<T>(q.firestore, r.path), r.data))
  const changes: DocumentChange<T>[] = []
  const prevIdx = new Map((prev ?? []).map((r, i) => [r.path, i]))
  const nextIdx = new Map(rows.map((r, i) => [r.path, i]))
  if (prev) prev.forEach((r, i) => {
    if (!nextIdx.has(r.path)) changes.push({ type: 'removed', doc: new QueryDocumentSnapshot<T>(new DocumentReference<T>(q.firestore, r.path), r.data), oldIndex: i, newIndex: -1 })
  })
  rows.forEach((r, i) => {
    const j = prevIdx.get(r.path)
    if (j === undefined) changes.push({ type: 'added', doc: docs[i], oldIndex: -1, newIndex: i })
    else if (JSON.stringify(prev![j].data) !== JSON.stringify(r.data) || i !== j) changes.push({ type: 'modified', doc: docs[i], oldIndex: j, newIndex: i })
  })
  return new QuerySnapshot<T>(q, docs, changes)
}

// ======================= oxu =======================
const call = async <T>(db: Firestore, path: string, body: unknown) => {
  if (!db._online) throw new FirebaseError('unavailable', 'offline')
  return http<T>(db._base, path, body, await db._headers())
}
export async function getDoc<T>(ref: DocumentReference<T>): Promise<DocumentSnapshot<T>> {
  const r = await call<{ data: DocumentData | null }>(ref.firestore, '/api/db/get', { path: ref.path })
  return new DocumentSnapshot<T>(ref, r.data)
}
export const getDocFromServer = getDoc
export const getDocFromCache = getDoc
export async function getDocs<T>(q: Query<T>): Promise<QuerySnapshot<T>> {
  const r = await call<{ docs: Row[] }>(q.firestore, '/api/db/query', { query: q._q })
  return rowsToSnap(q, r.docs, null)
}
export const getDocsFromServer = getDocs
export async function getCountFromServer(q: Query) {
  const r = await call<{ count: number }>(q.firestore, '/api/db/count', { query: q._q })
  return { data: () => ({ count: r.count }) }
}

// ======================= yazı =======================
type W = { op: 'set'; path: string; data: Wire; merge?: boolean } | { op: 'update'; path: string; data: Wire } | { op: 'delete'; path: string }
const commitWrites = (db: Firestore, writes: W[]) => call<{ time: number }>(db, '/api/db/commit', { writes }).then(() => undefined)

const updateData = (a: unknown[]): Wire => {
  if (a.length === 1) return toWire(a[0]) ?? {}
  const o: Record<string, unknown> = {}
  for (let i = 0; i < a.length; i += 2) o[String(a[i])] = a[i + 1]
  return toWire(o) ?? {}
}
const setW = (ref: DocumentReference, data: unknown, opts?: { merge?: boolean }): W => ({ op: 'set', path: ref.path, data: toWire(data) ?? {}, merge: !!opts?.merge })

export const setDoc = (ref: DocumentReference, data: unknown, opts?: { merge?: boolean }) => commitWrites(ref.firestore, [setW(ref, data, opts)])
export const updateDoc = (ref: DocumentReference, ...a: unknown[]) => commitWrites(ref.firestore, [{ op: 'update', path: ref.path, data: updateData(a) }])
export const deleteDoc = (ref: DocumentReference) => commitWrites(ref.firestore, [{ op: 'delete', path: ref.path }])
export async function addDoc(col: CollectionReference, data: unknown) {
  const ref = doc(col)
  await setDoc(ref, data)
  return ref
}

export class WriteBatch {
  _w: W[] = []
  constructor(private db: Firestore) {}
  set(ref: DocumentReference, data: unknown, opts?: { merge?: boolean }) { this._w.push(setW(ref, data, opts)); return this }
  update(ref: DocumentReference, ...a: unknown[]) { this._w.push({ op: 'update', path: ref.path, data: updateData(a) }); return this }
  delete(ref: DocumentReference) { this._w.push({ op: 'delete', path: ref.path }); return this }
  commit() { return this._w.length ? commitWrites(this.db, this._w) : Promise.resolve() }
}
export const writeBatch = (db: Firestore) => new WriteBatch(db)

// ======================= realtime =======================
type SubMsg = { t: 'doc'; id: string; data: DocumentData | null } | { t: 'query'; id: string; docs: Row[] } | { t: 'error'; id: string; code: string }
interface Listener { msg: Record<string, unknown>; on: (m: SubMsg) => void }

class Realtime {
  ws: WebSocket | null = null
  subs = new Map<string, Listener>()
  seq = 0
  paused = false
  retry = 0
  timer: ReturnType<typeof setTimeout> | null = null
  ping: ReturnType<typeof setInterval> | null = null
  offAuth: () => void
  constructor(private db: Firestore) {
    // istifadəçi dəyişəndə yeni token göndərilir (server bütün abunələri yenidən hesablayır)
    this.offAuth = db._authKey(() => { void this.sendAuth() })
  }
  url() { return this.db._base.replace(/^http/, 'ws') + '/api/ws' }
  connect() {
    if (this.ws || this.paused) return
    const ws = new WebSocket(this.url())
    this.ws = ws
    ws.onopen = async () => {
      this.retry = 0
      await this.sendAuth()
      for (const [id, l] of this.subs) this.raw({ t: 'sub', id, ...l.msg })
      this.ping = setInterval(() => this.raw({ t: 'ping' }), 25000)
    }
    ws.onmessage = (e) => {
      let m: SubMsg
      try { m = JSON.parse(String(e.data)) } catch { return }
      const l = 'id' in m ? this.subs.get(m.id) : undefined
      if (l) { if (m.t === 'error') this.subs.delete(m.id); l.on(m) }
    }
    ws.onclose = () => {
      if (this.ping) clearInterval(this.ping)
      this.ws = null
      if (this.paused || this.subs.size === 0) return
      const delay = Math.min(10000, 300 * 2 ** this.retry++) * (0.7 + Math.random() * 0.6)
      this.timer = setTimeout(() => this.connect(), delay)
    }
    ws.onerror = () => ws.close()
  }
  raw(m: unknown) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(m)) }
  async sendAuth() {
    const h = await this.db._headers()
    const token = h.authorization?.replace(/^Bearer /, '')
    this.raw({ t: 'auth', token, test: h['x-test-auth'] })
  }
  add(msg: Record<string, unknown>, on: (m: SubMsg) => void) {
    const id = String(++this.seq)
    this.subs.set(id, { msg, on })
    if (this.ws?.readyState === 1) this.raw({ t: 'sub', id, ...msg }); else this.connect()
    return () => {
      if (!this.subs.delete(id)) return
      this.raw({ t: 'unsub', id })
    }
  }
  pause() { this.paused = true; if (this.timer) clearTimeout(this.timer); this.ws?.close() }
  resume() { this.paused = false; if (this.subs.size) this.connect() }
  close() { this.pause(); this.offAuth(); this.subs.clear() }
}

type Observer<S> = { next?: (s: S) => void; error?: (e: FirebaseError) => void; complete?: () => void }
type SnapOpts = { includeMetadataChanges?: boolean }

type DocNext<T> = (s: DocumentSnapshot<T>) => void
type QNext<T> = (s: QuerySnapshot<T>) => void
type OnErr = (e: FirebaseError) => void
export function onSnapshot<T>(ref: DocumentReference<T>, onNext: DocNext<T>, onError?: OnErr): () => void
export function onSnapshot<T>(ref: DocumentReference<T>, opts: SnapOpts, onNext: DocNext<T>, onError?: OnErr): () => void
export function onSnapshot<T>(ref: DocumentReference<T>, observer: Observer<DocumentSnapshot<T>>): () => void
export function onSnapshot<T>(ref: Query<T>, onNext: QNext<T>, onError?: OnErr): () => void
export function onSnapshot<T>(ref: Query<T>, opts: SnapOpts, onNext: QNext<T>, onError?: OnErr): () => void
export function onSnapshot<T>(ref: Query<T>, observer: Observer<QuerySnapshot<T>>): () => void
export function onSnapshot<T>(ref: DocumentReference<T> | Query<T>, ...args: unknown[]): () => void {
  if (args[0] && typeof args[0] === 'object' && !('next' in (args[0] as object)) && typeof args[0] !== 'function') args.shift() as SnapOpts
  let next: ((s: never) => void) | undefined, error: ((e: FirebaseError) => void) | undefined
  if (typeof args[0] === 'function') { next = args[0] as typeof next; error = args[1] as typeof error }
  else if (args[0]) { const o = args[0] as Observer<never>; next = o.next?.bind(o); error = o.error?.bind(o) }
  const db = ref.firestore
  let prev: Row[] | null = null
  let done = false
  const on = (m: SubMsg) => {
    if (done) return
    if (m.t === 'error') { done = true; error?.(new FirebaseError(m.code, `onSnapshot: ${m.code}`)); return }
    if (m.t === 'doc') next?.(new DocumentSnapshot<T>(ref as DocumentReference<T>, m.data) as never)
    else { const s = rowsToSnap(ref as Query<T>, m.docs, prev); prev = m.docs; next?.(s as never) }
  }
  const msg = ref instanceof DocumentReference ? { kind: 'doc', path: ref.path } : { kind: 'query', query: (ref as Query<T>)._q }
  const off = db._realtime.add(msg, on)
  return () => { done = true; off() }
}

export type { FirebaseError as FirestoreError }
export type Unsubscribe = () => void
export type SetOptions = { merge?: boolean }
export type UpdateData<T> = Partial<T> & Record<string, unknown>
export type WithFieldValue<T> = T
