import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { confirmPasswordReset } from 'firebase/auth'
import { CheckCircle2, Eye, EyeOff, KeyRound, Lock, RotateCcw } from 'lucide-react'
import { auth } from '../../firebase/config'
import { t } from '../../i18n/az'
import { Logo } from '../../components/Brand'
import { LangSwitch } from '../../components/LangSwitch'

/** Şifrə gücü: 0–4 (uzunluq, böyük/kiçik hərf, rəqəm, simvol). */
const strength = (pw: string) => (pw.length >= 8 ? 1 : 0) + (pw.length >= 12 ? 1 : 0) + (/[a-z]/.test(pw) && /[A-Z]/.test(pw) ? 1 : 0) + (/\d/.test(pw) && /[^\w\s]/.test(pw) ? 1 : 0)

/** E-poçtdakı keçidlə yeni şifrə təyini (/reset?token=… — Firebase rejimində ?oobCode=…). */
export default function ResetPassword() {
  const [sp] = useSearchParams()
  const code = sp.get('token') ?? sp.get('oobCode') ?? ''
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [expired, setExpired] = useState(!code)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const R = t.resetPw
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    if (pw.length < 8) return setErr(R.short)
    if (pw !== pw2) return setErr(R.mismatch)
    setBusy(true)
    try { await confirmPasswordReset(auth, code, pw); setDone(true) } catch { setExpired(true) } finally { setBusy(false) }
  }
  const s = strength(pw)
  return (
    <main className="bg-app flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 flex w-full max-w-sm items-center justify-between"><Link to="/" aria-label={t.app.home}><Logo size={32} /></Link><LangSwitch /></div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card hairline-top w-full max-w-sm p-6 sm:p-7">
        {done ? (
          <div className="text-center">
            <span className="icon-tile mx-auto mb-4 h-14 w-14 text-emerald-300"><CheckCircle2 className="h-6 w-6" /></span>
            <h1 className="text-xl font-bold tracking-tight">{R.done}</h1>
            <Link to="/admin/login" className="btn btn-primary mt-6 w-full">{R.login}</Link>
          </div>
        ) : expired ? (
          <div className="text-center">
            <span className="icon-tile mx-auto mb-4 h-14 w-14 text-amber-300"><RotateCcw className="h-6 w-6" /></span>
            <p className="text-sm leading-relaxed text-fg2">{R.expired}</p>
            <Link to="/admin/login?forgot=1" className="btn btn-primary mt-6 w-full">{t.forgot.send}</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <span className="icon-tile mb-1 h-12 w-12"><KeyRound className="h-5 w-5" /></span>
            <h1 className="text-xl font-bold tracking-tight">{R.title}</h1>
            <div>
              <label className="label" htmlFor="rp1">{R.pw}</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input id="rp1" type={show ? 'text' : 'password'} autoComplete="new-password" autoFocus className="input px-9" value={pw} onChange={(e) => setPw(e.target.value)} />
                <button type="button" onClick={() => setShow((v) => !v)} aria-label={t.admin.showPw} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-white/5">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1" aria-hidden>{[0, 1, 2, 3].map((i) => <span key={i} className="h-1 rounded-full" style={{ background: i < s ? (s <= 1 ? '#F87171' : s === 2 ? '#FBBF24' : '#34D399') : 'rgba(255,255,255,.08)' }} />)}</div>
            </div>
            <div>
              <label className="label" htmlFor="rp2">{R.pw2}</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input id="rp2" type={show ? 'text' : 'password'} autoComplete="new-password" className="input pl-9" value={pw2} onChange={(e) => setPw2(e.target.value)} />
              </div>
            </div>
            {err && <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300">{err}</p>}
            <button disabled={busy} className="btn btn-primary w-full">{R.save}</button>
          </form>
        )}
      </motion.div>
    </main>
  )
}
