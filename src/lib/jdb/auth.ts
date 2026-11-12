/**
 * "firebase/auth" uyğun interfeys. Sessiya tokeni localStorage-da saxlanılır (inMemoryPersistence ilə — yalnız yaddaşda).
 * Google girişi: Google OAuth (id_token) popup/yönləndirmə; ID token serverdə yoxlanılır.
 */
import { apiBase, FirebaseError, getApp, http, type FirebaseApp } from './app'

export interface UserInfo { providerId: string; uid: string; email: string | null; displayName: string | null; photoURL: string | null }
export interface User {
  uid: string; email: string | null; displayName: string | null; photoURL: string | null; isAnonymous: boolean
  emailVerified: boolean; providerId: string; providerData: UserInfo[]
  metadata: Record<string, string | undefined>
  getIdToken(forceRefresh?: boolean): Promise<string>
  reload(): Promise<void>
  delete(): Promise<void>
}
export interface UserCredential { user: User; providerId: string | null; operationType: 'signIn' }
type Persistence = { type: 'LOCAL' | 'NONE' }
export const browserLocalPersistence: Persistence = { type: 'LOCAL' }
export const inMemoryPersistence: Persistence = { type: 'NONE' }

interface ServerUser { uid: string; email: string | null; displayName: string | null; photoURL: string | null; isAnonymous: boolean; provider: string }
type Listener = (u: User | null) => void

export class Auth {
  currentUser: User | null = null
  _token: string | null = null
  _persistence: Persistence = browserLocalPersistence
  _listeners = new Set<Listener>()
  _ready: Promise<void>
  _pendingPassword: string | null = null
  readonly name: string
  constructor(public app: FirebaseApp) {
    this.name = app.name
    this._ready = this._restore()
  }
  get _key() { return `jabr.auth.${this.app.name}` }
  get _base() { return apiBase(this.app) }
  /** Firestore modulu üçün: sorğu başlıqları. */
  async _headers(): Promise<Record<string, string>> {
    await this._ready
    return this._token ? { authorization: `Bearer ${this._token}` } : {}
  }
  async _restore() {
    let saved: { token: string; user: ServerUser } | null = null
    try { saved = JSON.parse(localStorage.getItem(this._key) ?? 'null') } catch { saved = null }
    if (!saved?.token) return
    this._token = saved.token
    this.currentUser = this._mkUser(saved.user)
    // sessiya hələ etibarlıdırmı? (arxa planda; şəbəkə xətasında mövcud sessiya saxlanılır)
    void http<{ user: ServerUser }>(this._base, '/api/auth/me', undefined, { authorization: `Bearer ${saved.token}` }, 'auth/')
      .then((r) => { if (this._token === saved!.token) { this.currentUser = this._mkUser(r.user); this._save(); this._emit() } })
      .catch((e: FirebaseError) => { if (this._token === saved!.token && e.code === 'auth/unauthenticated') void this._set(null, null) })
  }
  _save() {
    if (this._persistence.type !== 'LOCAL') return
    try {
      if (this._token && this.currentUser) localStorage.setItem(this._key, JSON.stringify({ token: this._token, user: this._serverUser(this.currentUser) }))
      else localStorage.removeItem(this._key)
    } catch { /* gizli rejim */ }
  }
  _serverUser(u: User): ServerUser {
    return { uid: u.uid, email: u.email, displayName: u.displayName, photoURL: u.photoURL, isAnonymous: u.isAnonymous, provider: u.providerData[0]?.providerId ?? (u.isAnonymous ? 'anonymous' : 'password') }
  }
  _mkUser(s: ServerUser): User {
    const auth = this // eslint-disable-line @typescript-eslint/no-this-alias
    const providerId = s.provider === 'anonymous' ? 'anonymous' : s.provider
    const user: User = {
      uid: s.uid, email: s.email, displayName: s.displayName, photoURL: s.photoURL, isAnonymous: s.isAnonymous,
      emailVerified: s.provider === 'google.com', providerId: 'firebase',
      providerData: s.isAnonymous ? [] : [{ providerId, uid: s.uid, email: s.email, displayName: s.displayName, photoURL: s.photoURL }],
      metadata: {},
      async getIdToken() { await auth._ready; return auth._token ?? '' },
      async reload() {
        const r = await http<{ user: ServerUser }>(auth._base, '/api/auth/me', undefined, await auth._headers(), 'auth/')
        auth.currentUser = auth._mkUser(r.user); auth._save()
      },
      async delete() {
        await http(auth._base, '/api/auth/delete', {}, await auth._headers(), 'auth/')
        await auth._set(null, null)
      },
    }
    Object.defineProperty(user, '_auth', { value: auth, enumerable: false })
    return user
  }
  async _set(token: string | null, user: ServerUser | null) {
    this._token = token
    this.currentUser = user ? this._mkUser(user) : null
    this._save()
    this._emit()
    return this.currentUser
  }
  _emit() { for (const l of [...this._listeners]) l(this.currentUser) }
  _terminate() { this._listeners.clear() }
  async _call(path: string, body: unknown) {
    const r = await http<{ token: string; user: ServerUser }>(this._base, path, body, {}, 'auth/')
    const user = (await this._set(r.token, r.user))!
    return { user, providerId: r.user.provider === 'google.com' ? 'google.com' : null, operationType: 'signIn' as const }
  }
}

