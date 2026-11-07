import { onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { doc, getDoc, onSnapshot, type DocumentSnapshot } from 'firebase/firestore'
import { effectivePerms, normalizeRole, SUPER_UID, type AccessConfig, type PermMap, type Perms, type Role } from '../lib/roles'
import { logAudit } from '../lib/audit'
import { useEffect, useState } from 'react'
import { auth, db } from './config'

export function waitForUser(): Promise<User | null> {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub()
      resolve(u)
    })
  })
}

/**
 * Oyunçu üçün: mövcud sessiyanı saxla, yoxdursa anonim giriş.
 * Eyni anda bir neçə çağırış (məs. qoşulma səhifəsi + oyun ekranı) TƏK giriş paylaşır — əks halda hər biri ayrı
 * anonim hesab yaradır, səhifə köhnə uid-i saxlayır və yazılar "icazə yoxdur" ilə rədd olunurdu ("Lobbi bağlıdır").
 */
let pendingAnon: Promise<User> | null = null
export function ensureAnonymous(): Promise<User> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser)
  if (!pendingAnon) {
    pendingAnon = (async () => {
      const u = await waitForUser()
      if (u) return u
      const cred = await signInAnonymously(auth)
      await cred.user.getIdToken() // token hazır olsun ki, ilk Firestore sorğusu anonim (icazəsiz) getməsin
      return cred.user
    })().finally(() => { pendingAnon = null })
  }
  return pendingAnon
}

export type { Role } from '../lib/roles'

export interface AdminInfo { role: Role; disabled: boolean; mustChangePassword: boolean; name?: string }

export async function adminInfo(uid: string): Promise<AdminInfo | null> {
  if (uid === SUPER_UID) {
    const snap = await getDoc(doc(db, 'admins', uid)).catch(() => null)
    return { role: 'super', disabled: false, mustChangePassword: !!snap?.get('mustChangePassword'), name: snap?.get('name') }
  }
  try {
    const snap = await getDoc(doc(db, 'admins', uid))
    if (!snap.exists()) return null
    return { role: normalizeRole(snap.get('role'), uid), disabled: snap.get('disabled') === true, mustChangePassword: snap.get('mustChangePassword') === true, name: snap.get('name') }
  } catch {
    return null
  }
}
export const adminRole = async (uid: string) => { const i = await adminInfo(uid); return i && !i.disabled ? i.role : null }
export const checkAdmin = async (uid: string) => (await adminRole(uid)) !== null

export async function adminLogin(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
  const info = await adminInfo(cred.user.uid)
  if (!info || info.disabled) {
    await signOut(auth)
    throw new Error(info?.disabled ? 'disabled' : 'not-admin')
  }
  void logAudit('login')
  return cred.user
}

export const logout = () => signOut(auth)

export type AdminState = {
  loading: boolean; user: User | null; isAdmin: boolean; role: Role | null
  disabled: boolean; mustChangePassword: boolean
  /** Effektiv icazələr (rol standartı + fərdi istisnalar). Əsl yoxlama Rules-dadır. */
  perms: Perms
}

const NONE: Perms = effectivePerms(null, null, undefined)

/**
 * Admin sessiyası. Öz komanda sənədi və rol icazələri (settings/access) CANLI dinlənilir:
 * məhdudlaşdırma, rol və ya icazə dəyişikliyi açıq sessiyada dərhal qüvvəyə minir.
 */
export function useAdmin(): AdminState {
  const [state, setState] = useState<AdminState>({ loading: true, user: null, isAdmin: false, role: null, disabled: false, mustChangePassword: false, perms: NONE })
  useEffect(() => {
    let unsubs: (() => void)[] = []
    const stop = () => { unsubs.forEach((u) => u()); unsubs = [] }
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      stop()
      if (!u || u.isAnonymous) return setState({ loading: false, user: u, isAdmin: false, role: null, disabled: false, mustChangePassword: false, perms: NONE })
      let me: DocumentSnapshot | null = null
      let cfg: AccessConfig | null = null
      let cfgLoaded = false
      const emit = () => {
        if (!me || !cfgLoaded) return
        const isSuper = u.uid === SUPER_UID
        if (!me.exists() && !isSuper) return setState({ loading: false, user: u, isAdmin: false, role: null, disabled: false, mustChangePassword: false, perms: NONE })
        const disabled = !isSuper && me.get('disabled') === true
        const role = normalizeRole(me.get('role'), u.uid)
        setState({
          loading: false, user: u, isAdmin: !disabled, role, disabled, mustChangePassword: me.get('mustChangePassword') === true,
          perms: disabled ? NONE : effectivePerms(role, cfg, me.get('perms') as PermMap | undefined),
        })
      }
      const fail = () => setState({ loading: false, user: u, isAdmin: false, role: null, disabled: false, mustChangePassword: false, perms: NONE })
      unsubs.push(onSnapshot(doc(db, 'admins', u.uid), (s) => { me = s; emit() }, fail))
      unsubs.push(onSnapshot(doc(db, 'settings', 'access'), (s) => { cfg = s.exists() ? (s.data() as AccessConfig) : null; cfgLoaded = true; emit() }, () => { cfgLoaded = true; emit() }))
    })
    return () => { unsubAuth(); stop() }
  }, [])
  return state
}
