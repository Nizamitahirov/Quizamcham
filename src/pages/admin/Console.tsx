import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, Briefcase, ChevronDown, Copy, Clock, Download, GraduationCap, Hourglass, Inbox, Mail, MessageCircle, Phone, RefreshCw, Save, Search, ShieldCheck, Tag, TrendingUp, UserPlus, Users } from 'lucide-react'
import { t } from '../../i18n/az'
import { fmtDate, fmtDateTime, fmtDayMonth } from '../../lib/format'
import { toCsv, download } from '../../lib/csv'
import { planInfo } from '../../lib/roles'
import { setRestricted, type AdminRow } from '../../lib/team'
import {
  extendTrial, grantLicense, loadConsole, loadPricing, savePricing, setLeadStatus, unpublish,
  type ConsoleData, type LeadStatus, type PricePlan,
} from '../../lib/account'
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
    return data.users.map((u) => {
      const m = members.get(u.uid)
      const p = planInfo(m ?? null)
      const status: Status = u.type === 'student' ? 'student' : !m ? 'expired' : !p.selfServe ? 'team' : p.licensed && p.active ? 'licensed' : p.active ? 'trial' : 'expired'
      return {
        uid: u.uid, name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.displayName || u.email, email: u.email, phone: u.phone ?? '',
        type: u.type, org: u.organization || u.institution || '', position: u.position || u.level || '',
        status, endsAt: p.endsAt, joined: u.createdAt?.toDate() ?? null,
        quizzes: data.quizOwners[u.uid] ?? 0, games: data.gameHosts[u.uid] ?? 0, attempts: att[u.uid] ?? 0,
        disabled: m?.disabled === true, raw: u as unknown as Record<string, unknown>,
      }
    }).sort((a, b) => (b.joined?.getTime() ?? 0) - (a.joined?.getTime() ?? 0))
  }, [data])

  if (err) return <div className="mx-auto max-w-3xl p-8"><p className="card p-6 text-sm font-semibold text-red-700">{t.app.error} ({err})</p></div>
  if (!data) return <div className="p-10"><Spinner /></div>

  const now = Date.now()
  const trainers = rows.filter((r) => r.type !== 'student')
  const k = {
    users: rows.length,
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
      </div>

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

function Kpi({ icon: Icon, label, value, warn, good }: { icon: typeof Users; label: string; value: number; warn?: boolean; good?: boolean }) {
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
  const isTrainer = r.type !== 'student' && r.status !== 'team'
  const details = Object.entries(r.raw).filter(([k, v]) => !['createdAt', 'lastLoginAt', 'termsAt', 'onboarded', 'photoURL', 'displayName', 'uid'].includes(k) && v !== '' && v != null)
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
        <td className="px-4 py-3">{A.types[r.type]?.title ?? r.type}</td>
        <td className="px-4 py-3"><div className="max-w-56 truncate">{r.org || '—'}</div><div className="max-w-56 truncate text-xs text-muted">{r.position}</div></td>
        <td className="px-4 py-3"><span className={`chip ${STATUS_TONE[r.status]}`}>{C.status[r.status]}</span>{r.endsAt && r.status !== 'student' && r.status !== 'team' && <div className="mt-1 text-xs text-muted">{fmtDate(r.endsAt)}</div>}</td>
        <td className="px-4 py-3 text-xs text-muted">{C.activity(r.quizzes, r.games, r.attempts)}</td>
        <td className="px-4 py-3 whitespace-nowrap text-xs text-muted">{r.joined ? fmtDateTime(r.joined) : '—'}</td>
        <td className="px-4 py-3 text-right"><button className="btn btn-ghost-dark btn-sm" aria-expanded={open} onClick={onToggle}>{C.details}<ChevronDown className={`transition ${open ? 'rotate-180' : ''}`} /></button></td>
      </tr>
      {open && (
        <tr className="bg-surface/50">
          <td colSpan={8} className="px-4 py-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
              <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2 xl:grid-cols-3">
                {details.map(([k2, v]) => <div key={k2}><dt className="font-semibold uppercase tracking-wide text-muted">{k2}</dt><dd className="font-medium">{Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? '✓' : '—') : String(v)}</dd></div>)}
              </dl>
              {isTrainer && (
                <div className="flex flex-col gap-2 lg:w-64">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">{C.grant}</p>
                  <div className="grid grid-cols-3 gap-1">{[30, 90, 365].map((d) => <button key={d} className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void act(r.uid, () => grantLicense(r.uid, r.email, d))}>{C.days(d)}</button>)}</div>
                  <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void act(r.uid, () => extendTrial(r.uid, r.email, 3))}><Hourglass />{C.extend}</button>
                  {r.status === 'licensed' && <button className="btn btn-ghost-dark btn-sm text-red-600" disabled={busy} onClick={() => { if (confirm(`${C.revoke}?`)) void act(r.uid, () => grantLicense(r.uid, r.email, 0)) }}>{C.revoke}</button>}
                  <button className="btn btn-ghost-dark btn-sm" disabled={busy} onClick={() => void act(r.uid, () => setRestricted({ uid: r.uid, email: r.email } as AdminRow, !r.disabled))}>{r.disabled ? t.team.unrestrict : t.team.restrict}</button>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
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
  const stats = data.catalog.map((c) => {
    const at = data.attempts.filter((a) => a.quizId === c.id)
    const avg = at.length ? Math.round((at.reduce((s, a) => s + (a.total ? a.correct / a.total : 0), 0) / at.length) * 100) : 0
    return { c, n: at.length, avg }
  }).sort((a, b) => b.n - a.n)
  return (
    <Section icon={BookOpen} title={`${C.catalogTitle} · ${data.catalog.length}`} sub={C.catalogSub} bodyClassName="p-0">
      {stats.length === 0 ? <p className="p-5 text-sm text-muted">{A.emptyCatalog}</p> : (
        <ul className="divide-y divide-line">
          {stats.map(({ c, n, avg }) => (
            <li key={c.id} className="flex items-center gap-3 px-5 py-3 text-sm">
              <span className="text-xl">{c.coverEmoji ?? '🎯'}</span>
              <div className="min-w-0 flex-1"><div className="truncate font-semibold">{c.title}</div><div className="text-xs text-muted">{C.plays(n)} · {C.avgScore(avg)}</div></div>
              <button className="btn btn-ghost-dark btn-sm text-red-600" onClick={() => { if (confirm(`${A.unpublish}?`)) void unpublish(c.id).then(reload) }}>{A.unpublish}</button>
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
