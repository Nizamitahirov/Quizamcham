import { deleteApp, initializeApp } from 'firebase/app'
import { createUserWithEmailAndPassword, getAuth, inMemoryPersistence, sendPasswordResetEmail, setPersistence, signOut } from 'firebase/auth'
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { app, auth, db } from '../firebase/config'
import { normalizeRole, type Role } from './roles'
import { logAudit } from './audit'

export interface AdminRow { uid: string; email: string; role: Role; name?: string; disabled: boolean; mustChangePassword: boolean }

const ORDER: Record<Role, number> = { super: 0, admin: 1, trainer: 2 }

export async function listAdmins(): Promise<AdminRow[]> {
  const s = await getDocs(collection(db, 'admins'))
  return s.docs
    .map((d) => ({
      uid: d.id, email: d.get('email') ?? '', role: normalizeRole(d.get('role'), d.id), name: d.get('name') ?? '',
      disabled: d.get('disabled') === true, mustChangePassword: d.get('mustChangePassword') === true,
    }))
    .sort((a, b) => ORDER[a.role] - ORDER[b.role] || a.email.localeCompare(b.email))
}

export function tempPassword() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const r = crypto.getRandomValues(new Uint32Array(12))
  return 'Qz-' + Array.from(r, (x) => a[x % a.length]).join('') + '7!'
}

/**
 * Yeni üzv: ikinci (müvəqqəti) Firebase tətbiqi ilə yaradılır ki, yaradanın öz sessiyası dəyişməsin.
 * mustChangePassword=true → ilk girişdə yeni şifrə təyin etmədən heç nəyə keçə bilməz.
 */
export async function createMember(email: string, name: string, role: Exclude<Role, 'super'>) {
  const secondary = initializeApp(app.options, `invite-${Date.now()}`)
  const a2 = getAuth(secondary)
  await setPersistence(a2, inMemoryPersistence)
  const password = tempPassword()
  try {
    const cred = await createUserWithEmailAndPassword(a2, email.trim(), password)
    await setDoc(doc(db, 'admins', cred.user.uid), {
      email: email.trim(), name: name.trim(), role, disabled: false, mustChangePassword: true,
      createdAt: serverTimestamp(), createdBy: auth.currentUser?.uid ?? '',
    })
    await signOut(a2)
    void logAudit('member_created', { target: cred.user.uid, targetEmail: email.trim(), details: { role } })
    return { uid: cred.user.uid, password }
  } finally {
    await deleteApp(secondary)
  }
}

const stamp = () => ({ updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.uid ?? '' })

export async function setRole(row: AdminRow, role: Exclude<Role, 'super'>) {
  await updateDoc(doc(db, 'admins', row.uid), { role, ...stamp() })
  void logAudit('member_role', { target: row.uid, targetEmail: row.email, details: { from: row.role, to: role } })
}

/** Məhdudlaşdırma: hesab silinmir, amma Rules bütün admin hüquqlarını dərhal bağlayır. */
export async function setRestricted(row: AdminRow, disabled: boolean) {
  await updateDoc(doc(db, 'admins', row.uid), { disabled, ...stamp() })
  void logAudit(disabled ? 'member_restricted' : 'member_unrestricted', { target: row.uid, targetEmail: row.email })
}

/** Şifrə sıfırlama: Firebase istifadəçinin e-poçtuna link göndərir; yeni şifrəni yalnız o özü təyin edir. */
export async function sendReset(row: AdminRow) {
  await sendPasswordResetEmail(auth, row.email)
  void logAudit('password_reset_sent', { target: row.uid, targetEmail: row.email })
}

export async function removeMember(row: AdminRow) {
  await deleteDoc(doc(db, 'admins', row.uid))
  void logAudit('member_removed', { target: row.uid, targetEmail: row.email, details: { role: row.role } })
}
