import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getRedirectResult } from 'firebase/auth'
import { CheckCircle2, GraduationCap, Presentation } from 'lucide-react'
import { auth } from '../../firebase/config'
import { routeAfterLogin, signInWithGoogle, touchLogin } from '../../lib/account'
import { t } from '../../i18n/az'
import { FuturisticBg } from '../../components/FuturisticBg'
import { Logo } from '../../components/Brand'
import { LangSwitch } from '../../components/LangSwitch'
import { Spinner } from '../../components/ui'
import { LegalLink, LegalModal } from '../../components/LegalModal'

const A = t.acct

export function GoogleIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

/** Hamı üçün giriş/qeydiyyat: Google ilə; komanda üzvləri e-poçtla /admin/login-dən. */
export default function Start() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(true)
  const [err, setErr] = useState('')
  const [legal, setLegal] = useState(false)

  const go = async (uid: string) => {
    void touchLogin(uid)
    const dest = await routeAfterLogin(uid)
    nav(dest === '/onboarding' || !next ? dest : next, { replace: true })
  }

  useEffect(() => {
    // telefonda yönləndirmə ilə qayıdış və ya artıq daxil olmuş istifadəçi
    void getRedirectResult(auth).catch(() => null).then(async (r) => {
      const u = r?.user ?? auth.currentUser
      if (u && !u.isAnonymous) await go(u.uid)
      else setChecking(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const google = async () => {
    setBusy(true); setErr('')
    try { const u = await signInWithGoogle(); await go(u.uid) } catch (e) {
      const code = (e as { code?: string }).code ?? ''
      setErr(code.includes('popup-closed') || code.includes('cancelled') ? A.popupClosed : code.includes('unauthorized-domain') ? A.unauthorized : code.includes('operation-not-allowed') ? A.googleOff : t.app.error)
      setBusy(false)
    }
  }

  return (
    <div className="noise relative flex min-h-dvh flex-col overflow-hidden bg-night text-white">
      <FuturisticBg floor={false} intensity={0.8} />
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-5 sm:px-8">
        <Link to="/" aria-label={t.app.home}><Logo size={34} /></Link>
        <LangSwitch />
      </header>
      <main className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 px-4 py-10 sm:px-8 lg:grid-cols-[1.1fr_1fr]">
        <section className="order-2 grid gap-4 sm:grid-cols-2 lg:order-1 lg:grid-cols-1">
          {[{ icon: Presentation, title: A.forTrainers, pts: A.forTrainersPts, badge: A.freeTrial }, { icon: GraduationCap, title: A.forStudents, pts: A.forStudentsPts }].map((c) => (
            <div key={c.title} className="glass p-6">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: 'var(--grad)' }}><c.icon className="h-5 w-5" /></span>
                <h2 className="text-xl font-black">{c.title}</h2>
                {c.badge && <span className="chip ml-auto bg-white text-ink">{c.badge}</span>}
              </div>
              <ul className="flex flex-col gap-2">
                {c.pts.map((p) => <li key={p} className="flex items-start gap-2 text-white/80"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />{p}</li>)}
              </ul>
            </div>
          ))}
        </section>
        <section className="glass-strong gradient-border order-1 flex flex-col gap-5 p-7 sm:p-9 lg:order-2">
          <div>
            <h1 className="text-3xl font-black sm:text-4xl">{A.startTitle}</h1>
            <p className="mt-2 text-white/65">{A.startSub}</p>
          </div>
          {checking ? <div className="py-6"><Spinner /></div> : (
            <>
              <button className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-white text-base font-bold text-ink shadow-lg transition hover:bg-white/90 disabled:opacity-60" disabled={busy} onClick={() => void google()}>
                <GoogleIcon />{busy ? A.googleBusy : A.google}
              </button>
              {err && <p className="rounded-xl bg-red-500/15 px-3 py-2 text-center text-sm font-semibold text-red-200" role="alert">{err}</p>}
            </>
          )}
          <p className="text-center text-xs leading-relaxed text-white/50">{A.agree} <LegalLink onOpen={() => setLegal(true)} /></p>
          <LegalModal ids={['privacy', 'terms']} open={legal} onClose={() => setLegal(false)} />
          <div className="border-t border-white/10 pt-4 text-center">
            <Link to="/admin/login" className="text-sm font-semibold text-white/70 underline-offset-4 hover:text-white hover:underline">{A.teamLogin}</Link>
          </div>
          <div className="text-center"><Link to="/pricing" className="text-sm font-semibold text-orange-300 hover:underline">{A.pricingTitle} →</Link></div>
        </section>
      </main>
    </div>
  )
}
