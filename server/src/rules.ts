/**
 * Təhlükəsizlik qaydaları — firestore.rules faylının sətir-sətir köçürməsi.
 * Firestore-dakı kimi: qiymətləndirmə zamanı istənilən xəta (məs. olmayan sahə/sənəd) → İCAZƏ YOX.
 * Hər qərar serverdə verilir; klient heç nəyə birbaşa çıxış əldə etmir.
 */
import { affectedKeys, deepEqual, isMap, isTs, type Doc, type J } from './values.js'

export type Op = 'get' | 'list' | 'create' | 'update' | 'delete'
export interface Auth { uid: string; token: { email?: string; firebase: { sign_in_provider: string } } }
export interface Request {
  op: Op
  path: string[] // ['games', 'g1', 'players', 'p2']
  resource: Doc | null // mövcud sənəd (create üçün null)
  next: Doc | null // yazıdan sonrakı tam sənəd (create/update)
  auth: Auth | null
  time: number // request.time (ms) — serverTimestamp-lar da bu vaxta bərabərdir
  load: (path: string) => Promise<Doc | null> // get()/exists() üçün (yazıdan ƏVVƏLKİ vəziyyət)
}

const SUPER = 'ii98moHX58SDPcn9lA4SYHWanou1'
const PERM_KEYS = ['createQuiz', 'runGames', 'library', 'share', 'allContent', 'trainers', 'settings', 'logs', 'publish', 'console']
const DAY = 86_400_000

class Deny extends Error {}
const fail = (): never => { throw new Deny() }
/** Firestore semantikası: "A || B" — A xəta versə də B doğrudursa icazə verilir. Hər disyunkt ayrıca qiymətləndirilir. */
const ok = async (fn: () => unknown): Promise<boolean> => {
  try { return (await fn()) === true } catch (e) { if (e instanceof Deny) return false; throw e }
}

// ---------- dəyər köməkçiləri (Firestore rules semantikası) ----------
const has = (d: J | undefined, k: string): boolean => isMap(d) && Object.prototype.hasOwnProperty.call(d, k)
/** d.k — sahə yoxdursa xəta */
const f = (d: J | undefined, k: string): J => (has(d, k) ? (d as Doc)[k] : fail())
/** d.get(k, def) */
const g = (d: J | undefined, k: string, def: J): J => (isMap(d) ? (has(d, k) ? (d as Doc)[k] : def) : fail())
const isStr = (v: J | undefined): v is string => typeof v === 'string'
const isInt = (v: J | undefined): v is number => typeof v === 'number' && Number.isInteger(v)
const isNum = (v: J | undefined): v is number => typeof v === 'number'
const isList = (v: J | undefined): v is J[] => Array.isArray(v)
const size = (v: J | undefined): number => (isStr(v) ? [...v].length : isList(v) ? v.length : isMap(v) ? Object.keys(v).length : fail())
const str = (v: J | undefined, n: number) => isStr(v) && size(v) <= n
const ms = (v: J | undefined): number => (isTs(v) ? v.__t : fail())
const keysOnly = (d: J | undefined, allowed: string[]) => isMap(d) && Object.keys(d).every((k) => allowed.includes(k))
const keysAny = (d: J | undefined, list: string[]) => isMap(d) && Object.keys(d).some((k) => list.includes(k))
const inList = (v: J | undefined, list: J[]) => list.some((x) => deepEqual(x, v))
const eq = (a: J | undefined, b: J | undefined) => deepEqual(a, b)

/** Bir sorğu üçün kontekst (get() nəticələri və rol funksiyaları keşlənir). */
class Ctx {
  private cache = new Map<string, Promise<Doc | null>>()
  constructor(public r: Request) {}
  get auth() { return this.r.auth }
  get uid() { return this.r.auth?.uid ?? fail() }
  get time() { return this.r.time }
  signedIn() { return !!this.r.auth }
  load(path: string) { if (!this.cache.has(path)) this.cache.set(path, this.r.load(path)); return this.cache.get(path)! }
  async exists(path: string) { return (await this.load(path)) !== null }
  async get(path: string) { return (await this.load(path)) ?? fail() }

