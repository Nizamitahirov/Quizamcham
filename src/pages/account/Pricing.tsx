import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Mail, MessageCircle, Phone, Send, Sparkles } from 'lucide-react'
import { CONTACT, loadPricing, requestLicense, useAccount, type PricePlan } from '../../lib/account'
import { t } from '../../i18n/az'
import { FuturisticBg } from '../../components/FuturisticBg'
import { Logo } from '../../components/Brand'
import { LangSwitch } from '../../components/LangSwitch'

const A = t.acct
type PlanKey = 'trainer' | 'pro' | 'business' | 'institution' | 'event' | 'custom'

/** Planlar, qiymətlər (konsoldan idarə olunur), lisenziya müraciəti və birbaşa əlaqə. */
export default function Pricing() {
  const { user, profile } = useAccount()
  const [prices, setPrices] = useState<PricePlan[] | null>(null)
  const [plan, setPlan] = useState<PlanKey>('pro')
  const [f, setF] = useState({ name: '', phone: '', organization: '', seats: '', message: '' })
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { void loadPricing().then(setPrices).catch(() => setPrices(null)); void import('../../firebase/extras').then((m) => m.track('pricing_view')) }, [])
  useEffect(() => {
    if (!profile) return
    setF((x) => ({ ...x, name: x.name || `${profile.firstName} ${profile.lastName}`.trim(), phone: x.phone || profile.phone, organization: x.organization || profile.organization || profile.institution || '', seats: x.seats || profile.seats || '' }))
    if (profile.type === 'institution') setPlan('institution')
  }, [profile])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (f.name.trim().length < 2 || f.phone.trim().length < 9) return setErr(A.required)
    setBusy(true); setErr('')
    try { await requestLicense({ email: user?.email ?? '', name: f.name.trim(), phone: f.phone.trim(), organization: f.organization.trim(), plan, seats: f.seats, message: f.message.trim() }); setDone(true) } catch { setErr(t.app.error) } finally { setBusy(false) }
  }
  const price = (k: string) => prices?.find((p) => p.key === k)

  return (
    <div className="noise relative min-h-dvh overflow-hidden bg-night text-white">
      <FuturisticBg floor={false} intensity={0.6} />
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-4 pt-5 sm:px-8">
        <Link to="/" aria-label={t.app.home}><Logo size={32} /></Link>
        <div className="flex items-center gap-2">
          <LangSwitch />
          <Link to={user ? (profile?.type === 'student' ? '/learn' : '/admin') : '/start'} className="btn btn-ghost btn-sm">{user ? '←' : A.signIn}</Link>
        </div>
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-black sm:text-5xl">{A.pricingTitle}</h1>
          <p className="mt-3 text-white/65">{A.pricingSub}</p>
        </div>
        {/* Təlimçi planları — iştirakçı sayına görə (host ödəyir, iştirakçı heç vaxt) */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(['free', 'trainer', 'pro', 'business'] as const).map((k) => {
            const p = A.plans[k], pr = price(k), hot = k === 'pro'
            return (
              <div key={k} className={`relative flex flex-col gap-4 p-6 ${hot ? 'glass-strong gradient-border' : 'glass'}`}>
                {hot && <span className="chip absolute -top-3 left-6 bg-white text-onlight shadow-lg"><Sparkles className="h-3.5 w-3.5 text-brand" />{A.popular}</span>}
                <div>
                  <h2 className="text-2xl font-black">{p.title}</h2>
                  <p className="text-sm text-white/60">{p.desc}</p>
                </div>
                <div className="font-display text-3xl font-black">
                  {pr?.price ? <>{pr.price}<span className="text-base font-semibold text-white/55"> {pr.period}</span></> : <span className="text-xl">{A.priceOnRequest}</span>}
                </div>
                <ul className="flex flex-1 flex-col gap-2">
                  {p.feats.map((x) => <li key={x} className="flex items-start gap-2 text-sm text-white/80"><Check className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />{x}</li>)}
                </ul>
                {k === 'free'
                  ? <Link to={user ? '/admin' : '/start'} className="btn btn-ghost w-full">{A.start}</Link>
                  : <a href="#request" onClick={() => setPlan(k)} className={`btn w-full ${hot ? 'btn-primary' : 'btn-ghost'}`}>{A.getLicense}</a>}
                {k !== 'free' && <p className="text-center text-xs text-white/50">{A.freeTrial}</p>}
              </div>
            )
          })}
        </section>
        <section className="grid gap-4 lg:grid-cols-3">
          {(['student', 'institution', 'event'] as const).map((k) => {
            const p = A.plans[k], pr = price(k)
            return (
              <div key={k} className="glass flex flex-col gap-3 p-6">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-xl font-black">{p.title}</h2>
                  <span className="font-display text-xl font-black">{k === 'student' ? (pr?.price || A.free) : pr?.price ? <>{pr.price}<span className="text-sm font-semibold text-white/55"> {pr.period}</span></> : <span className="text-sm font-semibold text-white/70">{A.priceOnRequest}</span>}</span>
                </div>
                <p className="text-sm text-white/60">{p.desc}</p>
                <ul className="flex flex-1 flex-col gap-1.5">
                  {p.feats.map((x) => <li key={x} className="flex items-start gap-2 text-sm text-white/80"><Check className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />{x}</li>)}
                </ul>
                {k === 'student'
                  ? <Link to={user ? '/learn' : '/start?next=/learn'} className="btn btn-ghost w-full">{A.start}</Link>
                  : <a href="#request" onClick={() => setPlan(k)} className="btn btn-ghost w-full">{A.getLicense}</a>}
              </div>
            )
          })}
        </section>

        <section id="request" className="grid scroll-mt-6 gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="glass-strong p-6 sm:p-8">
            <h2 className="text-2xl font-black">{A.requestTitle}</h2>
            <p className="mb-5 text-sm text-white/60">{A.requestSub}</p>
            {!user && !done && (
              <ol className="mb-6 grid gap-3 sm:grid-cols-3">
                {A.how.map((x, i) => (
                  <li key={x} className="flex flex-col gap-2 rounded-2xl bg-white/5 p-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full font-black" style={{ background: 'var(--grad)' }}>{i + 1}</span>
                    <span className="text-sm text-white/80">{x}</span>
                  </li>
                ))}
              </ol>
            )}
            {done ? <p className="rounded-xl bg-green-500/15 p-4 font-semibold text-green-200" role="status">{A.sent}</p>
              : !user ? <Link to="/start?next=/pricing%23request" className="btn btn-primary">{A.signInToRequest}</Link> : (
                <form onSubmit={send} className="flex flex-col gap-4">
                  <div>
                    <span className="label-dark">{A.plan}</span>
                    <div className="flex flex-wrap gap-2">
                      {(['trainer', 'pro', 'business', 'institution', 'event', 'custom'] as PlanKey[]).map((k) => (
                        <button key={k} type="button" aria-pressed={plan === k} onClick={() => setPlan(k)} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${plan === k ? 'border-transparent' : 'border-white/15 bg-white/5 text-white/75'}`} style={plan === k ? { background: 'var(--grad)' } : undefined}>
                          {k === 'custom' ? A.planCustom : A.plans[k].title}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div><label className="label-dark" htmlFor="rn">{A.firstName} / {A.lastName} *</label><input id="rn" className="input-dark" value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
                    <div><label className="label-dark" htmlFor="rp">{A.phone} *</label><input id="rp" className="input-dark" type="tel" value={f.phone} maxLength={30} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
                    <div><label className="label-dark" htmlFor="ro">{A.organization}</label><input id="ro" className="input-dark" value={f.organization} maxLength={120} onChange={(e) => setF({ ...f, organization: e.target.value })} /></div>
                    <div><label className="label-dark" htmlFor="rs">{A.seatsReq}</label><input id="rs" className="input-dark" value={f.seats} maxLength={20} onChange={(e) => setF({ ...f, seats: e.target.value })} /></div>
                  </div>
                  <div><label className="label-dark" htmlFor="rm">{A.message}</label><textarea id="rm" className="input-dark min-h-24 py-3" maxLength={1000} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></div>
                  {err && <p className="rounded-xl bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-200" role="alert">{err}</p>}
                  <button className="btn btn-primary btn-lg" disabled={busy}><Send />{A.send}</button>
                </form>
              )}
          </div>
          <div className="glass flex flex-col gap-3 p-6 sm:p-8">
            <h2 className="text-xl font-black">{A.contactUs}</h2>
            <a href={`tel:${CONTACT.phone}`} className="flex items-center gap-3 rounded-2xl bg-white/5 p-4 hover:bg-white/10"><span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--grad)' }}><Phone className="h-5 w-5" /></span><span><span className="block text-xs text-white/55">{A.call}</span><span className="font-bold">{CONTACT.phoneLabel}</span></span></a>
            <a href={CONTACT.whatsapp} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl bg-white/5 p-4 hover:bg-white/10"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-600"><MessageCircle className="h-5 w-5" /></span><span><span className="block text-xs text-white/55">{A.whatsapp}</span><span className="font-bold">{CONTACT.phoneLabel}</span></span></a>
            <a href={`mailto:${CONTACT.email}?subject=${encodeURIComponent('Jabr lisenziya')}`} className="flex items-center gap-3 rounded-2xl bg-white/5 p-4 hover:bg-white/10"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15"><Mail className="h-5 w-5" /></span><span className="min-w-0"><span className="block text-xs text-white/55">{A.mail}</span><span className="block truncate font-bold">{CONTACT.email}</span></span></a>
          </div>
        </section>
      </main>
    </div>
  )
}
