import { useCallback, useEffect, useMemo, useState } from 'react'
import { Award, BellRing, BookOpen, Briefcase, ChevronDown, Copy, Coins, Rocket, CalendarClock, Clock, Download, GraduationCap, Hourglass, Inbox, Mail, MessageCircle, Phone, RefreshCw, Save, Search, ShieldCheck, Tag, TrendingUp, UserPlus, Users } from 'lucide-react'
import { t } from '../../i18n/az'
import { fmtDate, fmtDateTime, fmtDayMonth } from '../../lib/format'
import { toCsv, download } from '../../lib/csv'
import { planInfo } from '../../lib/roles'
import { setRestricted, type AdminRow } from '../../lib/team'
import {
  approveCatalog, convertToTrainer, extendTrial, grantLicense, hideCatalog, listReports, loadConsole, loadPricing, revokeLicense, savePricing, setLeadStatus, unpublish,
  type ConsoleData, type QuizReport, type LeadStatus, type LicenseRecord, type PricePlan,
} from '../../lib/account'
import { Link } from 'react-router-dom'
import { PageHeader, Spinner } from '../../components/ui'
import { Section, Segmented } from '../../components/kit'

const C = t.acct.console
const A = t.acct
const DAY = 86_400_000
type Status = 'student' | 'trial' | 'expired' | 'licensed' | 'team'

const BAR = '#F2541B' // tək seriya — brend narıncısı (ağ fonda kontrast ≥ 3:1)

interface Row {
  uid: string; name: string; email: string; phone: string; type: string; org: string; position: string
  status: Status; endsAt: Date | null; joined: Date | null; quizzes: number; games: number; attempts: number
  disabled: boolean; raw: Record<string, unknown>
  member: ConsoleData['members'][number] | null; licenses: LicenseRecord[]; seatsUsed: number
}