  // ---------- rollar ----------
  isSuper() { return this.signedIn() && this.uid === SUPER }
  adminPath() { return `admins/${this.uid}` }
  me() { return this.get(this.adminPath()) }
  async isAdmin() { return this.isSuper() || (this.signedIn() && (await this.exists(this.adminPath())) && g(await this.me(), 'disabled', false) !== true) }
  async roleKey() { return inList(g(await this.me(), 'role', 'trainer'), ['admin', 'owner']) ? 'admin' : 'trainer' }
  defaultPerm(r: string, p: string) {
    return r === 'admin' ? ['createQuiz', 'runGames', 'library', 'share', 'allContent', 'trainers', 'settings', 'publish'].includes(p)
      : ['createQuiz', 'runGames', 'library', 'share'].includes(p)
  }
  async rolePerm(p: string): Promise<J> {
    const rk = await this.roleKey()
    if (await this.exists('settings/access')) return g(g(await this.get('settings/access'), rk, {}), p, this.defaultPerm(rk, p))
    return this.defaultPerm(rk, p)
  }
  async orgLicensed(o: string) {
    const od = await this.get(`admins/${o}`)
    return g(od, 'plan', '') === 'institution' && this.time < ms(g(od, 'licenseUntil', { __t: 0 }))
  }
  async planOk() {
    const d = await this.me()
    if (g(d, 'source', 'team') === 'org') return this.orgLicensed(g(d, 'orgId', '-') as string)
    if (g(d, 'source', 'team') !== 'signup') return true
    const created = ms(g(d, 'createdAt', { __t: 0 })) + 3 * DAY
    const end = has(d, 'licenseUntil') ? ms(f(d, 'licenseUntil')) : has(d, 'trialEndsAt') ? ms(f(d, 'trialEndsAt')) : created
    return this.time < end
  }
  async selfServe() { return !this.isSuper() && (await this.exists(this.adminPath())) && inList(g(await this.me(), 'source', 'team'), ['signup', 'org']) }
  async isOrgOwner() {
    if (!(await this.isAdmin())) return false
    const d = await this.me()
    return g(d, 'source', 'team') === 'signup' && g(d, 'plan', '') === 'institution' && (await this.planOk())
  }
  async orgOf(): Promise<string> {
    if (!(await this.isAdmin())) return ''
    const d = await this.me()
    if (g(d, 'source', 'team') === 'org') return g(d, 'orgId', '') as string
    return g(d, 'source', 'team') === 'signup' && g(d, 'plan', '') === 'institution' ? this.uid : ''
  }
  async freeHost() { return (await this.selfServe()) && !(await this.planOk()) }
  /** Plan pillələri: oyunda iştirakçı limiti (firestore.rules → playerCap ilə eyni). */
  async playerCap() {
    if (!(await this.selfServe())) return 100000
    if (!(await this.planOk())) return 10
    const d = await this.me()
    if (g(d, 'source', 'team') === 'org') return 1000
    if (this.time < ms(g(d, 'licenseUntil', { __t: 0 }))) { const p = g(d, 'plan', 'pro'); return p === 'trainer' ? 50 : inList(p, ['business', 'institution']) ? 1000 : 200 }
    return 200
  }
  async can(p: string) {
    if (this.isSuper()) return true
    if (!(await this.isAdmin())) return false
    if (g(g(await this.me(), 'perms', {}), p, await this.rolePerm(p)) !== true) return false
    return !['share', 'publish'].includes(p) || !(await this.selfServe())
  }
  registered() { return this.signedIn() && this.r.auth!.token.firebase.sign_in_provider !== 'anonymous' }
  isOwner() { return this.can('allContent') }
  game(gid: string) { return this.get(`games/${gid}`) }
  async isGameHost(gid: string) {
    if (!(await this.isAdmin())) return false
    const gm = await this.game(gid)
    return f(gm, 'hostUid') === this.uid || (await this.isOwner()) || (g(gm, 'orgId', '') === this.uid && (await this.isOrgOwner()))
  }
  async isPlayer(gid: string) { return this.signedIn() && this.exists(`games/${gid}/players/${this.uid}`) }
  async bannedList(): Promise<J[]> { return (await this.exists('settings/app')) ? (g(await this.get('settings/app'), 'bannedWords', []) as J[]) : [] }
  async nameAllowed(v: J) { return !inList((v as string).toLowerCase(), await this.bannedList()) }
}

const nameOk = (v: J | undefined) => isStr(v) && size(v) >= 2 && size(v) <= 20
const answerValueOk = (v: J | undefined) => v === null || isNum(v) || (isStr(v) && size(v) <= 200) || (isList(v) && v.length <= 10)
const isReq = (v: J | undefined, now: number) => isTs(v) && v.__t === now
const affected = (next: Doc | null, prev: Doc | null) => affectedKeys(next ?? fail(), prev ?? fail())
const onlyAffected = (next: Doc | null, prev: Doc | null, list: string[]) => [...affected(next, prev)].every((k) => list.includes(k))
const anyAffected = (next: Doc | null, prev: Doc | null, list: string[]) => [...affected(next, prev)].some((k) => list.includes(k))

/** Əsas giriş nöqtəsi: icazə varmı? */
export async function allowed(r: Request): Promise<boolean> {
  try { return await evaluate(new Ctx(r)) } catch { return false }
}

