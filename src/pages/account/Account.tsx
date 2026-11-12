import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { Sparkles, Briefcase, Check, Download, FileText, Rocket, Save, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { db } from '../../firebase/config'
import { deleteMyAccount, exportMyData, setMarketing, updateMyProfile, upgradeToTrainer, useAccount, type UserProfile } from '../../lib/account'
import { planInfo, type PlanInfo } from '../../lib/roles'
import { download } from '../../lib/csv'
import { fmtDate, fmtDateTime } from '../../lib/format'
import { LEGAL_VERSION } from '../../content/legal'
import { t } from '../../i18n/az'
import { StudentShell } from '../../components/StudentShell'
import { UserAvatar } from '../../components/AccountMenu'
import { Spinner } from '../../components/ui'
import { LegalLink, LegalModal } from '../../components/LegalModal'
import type { LegalId } from '../../content/legal'

const A = t.acct

function Field({ id, label, value, onChange, type = 'text' }: { id: string; label: string; value?: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="label-dark" htmlFor={id}>{label}</label>
      <input id={id} className="input-dark" type={type} value={value ?? ''} maxLength={type === 'tel' ? 20 : 100} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

/** Qeydiyyatlı istifadəçinin hesabı: məlumatlar, plan, razılıqlar, ixrac və silmə. */
export default function Account() {
  const { loading, user, profile } = useAccount()
  const nav = useNavigate()
  const [d, setD] = useState<Partial<UserProfile>>({})
  const [msg, setMsg] = useState('')
  const [plan, setPlan] = useState<PlanInfo | null>(null)
  const [confirm, setConfirm] = useState('')
  const [delStep, setDelStep] = useState('')
  const [err, setErr] = useState('')
  const [docIds, setDoc] = useState<LegalId[] | null>(null)
  const [up, setUp] = useState<{ type: 'trainer' | 'institution'; position: string; organization: string; sector: string }>({ type: 'trainer', position: '', organization: '', sector: '' })

  useEffect(() => { if (profile) setD(profile) }, [profile])
  useEffect(() => {
    if (!user) return
    void getDoc(doc(db, 'admins', user.uid)).then((s) => setPlan(s.exists() ? planInfo(s.data() as Parameters<typeof planInfo>[0]) : null)).catch(() => setPlan(null))
  }, [user, profile?.type])

  if (loading) return <div className="flex min-h-dvh items-center justify-center bg-night"><Spinner /></div>
  if (!user) return <Navigate to="/start?next=/account" replace />
  if (!profile?.onboarded) return <Navigate to="/onboarding" replace />
  const set = (p: Partial<UserProfile>) => setD((x) => ({ ...x, ...p }))
  const back = profile.type === 'student' ? '/learn' : '/admin'

  const save = async () => {
    setMsg(''); setErr('')
    if ((d.phone ?? '').replace(/\D/g, '').length < 9) return setErr(A.badPhone)
    const patch: Partial<UserProfile> = { firstName: d.firstName?.trim(), lastName: d.lastName?.trim(), phone: d.phone?.trim(), country: d.country, city: d.city, organization: d.organization, position: d.position, sector: d.sector, institution: d.institution, field: d.field, year: d.year }
    try { await updateMyProfile(user.uid, patch); setMsg(A.saved) } catch { setErr(t.app.error) }
  }
  const exportData = async () => {
    try { download(`jabr-my-data-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(await exportMyData(user.uid), null, 2), 'application/json') } catch { setErr(t.app.error) }
  }
  const del = async () => {
    setErr(''); setDelStep('start')
    try { await deleteMyAccount(user, setDelStep); nav('/', { replace: true }) } catch (e) {
      const code = (e as { code?: string }).code ?? ''
      setErr(code.includes('popup-closed') || code.includes('cancelled') ? A.popupClosed : t.app.error); setDelStep('')
    }
  }
  const upgrade = async () => {
    setErr('')
    if (!up.position.trim() || (up.type === 'institution' && !up.organization.trim())) return setErr(A.required)
    try { await upgradeToTrainer(user, profile, up.type, { position: up.position.trim(), organization: up.organization.trim(), sector: up.sector }); nav('/admin') } catch { setErr(t.app.error) }
  }
  const ts = (x?: { toDate(): Date }) => (x ? fmtDateTime(x.toDate()) : '—')

  return (
    <StudentShell back={back} title={A.myAccount}>
        <div className="-mb-3 flex flex-wrap items-center gap-4">
          <UserAvatar uid={user.uid} name={`${profile.firstName} ${profile.lastName}`} photo={user.photoURL} size={64} ring />
          <div className="mr-auto"><h1 className="text-3xl font-extrabold">{A.myAccount}</h1><p className="text-sm text-muted">{user.email} · {A.types[profile.type]?.title}</p></div>
          <Link to="/avatar" className="btn btn-secondary btn-sm"><Sparkles />{t.menu.avatar}</Link>
        </div>
        {(msg || err) && <p className={`rounded-xl px-4 py-3 text-sm font-semibold ${err ? 'bg-red-500/15 text-red-200' : 'bg-green-500/15 text-green-200'}`} role="status">{err || msg}</p>}

        <div className="grid items-start gap-5 lg:grid-cols-[1.5fr_1fr]">
          <section className="glass p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black"><UserRound className="h-5 w-5 text-orange-300" />{A.personal}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="a-fn" label={A.firstName} value={d.firstName} onChange={(v) => set({ firstName: v })} />
              <Field id="a-ln" label={A.lastName} value={d.lastName} onChange={(v) => set({ lastName: v })} />
              <Field id="a-ph" label={A.phone} type="tel" value={d.phone} onChange={(v) => set({ phone: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Field id="a-co" label={A.country} value={d.country} onChange={(v) => set({ country: v })} />
                <Field id="a-ci" label={A.city} value={d.city} onChange={(v) => set({ city: v })} />
              </div>
              {profile.type === 'student' ? (
                <>
                  <Field id="a-in" label={A.institution} value={d.institution} onChange={(v) => set({ institution: v })} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="a-fi" label={A.field} value={d.field} onChange={(v) => set({ field: v })} />
                    <Field id="a-yr" label={A.year} value={d.year} onChange={(v) => set({ year: v })} />
                  </div>
                </>
              ) : (
                <>
                  <Field id="a-or" label={A.organization} value={d.organization} onChange={(v) => set({ organization: v })} />
                  <Field id="a-po" label={A.position} value={d.position} onChange={(v) => set({ position: v })} />
                </>
              )}
            </div>
            <button className="btn btn-primary mt-5" onClick={() => void save()}><Save />{A.save}</button>
          </section>

          <div className="flex flex-col gap-5">
            <section className="glass p-6">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-black"><Briefcase className="h-5 w-5 text-orange-300" />{A.planTitle}</h2>
              {profile.type === 'student' ? (
                <div className="flex flex-col gap-3">
                  <p className="font-bold">{A.plans.student.title} · {A.free}</p>
                  <div className="rounded-2xl bg-white/5 p-4">
                    <p className="font-bold">{A.becomeTrainer}</p>
                    <p className="mb-3 text-sm text-white/60">{A.becomeTrainerSub}</p>
                    <div className="mb-3 flex flex-wrap gap-2">
                      {(['trainer', 'institution'] as const).map((k) => <button key={k} type="button" aria-pressed={up.type === k} onClick={() => setUp({ ...up, type: k })} className={`rounded-xl px-3 py-2 text-sm font-semibold ${up.type === k ? '' : 'bg-white/5 text-white/70'}`} style={up.type === k ? { background: 'var(--grad)' } : undefined}>{A.types[k].title}</button>)}
                    </div>
                    <div className="grid gap-3">
                      <Field id="u-po" label={A.position} value={up.position} onChange={(v) => setUp({ ...up, position: v })} />
                      <Field id="u-or" label={up.type === 'institution' ? A.organization : A.orgOptional} value={up.organization} onChange={(v) => setUp({ ...up, organization: v })} />
                    </div>
                    <button className="btn btn-primary mt-3 w-full" onClick={() => void upgrade()}><Rocket />{A.upgrade}</button>
                  </div>
                </div>
              ) : plan ? (
                <div className="flex flex-col gap-2 text-sm">
                  <p className="text-lg font-black">{plan.licensed && plan.active ? A.plans.trainer.title : plan.active ? `${A.plans.trainer.title} · ${A.freeTrial}` : A.freePlan}</p>
                  {plan.endsAt && plan.active && <p className="text-white/60">{plan.licensed ? A.licensedUntil(fmtDate(plan.endsAt)) : `${fmtDateTime(plan.endsAt)}`}</p>}
                  {plan.free && <p className="text-white/60">{A.freeCapHint}</p>}
                  <Link to="/pricing#request" className="btn btn-primary mt-2">{A.getLicense}</Link>
                </div>
              ) : <Spinner />}
            </section>

            <section className="glass p-6">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-black"><ShieldCheck className="h-5 w-5 text-orange-300" />{A.consentsTitle}</h2>
              <ul className="flex flex-col gap-3 text-sm">
                <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-green-400" /><span><span className="font-semibold">{t.legal.consent}</span> <LegalLink onOpen={() => setDoc(['consent'])} /><span className="block text-xs text-white/50">{A.consentGiven(ts(profile.dataConsentAt ?? profile.termsAt), profile.consentVersion ?? LEGAL_VERSION)}</span><span className="block text-xs text-white/40">{A.withdrawData}</span></span></li>
                <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-green-400" /><span><span className="font-semibold">{t.legal.privacy} · {t.legal.terms}</span> <LegalLink onOpen={() => setDoc(['privacy', 'terms'])} /><span className="block text-xs text-white/50">{A.consentGiven(ts(profile.termsAt), profile.consentVersion ?? LEGAL_VERSION)}</span></span></li>
                <li className="flex items-start justify-between gap-3 border-t border-white/10 pt-3">
                  <span><span className="font-semibold">{A.marketingOn}</span> <LegalLink onOpen={() => setDoc(['marketing'])} /><span className="block text-xs text-white/50">{A.marketingHint}</span>{profile.marketingAt && <span className="block text-xs text-white/40">{ts(profile.marketingAt)}</span>}</span>
                  <button type="button" role="switch" aria-checked={!!profile.marketing} aria-label={A.marketingOn} onClick={() => void setMarketing(user.uid, !profile.marketing)}
                    className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition ${profile.marketing ? '' : 'bg-white/20'}`} style={profile.marketing ? { background: 'var(--grad)' } : undefined}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[#fff] shadow transition-all ${profile.marketing ? 'left-[1.375rem]' : 'left-0.5'}`} />
                  </button>
                </li>
              </ul>
            </section>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="glass flex flex-col gap-3 p-6">
            <h2 className="flex items-center gap-2 text-lg font-black"><FileText className="h-5 w-5 text-orange-300" />{A.myData}</h2>
            <p className="text-sm text-white/60">{A.myDataHint}</p>
            <button className="btn btn-ghost mt-auto self-start" onClick={() => void exportData()}><Download />{A.download}</button>
          </section>
          <section className="flex flex-col gap-3 rounded-3xl border border-red-500/40 bg-red-500/10 p-6">
            <h2 className="flex items-center gap-2 text-lg font-black text-red-200"><Trash2 className="h-5 w-5" />{A.danger}</h2>
            <p className="text-sm text-white/70">{A.dangerHint}</p>
            <label className="text-xs font-semibold text-white/60" htmlFor="del-c">{A.typeToConfirm(A.confirmWord)}</label>
            <div className="flex flex-wrap gap-2">
              <input id="del-c" className="input-dark h-11 max-w-40" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
              <button className="btn bg-red-600 text-[#fff] hover:bg-red-700 disabled:opacity-40" disabled={confirm.trim().toUpperCase() !== A.confirmWord || !!delStep} onClick={() => void del()}>
                <Trash2 />{delStep ? (A.deleteSteps[delStep] ?? A.deleting) : A.deleteBtn}
              </button>
            </div>
          </section>
        </div>
      <LegalModal ids={docIds ?? []} open={!!docIds} onClose={() => setDoc(null)} />
    </StudentShell>
  )
}