export default function Console() {
  const [data, setData] = useState<ConsoleData | null>(null)
  const [err, setErr] = useState('')
  const load = useCallback(() => { setErr(''); void loadConsole().then(setData).catch((e) => { setErr(String((e as { code?: string }).code ?? e)); setData(null) }) }, [])
  useEffect(load, [load])

  const rows = useMemo<Row[]>(() => {
    if (!data) return []
    const members = new Map(data.members.map((m) => [m.uid, m]))
    const att = data.attempts.reduce<Record<string, number>>((a, x) => { a[x.uid] = (a[x.uid] ?? 0) + 1; return a }, {})
    const plays = data.plays.reduce<Record<string, number>>((a, x) => { a[x.uid] = (a[x.uid] ?? 0) + 1; return a }, {})
    const lic = data.licenses.reduce<Record<string, LicenseRecord[]>>((a, x) => { (a[x.uid] ??= []).push(x); return a }, {})
    const seatsUsed = data.members.reduce<Record<string, number>>((a, m) => { if (m.orgId) a[m.orgId] = (a[m.orgId] ?? 0) + 1; return a }, {})
    const fromUsers: Row[] = data.users.map((u) => {
      const m = members.get(u.uid) ?? null
      const p = planInfo(m)
      const status: Status = u.type === 'student' ? 'student' : !m ? 'expired' : !p.selfServe ? 'team' : p.licensed && p.active ? 'licensed' : p.active ? 'trial' : 'expired'
      return {
        uid: u.uid, name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.displayName || u.email, email: u.email, phone: u.phone ?? '',
        type: u.type, org: u.organization || u.institution || '', position: u.position || u.level || '',
        status, endsAt: p.endsAt, joined: u.createdAt?.toDate() ?? null,
        quizzes: data.quizOwners[u.uid] ?? 0, games: data.gameHosts[u.uid] ?? 0, attempts: (att[u.uid] ?? 0) + (plays[u.uid] ?? 0),
        disabled: m?.disabled === true, raw: u as unknown as Record<string, unknown>, member: m, licenses: lic[u.uid] ?? [], seatsUsed: seatsUsed[u.uid] ?? 0,
      }
    })
    // Komanda üzvləri (qeydiyyat profili olmayanlar) da siyahıda
    const known = new Set(data.users.map((u) => u.uid))
    const team: Row[] = data.members.filter((m) => !known.has(m.uid)).map((m) => ({
      uid: m.uid, name: m.name || m.email.split('@')[0], email: m.email, phone: '', type: 'team', org: m.source === 'org' ? `🏢 ${members.get(m.orgId ?? '')?.name || members.get(m.orgId ?? '')?.email || ''}` : '', position: m.role === 'super' ? t.team.super : m.role === 'admin' || m.role === 'owner' ? t.team.admin : t.team.trainer,
      status: 'team' as Status, endsAt: null, joined: m.createdAt?.toDate() ?? null,
      quizzes: data.quizOwners[m.uid] ?? 0, games: data.gameHosts[m.uid] ?? 0, attempts: 0,
      disabled: m.disabled === true, raw: { email: m.email, role: m.role }, member: m, licenses: [], seatsUsed: 0,
    }))
    return [...fromUsers, ...team].sort((a, b) => (b.joined?.getTime() ?? 0) - (a.joined?.getTime() ?? 0))
  }, [data])

  if (err) return <div className="mx-auto max-w-3xl p-8"><p className="card p-6 text-sm font-semibold text-red-700">{t.app.error} ({err})</p></div>
  if (!data) return <div className="p-10"><Spinner /></div>

  const now = Date.now()
  const trainers = rows.filter((r) => r.type !== 'student' && r.type !== 'team')
  const k = {
    users: rows.filter((r) => r.type !== 'team').length,
    new7: rows.filter((r) => r.joined && now - r.joined.getTime() < 7 * DAY).length,
    students: rows.filter((r) => r.type === 'student').length,
    trainers: trainers.length,
    trials: rows.filter((r) => r.status === 'trial').length,
    expired: rows.filter((r) => r.status === 'expired').length,
    licensed: rows.filter((r) => r.status === 'licensed').length,
    leads: data.leads.filter((l) => l.status === 'new').length,
  }
  const exportCsv = () => {
    const keys = ['email', 'firstName', 'lastName', 'phone', 'type', 'country', 'city', 'sector', 'position', 'organization', 'orgType', 'orgSize', 'seats', 'goal', 'institution', 'field', 'level', 'year', 'interests', 'source', 'marketing']
    const body = rows.map((r) => [...keys.map((key) => { const v = r.raw[key]; return Array.isArray(v) ? v.join('; ') : v == null ? '' : String(v) }),
      C.status[r.status], r.endsAt ? fmtDate(r.endsAt) : '', r.joined ? fmtDateTime(r.joined) : '', r.quizzes, r.games, r.attempts])
    download(`jabr-users-${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + toCsv([[...keys, 'status', 'plan_ends', 'joined', 'quizzes', 'games', 'attempts'], ...body]))
  }

  return (
    <div className="mx-auto max-w-[1440px] p-4 sm:p-8">
      <PageHeader title={C.title} sub={C.sub}>
        <button className="btn btn-secondary" onClick={load}><RefreshCw />{C.refresh}</button>
        <button className="btn btn-primary" onClick={exportCsv} disabled={!rows.length}><Download />{C.exportCsv}</button>
      </PageHeader>

      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi icon={Users} label={C.kpi.users} value={k.users} />
        <Kpi icon={UserPlus} label={C.kpi.new7} value={k.new7} />
        <Kpi icon={GraduationCap} label={C.kpi.students} value={k.students} />
        <Kpi icon={Briefcase} label={C.kpi.trainers} value={k.trainers} />
        <Kpi icon={Hourglass} label={C.kpi.trials} value={k.trials} />
        <Kpi icon={Clock} label={C.kpi.expired} value={k.expired} warn={k.expired > 0} />
        <Kpi icon={ShieldCheck} label={C.kpi.licensed} value={k.licensed} good={k.licensed > 0} />
        <Kpi icon={Inbox} label={C.kpi.leads} value={k.leads} warn={k.leads > 0} />
        <Kpi icon={Award} label={C.revenue.active} value={k.licensed} />
        <Kpi icon={Coins} label={C.revenue.month} value={money(data.licenses.filter((l) => l.at && l.at.toDate().getMonth() === new Date().getMonth() && l.at.toDate().getFullYear() === new Date().getFullYear()).reduce((s2, l) => s2 + (l.amount || 0), 0))} />
        <Kpi icon={Coins} label={C.revenue.total} value={money(data.licenses.reduce((s2, l) => s2 + (l.amount || 0), 0))} />
        <Kpi icon={CalendarClock} label={C.revenue.expiring} value={rows.filter((r) => r.status === 'licensed' && r.endsAt && r.endsAt.getTime() - now < 7 * DAY).length} warn={rows.some((r) => r.status === 'licensed' && r.endsAt && r.endsAt.getTime() - now < 7 * DAY)} />
      </div>

      <ContactToday rows={rows} data={data} />

      <div className="mb-4 grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Section icon={TrendingUp} title={C.signups} sub={C.signupsSub} className="flex flex-col" bodyClassName="flex flex-1 flex-col p-5"><SignupChart rows={rows} /></Section>
        <Section icon={TrendingUp} title={C.funnel} sub={C.funnelSub} className="flex flex-col" bodyClassName="flex flex-1 flex-col justify-center p-5">
          <Funnel steps={[
            trainers.length,
            trainers.filter((r) => r.quizzes > 0).length,
            trainers.filter((r) => r.games > 0).length,
            new Set(data.leads.map((l) => l.uid)).size,
            trainers.filter((r) => r.status === 'licensed').length,
          ]} />
        </Section>
      </div>

      <UsersTable rows={rows} reload={load} />

      <div className="mt-4 grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Leads data={data} reload={load} />
        <div className="flex flex-col gap-4">
          <CatalogStats data={data} reload={load} />
          <PricingEditor />
        </div>
      </div>
    </div>
  )
}

const money = (n: number) => `${n.toLocaleString('az-AZ', { maximumFractionDigits: 0 })} ₼`

function Kpi({ icon: Icon, label, value, warn, good }: { icon: typeof Users; label: string; value: number | string; warn?: boolean; good?: boolean }) {
  return (
    <div className="card flex items-center gap-4 p-4">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${warn ? 'bg-amber-50 text-amber-700' : good ? 'bg-green-50 text-green-700' : 'text-brand'}`} style={warn || good ? undefined : { background: 'var(--grad-soft)' }}><Icon className="h-5 w-5" /></span>
      <div className="min-w-0"><div className="font-display text-2xl font-black leading-none tabular-nums">{value}</div><div className="mt-1 truncate text-xs font-semibold text-muted">{label}</div></div>
    </div>
  )
}

