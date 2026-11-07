import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Building2, Check, GraduationCap, Presentation } from 'lucide-react'
import { completeOnboarding, routeAfterLogin, useAccount, type AccountType, type UserProfile } from '../../lib/account'
import { logout } from '../../firebase/auth'
import { t, currentLang } from '../../i18n/az'
import { FuturisticBg } from '../../components/FuturisticBg'
import { Logo } from '../../components/Brand'
import { Spinner } from '../../components/ui'

const A = t.acct
type Draft = Omit<UserProfile, 'email' | 'onboarded' | 'createdAt' | 'termsAt'>

const phoneOk = (p: string) => /^\+?[0-9 ()-]{9,20}$/.test(p.trim()) && p.replace(/\D/g, '').length >= 9

function Choice({ value, options, onChange, label }: { value?: string; options: string[]; onChange: (v: string) => void; label: string }) {
  return (
    <div>
      <span className="label-dark">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o} type="button" onClick={() => onChange(o)} aria-pressed={value === o}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${value === o ? 'border-transparent text-white' : 'border-white/15 bg-white/5 text-white/75 hover:bg-white/10'}`}
            style={value === o ? { background: 'var(--grad)' } : undefined}>{o}</button>
        ))}
      </div>
    </div>
  )
}

function Input({ id, label, value, onChange, required, type = 'text', placeholder, autoComplete }: { id: string; label: string; value?: string; onChange: (v: string) => void; required?: boolean; type?: string; placeholder?: string; autoComplete?: string }) {
  return (
    <div>
      <label className="label-dark" htmlFor={id}>{label}{required && <span className="text-orange-300"> *</span>}</label>
      <input id={id} className="input-dark" type={type} value={value ?? ''} placeholder={placeholder} autoComplete={autoComplete} maxLength={type === 'tel' ? 20 : 100} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

/** Qeydiyyatın tamamlanması: tip → əlaqə → fəaliyyət, maraqlar, razılıq. */
export default function Onboarding() {
  const { loading, user, profile } = useAccount()
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [d, setD] = useState<Draft>({ type: 'trainer', firstName: '', lastName: '', phone: '', country: 'Azərbaycan', city: '', interests: [], marketing: true })
  const [terms, setTerms] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }))

  useEffect(() => {
    if (!user) return
    const [f, ...rest] = (user.displayName ?? '').split(' ')
    setD((x) => ({ ...x, firstName: x.firstName || f || '', lastName: x.lastName || rest.join(' ') }))
  }, [user])
  useEffect(() => { if (profile?.onboarded && user) void routeAfterLogin(user.uid).then((r) => nav(r, { replace: true })) }, [profile, user, nav])

  const types = useMemo(() => [
    { v: 'student' as AccountType, icon: GraduationCap },
    { v: 'trainer' as AccountType, icon: Presentation },
    { v: 'institution' as AccountType, icon: Building2 },
  ], [])

  if (loading) return <div className="flex min-h-dvh items-center justify-center bg-night"><Spinner /></div>
  if (!user) return <Navigate to="/start" replace />

  const validate = (s: number) => {
    if (s === 1) {
      if (d.firstName.trim().length < 2 || d.lastName.trim().length < 2 || !d.phone.trim()) return A.required
      if (!phoneOk(d.phone)) return A.badPhone
    }
    if (s === 2) {
      if (d.type === 'trainer' && (!d.sector || !d.position?.trim())) return A.required
      if (d.type === 'institution' && (!d.orgType || !d.organization?.trim() || !d.position?.trim())) return A.required
      if (d.type === 'student' && !d.level) return A.required
      if (!terms) return A.required
    }
    return ''
  }
  const forward = async () => {
    const e = validate(step)
    if (e) return setErr(e)
    setErr('')
    if (step < 2) return setStep(step + 1)
    setBusy(true)
    try {
      await completeOnboarding(user, { ...d, firstName: d.firstName.trim(), lastName: d.lastName.trim(), phone: d.phone.trim(), lang: currentLang() })
      nav(d.type === 'student' ? '/learn' : '/admin', { replace: true })
    } catch { setErr(t.app.error); setBusy(false) }
  }

  return (
    <div className="noise relative flex min-h-dvh flex-col overflow-hidden bg-night text-white">
      <FuturisticBg floor={false} intensity={0.7} />
      <header className="relative z-10 mx-auto flex w-full max-w-3xl items-center justify-between px-4 pt-5">
        <Link to="/" aria-label={t.app.home}><Logo size={32} /></Link>
        <button className="text-sm font-semibold text-white/60 hover:text-white" onClick={() => void logout().then(() => nav('/start'))}>{A.signOut}</button>
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-8">
        <div>
          <p className="text-sm font-bold text-orange-300">{A.step(step + 1, 3)}</p>
          <h1 className="text-3xl font-black sm:text-4xl">{A.obTitle}</h1>
          <p className="mt-1 text-white/60">{A.obSub}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <span key={i} className={`h-1.5 rounded-full ${i <= step ? '' : 'bg-white/10'}`} style={i <= step ? { background: 'var(--grad)' } : undefined} />)}</div>
        </div>

        <form className="glass-strong flex flex-col gap-5 p-6 sm:p-8" onSubmit={(e) => { e.preventDefault(); void forward() }}>
          {step === 0 && (
            <>
              <h2 className="text-xl font-black">{A.whoAreYou}</h2>
              <div className="grid gap-3 md:grid-cols-3">
                {types.map(({ v, icon: Icon }) => (
                  <button key={v} type="button" onClick={() => set({ type: v })} aria-pressed={d.type === v}
                    className={`relative flex flex-col gap-2 rounded-2xl border p-5 text-left transition ${d.type === v ? 'border-orange-400 bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                    {d.type === v && <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full" style={{ background: 'var(--grad)' }}><Check className="h-4 w-4" /></span>}
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: 'var(--grad)' }}><Icon className="h-5 w-5" /></span>
                    <span className="text-lg font-black">{A.types[v].title}</span>
                    <span className="text-sm text-white/65">{A.types[v].desc}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="text-xl font-black">{A.personal}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input id="fn" label={A.firstName} value={d.firstName} onChange={(v) => set({ firstName: v })} required autoComplete="given-name" />
                <Input id="ln" label={A.lastName} value={d.lastName} onChange={(v) => set({ lastName: v })} required autoComplete="family-name" />
                <Input id="ph" label={A.phone} type="tel" value={d.phone} onChange={(v) => set({ phone: v })} required placeholder={A.phoneHint} autoComplete="tel" />
                <div className="grid grid-cols-2 gap-3">
                  <Input id="co" label={A.country} value={d.country} onChange={(v) => set({ country: v })} autoComplete="country-name" />
                  <Input id="ci" label={A.city} value={d.city} onChange={(v) => set({ city: v })} autoComplete="address-level2" />
                </div>
              </div>
              <p className="text-xs text-white/45">{user.email}</p>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-xl font-black">{A.about}</h2>
              {d.type === 'trainer' && (
                <div className="flex flex-col gap-4">
                  <Choice label={`${A.sector} *`} value={d.sector} options={A.sectors} onChange={(v) => set({ sector: v })} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input id="po" label={A.position} value={d.position} onChange={(v) => set({ position: v })} required autoComplete="organization-title" />
                    <Input id="or" label={A.orgOptional} value={d.organization} onChange={(v) => set({ organization: v })} autoComplete="organization" />
                  </div>
                  <Choice label={A.goal} value={d.goal} options={A.goals} onChange={(v) => set({ goal: v })} />
                </div>
              )}
              {d.type === 'institution' && (
                <div className="flex flex-col gap-4">
                  <Choice label={`${A.orgType} *`} value={d.orgType} options={A.orgTypes} onChange={(v) => set({ orgType: v })} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input id="or" label={A.organization} value={d.organization} onChange={(v) => set({ organization: v })} required autoComplete="organization" />
                    <Input id="po" label={A.position} value={d.position} onChange={(v) => set({ position: v })} required autoComplete="organization-title" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Choice label={A.orgSize} value={d.orgSize} options={A.orgSizes} onChange={(v) => set({ orgSize: v })} />
                    <Choice label={A.seats} value={d.seats} options={A.seatOptions} onChange={(v) => set({ seats: v })} />
                  </div>
                  <Choice label={A.sector} value={d.sector} options={A.sectors} onChange={(v) => set({ sector: v })} />
                </div>
              )}
              {d.type === 'student' && (
                <div className="flex flex-col gap-4">
                  <Choice label={`${A.level} *`} value={d.level} options={A.levels} onChange={(v) => set({ level: v })} />
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Input id="in" label={A.institution} value={d.institution} onChange={(v) => set({ institution: v })} />
                    <Input id="fi" label={A.field} value={d.field} onChange={(v) => set({ field: v })} />
                    <Input id="yr" label={A.year} value={d.year} onChange={(v) => set({ year: v })} />
                  </div>
                </div>
              )}
              <div>
                <span className="label-dark">{A.interests} <span className="font-normal normal-case tracking-normal text-white/40">· {A.interestsHint}</span></span>
                <div className="flex flex-wrap gap-2">
                  {A.interestOptions.map((o) => {
                    const on = d.interests?.includes(o)
                    return <button key={o} type="button" aria-pressed={on} onClick={() => set({ interests: on ? d.interests!.filter((x) => x !== o) : [...(d.interests ?? []), o].slice(0, 12) })}
                      className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${on ? 'border-transparent text-white' : 'border-white/15 bg-white/5 text-white/70 hover:bg-white/10'}`} style={on ? { background: 'var(--grad)' } : undefined}>{o}</button>
                  })}
                </div>
              </div>
              <Choice label={A.source} value={d.source} options={A.sources} onChange={(v) => set({ source: v })} />
              <div className="flex flex-col gap-2 rounded-xl bg-white/5 p-4 text-sm">
                <label className="flex items-start gap-3"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-orange-500" checked={terms} onChange={(e) => setTerms(e.target.checked)} /><span>{A.terms} <Link to="/privacy" target="_blank" className="underline">{t.privacy.more}</Link> <span className="text-orange-300">*</span></span></label>
                <label className="flex items-start gap-3"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-orange-500" checked={!!d.marketing} onChange={(e) => set({ marketing: e.target.checked })} /><span className="text-white/75">{A.marketing}</span></label>
              </div>
            </>
          )}

          {err && <p className="rounded-xl bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-200" role="alert">{err}</p>}
          <div className="flex items-center justify-between gap-3">
            {step > 0 ? <button type="button" className="btn btn-ghost shrink-0" onClick={() => { setErr(''); setStep(step - 1) }} aria-label={A.back}><ArrowLeft /><span className="hidden sm:inline">{A.back}</span></button> : <span />}
            <button className="btn btn-primary btn-lg min-w-0 flex-1 sm:flex-none" disabled={busy}>{busy ? A.saving : step < 2 ? <>{A.next}<ArrowRight /></> : <>{A.finish}<Check /></>}</button>
          </div>
        </form>
      </main>
    </div>
  )
}