export function getAuth(app: FirebaseApp = getApp()): Auth {
  let a = app._services.get('auth') as Auth | undefined
  if (!a) { a = new Auth(app); app._services.set('auth', a) }
  return a
}
export const initializeAuth = (app: FirebaseApp) => getAuth(app)

export async function setPersistence(auth: Auth, p: Persistence) {
  auth._persistence = p
  if (p.type === 'NONE') try { localStorage.removeItem(auth._key) } catch { /* */ }
}

export function onAuthStateChanged(auth: Auth, next: Listener | { next: Listener }, _error?: unknown): () => void {
  const cb = typeof next === 'function' ? next : next.next.bind(next)
  auth._listeners.add(cb)
  let active = true
  void auth._ready.then(() => { if (active && auth._listeners.has(cb)) cb(auth.currentUser) })
  return () => { active = false; auth._listeners.delete(cb) }
}
export const onIdTokenChanged = onAuthStateChanged

export const signInAnonymously = (auth: Auth): Promise<UserCredential> => auth._call('/api/auth/anonymous', {})
export const signInWithEmailAndPassword = (auth: Auth, email: string, password: string): Promise<UserCredential> =>
  auth._call('/api/auth/signin', { email, password })
export const createUserWithEmailAndPassword = (auth: Auth, email: string, password: string): Promise<UserCredential> =>
  auth._call('/api/auth/signup', { email, password })

export async function signOut(auth: Auth) {
  const h = await auth._headers()
  await auth._set(null, null)
  await http(auth._base, '/api/auth/signout', {}, h, 'auth/').catch(() => {})
}

export async function sendPasswordResetEmail(auth: Auth, email: string) {
  await http(auth._base, '/api/auth/reset/request', { email, lang: (() => { try { return localStorage.getItem('qz.lang') ?? 'az' } catch { return 'az' } })() }, {}, 'auth/')
}
export async function confirmPasswordReset(auth: Auth, token: string, newPassword: string) {
  await http(auth._base, '/api/auth/reset/confirm', { token, newPassword }, {}, 'auth/')
}

// ---- şifrə dəyişmə: Firebase axını (reauthenticate → updatePassword) saxlanılır ----
export interface AuthCredential { providerId: string; email?: string; password?: string; idToken?: string }
export const EmailAuthProvider = {
  PROVIDER_ID: 'password',
  credential: (email: string, password: string): AuthCredential => ({ providerId: 'password', email, password }),
}
const authOf = (user: User): Auth => {
  const a = (user as User & { _auth?: Auth })._auth
  if (!a || a.currentUser?.uid !== user.uid) throw new FirebaseError('auth/user-mismatch')
  return a
}

export async function reauthenticateWithCredential(user: User, cred: AuthCredential): Promise<UserCredential> {
  const auth = authOf(user)
  // şifrəni yoxlayırıq (yeni sessiya almadan): serverdə ayrıca endpoint yoxdur — signin ilə yoxlanılır
  const r = await http<{ token: string }>(auth._base, '/api/auth/signin', { email: cred.email, password: cred.password }, {}, 'auth/')
    .catch((e: FirebaseError) => { throw new FirebaseError(e.code === 'auth/invalid-credential' ? 'auth/wrong-password' : e.code) })
  await http(auth._base, '/api/auth/signout', {}, { authorization: `Bearer ${r.token}` }).catch(() => {})
  auth._pendingPassword = cred.password ?? null
  return { user, providerId: 'password', operationType: 'signIn' }
}
export async function updatePassword(user: User, newPassword: string) {
  const auth = authOf(user)
  if (!auth._pendingPassword) throw new FirebaseError('auth/requires-recent-login')
  try {
    await http(auth._base, '/api/auth/password', { currentPassword: auth._pendingPassword, newPassword }, await auth._headers(), 'auth/')
  } finally { auth._pendingPassword = null }
}
export const deleteUser = (user: User) => user.delete()

