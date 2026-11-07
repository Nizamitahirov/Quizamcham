import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Ban, Check, Copy, Crown, KeyRound, Minus, ShieldAlert, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react'
import { t } from '../../i18n/az'
import { PageHeader, Spinner } from '../../components/ui'
import { Field, Section, Segmented } from '../../components/kit'
import { createMember, listAdmins, removeMember, sendReset, setRestricted, setRole, type AdminRow } from '../../lib/team'
import { canManageMember, isManagerRole, isSuperRole, type Role } from '../../lib/roles'
import type { AdminState } from '../../firebase/auth'

const T = t.team
type Assignable = Exclude<Role, 'super'>

const roleLabel = (r: Role) => (r === 'super' ? T.super : r === 'admin' ? T.admin : T.trainer)

function RoleChip({ role }: { role: Role }) {
  const cls = role === 'super' ? 'chip-brand' : role === 'admin' ? 'bg-ink text-white' : 'bg-surface text-[#4A4E69]'
  return <span className={`chip ${cls}`}>{role === 'super' && <Crown className="h-3.5 w-3.5" />}{roleLabel(role)}</span>
}

export default function Team() {
  const { user, role } = useOutletContext<AdminState>()
  const [rows, setRows] = useState<AdminRow[] | null>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [newRole, setNewRole] = useState<Assignable>('trainer')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)
  const reload = useCallback(() => { void listAdmins().then(setRows).catch(() => setRows([])) }, [])
  useEffect(reload, [reload])
  const manager = isManagerRole(role)
  const superAdmin = isSuperRole(role)

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setMsg(null)
    try { await fn(); if (ok) setMsg({ ok: true, text: ok }) } catch (ex) {
      setMsg({ ok: false, text: (ex as { code?: string }).code === 'permission-denied' ? T.errors.forbidden : T.errors.failed })
    }
    reload()
  }

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setMsg(null); setCreated(null)
    try {
      const r = await createMember(email, name, superAdmin ? newRole : 'trainer')
      setCreated({ email, password: r.password }); setEmail(''); setName(''); reload()
    } catch (ex) {
      const code = (ex as { code?: string }).code
      setMsg({ ok: false, text: code === 'auth/email-already-in-use' ? T.exists : code === 'permission-denied' ? T.errors.forbidden : t.app.error })
    } finally { setBusy(false) }
  }

  if (!manager) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-8">
        <PageHeader title={T.title} sub={T.sub} />
        <p className="card flex items-center gap-2 p-4 text-sm font-semibold text-amber-800"><ShieldAlert className="h-4 w-4" />{T.ownerOnly}</p>
      </div>
    )
  }

  const perms: { label: string; super: boolean; admin: boolean; trainer: boolean }[] = [
    { label: T.perms.ownQuizzes, super: true, admin: true, trainer: true },
    { label: T.perms.library, super: true, admin: true, trainer: true },
    { label: T.perms.allContent, super: true, admin: true, trainer: false },
    { label: T.perms.trainers, super: true, admin: true, trainer: false },
    { label: T.perms.settings, super: true, admin: true, trainer: false },
    { label: T.perms.admins, super: true, admin: false, trainer: false },
    { label: T.perms.logs, super: true, admin: false, trainer: false },
  ]

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <PageHeader title={T.title} sub={T.sub} />
      {msg && <p className={`mb-4 rounded-xl px-4 py-3 text-sm font-semibold ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`} role="status">{msg.text}</p>}
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_360px]">
        <Section icon={Users} title={T.members} sub={superAdmin ? T.roleHint : T.adminOnlyTrainers}>
          {!rows ? <Spinner /> : (
            <ul className="divide-y divide-line">
              {rows.map((r) => {
                const can = canManageMember(role, user?.uid, r)
                return (
                  <li key={r.uid} className={`flex flex-wrap items-center gap-3 py-3 ${r.disabled ? 'opacity-60' : ''}`}>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ background: r.disabled ? '#9CA3AF' : 'var(--grad)' }}>{(r.name || r.email)[0]?.toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                        <span className="truncate">{r.name || r.email.split('@')[0]}</span>
                        {r.uid === user?.uid && <span className="font-normal text-muted">({T.you})</span>}
                        {r.disabled && <span className="chip bg-red-50 text-red-700"><Ban className="h-3 w-3" />{T.restricted}</span>}
                        {!r.disabled && r.mustChangePassword && <span className="chip bg-amber-50 text-amber-800">{T.pendingPassword}</span>}
                      </div>
                      <div className="truncate text-xs text-muted">{r.email}</div>
                    </div>
                    {superAdmin && can ? (
                      <Segmented size="sm" value={r.role as Assignable} options={[{ value: 'trainer', label: T.trainer }, { value: 'admin', label: T.admin }]}
                        onChange={(v) => void run(() => setRole(r, v))} />
                    ) : <RoleChip role={r.role} />}
                    {can ? (
                      <div className="flex items-center gap-1">
                        <button className="btn btn-ghost-dark btn-icon btn-sm" title={T.reset} aria-label={T.reset}
                          onClick={() => { if (confirm(T.resetConfirm(r.email))) void run(() => sendReset(r), T.resetSent(r.email)) }}><KeyRound /></button>
                        <button className={`btn btn-ghost-dark btn-icon btn-sm ${r.disabled ? 'text-green-700' : 'text-amber-700'}`} title={r.disabled ? T.unrestrict : T.restrict} aria-label={r.disabled ? T.unrestrict : T.restrict}
                          onClick={() => { if (r.disabled || confirm(T.restrictConfirm(r.email))) void run(() => setRestricted(r, !r.disabled)) }}>{r.disabled ? <ShieldCheck /> : <Ban />}</button>
                        <button className="btn btn-ghost-dark btn-icon btn-sm text-red-600" title={T.remove} aria-label={T.remove}
                          onClick={() => { if (confirm(T.removeConfirm(r.email))) void run(() => removeMember(r)) }}><Trash2 /></button>
                      </div>
                    ) : r.role === 'super' ? <span className="text-xs font-semibold text-muted">{T.protected}</span> : null}
                  </li>
                )
              })}
            </ul>
          )}
        </Section>

        <Section icon={UserPlus} title={T.add}>
          <form onSubmit={add} className="flex flex-col gap-3">
            <Field label={T.email}><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label={T.name}><input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></Field>
            {superAdmin
              ? <Field label={T.role}><Segmented value={newRole} options={[{ value: 'trainer', label: T.trainer }, { value: 'admin', label: T.admin }]} onChange={setNewRole} /></Field>
              : <p className="text-xs text-muted">{T.role}: <b>{T.trainer}</b></p>}
            <button className="btn btn-primary" disabled={busy}><UserPlus />{T.add}</button>
            {created && (
              <div className="rounded-xl bg-green-50 p-3 text-sm text-green-900">
                <p className="mb-2">{T.created}</p>
                <div className="flex items-center gap-2 rounded-lg bg-white p-2 font-mono text-xs"><span className="flex-1 truncate">{created.email} · {created.password}</span>
                  <button type="button" className="btn btn-ghost-dark btn-icon btn-sm" aria-label="Copy" onClick={() => void navigator.clipboard.writeText(`${created.email}\n${created.password}`)}><Copy /></button></div>
              </div>
            )}
          </form>
        </Section>
      </div>

      <div className="mt-4">
        <Section icon={ShieldCheck} title={T.matrixTitle} sub={T.matrixSub}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-4 font-semibold" />
                  {(['super', 'admin', 'trainer'] as Role[]).map((r) => <th key={r} className="px-3 py-2 text-center font-semibold"><RoleChip role={r} /></th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {perms.map((p) => (
                  <tr key={p.label}>
                    <td className="py-2.5 pr-4 font-medium">{p.label}</td>
                    {[p.super, p.admin, p.trainer].map((v, i) => (
                      <td key={i} className="px-3 py-2.5 text-center">{v ? <Check className="mx-auto h-4 w-4 text-green-600" aria-label="✓" /> : <Minus className="mx-auto h-4 w-4 text-slate-300" aria-label="—" />}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </div>
  )
}
