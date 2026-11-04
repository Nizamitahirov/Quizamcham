import { onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
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

/** Oyunçu üçün: mövcud sessiyanı saxla, yoxdursa anonim giriş. */
export async function ensureAnonymous(): Promise<User> {
  const u = await waitForUser()
  if (u) return u
  const cred = await signInAnonymously(auth)
  return cred.user
}

export type Role = 'owner' | 'trainer'

export async function adminRole(uid: string): Promise<Role | null> {
  try {
    const snap = await getDoc(doc(db, 'admins', uid))
    return snap.exists() ? ((snap.get('role') as Role) ?? 'trainer') : null
  } catch {
    return null
  }
}
export const checkAdmin = async (uid: string) => (await adminRole(uid)) !== null

export async function adminLogin(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
  const ok = await checkAdmin(cred.user.uid)
  if (!ok) {
    await signOut(auth)
    throw new Error('not-admin')
  }
  return cred.user
}

export const logout = () => signOut(auth)

export type AdminState = { loading: boolean; user: User | null; isAdmin: boolean; role: Role | null }

export function useAdmin(): AdminState {
  const [state, setState] = useState<AdminState>({ loading: true, user: null, isAdmin: false, role: null })
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u || u.isAnonymous) return setState({ loading: false, user: u, isAdmin: false, role: null })
      const role = await adminRole(u.uid)
      setState({ loading: false, user: u, isAdmin: role !== null, role })
    })
  }, [])
  return state
}