// ---- Google ----
export class GoogleAuthProvider {
  static PROVIDER_ID = 'google.com'
  providerId = 'google.com'
  _params: Record<string, string> = {}
  setCustomParameters(p: Record<string, string>) { this._params = { ...p }; return this }
  addScope() { return this }
  static credential(idToken: string): AuthCredential { return { providerId: 'google.com', idToken } }
}

const GOOGLE_CLIENT_ID = () => (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_GOOGLE_CLIENT_ID ?? ''
const REDIRECT_PATH = '/auth/google'
const STATE_KEY = 'jabr.google.state'

function googleUrl(provider: GoogleAuthProvider, state: string) {
  const clientId = GOOGLE_CLIENT_ID()
  if (!clientId) throw new FirebaseError('auth/operation-not-allowed', 'Google girişi konfiqurasiya olunmayıb')
  const q = new URLSearchParams({
    client_id: clientId, response_type: 'id_token', scope: 'openid email profile',
    redirect_uri: location.origin + REDIRECT_PATH, nonce: state, state, ...provider._params,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`
}
const randomState = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')

/** Popup: Google → /auth/google#id_token=... → həmin səhifə postMessage ilə tokeni qaytarır. */
export function signInWithPopup(auth: Auth, provider: GoogleAuthProvider): Promise<UserCredential> {
  return new Promise((resolve, reject) => {
    let url: string
    const state = randomState()
    try { url = googleUrl(provider, state) } catch (e) { reject(e); return }
    try { sessionStorage.setItem(STATE_KEY, state) } catch { /* */ }
    const w = window.open(url, 'jabr-google', 'width=480,height=640')
    if (!w) { reject(new FirebaseError('auth/popup-blocked')); return }
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.data?.type !== 'jabr-google') return
      cleanup()
      if (e.data.state !== state || !e.data.idToken) { reject(new FirebaseError('auth/invalid-credential')); return }
      auth._call('/api/auth/google', { idToken: e.data.idToken }).then(resolve, reject)
    }
    const timer = setInterval(() => { if (w.closed) { cleanup(); reject(new FirebaseError('auth/popup-closed-by-user')) } }, 500)
    const cleanup = () => { clearInterval(timer); window.removeEventListener('message', onMsg) }
    window.addEventListener('message', onMsg)
  })
}
export async function reauthenticateWithPopup(user: User, provider: GoogleAuthProvider) {
  const auth = authOf(user)
  const cred = await signInWithPopup(auth, provider)
  if (cred.user.uid !== user.uid) throw new FirebaseError('auth/user-mismatch')
  return cred
}
export async function signInWithRedirect(_auth: Auth, provider: GoogleAuthProvider): Promise<never> {
  const state = randomState()
  const url = googleUrl(provider, state)
  try { sessionStorage.setItem(STATE_KEY, state); sessionStorage.setItem('jabr.google.return', location.pathname + location.search) } catch { /* */ }
  location.assign(url)
  return new Promise<never>(() => {})
}
/** Yönləndirmədən qayıdanda: /auth/google səhifəsi tokeni sessionStorage-a yazır, burada istifadə olunur. */
export async function getRedirectResult(auth: Auth): Promise<UserCredential | null> {
  let token: string | null = null
  try { token = sessionStorage.getItem('jabr.google.idToken'); sessionStorage.removeItem('jabr.google.idToken') } catch { /* */ }
  if (!token) return null
  return auth._call('/api/auth/google', { idToken: token })
}

/**
 * /auth/google səhifəsində çağırılır (index.html-dən əvvəl, main.tsx-də): Google cavabını emal edir.
 * Popup-dadırsa açanı xəbərdar edib bağlanır; yönləndirmədirsə tokeni saxlayıb əvvəlki səhifəyə qayıdır.
 */
export function handleGoogleCallback(): boolean {
  if (typeof location === 'undefined' || location.pathname !== REDIRECT_PATH) return false
  const p = new URLSearchParams(location.hash.slice(1))
  const idToken = p.get('id_token'), state = p.get('state')
  let expected: string | null = null
  try { expected = sessionStorage.getItem(STATE_KEY) } catch { /* */ }
  if (window.opener && window.opener !== window) {
    window.opener.postMessage({ type: 'jabr-google', idToken, state }, location.origin)
    window.close()
    return true
  }
  let back = '/start'
  try {
    if (idToken && state && state === expected) sessionStorage.setItem('jabr.google.idToken', idToken)
    back = sessionStorage.getItem('jabr.google.return') || back
  } catch { /* */ }
  location.replace(back)
  return true
}
