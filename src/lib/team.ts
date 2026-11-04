import { deleteApp, initializeApp } from 'firebase/app'
import { createUserWithEmailAndPassword, getAuth, inMemoryPersistence, setPersistence, signOut } from 'firebase/auth'
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore'
import { app, auth, db } from '../firebase/config'
import type { Role } from '../firebase/auth'

export interface AdminRow { uid: string; email: string; role: Role; name?: string }

export async function listAdmins(): Promise<AdminRow[]> {
  const s = await getDocs(collection(db, 'admins'))
  return s.docs.map((d) => ({ uid: d.id, email: d.get('email') ?? '', role: (d.get('role') as Role) ?? 'trainer', name: d.get('name') ?? '' }))
}

export function tempPassword() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const r = crypto.getRandomValues(new Uint32Array(12))
  return 'Qz-' + Array.from(r, (x) => a[x % a.length]).join('') + '!'
}

/**
 * Yeni təlimçi hesabı: ikinci (müvəqqəti) Firebase tətbiqi ilə yaradılır ki,
 * sahibin öz sessiyası dəyişməsin. Sonra admins/{uid} sənədi sahib tərəfindən yazılır.
 */
export async function createTrainer(email: string, name: string, role: Role) {
  const secondary = initializeApp(app.options, `invite-${Date.now()}`)
  const a2 = getAuth(secondary)
  await setPersistence(a2, inMemoryPersistence)
  const password = tempPassword()
  try {
    const cred = await createUserWithEmailAndPassword(a2, email.trim(), password)
    await setDoc(doc(db, 'admins', cred.user.uid), { email: email.trim(), name: name.trim(), role, createdAt: serverTimestamp(), createdBy: auth.currentUser?.uid ?? '' })
    await signOut(a2)
    return { uid: cred.user.uid, password }
  } finally {
    await deleteApp(secondary)
  }
}

export const setRole = (uid: string, row: AdminRow, role: Role) => setDoc(doc(db, 'admins', uid), { email: row.email, name: row.name ?? '', role }, { merge: true })
export const removeAdmin = (uid: string) => deleteDoc(doc(db, 'admins', uid))