/** Son 30 gün üzrə gündəlik qeydiyyat (tək seriya; hover — tələbə/təlimçi bölgüsü). */
function SignupChart({ rows }: { rows: Row[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const days = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    return Array.from({ length: 30 }, (_, i) => {
      const d0 = start.getTime() - (29 - i) * DAY
      const inDay = rows.filter((r) => r.joined && r.joined.getTime() >= d0 && r.joined.getTime() < d0 + DAY)
      return { date: new Date(d0), total: inDay.length, students: inDay.filter((r) => r.type === 'student').length }
    })
  }, [rows])
  const max = Math.max(1, ...days.map((d) => d.total))
  const ticks = max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, Math.round(max / 2), max]
  const h = hover != null ? days[hover] : null
  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-2 h-5 text-xs text-muted" aria-live="polite">
        {h ? <><b className="text-ink">{fmtDayMonth(h.date)}</b> · {h.total} · {A.types.student.title}: {h.students} · {A.types.trainer.title}: {h.total - h.students}</> : null}
      </div>
      <div className="relative flex min-h-48 flex-1">
        <div className="flex w-6 flex-col-reverse justify-between pb-6 text-right text-[10px] tabular-nums text-muted">{ticks.map((v) => <span key={v}>{v}</span>)}</div>
        <div className="relative flex-1">
          <div className="absolute inset-x-0 bottom-6 top-0 flex flex-col-reverse justify-between">{ticks.map((v) => <div key={v} className="border-t border-line/70" />)}</div>
          <div className="absolute inset-x-0 bottom-6 top-0 flex items-end gap-[2px] pl-1" role="img" aria-label={C.signups}>
            {days.map((d, i) => (
              <div key={i} className="flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${fmtDayMonth(d.date)}: ${d.total}`}>
                <div className="w-full rounded-t-[4px] transition-opacity" style={{ height: `${(d.total / max) * 100}%`, minHeight: d.total ? 3 : 0, background: BAR, opacity: hover == null || hover === i ? 1 : 0.45 }} />
              </div>
            ))}
          </div>
          <div className="absolute inset-x-0 bottom-0 flex justify-between pl-1 text-[10px] text-muted">
            <span>{fmtDayMonth(days[0].date)}</span><span>{fmtDayMonth(days[14].date)}</span><span>{fmtDayMonth(days[29].date)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Funnel({ steps }: { steps: number[] }) {
  const top = Math.max(1, steps[0])
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((v, i) => (
        <li key={i} title={`${C.funnelSteps[i]}: ${v}`}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm"><span className="font-semibold">{C.funnelSteps[i]}</span><span className="tabular-nums"><b>{v}</b><span className="ml-1.5 text-xs text-muted">{i === 0 ? '' : `${Math.round((v / top) * 100)}%`}</span></span></div>
          <div className="h-3 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-r-[4px]" style={{ width: `${(v / top) * 100}%`, minWidth: v ? 6 : 0, background: BAR }} /></div>
        </li>
      ))}
    </ol>
  )
}

