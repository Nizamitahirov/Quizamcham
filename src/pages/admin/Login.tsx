import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { routeAfterLogin, signInWithGoogle, touchLogin } from '../../lib/account'
import { GoogleIcon } from '../account/Start'
import { motion } from 'framer-motion'
import { Bot, CheckCircle2, Eye, EyeOff, Lock, LogIn, Mail, Radio, BarChart3 } from 'lucide-react'
import { adminLogin, useAdmin } from '../../firebase/auth'
import { t } from '../../i18n/az'
import { Spinner } from '../../components/ui'
import { Logo } from '../../components/Brand'
import { LangSwitch } from '../../components/LangSwitch'
import { FuturisticBg } from '../../components/FuturisticBg'

const ICONS = [Radio, Bot, BarChart3]

export default function Login() {
  const nav = useNavigate()
  const admin = useAdmin()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  if (admin.loading) return <div className="flex min-h-dvh items-center justify-center bg-surface text-ink"><Spinner /></div>
  if (admin.isAdmin) return <Navigate to="/admin" replace />
  const google = async () => {
    setBusy(true); setErr('')
    try { const u = await signInWithGoogle(); void touchLogin(u.uid); nav(await routeAfterLogin(u.uid)) } catch (ex) {
      const code = (ex as { code?: string }).code ?? ''
      setErr(code.includes('popup-closed') || code.includes('cancelled') ? t.acct.popupClosed : code.includes('operation-not-allowed') ? t.acct.googleOff : t.admin.badCreds)
    } finally { setBusy(false) }
  }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await adminLogin(email, pw)
      nav('/admin')
    } catch (ex) {
      setErr((ex as Error).message === 'not-admin' ? t.admin.notAdmin : (ex as Error).message === 'disabled' ? t.admin.disabled : t.admin.badCreds)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="grid min-h-dvh bg-surface text-ink lg:grid-cols-2">
      <div className="noise relative hidden flex-col justify-between overflow-hidden bg-night p-12 text-white lg:flex">
        <FuturisticBg />
        <div className="relative"><Logo size={44} sub="Live quiz platform" /></div>
        <div className="relative space-y-6">
          <h1 className="max-w-md text-4xl font-black leading-tight">{t.admin.brandTitle.split(' ').slice(0, 2).join(' ')} <span className="text-grad">{t.admin.brandTitle.split(' ').slice(2).join(' ')}</span></h1>
          <ul className="space-y-3">
            {t.admin.brandPoints.map((p, i) => {
              const Icon = ICONS[i]
              return <li key={p} className="flex items-center gap-3 text-white/85"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10"><Icon className="h-4 w-4" /></span>{p}</li>
            })}
          </ul>
        </div>
        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} Jabr · AmCham NextGen HR Leaders</p>
      </div>
      <div className="flex items-center justify-center px-4 py-10">
        <motion.form initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} onSubmit={submit} className="w-full max-w-sm">
          <div className="mb-8 flex items-center justify-between"><span className="lg:hidden"><Logo size={36} dark={false} /></span><LangSwitch dark={false} className="ml-auto" /></div>
          <h2 className="text-2xl font-bold tracking-tight">{t.admin.login}</h2>
          <p className="mt-1 text-sm text-muted">{t.admin.loginSubtitle}</p>
          <div className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="em">{t.admin.email}</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input id="em" className="input pl-9" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="pw">{t.admin.password}</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input id="pw" className="input px-9" type={show ? 'text' : 'password'} autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
                <button type="button" onClick={() => setShow((v) => !v)} aria-label={t.admin.showPw} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-surface">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">{err}</p>}
            <button className="btn btn-primary w-full" disabled={busy}>{busy ? t.admin.signingIn : <><LogIn />{t.admin.signIn}</>}</button>
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-muted"><span className="h-px flex-1 bg-line" />{t.admin.or}<span className="h-px flex-1 bg-line" /></div>
            <button type="button" className="btn btn-secondary w-full" disabled={busy} onClick={() => void google()}><GoogleIcon />{t.acct.google}</button>
            <p className="text-center text-sm text-muted">{t.admin.noAccount} <Link to="/start" className="font-bold text-red-700 hover:underline">{t.acct.signUp} · {t.acct.freeTrial}</Link></p>
          </div>
          <p className="mt-6 flex items-center gap-2 text-xs text-muted"><CheckCircle2 className="h-4 w-4 text-ok" />Firebase Auth</p>
        </motion.form>
      </div>
    </div>
  )
}
