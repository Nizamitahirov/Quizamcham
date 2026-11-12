import { confirmDialog } from '../../components/dialogs'
import { useCallback, useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Ban, Building2, Copy, KeyRound, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react'
import { t } from '../../i18n/az'
import { PageHeader, Spinner } from '../../components/ui'
import { Field, Section } from '../../components/kit'
import { createOrgMember, listOrgMembers, removeOrgMember, resetOrgMember, setOrgMemberDisabled, type OrgMember } from '../../lib/team'
import type { AdminState } from '../../firebase/auth'

const O = t.acct.org
const T = t.team

/** Müəssisə sahibi: lisenziyadakı yerlər üzrə öz təlimçiləri. */
export default function OrgTeam() {
  const admin = useOutletContext<AdminState>()
  const org = admin.org
  const [rows, setRows] = useState<OrgMember[] | null>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)
  const reload = useCallback(() => { if (org.role === 'owner') void listOrgMembers(org.id).then(setRows).catch(() => setRows([])) }, [org.role, org.id])
  useEffect(reload, [reload])
  if (org.role !== 'owner') return <div className="mx-auto max-w-3xl p-8"><p className="card p-6 text-sm font-semibold text-amber-300">{t.access.noPerm}</p></div>
  const used = rows?.length ?? 0
  const full = used >= org.seats
  const act = async (fn: () => Promise<unknown>, ok?: string) => { setMsg(null); try { await fn(); if (ok) setMsg({ ok: true, text: ok }) } catch { setMsg({ ok: false, text: T.errors.failed }) } reload() }
  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (full || !admin.plan.active) return
    setBusy(true); setMsg(null); setCreated(null)
    try { const r = await createOrgMember(email, name, org.id); setCreated({ email, password: r.password }); setEmail(''); setName(''); reload() } catch (ex) {
      const code = (ex as { code?: string }).code
      setMsg({ ok: false, text: code === 'auth/email-already-in-use' ? T.exists : code === 'permission-denied' ? T.errors.forbidden : t.app.error })
    } finally { setBusy(false) }
  }
  return (
    <div className="mx-auto max-w-[1440px] p-4 sm:p-8">
      <PageHeader title={O.title} sub={O.sub}><Link to="/pricing#request" className="btn btn-secondary">{O.moreSeats}</Link></PageHeader>
      {msg && <p className={`mb-4 rounded-xl px-4 py-3 text-sm font-semibold ${msg.ok ? 'bg-green-500/10 text-green-300' : 'bg-red-500/10 text-red-300'}`} role="status">{msg.text}</p>}
      <div className="card mb-4 flex flex-wrap items-center gap-4 p-5">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl text-brand" style={{ background: 'var(--grad-soft)' }}><Building2 /></span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-2xl font-black">{O.seats(used, org.seats)}</div>
          <div className="mt-2 h-2 max-w-md overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (used / Math.max(1, org.seats)) * 100)}%`, background: full ? '#B45309' : 'var(--grad)' }} /></div>
        </div>
        <p className="max-w-xl text-sm text-muted">{O.inherit}</p>
      </div>
      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Section icon={Users} title={T.members} sub={O.loginHint} className="flex flex-col" bodyClassName="flex flex-1 flex-col">
          {!rows ? <div className="p-5"><Spinner /></div> : rows.length === 0 ? (
            <div className="m-5 flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line p-8 text-center text-muted"><UserPlus className="h-8 w-8 text-brand" /><p className="font-bold text-ink">{O.empty}</p></div>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((m) => (
                <li key={m.uid} className={`flex flex-wrap items-center gap-3 px-5 py-3.5 ${m.disabled ? 'opacity-60' : ''}`}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-[#fff]" style={{ background: m.disabled ? '#9CA3AF' : 'var(--grad)' }}>{(m.name || m.email)[0]?.toUpperCase()}</span>
                  <div className="min-w-[10rem] flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-bold"><span className="truncate">{m.name || m.email.split('@')[0]}</span>
                      {m.disabled && <span className="chip bg-red-500/10 text-red-300"><Ban className="h-3 w-3" />{T.restricted}</span>}
                      {!m.disabled && m.mustChangePassword && <span className="chip bg-amber-500/10 text-amber-300">{T.pendingPassword}</span>}</div>
                    <div className="truncate text-xs text-muted">{m.email}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="btn btn-ghost-dark btn-icon btn-sm" title={T.reset} aria-label={T.reset} onClick={async () => { if ((await confirmDialog({ title: T.resetConfirm(m.email) }))) void act(() => resetOrgMember(m), T.resetSent(m.email)) }}><KeyRound /></button>
                    <button className={`btn btn-ghost-dark btn-icon btn-sm ${m.disabled ? 'text-green-300' : 'text-amber-300'}`} title={m.disabled ? T.unrestrict : T.restrict} aria-label={m.disabled ? T.unrestrict : T.restrict}
                      onClick={async () => { if (m.disabled || (await confirmDialog({ title: T.restrictConfirm(m.email), danger: true }))) void act(() => setOrgMemberDisabled(m, !m.disabled)) }}>{m.disabled ? <ShieldCheck /> : <Ban />}</button>
                    <button className="btn btn-ghost-dark btn-icon btn-sm text-red-300" title={T.remove} aria-label={T.remove} onClick={async () => { if ((await confirmDialog({ title: T.removeConfirm(m.email), danger: true }))) void act(() => removeOrgMember(m)) }}><Trash2 /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section icon={UserPlus} title={O.add} className="flex flex-col" bodyClassName="flex flex-1 flex-col p-5">
          <form onSubmit={add} className="flex flex-1 flex-col gap-3">
            <Field label={T.email}><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={full} /></Field>
            <Field label={T.name}><input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} disabled={full} /></Field>
            {full && <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-300">{O.full}</p>}
            <button className="btn btn-primary mt-auto" disabled={busy || full || !admin.plan.active}><UserPlus />{O.add}</button>
            {created && (
              <div className="rounded-xl bg-green-500/10 p-3 text-sm text-green-300">
                <p className="mb-2">{O.created}</p>
                <div className="flex items-center gap-2 rounded-lg bg-panel p-2 font-mono text-xs"><span className="flex-1 truncate">{created.email} · {created.password}</span>
                  <button type="button" className="btn btn-ghost-dark btn-icon btn-sm" aria-label="Copy" onClick={() => void navigator.clipboard.writeText(`${created.email}\n${created.password}`)}><Copy /></button></div>
              </div>
            )}
          </form>
        </Section>
      </div>
    </div>
  )
}