async function evaluate(c: Ctx): Promise<boolean> {
  const { op, path } = c.r
  const res = c.r.resource
  const data = c.r.next // request.resource.data
  const rd = () => res ?? fail() // resource.data
  const nd = () => data ?? fail()
  const now = c.time
  const read = op === 'get' || op === 'list'
  const write = !read
  const [col, id, sub, subId] = path

  // ---------- admins ----------
  if (col === 'admins' && path.length === 2) {
    const uid = id
    const newRole = () => g(nd(), 'role', 'trainer')
    const keysOk = () => keysOnly(nd(), ['email', 'role', 'name', 'createdAt', 'createdBy', 'disabled', 'mustChangePassword', 'passwordChangedAt', 'updatedAt', 'updatedBy', 'perms', 'source', 'trialEndsAt', 'licenseUntil', 'plan', 'seats', 'orgId'])
      && keysOnly(g(nd(), 'perms', {}), PERM_KEYS)
    const permsUnchanged = () => !anyAffected(nd(), rd(), ['perms', 'source', 'trialEndsAt', 'licenseUntil', 'plan', 'seats', 'orgId'])
    if (op === 'get') return c.signedIn() && (c.uid === uid || (await c.can('trainers')) || g(rd(), 'orgId', '') === c.uid
      || ((await c.exists(c.adminPath())) && g(await c.me(), 'orgId', '') === uid))
    if (op === 'list') return (await c.can('trainers')) || (c.signedIn() && g(rd(), 'orgId', '') === c.uid)
    if (op === 'create') {
      if (!keysOk() || uid === SUPER) return false
      if (c.isSuper() && inList(newRole(), ['admin', 'trainer'])) return true
      if ((await c.can('trainers')) && newRole() === 'trainer' && !has(nd(), 'perms') && !keysAny(nd(), ['source', 'trialEndsAt', 'licenseUntil', 'plan'])) return true
      if (c.signedIn() && uid === c.uid && c.auth!.token.firebase.sign_in_provider === 'google.com'
        && keysOnly(nd(), ['email', 'name', 'role', 'source', 'createdAt', 'disabled', 'mustChangePassword'])
        && newRole() === 'trainer' && f(nd(), 'source') === 'signup'
        && eq(f(nd(), 'email'), c.auth!.token.email ?? fail())
        && isReq(f(nd(), 'createdAt'), now)
        && g(nd(), 'disabled', false) === false && g(nd(), 'mustChangePassword', false) === false
        && (await c.exists(`users/${uid}`)) && inList(f(await c.get(`users/${uid}`), 'type'), ['trainer', 'institution'])) return true
      if ((await c.isOrgOwner()) && uid !== c.uid
        && keysOnly(nd(), ['email', 'name', 'role', 'source', 'orgId', 'createdAt', 'createdBy', 'disabled', 'mustChangePassword'])
        && newRole() === 'trainer' && f(nd(), 'source') === 'org'
        && f(nd(), 'orgId') === c.uid && f(nd(), 'createdBy') === c.uid && isReq(f(nd(), 'createdAt'), now)
        && f(nd(), 'disabled') === false && f(nd(), 'mustChangePassword') === true) return true
      return false
    }
    if (op === 'update') {
      if (!keysOk()) return false
      if (uid === SUPER && c.isSuper() && newRole() === 'super' && g(nd(), 'disabled', false) === false) return true
      if (uid !== SUPER && c.isSuper() && inList(newRole(), ['admin', 'trainer'])) return true
      if (c.signedIn() && uid !== SUPER && uid !== c.uid && (await c.can('trainers')) && permsUnchanged()
        && g(rd(), 'role', 'trainer') === 'trainer' && newRole() === 'trainer') return true
      if (c.signedIn() && uid !== c.uid && g(rd(), 'orgId', '') === c.uid && (await c.isOrgOwner())
        && onlyAffected(nd(), rd(), ['disabled', 'name', 'updatedAt', 'updatedBy'])) return true
      if (c.signedIn() && c.uid === uid && onlyAffected(nd(), rd(), ['mustChangePassword', 'passwordChangedAt']) && f(nd(), 'mustChangePassword') === false) return true
      return false
    }
    // delete
    if (uid === SUPER || !c.signedIn()) return false
    if (uid !== c.uid && (c.isSuper() || ((await c.can('trainers')) && g(rd(), 'role', 'trainer') === 'trainer'))) return true
    if (uid === c.uid && g(rd(), 'source', 'team') === 'signup') return true
    if (uid !== c.uid && (await c.isAdmin()) && g(rd(), 'orgId', '') === c.uid) return true
    return false
  }

  // ---------- audit ----------
  if (col === 'audit' && path.length === 2) {
    if (read) return c.can('logs')
    if (op === 'create') {
      const d = nd()
      return ((await c.isAdmin()) || (c.registered() && inList(f(d, 'action'), ['account_deleted', 'data_exported'])))
        && keysOnly(d, ['actor', 'actorEmail', 'action', 'target', 'targetEmail', 'details', 'at'])
        && f(d, 'actor') === c.uid && isReq(f(d, 'at'), now)
        && isStr(f(d, 'action')) && size(f(d, 'action')) <= 40
        && (!has(d, 'details') || (isMap(f(d, 'details')) && size(f(d, 'details')) <= 20))
    }
    return false
  }

  // ---------- quizzes ----------
  if (col === 'quizzes' && path.length === 2) {
    if (read) return (await c.can('allContent'))
      || ((await c.isAdmin()) && ((await ok(() => f(rd(), 'ownerUid') === c.uid)) || (g(rd(), 'shared', false) === true && (await c.can('library')))))
      || ((await c.orgOf()) !== '' && g(rd(), 'orgId', '') === (await c.orgOf()))
    if (op === 'create') return (await c.can('createQuiz')) && f(nd(), 'ownerUid') === c.uid
      && (g(nd(), 'shared', false) === false || (await c.can('share')))
      && inList(g(nd(), 'orgId', ''), ['', await c.orgOf()])
    const manage = async () => (await c.isAdmin()) && ((await ok(() => f(rd(), 'ownerUid') === c.uid)) || (await c.isOwner()) || ((await c.isOrgOwner()) && g(rd(), 'orgId', '') === c.uid))
    if (op === 'update') return (await manage()) && eq(f(nd(), 'ownerUid'), f(rd(), 'ownerUid'))
      && eq(g(nd(), 'orgId', ''), g(rd(), 'orgId', ''))
      && (eq(g(nd(), 'shared', false), g(rd(), 'shared', false)) || (await c.can('share')))
    return manage()
  }
  if (col === 'quizzes' && sub === 'questions' && path.length === 4) {
    const qp = `quizzes/${id}`
    const quiz = () => c.get(qp)
    if (read) return (await c.can('allContent'))
      || ((await c.isAdmin()) && (f(await quiz(), 'ownerUid') === c.uid || (g(await quiz(), 'shared', false) === true && (await c.can('library')))))
      || ((await c.orgOf()) !== '' && g(await quiz(), 'orgId', '') === (await c.orgOf()))
    return (await c.isAdmin()) && (!(await c.exists(qp)) || f(await quiz(), 'ownerUid') === c.uid || (await c.isOwner())
      || ((await c.isOrgOwner()) && g(await quiz(), 'orgId', '') === c.uid))
  }

  // ---------- pins, settings, sounds, profiles ----------
  if (col === 'pins' && path.length === 2) {
    if (op === 'get') return c.signedIn()
    if (op === 'list') return c.can('allContent')
    return c.isAdmin()
  }
  if (col === 'settings' && path.length === 2) {
    if (op === 'get') return c.signedIn()
    if (op === 'list') return c.can('settings')
    if (op === 'delete' || op === 'create' || op === 'update') {
      if (id === 'access' && c.isSuper() && op !== 'delete'
        && keysOnly(nd(), ['admin', 'trainer', 'updatedAt', 'updatedBy'])
        && keysOnly(f(nd(), 'admin'), PERM_KEYS) && keysOnly(f(nd(), 'trainer'), PERM_KEYS)) return true
      if (id === 'pricing' && (await c.can('console'))) return true
      if (!['access', 'pricing'].includes(id) && ((await c.can('settings'))
        || ((await c.isAdmin()) && ((id === 'current' && !(await c.selfServe())) || id === `play_${c.uid}`)))) return true
      return false
    }
  }
  if (col === 'sounds' && path.length === 2) {
    if (op === 'get') return c.signedIn()
    if (op === 'list') return c.isAdmin()
    return c.can('settings')
  }
  if (col === 'profiles' && path.length === 2) {
    if (read) return (await c.can('trainers')) || (await c.can('allContent')) || (c.signedIn() && c.uid === id)
    return (await c.isAdmin()) && c.uid === id
  }

  // ---------- users ----------
  if (col === 'users' && path.length === 2) {
    const own = () => c.registered() && c.uid === id
    const fieldsOk = () => {
      const d = nd()
      return keysOnly(d, ['email', 'displayName', 'photoURL', 'type', 'firstName', 'lastName', 'phone', 'country', 'city',
        'sector', 'position', 'organization', 'orgSize', 'orgType', 'seats', 'institution', 'field', 'level', 'year',
        'interests', 'goal', 'source', 'marketing', 'termsAt', 'onboarded', 'createdAt', 'lastLoginAt', 'lang',
        'dataConsentAt', 'marketingAt', 'consentVersion'])
        && inList(f(d, 'type'), ['student', 'trainer', 'institution'])
        && str(g(d, 'firstName', ''), 60) && str(g(d, 'lastName', ''), 60) && str(g(d, 'phone', ''), 30)
        && str(g(d, 'organization', ''), 120) && str(g(d, 'position', ''), 80) && str(g(d, 'sector', ''), 60)
        && (!has(d, 'interests') || (isList(f(d, 'interests')) && size(f(d, 'interests')) <= 12))
    }
    if (op === 'get') return own() || c.can('console')
    if (op === 'list') return c.can('console')
    if (op === 'create') return own() && fieldsOk() && isReq(f(nd(), 'createdAt'), now) && eq(f(nd(), 'email'), c.auth!.token.email ?? fail())
    if (op === 'update') {
      if (own() && fieldsOk()
        && ((await ok(() => eq(f(nd(), 'type'), f(rd(), 'type')))) || (await ok(() => f(rd(), 'type') === 'student' && inList(f(nd(), 'type'), ['trainer', 'institution']))))
        && eq(f(nd(), 'createdAt'), f(rd(), 'createdAt')) && eq(f(nd(), 'email'), f(rd(), 'email'))) return true
      return (await c.can('console')) && onlyAffected(nd(), rd(), ['type']) && inList(f(nd(), 'type'), ['student', 'trainer', 'institution'])
    }
    return own() || c.isSuper()
  }

  // ---------- consents, catalog, attempts, plays, licenses, licenseRequests, errors ----------
  if (col === 'consents' && path.length === 2) {
    if (read) return (await c.can('console')) || (c.registered() && f(rd(), 'uid') === c.uid)
    if (op === 'create') {
      const d = nd()
      return c.registered() && keysOnly(d, ['uid', 'type', 'granted', 'version', 'at']) && f(d, 'uid') === c.uid
        && inList(f(d, 'type'), ['data', 'terms', 'marketing']) && typeof f(d, 'granted') === 'boolean'
        && str(f(d, 'version'), 20) && isReq(f(d, 'at'), now)
    }
    return false
  }
  if (col === 'catalog' && path.length === 2) {
    if (read) return c.registered() || c.isAdmin()
    if (op === 'delete') return (await c.can('publish')) || (await c.can('console')) || ((await c.isAdmin()) && f(rd(), 'publishedBy') === c.uid)
    const d = nd()
    const ownsQuiz = async () => (await c.isAdmin()) && (await c.can('createQuiz')) && (await c.exists(`quizzes/${id}`))
      && f(await c.get(`quizzes/${id}`), 'ownerUid') === c.uid
    const safe = () => g(d, 'hidden', false) === false
      && !(res !== null && g(res, 'hidden', false) === true)
      && inList(g(d, 'status', 'live'), ['live', 'review'])
      && (g(d, 'hasImages', false) === false || g(d, 'status', 'live') === 'review')
    if ((await c.can('console')) && (f(d, 'publishedBy') === c.uid || (res !== null && eq(f(d, 'publishedBy'), f(res, 'publishedBy'))))) return true
    return f(d, 'publishedBy') === c.uid
      && ((await c.can('publish')) || (await ownsQuiz()))
      && (res === null || (await c.can('publish')) || f(res, 'publishedBy') === c.uid)
      && safe()
  }
  if (col === 'reports' && path.length === 2) {
    if (read || op === 'delete') return c.can('console')
    if (op !== 'create') return false
    const d = nd()
    return c.registered() && id === `${f(d, 'quizId')}_${c.uid}`
      && keysOnly(d, ['uid', 'quizId', 'reason', 'note', 'at'])
      && f(d, 'uid') === c.uid
      && inList(f(d, 'reason'), ['language', 'sexual', 'hate', 'wrong', 'spam', 'other'])
      && str(g(d, 'note', ''), 300) && isReq(f(d, 'at'), now)
      && c.exists(`catalog/${f(d, 'quizId')}`)
  }
  if (col === 'attempts' && path.length === 2) {
    if (read) return (await ok(() => c.registered() && f(rd(), 'uid') === c.uid)) || c.can('console')
    if (op === 'create') {
      const d = nd()
      return c.registered() && keysOnly(d, ['uid', 'quizId', 'quizTitle', 'correct', 'total', 'score', 'durationMs', 'at'])
        && f(d, 'uid') === c.uid && isReq(f(d, 'at'), now)
        && isInt(f(d, 'total')) && (f(d, 'total') as number) > 0 && (f(d, 'total') as number) <= 200
        && isInt(f(d, 'correct')) && (f(d, 'correct') as number) >= 0 && (f(d, 'correct') as number) <= (f(d, 'total') as number)
        && isInt(f(d, 'score')) && (f(d, 'score') as number) >= 0 && (f(d, 'score') as number) <= 1_000_000
        && str(f(d, 'quizTitle'), 120) && c.exists(`catalog/${f(d, 'quizId')}`)
    }
    if (op === 'delete') return c.registered() && f(rd(), 'uid') === c.uid
    return false
  }
  // ---------- siniflər, kodlar, üzvlüklər, kurslar (firestore.rules ilə eyni) ----------
  const classOwner = async (cid: string) => (await c.isAdmin()) && (await c.exists(`classes/${cid}`)) && g(await c.get(`classes/${cid}`), 'ownerUid', '') === c.uid
  const classMember = async (cid: string) => c.registered() && (await c.exists(`classes/${cid}/members/${c.uid}`))
  if (col === 'classes') {
    const cid = id
    if (path.length === 2) {
      if (op === 'get') return (await classOwner(cid)) || (await classMember(cid)) || c.can('allContent')
      if (op === 'list') return ((await c.isAdmin()) && (await ok(() => f(rd(), 'ownerUid') === c.uid))) || c.can('allContent')
      if (op === 'create') {
        const d = nd()
        return (await c.isAdmin()) && (await c.can('createQuiz')) && f(d, 'ownerUid') === c.uid
          && keysOnly(d, ['ownerUid', 'name', 'code', 'createdAt', 'archived', 'ownerName'])
          && str(f(d, 'name'), 80) && size(f(d, 'name')) >= 2 && isStr(f(d, 'code')) && size(f(d, 'code')) === 6 && isReq(f(d, 'createdAt'), now)
      }
      if (op === 'update') {
        const d = nd()
        return (await classOwner(cid)) && eq(f(d, 'ownerUid'), f(rd(), 'ownerUid')) && eq(f(d, 'code'), f(rd(), 'code'))
          && onlyAffected(d, res, ['name', 'archived', 'ownerName']) && str(f(d, 'name'), 80)
      }
      return classOwner(cid)
    }
    if (path.length === 4 && sub === 'members') {
      const uid = subId
      if (read) return (await classOwner(cid)) || (c.registered() && c.uid === uid)
      if (op === 'create') {
        const d = nd(), cls = await c.get(`classes/${cid}`)
        return c.registered() && uid === c.uid && keysOnly(d, ['uid', 'name', 'email', 'code', 'joinedAt'])
          && f(d, 'uid') === uid && str(f(d, 'name'), 80) && str(g(d, 'email', ''), 120)
          && eq(f(d, 'code'), f(cls, 'code')) && g(cls, 'archived', false) === false && isReq(f(d, 'joinedAt'), now)
      }
      if (op === 'update') return false
      return (await classOwner(cid)) || (c.registered() && c.uid === uid)
    }
    if (path.length === 4 && sub === 'tasks') {
      if (read) return (await classOwner(cid)) || (await classMember(cid))
      if (op === 'delete') return classOwner(cid)
      const d = nd()
      return (await classOwner(cid)) && keysOnly(d, ['kind', 'title', 'quizId', 'courseId', 'gameId', 'pin', 'dueAt', 'createdAt', 'note'])
        && inList(f(d, 'kind'), ['practice', 'course', 'game']) && str(f(d, 'title'), 120) && str(g(d, 'note', ''), 300)
    }
    if (path.length === 4 && sub === 'results') {
      if (read) return (await classOwner(cid)) || (c.registered() && (await ok(() => f(rd(), 'uid') === c.uid)))
      if (op === 'delete') return classOwner(cid)
      const d = nd()
      const total = f(d, 'total'), correct = f(d, 'correct'), pct = f(d, 'pct')
      return (await classMember(cid)) && subId === `${c.uid}_${f(d, 'taskId')}`
        && keysOnly(d, ['uid', 'name', 'taskId', 'score', 'correct', 'total', 'pct', 'at'])
        && f(d, 'uid') === c.uid && str(f(d, 'name'), 80)
        && isInt(total) && (total as number) > 0 && (total as number) <= 200
        && isInt(correct) && (correct as number) >= 0 && (correct as number) <= (total as number)
        && isInt(pct) && (pct as number) >= 0 && (pct as number) <= 100
        && isReq(f(d, 'at'), now) && (await c.exists(`classes/${cid}/tasks/${f(d, 'taskId')}`))
    }
    return false
  }
  if (col === 'classCodes' && path.length === 2) {
    if (op === 'get') return c.registered() || c.isAdmin()
    if (op === 'list' || op === 'update') return false
    if (op === 'create') { const d = nd(); return (await c.isAdmin()) && keysOnly(d, ['classId']) && classOwner(String(f(d, 'classId'))) }
    return (await c.isAdmin()) && classOwner(String(f(rd(), 'classId')))
  }
  if (col === 'memberships' && path.length === 2) {
    if (read) return c.registered() && (await ok(() => f(rd(), 'uid') === c.uid))
    if (op === 'create') {
      const d = nd()
      return c.registered() && id === `${c.uid}_${f(d, 'classId')}` && keysOnly(d, ['uid', 'classId', 'className', 'joinedAt'])
        && f(d, 'uid') === c.uid && str(f(d, 'className'), 80) && isReq(f(d, 'joinedAt'), now)
        && c.exists(`classes/${f(d, 'classId')}/members/${c.uid}`)
    }
    if (op === 'delete') return c.registered() && f(rd(), 'uid') === c.uid
    return false
  }
  if (col === 'courses') {
    if (path.length === 2) {
      if (read) return c.registered() || c.isAdmin()
      if (op === 'delete') return (await c.isAdmin()) && f(rd(), 'ownerUid') === c.uid
      const d = nd()
      const items = f(d, 'items')
      return (await c.isAdmin()) && (await c.can('createQuiz')) && f(d, 'ownerUid') === c.uid
        && (res === null || f(res, 'ownerUid') === c.uid)
        && keysOnly(d, ['ownerUid', 'ownerName', 'title', 'description', 'items', 'createdAt', 'updatedAt', 'coverEmoji'])
        && str(f(d, 'title'), 120) && size(f(d, 'title')) >= 3 && str(g(d, 'description', ''), 500)
        && Array.isArray(items) && items.length >= 1 && items.length <= 50
    }
    if (path.length === 4 && sub === 'progress') {
      const uid = subId
      if (read) return (c.registered() && c.uid === uid) || ((await c.isAdmin()) && g(await c.get(`courses/${id}`), 'ownerUid', '') === c.uid)
      if (op === 'delete') return false
      const d = nd(), done = f(d, 'done')
      return c.registered() && c.uid === uid && keysOnly(d, ['uid', 'name', 'done', 'completedAt', 'at'])
        && f(d, 'uid') === uid && Array.isArray(done) && done.length <= 50 && isReq(f(d, 'at'), now)
    }
    return false
  }
  if (col === 'plays' && path.length === 2) {
    if (read) return (await ok(() => c.registered() && f(rd(), 'uid') === c.uid)) || c.can('console')
    if (op === 'create') {
      const d = nd()
      return c.registered() && id === `${c.uid}_${f(d, 'gameId')}`
        && keysOnly(d, ['uid', 'gameId', 'title', 'rank', 'total', 'score', 'correct', 'questions', 'at'])
        && f(d, 'uid') === c.uid && isReq(f(d, 'at'), now) && str(f(d, 'title'), 120)
        && isInt(f(d, 'score')) && isInt(f(d, 'rank'))
        && c.exists(`games/${f(d, 'gameId')}/players/${c.uid}`)
    }
    if (op === 'delete') return c.registered() && f(rd(), 'uid') === c.uid
    return false
  }
  if (col === 'licenses' && path.length === 2) {
    if (read) return c.can('console')
    if (op === 'create') {
      const d = nd()
      return (await c.can('console')) && keysOnly(d, ['uid', 'email', 'plan', 'seats', 'from', 'until', 'amount', 'currency', 'note', 'by', 'at'])
        && f(d, 'by') === c.uid && isReq(f(d, 'at'), now) && inList(f(d, 'plan'), ['trainer', 'pro', 'business', 'institution', 'revoked'])
        && isNum(f(d, 'amount')) && (f(d, 'amount') as number) >= 0 && str(g(d, 'note', ''), 300)
    }
    return c.isSuper()
  }
  if (col === 'licenseRequests' && path.length === 2) {
    if (read) return (await c.can('console')) || (c.registered() && f(rd(), 'uid') === c.uid)
    if (op === 'create') {
      const d = nd()
      return c.registered() && keysOnly(d, ['uid', 'email', 'name', 'phone', 'organization', 'plan', 'seats', 'message', 'status', 'createdAt'])
        && f(d, 'uid') === c.uid && f(d, 'status') === 'new' && isReq(f(d, 'createdAt'), now)
        && inList(f(d, 'plan'), ['trainer', 'pro', 'business', 'institution', 'event', 'custom'])
        && str(f(d, 'name'), 80) && str(f(d, 'phone'), 30) && str(g(d, 'message', ''), 1000) && str(g(d, 'organization', ''), 120)
    }
    if (op === 'update') return (await c.can('console')) && onlyAffected(nd(), rd(), ['status', 'note', 'updatedAt'])
      && inList(f(nd(), 'status'), ['new', 'contacted', 'won', 'lost'])
    return c.isSuper() || (c.registered() && f(rd(), 'uid') === c.uid)
  }
  if (col === 'errors' && path.length === 2) {
    if (read || op === 'delete') return c.can('logs')
    if (op === 'create') {
      const d = nd()
      return c.signedIn() && keysOnly(d, ['message', 'stack', 'url', 'ua', 'uid', 'at', 'context'])
        && isStr(f(d, 'message')) && size(f(d, 'message')) <= 500
        && (!has(d, 'stack') || size(f(d, 'stack')) <= 4000) && isReq(f(d, 'at'), now)
    }
    return false
  }

  // ---------- games ----------
  if (col === 'games' && path.length === 2) {
    const gid = id
    if (op === 'list') return (await c.can('allContent')) || ((await c.isAdmin()) && f(rd(), 'hostUid') === c.uid)
      || ((await c.isOrgOwner()) && g(rd(), 'orgId', '') === c.uid)
    if (op === 'get') return (await c.can('allContent')) || ((await c.isAdmin()) && (await ok(() => f(rd(), 'hostUid') === c.uid))) || (await c.isPlayer(gid))
      || (c.signedIn() && (await ok(() => f(rd(), 'phase') !== 'finished'))) || ((await c.isOrgOwner()) && g(rd(), 'orgId', '') === c.uid)
    const manage = async () => (await c.isAdmin()) && ((await ok(() => f(rd(), 'hostUid') === c.uid)) || (await c.isOwner()) || ((await c.isOrgOwner()) && g(rd(), 'orgId', '') === c.uid))
    if (op === 'create') return (await c.can('runGames')) && f(nd(), 'hostUid') === c.uid
      && inList(g(nd(), 'orgId', ''), ['', await c.orgOf()])
      && (g(f(nd(), 'settings'), 'maxPlayers', 200) as number) <= (await c.playerCap())
    if (op === 'update') {
      if (!(await manage())) return false
      const nm = g(f(nd(), 'settings'), 'maxPlayers', 200) as number
      return nm <= (await c.playerCap()) || nm <= (g(f(rd(), 'settings'), 'maxPlayers', 200) as number)
    }
    return manage()
  }

  if (col === 'games' && path.length === 4) {
    const gid = id
    const game = () => c.game(gid)
    if (sub === 'secret') return c.isGameHost(gid)

    if (sub === 'players') {
      const uid = subId
      if (read) return (await c.isGameHost(gid)) || (c.signedIn() && c.uid === uid)
      if (op === 'create') {
        const d = nd(), gm = await game()
        const pw = g(d, 'powerups', null)
        return c.signedIn() && c.uid === uid
          && f(gm, 'locked') === false && f(gm, 'phase') !== 'finished'
          && (f(gm, 'phase') === 'lobby' || f(f(gm, 'settings'), 'lateJoin') === true)
          && nameOk(f(d, 'firstName')) && nameOk(f(d, 'lastName'))
          && (g(f(gm, 'settings'), 'nameFilter', true) === false || ((await c.nameAllowed(f(d, 'firstName'))) && (await c.nameAllowed(f(d, 'lastName')))))
          && (g(gm, 'playerCount', 0) as number) < (g(f(gm, 'settings'), 'maxPlayers', 200) as number)
          && isMap(f(d, 'avatar'))
          && keysOnly(d, ['firstName', 'lastName', 'avatar', 'joinedAt', 'lastSeen', 'kicked', 'score', 'correctCount', 'streak', 'bestStreak', 'totalCorrectTimeMs', 'lastResult', 'history', 'powerups', 'power', 'fiftyHide', 'team'])
          && f(d, 'score') === 0 && f(d, 'correctCount') === 0 && size(f(d, 'history')) === 0
          && (!has(d, 'fiftyHide') || f(d, 'fiftyHide') === null)
          && (!has(d, 'powerups') || ((f(pw, 'fifty') as number) <= 1 && (f(pw, 'double') as number) <= 1 && (f(pw, 'shield') as number) <= 1))
          && (!has(d, 'team') || (isInt(f(d, 'team')) && (f(d, 'team') as number) >= 0 && (f(d, 'team') as number) < 4))
          && f(d, 'kicked') === false
      }
      if (op === 'update') {
        if (await c.isGameHost(gid)) return true
        if (!(c.signedIn() && c.uid === uid)) return false
        const d = nd()
        if (!onlyAffected(d, rd(), ['firstName', 'lastName', 'avatar', 'lastSeen', 'power'])) return false
        if (anyAffected(d, rd(), ['firstName', 'lastName', 'avatar']) && f(await game(), 'phase') !== 'lobby') return false
        if (!nameOk(f(d, 'firstName')) || !nameOk(f(d, 'lastName'))) return false
        if (!anyAffected(d, rd(), ['power']) || f(d, 'power') === null) return true
        const p = f(d, 'power'), gm = await game()
        return inList(f(p, 'type'), ['fifty', 'double', 'shield'])
          && (eq(f(p, 'q'), f(gm, 'questionIndex')) || (f(gm, 'phase') === 'self' && isInt(f(p, 'q')) && (f(p, 'q') as number) < (f(gm, 'totalQuestions') as number)))
      }
      return c.isGameHost(gid)
    }

    if (sub === 'starts') {
      if (read) return (await c.isGameHost(gid)) || (c.signedIn() && f(rd(), 'uid') === c.uid)
      if (op === 'create') {
        const d = nd(), gm = await game()
        if (!(c.signedIn() && subId === `${c.uid}_${f(d, 'q')}` && keysOnly(d, ['uid', 'q', 'startedAt']) && f(d, 'uid') === c.uid
          && isReq(f(d, 'startedAt'), now) && isInt(f(d, 'q')) && (f(d, 'q') as number) >= 0 && (f(d, 'q') as number) < (f(gm, 'totalQuestions') as number))) return false
        return (f(gm, 'phase') === 'self' && now <= ms(f(gm, 'selfEndsAt')))
          || (inList(f(gm, 'phase'), ['countdown', 'question']) && eq(f(d, 'q'), f(gm, 'questionIndex')) && (await c.isPlayer(gid)))
      }
      if (op === 'delete') return c.isGameHost(gid)
      return false
    }

    if (sub === 'answers') {
      if (read) return c.isGameHost(gid)
      if (op === 'create') {
        const d = nd()
        if (!(c.signedIn() && subId === `${c.uid}_${f(d, 'questionIndex')}` && keysOnly(d, ['uid', 'questionIndex', 'value', 'answeredAt', 'conf']) && typeof g(d, 'conf', false) === 'boolean'
          && f(d, 'uid') === c.uid && isReq(f(d, 'answeredAt'), now) && answerValueOk(f(d, 'value')))) return false
        const pp = `games/${gid}/players/${c.uid}`
        if (!(await c.exists(pp)) || f(await c.get(pp), 'kicked') !== false) return false
        const gm = await game()
        if (inList(f(gm, 'phase'), ['countdown', 'question']) && eq(f(d, 'questionIndex'), f(gm, 'questionIndex'))
          && f(gm, 'questionEndsAt') !== null && f(gm, 'questionStartedAt') !== null
          && now >= ms(f(gm, 'questionStartedAt')) - 2000 && now <= ms(f(gm, 'questionEndsAt')) + 2000) return true
        return f(gm, 'phase') === 'self' && now <= ms(f(gm, 'selfEndsAt')) + 5000 && (await c.exists(`games/${gid}/starts/${subId}`))
      }
      if (op === 'delete') return c.isGameHost(gid)
      return false
    }

    if (sub === 'reactions') {
      if (read || op === 'delete') return c.isGameHost(gid)
      if (op === 'create') {
        const d = nd(), bucket = Math.floor(now / 2000)
        return c.signedIn() && keysOnly(d, ['uid', 'emoji', 'createdAt']) && f(d, 'uid') === c.uid
          && isStr(f(d, 'emoji')) && size(f(d, 'emoji')) <= 8 && isReq(f(d, 'createdAt'), now)
          && (await c.isPlayer(gid)) && (subId === `${c.uid}_${bucket}` || subId === `${c.uid}_${bucket - 1}`)
      }
      return false
    }

    if (sub === 'qa') {
      if (read) return (await c.isGameHost(gid)) || (await c.isPlayer(gid))
      if (op === 'create') {
        const d = nd(), bucket = Math.floor(now / 10000)
        return (await c.isPlayer(gid)) && (subId === `${c.uid}_${bucket}` || subId === `${c.uid}_${bucket - 1}`)
          && keysOnly(d, ['uid', 'name', 'text', 'createdAt', 'votes', 'answered', 'hidden'])
          && f(d, 'uid') === c.uid && isStr(f(d, 'text')) && size(f(d, 'text')) >= 3 && size(f(d, 'text')) <= 200
          && isStr(f(d, 'name')) && size(f(d, 'name')) <= 40 && isReq(f(d, 'createdAt'), now)
          && size(f(d, 'votes')) === 0 && f(d, 'answered') === false && f(d, 'hidden') === false
          && f(await game(), 'phase') !== 'finished'
      }
      if (op === 'update') {
        if (await c.isGameHost(gid)) return true
        if (!(await c.isPlayer(gid)) || !onlyAffected(nd(), rd(), ['votes'])) return false
        const a = new Set((f(nd(), 'votes') as J[]).map(String)), b = new Set((f(rd(), 'votes') as J[]).map(String))
        const sym = new Set([...[...a].filter((x) => !b.has(x)), ...[...b].filter((x) => !a.has(x))])
        return sym.size === 1 && sym.has(c.uid)
      }
      return c.isGameHost(gid)
    }

    if (sub === 'results') {
      if (read) return (await c.isGameHost(gid)) || (await c.isPlayer(gid))
      return c.isGameHost(gid)
    }

    if (sub === 'feedback') {
      if (read || op === 'delete') return c.isGameHost(gid)
      const d = nd()
      return c.signedIn() && c.uid === subId && keysOnly(d, ['rating', 'comment', 'name', 'at'])
        && isInt(f(d, 'rating')) && (f(d, 'rating') as number) >= 1 && (f(d, 'rating') as number) <= 5
        && (!has(d, 'comment') || (isStr(f(d, 'comment')) && size(f(d, 'comment')) <= 500))
        && isReq(f(d, 'at'), now) && (await c.exists(`games/${gid}/players/${c.uid}`))
    }
  }

  void write
  return false
}
