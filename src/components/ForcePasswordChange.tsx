import { useState } from 'react'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, type User } from 'firebase/auth'
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { KeyRound, LogOut } from 'lucide-react'
import { db } from '../firebase/config'
import { logout } from '../firebase/auth'
import { logAudit } from '../lib/audit'
import { t } from '../i18n/az'
import { Logo } from './Brand'

const A = t.access
export const strongEnough = (p: string) => p.length >= 10 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p)

/**
 * İlk girişdə məcburi şifrə dəyişmə (bağlana bilməyən pəncərə).
 * Yeni şifrə yalnız Firebase Auth-a gedir — heç bir yerdə saxlanmır, admin onu görə bilməz.
 */
export function ForcePasswordChange({ user }: { user: User }) {
  const [cur, setCur] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    if (!strongEnough(pw)) return setErr(A.pwWeak)
    if (pw !== pw2) return setErr(A.pwMismatch)
    if (pw === cur) return setErr(A.pwSame)
    setBusy(true)
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email ?? '', cur))
      await updatePassword(user, pw)
      await logAudit('password_changed') // əvvəl jurnal, sonra bayraq — pəncərə yalnız qeyd yazılandan sonra bağlanır
      await updateDoc(doc(db, 'admins', user.uid), { mustChangePassword: false, passwordChangedAt: serverTimestamp() })
    } catch (ex) {
      const code = (ex as { code?: string }).code ?? ''
      setErr(code.includes('wrong-password') || code.includes('invalid-credential') ? A.pwWrong : code.includes('weak-password') ? A.pwWeak : t.app.error)
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-night/80 p-4 backdrop-blur" role="dialog" aria-modal="true" aria-labelledby="pw-title">
      <form onSubmit={save} className="w-full max-w-md rounded-3xl bg-panel p-6 text-ink shadow-2xl sm:p-8">
        <div className="mb-5 flex items-center justify-between">
          <Logo size={30} dark={false} />
          <button type="button" className="btn btn-ghost-dark btn-sm" onClick={() => void logout()}><LogOut className="h-4 w-4" />{t.admin.logout}</button>
        </div>
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl text-white" style={{ background: 'var(--grad)' }}><KeyRound /></span>
        <h2 id="pw-title" className="text-2xl font-black">{A.pwTitle}</h2>
        <p className="mt-1 text-sm text-muted">{A.pwText}</p>
        <div className="mt-5 flex flex-col gap-3">
          <label className="text-sm font-semibold">{A.pwCurrent}
            <input className="input mt-1" type="password" autoComplete="current-password" required value={cur} onChange={(e) => setCur(e.target.value)} />
          </label>
          <label className="text-sm font-semibold">{A.pwNew}
            <input className="input mt-1" type="password" autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
          </label>
          <label className="text-sm font-semibold">{A.pwRepeat}
            <input className="input mt-1" type="password" autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </label>
          <p className={`text-xs ${pw && !strongEnough(pw) ? 'text-red-300' : 'text-muted'}`}>{A.pwRules}</p>
          {err && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300" role="alert">{err}</p>}
          <button className="btn btn-primary mt-1" disabled={busy}>{busy ? t.app.loading : A.pwSave}</button>
        </div>
      </form>
    </div>
  )
}