const STATUS_TONE: Record<Status, string> = {
  student: 'bg-blue-50 text-blue-800', trial: 'bg-amber-50 text-amber-800', expired: 'bg-red-50 text-red-700', licensed: 'bg-green-50 text-green-800', team: 'bg-surface text-[#4A4E69]',
}

function UsersTable({ rows, reload }: { rows: Row[]; reload: () => void }) {
  const [q, setQ] = useState('')
  const [f, setF] = useState<'all' | Status>('all')
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const shown = rows.filter((r) => (f === 'all' || r.status === f) && (!q || `${r.name} ${r.email} ${r.phone} ${r.org} ${r.position}`.toLowerCase().includes(q.toLowerCase())))
  const act = async (uid: string, fn: () => Promise<unknown>) => { setBusy(uid); try { await fn() } catch { alert(t.team.errors.forbidden) } finally { setBusy(null); reload() } }
  const filters: ('all' | Status)[] = ['all', 'trial', 'expired', 'licensed', 'student', 'team']
  return (
    <Section icon={Users} title={`${C.users} · ${rows.length}`} bodyClassName="p-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
        <Segmented size="sm" value={f} options={filters.map((x) => ({ value: x, label: x === 'all' ? C.all : C.status[x] }))} onChange={setF} />
        <label className="relative ml-auto w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder={C.search} value={q} onChange={(e) => setQ(e.target.value)} aria-label={C.search} />
        </label>
      </div>
      {shown.length === 0 ? <p className="p-6 text-center text-sm text-muted">{C.noUsers}</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-surface/60 text-left text-xs uppercase tracking-wide text-muted">
              <tr>{[C.cols.name, C.cols.contact, C.cols.type, C.cols.org, C.cols.status, C.cols.activity, C.cols.joined, ''].map((h, i) => <th key={i} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((r) => (
                <FragmentRow key={r.uid} r={r} open={open === r.uid} onToggle={() => setOpen(open === r.uid ? null : r.uid)} busy={busy === r.uid} act={act} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

function FragmentRow({ r, open, onToggle, busy, act }: { r: Row; open: boolean; onToggle: () => void; busy: boolean; act: (uid: string, fn: () => Promise<unknown>) => Promise<void> }) {
  const [mode, setMode] = useState<'details' | 'license'>('details')
  const isClient = r.type === 'trainer' || r.type === 'institution'
  const details = Object.entries(r.raw).filter(([k, v]) => !['createdAt', 'lastLoginAt', 'termsAt', 'onboarded', 'photoURL', 'displayName', 'uid', 'dataConsentAt', 'marketingAt'].includes(k) && v !== '' && v != null)
  const show = (m: 'details' | 'license') => { if (open && mode === m) onToggle(); else { setMode(m); if (!open) onToggle() } }
  return (
    <>
      <tr className={r.disabled ? 'opacity-60' : ''}>
        <td className="px-4 py-3"><div className="font-semibold">{r.name}</div><div className="text-xs text-muted">{r.email}</div></td>
        <td className="px-4 py-3 whitespace-nowrap">
          {r.phone && <div className="flex items-center gap-2">
            <a className="font-medium hover:underline" href={`tel:${r.phone.replace(/\s/g, '')}`}>{r.phone}</a>
            <a href={`https://wa.me/${r.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-green-700" aria-label="WhatsApp"><MessageCircle className="h-4 w-4" /></a>
            <a href={`mailto:${r.email}`} className="text-muted" aria-label="Email"><Mail className="h-4 w-4" /></a>
          </div>}
        </td>
        <td className="px-4 py-3">{r.type === 'team' ? t.team.title : A.types[r.type]?.title ?? r.type}</td>
        <td className="px-4 py-3"><div className="max-w-56 truncate">{r.org || '—'}</div><div className="max-w-56 truncate text-xs text-muted">{r.position}</div></td>
        <td className="px-4 py-3"><span className={`chip ${STATUS_TONE[r.status]}`}>{C.status[r.status]}</span>{r.endsAt && r.status !== 'student' && r.status !== 'team' && <div className="mt-1 text-xs text-muted">{fmtDate(r.endsAt)}</div>}{r.member?.plan === 'institution' && <div className="text-xs text-muted">{C.licInst} · {t.acct.org.seats(r.seatsUsed, r.member.seats ?? 1)}</div>}</td>
        <td className="px-4 py-3 text-xs text-muted">{C.activity(r.quizzes, r.games, r.attempts)}</td>
        <td className="px-4 py-3 whitespace-nowrap text-xs text-muted">{r.joined ? fmtDateTime(r.joined) : '—'}</td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            {isClient && <button className={`btn btn-sm ${open && mode === 'license' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => show('license')}><Award />{C.license}</button>}
            {r.type === 'student' && <button className="btn btn-secondary btn-sm" disabled={busy} title={C.convertHint} onClick={() => { if (confirm(`${C.convert}?\n${C.convertHint}`)) void act(r.uid, () => convertToTrainer(r.uid, r.email, r.name)) }}><Rocket />{C.convert}</button>}
            {r.type === 'team' && <Link to="/admin/team" className="btn btn-ghost-dark btn-sm" title={C.teamRow}>{C.manageTeam}</Link>}
            {r.type !== 'team' && <button className="btn btn-ghost-dark btn-sm" aria-expanded={open && mode === 'details'} onClick={() => show('details')}>{C.details}<ChevronDown className={`transition ${open && mode === 'details' ? 'rotate-180' : ''}`} /></button>}
          </div>
        </td>
      </tr>
      {open && (
        <tr className="bg-surface/50">
          <td colSpan={8} className="px-4 py-4">
            {mode === 'license' && isClient ? <LicensePanel r={r} busy={busy} act={act} /> : (
              <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
                {details.map(([k2, v]) => <div key={k2}><dt className="font-semibold uppercase tracking-wide text-muted">{k2}</dt><dd className="font-medium">{Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? '✓' : '—') : String(v)}</dd></div>)}
              </dl>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

const addMonths = (base: Date, n: number) => { const d = new Date(base); d.setMonth(d.getMonth() + n); return d }
const isoDay = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)

/** Lisenziya ver / yenilə / ləğv et + tarixçə. */
function LicensePanel({ r, busy, act }: { r: Row; busy: boolean; act: (uid: string, fn: () => Promise<unknown>) => Promise<void> }) {
  const base = r.status === 'licensed' && r.endsAt && r.endsAt.getTime() > Date.now() ? r.endsAt : new Date()
  const [plan, setPlan] = useState<'pro' | 'institution'>(r.member?.plan === 'institution' || r.type === 'institution' ? 'institution' : 'pro')
  const [seats, setSeats] = useState(String(r.member?.seats ?? (r.type === 'institution' ? 5 : 1)))
  const [until, setUntil] = useState(isoDay(addMonths(base, 1)))
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const ok = until && new Date(until).getTime() > Date.now()
  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div><p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">{C.licPlan}</p><Segmented size="sm" value={plan} options={[{ value: 'pro', label: C.licPro }, { value: 'institution', label: C.licInst }]} onChange={setPlan} /></div>
          {plan === 'institution' && <label className="text-xs font-bold uppercase tracking-wide text-muted">{C.licSeats}<input className="input mt-1 h-10 w-24 text-sm" type="number" min={1} max={500} value={seats} onChange={(e) => setSeats(e.target.value)} /></label>}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-bold uppercase tracking-wide text-muted">{C.licUntil}<input className="input mt-1 h-10 text-sm" type="date" min={isoDay(new Date())} value={until} onChange={(e) => setUntil(e.target.value)} /></label>
          <div className="flex gap-1">{[1, 3, 12].map((m) => <button key={m} type="button" className="btn btn-secondary btn-sm" onClick={() => setUntil(isoDay(addMonths(base, m)))}>+{C.days(m === 12 ? 365 : m * 30)}</button>)}</div>
          <label className="text-xs font-bold uppercase tracking-wide text-muted">{C.licAmount}<input className="input mt-1 h-10 w-28 text-sm" type="number" min={0} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        </div>
        <input className="input h-10 text-sm" placeholder={C.licNote} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} aria-label={C.licNote} />
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary btn-sm" disabled={busy || !ok} onClick={() => void act(r.uid, () => grantLicense(r.uid, r.email, { plan, seats: plan === 'institution' ? Number(seats) || 1 : 1, until: new Date(`${until}T23:59:59`), amount: Number(amount) || 0, note }))}><Award />{C.licSave}</button>
          {r.status === 'licensed' && <button className="btn btn-ghost-dark btn-sm text-red-600" disabled={busy} onClick={() => { if (confirm(`${C.revoke}?`)) void act(r.uid, () => revokeLicense(r.uid, r.email)) }}>{C.revoke}</button>}
          {r.status !== 'licensed' && <button className="btn btn-ghost-dark btn-sm" disabled={busy} onClick={() => void act(r.uid, () => extendTrial(r.uid, r.email, 3))}><Hourglass />{C.extend}</button>}
          <button className="btn btn-ghost-dark btn-sm" disabled={busy} onClick={() => void act(r.uid, () => setRestricted({ uid: r.uid, email: r.email } as AdminRow, !r.disabled))}>{r.disabled ? t.team.unrestrict : t.team.restrict}</button>
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{C.licHistory}</p>
        {r.licenses.length === 0 ? <p className="text-sm text-muted">{C.licNone}</p> : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {r.licenses.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-3 rounded-lg bg-white px-3 py-2">
                <span className="font-semibold">{l.plan === 'revoked' ? C.licRevoked : l.plan === 'institution' ? `${C.licInst} · ${l.seats}` : C.licPro}</span>
                {l.plan !== 'revoked' && l.until && <span className="text-muted">→ {fmtDate(l.until.toDate())}</span>}
                {l.amount > 0 && <span className="font-semibold tabular-nums">{money(l.amount)}</span>}
                <span className="ml-auto text-xs text-muted">{l.at ? fmtDateTime(l.at.toDate()) : ''}</span>
                {l.note && <span className="w-full text-xs text-muted">{l.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/** Bu gün kimlə əlaqə saxlamalı: hazır WhatsApp/e-poçt mesajı ilə (avtomatik xatırlatma üçün server olmadığı halda). */
function ContactToday({ rows, data }: { rows: Row[]; data: ConsoleData }) {
  const now = Date.now()
  type Item = { key: string; name: string; email: string; phone: string; reason: string; msg: string }
  const first = (n: string) => n.split(' ')[0]
  const items: Item[] = []
  for (const r of rows) {
    if (r.type === 'student' || r.type === 'team' || !r.endsAt || r.disabled) continue
    const left = r.endsAt.getTime() - now
    if (r.status === 'trial' && left < DAY) items.push({ key: r.uid + 't', name: r.name, email: r.email, phone: r.phone, reason: 'trialEnding', msg: C.msgTrialEnding(first(r.name)) })
    else if (r.status === 'expired' && !r.member?.licenseUntil && -left < 7 * DAY) items.push({ key: r.uid + 'e', name: r.name, email: r.email, phone: r.phone, reason: 'trialEnded', msg: C.msgTrialEnded(first(r.name)) })
    else if (r.status === 'licensed' && left < 7 * DAY) items.push({ key: r.uid + 'l', name: r.name, email: r.email, phone: r.phone, reason: 'licenseExpiring', msg: C.msgLicense(first(r.name), fmtDate(r.endsAt)) })
  }
  for (const l of data.leads) if (l.status === 'new' && l.createdAt && now - l.createdAt.toMillis() > DAY) items.push({ key: l.id, name: l.name, email: l.email, phone: l.phone, reason: 'leadWaiting', msg: C.msgLead(first(l.name)) })
  return (
    <Section icon={BellRing} title={`${C.contactToday} · ${items.length}`} sub={C.contactTodaySub} className="mb-4" bodyClassName="p-0">
      {items.length === 0 ? <p className="px-5 py-4 text-sm text-muted">{C.noContacts}</p> : (
        <ul className="grid divide-y divide-line md:grid-cols-2 md:divide-y-0">
          {items.map((it) => (
            <li key={it.key} className="flex flex-wrap items-center gap-3 border-line px-5 py-3 md:border-b">
              <div className="min-w-0 flex-1"><div className="truncate font-semibold">{it.name}</div><div className="text-xs font-semibold text-amber-700">{C.reasons[it.reason]}</div></div>
              {it.phone && <a className="btn btn-secondary btn-sm" href={`https://wa.me/${it.phone.replace(/\D/g, '')}?text=${encodeURIComponent(it.msg)}`} target="_blank" rel="noreferrer"><MessageCircle className="text-green-700" />WhatsApp</a>}
              <a className="btn btn-ghost-dark btn-sm" href={`mailto:${it.email}?subject=${encodeURIComponent(C.subject)}&body=${encodeURIComponent(it.msg)}`}><Mail /></a>
              {it.phone && <a className="btn btn-ghost-dark btn-sm" href={`tel:${it.phone.replace(/\s/g, '')}`} aria-label={A.call}><Phone /></a>}
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function Leads({ data, reload }: { data: ConsoleData; reload: () => void }) {
  const [notes, setNotes] = useState<Record<string, string>>({})
  const order: LeadStatus[] = ['new', 'contacted', 'won', 'lost']
  return (
    <Section icon={Inbox} title={`${C.leadsTitle} · ${data.leads.length}`} className="flex flex-col" bodyClassName="flex-1 p-0">
      {data.leads.length === 0 ? (
        <div className="flex h-full min-h-56 flex-col items-center justify-center gap-3 p-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-brand" style={{ background: 'var(--grad-soft)' }}><Inbox /></span>
          <p className="font-bold">{C.noLeads}</p>
          <p className="max-w-md text-sm text-muted">{C.noLeadsHint}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <a href="/pricing" target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm"><Tag />{A.pricingTitle}</a>
            <button className="btn btn-ghost-dark btn-sm" onClick={() => void navigator.clipboard.writeText(`${window.location.origin}/start`)}><Copy />{C.copyLink}</button>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {data.leads.map((l) => (
            <li key={l.id} className="flex flex-col gap-2 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{l.name}</span>
                <span className="chip bg-surface text-[#4A4E69]"><Tag className="h-3 w-3" />{l.plan === 'custom' ? A.planCustom : A.plans[l.plan]?.title}{l.seats ? ` · ${l.seats}` : ''}</span>
                <span className="ml-auto text-xs text-muted">{l.createdAt ? fmtDateTime(l.createdAt.toDate()) : ''}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <a href={`tel:${l.phone.replace(/\s/g, '')}`} className="flex items-center gap-1 font-medium hover:underline"><Phone className="h-3.5 w-3.5" />{l.phone}</a>
                <a href={`https://wa.me/${l.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-green-700 hover:underline"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</a>
                <a href={`mailto:${l.email}`} className="flex items-center gap-1 hover:underline"><Mail className="h-3.5 w-3.5" />{l.email}</a>
                {l.organization && <span className="text-muted">{l.organization}</span>}
              </div>
              {l.message && <p className="rounded-lg bg-surface px-3 py-2 text-sm">{l.message}</p>}
              <div className="flex flex-wrap items-center gap-2">
                <Segmented size="sm" value={l.status} options={order.map((s) => ({ value: s, label: C.leadStatus[s] }))} onChange={(s) => void setLeadStatus(l.id, s).then(reload)} />
                <input className="input h-9 min-w-40 flex-1 text-sm" placeholder={C.note} defaultValue={l.note ?? ''} onChange={(e) => setNotes({ ...notes, [l.id]: e.target.value })} aria-label={C.note} />
                {notes[l.id] !== undefined && notes[l.id] !== (l.note ?? '') && <button className="btn btn-secondary btn-sm" onClick={() => void setLeadStatus(l.id, l.status, notes[l.id]).then(reload)}><Save /></button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function CatalogStats({ data, reload }: { data: ConsoleData; reload: () => void }) {
  const M = t.mod
  const [reports, setReports] = useState<QuizReport[]>([])
  const [busy, setBusy] = useState('')
  useEffect(() => { void listReports().then(setReports).catch(() => setReports([])) }, [data])
  const act = (id: string, fn: () => Promise<unknown>) => { setBusy(id); void fn().then(reload).finally(() => setBusy('')) }
  const stats = data.catalog.map((c) => {
    const at = data.attempts.filter((a) => a.quizId === c.id)
    const avg = at.length ? Math.round((at.reduce((s, a) => s + (a.total ? a.correct / a.total : 0), 0) / at.length) * 100) : 0
    const rep = reports.filter((r) => r.quizId === c.id)
    const flagged = !!c.hidden || c.status === 'review' || rep.length > 0
    return { c, n: at.length, avg, rep, flagged }
  }).sort((a, b) => Number(b.flagged) - Number(a.flagged) || b.n - a.n)
  const queue = stats.filter((x) => x.flagged).length
  return (
    <Section icon={BookOpen} title={`${C.catalogTitle} · ${data.catalog.length}${queue ? ` · ${M.queue}: ${queue}` : ''}`} sub={C.catalogSub} bodyClassName="p-0">
      {stats.length === 0 ? <p className="p-5 text-sm text-muted">{A.emptyCatalog}</p> : (
        <ul className="divide-y divide-line">
          {stats.map(({ c, n, avg, rep, flagged }) => (
            <li key={c.id} className={`flex flex-wrap items-center gap-3 px-5 py-3 text-sm ${flagged ? 'bg-amber-50/60' : ''}`}>
              <span className="text-xl">{c.coverEmoji ?? '🎯'}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{c.title}</div>
                <div className="text-xs text-muted">{c.author ? `${c.author} · ` : ''}{C.plays(n)} · {C.avgScore(avg)}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {c.hidden && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{c.hiddenReason === 'reports' ? M.autoHidden : M.hidden}</span>}
                  {c.status === 'review' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{M.review}</span>}
                  {rep.length > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold" title={rep.map((r) => M.reasons[r.reason] + (r.note ? `: ${r.note}` : '')).join('\n')}>{M.reports(rep.length)} · {[...new Set(rep.map((r) => M.reasons[r.reason]))].join(', ')}</span>}
                </div>
              </div>
              <Link to={`/learn/${c.id}`} className="btn btn-ghost-dark btn-sm">{A.toCatalog}</Link>
              {flagged && <button className="btn btn-secondary btn-sm text-green-700" disabled={busy === c.id} onClick={() => act(c.id, () => approveCatalog(c.id, reports))}>{c.hidden ? M.restore : M.approve}</button>}
              {!c.hidden && <button className="btn btn-ghost-dark btn-sm" disabled={busy === c.id} onClick={() => act(c.id, () => hideCatalog(c.id))}>{M.hide}</button>}
              <button className="btn btn-ghost-dark btn-sm text-red-600" disabled={busy === c.id} onClick={() => { if (confirm(`${A.unpublish}?`)) act(c.id, () => unpublish(c.id)) }}>{A.unpublish}</button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function PricingEditor() {
  const [plans, setPlans] = useState<PricePlan[] | null>(null)
  const [msg, setMsg] = useState('')
  useEffect(() => { void loadPricing().then(setPlans) }, [])
  if (!plans) return null
  const set = (i: number, p: Partial<PricePlan>) => setPlans(plans.map((x, j) => (j === i ? { ...x, ...p } : x)))
  return (
    <Section icon={Tag} title={C.pricingTitle} sub={C.pricingSub}
      actions={<button className="btn btn-primary btn-sm" onClick={() => void savePricing(plans).then(() => setMsg(C.saved), () => setMsg(t.app.error))}><Save />{t.app.save}</button>}>
      <div className="flex flex-col gap-3">
        {plans.map((p, i) => (
          <div key={p.key} className="grid grid-cols-[6.5rem_1fr_6rem] items-center gap-2">
            <span className="text-sm font-semibold">{A.plans[p.key].title}</span>
            <input className="input h-10 text-sm" placeholder={C.price} value={p.price} maxLength={30} onChange={(e) => set(i, { price: e.target.value })} aria-label={`${A.plans[p.key].title}: ${C.price}`} />
            <input className="input h-10 text-sm" placeholder={C.period} value={p.period} maxLength={20} onChange={(e) => set(i, { period: e.target.value })} aria-label={`${A.plans[p.key].title}: ${C.period}`} />
          </div>
        ))}
        {msg && <p className="text-sm font-semibold text-ok" role="status">{msg}</p>}
      </div>
    </Section>
  )
}
