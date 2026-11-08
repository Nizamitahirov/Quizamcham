import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { confirmPasswordReset } from 'firebase/auth'
import { CheckCircle2, KeyRound } from 'lucide-react'
import { auth } from '../../firebase/config'
import { t } from '../../i18n/az'
import { Logo } from '../../components/Brand'

/** E-poçtdakı keçidlə yeni şifrə təyini (/reset?token=… — Firebase rejimində ?oobCode=…). */
export default function ResetPassword() {
  const [sp] = useSearchParams()
  const code = sp.get('token') ?? sp.get('oobCode') ?? ''
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    if (pw.length < 8) return setErr(t.resetPw.short)
    if (pw !== pw2) return setErr(t.resetPw.mismatch)
    setBusy(true)
    try { await confirmPasswordReset(auth, code, pw); setDone(true) } catch { setErr(t.resetPw.expired) } finally { setBusy(false) }
  }
  const input = 'w-full rounded-xl border border-line bg-white px-4 py-3 text-ink outline-none focus:border-brand'
  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface px-4 py-10 text-ink">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-white p-6 shadow-sm">
        <div className="mb-6 flex justify-center"><Logo /></div>
        {done ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-600" aria-hidden />
            <p className="mb-5">{t.resetPw.done}</p>
            <Link to="/admin/login" className="inline-block rounded-xl bg-brand px-5 py-3 font-semibold text-white">{t.resetPw.login}</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <h1 className="mb-2 flex items-center gap-2 text-xl font-bold"><KeyRound className="h-5 w-5" aria-hidden />{t.resetPw.title}</h1>
            <label className="sr-only" htmlFor="rp1">{t.resetPw.pw}</label>
            <input id="rp1" type="password" autoComplete="new-password" placeholder={t.resetPw.pw} className={input} value={pw} onChange={(e) => setPw(e.target.value)} />
            <label className="sr-only" htmlFor="rp2">{t.resetPw.pw2}</label>
            <input id="rp2" type="password" autoComplete="new-password" placeholder={t.resetPw.pw2} className={input} value={pw2} onChange={(e) => setPw2(e.target.value)} />
            {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
            <button disabled={busy || !code} className="w-full rounded-xl bg-brand py-3 font-semibold text-white disabled:opacity-60">{t.resetPw.save}</button>
            {!code && <p className="text-sm text-red-700">{t.resetPw.expired}</p>}
          </form>
        )}
      </div>
    </main>
  )
}
