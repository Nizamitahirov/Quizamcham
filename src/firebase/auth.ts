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

export async function checkAdmin(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'admins', uid))
    return snap.exists()
  } catch {
    return false
  }
}

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

export type AdminState = { loading: boolean; user: User | null; isAdmin: boolean }

export function useAdmin(): AdminState {
  const [state, setState] = useState<AdminState>({ loading: true, user: null, isAdmin: false })
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u || u.isAnonymous) return setState({ loading: false, user: u, isAdmin: false })
      const ok = await checkAdmin(u.uid)
      setState({ loading: false, user: u, isAdmin: ok })
    })
  }, [])
  return state
}
