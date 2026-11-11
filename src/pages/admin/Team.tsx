import { confirmDialog } from '../../components/dialogs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { AlertTriangle, Ban, Check, Copy, Crown, KeyRound, Lock, Minus, RotateCcw, Save, ShieldCheck, ShieldAlert, SlidersHorizontal, Trash2, UserCog, UserPlus, Users, X } from 'lucide-react'
import { t } from '../../i18n/az'
import { PageHeader, Spinner } from '../../components/ui'
import { Field, Section, Segmented } from '../../components/kit'
import { createMember, listAdmins, loadAccess, removeMember, saveAccess, sendReset, setMemberPerms, setRestricted, setRole, type AdminRow } from '../../lib/team'
import { canManageMember, DEFAULT_ACCESS, isSuperRole, PERM_GROUPS, PERM_KEYS, roleDefault, type AccessConfig, type PermKey, type PermMap, type Role } from '../../lib/roles'
import type { AdminState } from '../../firebase/auth'

const T = t.team
type Assignable = Exclude<Role, 'super'>

const roleLabel = (r: Role) => (r === 'super' ? T.super : r === 'admin' ? T.admin : T.trainer)

function RoleChip({ role }: { role: Role }) {
  const cls = role === 'super' ? 'chip-brand' : role === 'admin' ? 'chip-info' : 'chip-muted'
  return <span className={`chip whitespace-nowrap ${cls}`}>{role === 'super' && <Crown className="h-3.5 w-3.5" />}{roleLabel(role)}</span>
}

function Toggle({ on, onChange, disabled, label }: { on: boolean; onChange?: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange?.(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:cursor-not-allowed ${on ? '' : 'bg-white/15'} ${disabled ? 'opacity-60' : ''}`}
      style={on ? { background: 'var(--grad)' } : undefined}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[1.375rem]' : 'left-0.5'}`} />
    </button>
  )
}

export default function Team() {
  const admin = useOutletContext<AdminState>()
  const { role, perms } = admin
  const superAdmin = isSuperRole(role)
  const [rows, setRows] = useState<AdminRow[] | null>(null)
  const [access, setAccess] = useState<AccessConfig | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [openPerms, setOpenPerms] = useState<string | null>(null)
  const reload = useCallback(() => { void listAdmins().then(setRows).catch(() => setRows([])) }, [])
  const reloadAccess = useCallback(() => { void loadAccess().then(setAccess) }, [])
  useEffect(() => { reload(); reloadAccess() }, [reload, reloadAccess])

  const run = useCallback(async (fn: () => Promise<unknown>, ok?: string) => {
    setMsg(null)
    try { await fn(); if (ok) setMsg({ ok: true, text: ok }) } catch (ex) {
      setMsg({ ok: false, text: (ex as { code?: string }).code === 'permission-denied' ? T.errors.forbidden : T.errors.failed })
    }
    reload()
  }, [reload])

  if (!perms.trainers) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-8">
        <PageHeader title={T.title} sub={T.sub} />
        <p className="card flex items-center gap-2 p-4 text-sm font-semibold text-amber-300"><ShieldAlert className="h-4 w-4" />{t.access.noPerm}</p>
      </div>
    )
  }

  const stats = {
    total: rows?.length ?? 0,
    admins: rows?.filter((r) => r.role === 'admin').length ?? 0,
    trainers: rows?.filter((r) => r.role === 'trainer').length ?? 0,
    attention: rows?.filter((r) => r.disabled || r.mustChangePassword).length ?? 0,
  }

  return (
    <div className="mx-auto max-w-[1440px] p-4 sm:p-8">
      <PageHeader title={T.title} sub={T.sub} />
      {msg && <p className={`mb-4 rounded-xl px-4 py-3 text-sm font-semibold ${msg.ok ? 'bg-green-500/10 text-green-300' : 'bg-red-500/10 text-red-300'}`} role="status">{msg.text}</p>}

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Users} label={T.kpi.total} value={stats.total} />
        <Kpi icon={Crown} label={T.kpi.admins} value={stats.admins} />
        <Kpi icon={UserCog} label={T.kpi.trainers} value={stats.trainers} />
        <Kpi icon={AlertTriangle} label={T.kpi.attention} value={stats.attention} sub={T.kpi.attentionSub} warn={stats.attention > 0} />
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Section icon={Users} title={T.members} sub={superAdmin ? T.roleHint : T.adminOnlyTrainers} className="flex flex-col" bodyClassName="flex flex-1 flex-col">
          {!rows ? <div className="p-5"><Spinner /></div> : (
            <>
              <ul className="divide-y divide-line">
                {rows.map((r) => (
                  <MemberRow key={r.uid} r={r} me={admin} access={access} open={openPerms === r.uid}
                    onTogglePerms={() => setOpenPerms((x) => (x === r.uid ? null : r.uid))} run={run} />
                ))}
              </ul>
              {rows.length <= 1 && (
                <div className="m-5 mt-1 flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line p-6 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-brand" style={{ background: 'var(--grad-soft)' }}><UserPlus /></span>
                  <p className="font-bold">{T.emptyTitle}</p>
                  <p className="max-w-md text-sm text-muted">{T.emptyText}</p>
                </div>
              )}
            </>
          )}
        </Section>
        <AddMember superAdmin={superAdmin} onAdded={reload} />
      </div>

      <RolePermissions className="mt-4" editable={superAdmin} access={access} onSaved={() => { reloadAccess(); setMsg({ ok: true, text: T.saved }) }} />
    </div>
  )
}

function Kpi({ icon: Icon, label, value, sub, warn }: { icon: typeof Users; label: string; value: number; sub?: string; warn?: boolean }) {
  return (
    <div className="card flex items-center gap-4 p-4">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${warn ? 'bg-amber-500/10 text-amber-300' : 'text-brand'}`} style={warn ? undefined : { background: 'var(--grad-soft)' }}><Icon className="h-5 w-5" /></span>
      <div className="min-w-0">
        <div className="font-display text-2xl font-black leading-none tabular-nums">{value}</div>
        <div className="mt-1 truncate text-xs font-semibold text-muted" title={sub}>{label}</div>
      </div>
    </div>
  )
}

function MemberRow({ r, me, access, open, onTogglePerms, run }: {
  r: AdminRow; me: AdminState; access: AccessConfig | null; open: boolean; onTogglePerms: () => void
  run: (fn: () => Promise<unknown>, ok?: string) => Promise<void>
}) {
  const superAdmin = isSuperRole(me.role)
  const can = canManageMember(me.role, me.user?.uid, r)
  const overrides = Object.keys(r.perms ?? {}).length
  return (
    <li className={r.disabled ? 'opacity-60' : ''}>
      <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ background: r.disabled ? '#9CA3AF' : 'var(--grad)' }}>{(r.name || r.email)[0]?.toUpperCase()}</span>
        <div className="min-w-[10rem] flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
            <span className="truncate">{r.name || r.email.split('@')[0]}</span>
            {r.uid === me.user?.uid && <span className="font-normal text-muted">({T.you})</span>}
            {r.disabled && <span className="chip bg-red-500/10 text-red-300"><Ban className="h-3 w-3" />{T.restricted}</span>}
            {!r.disabled && r.mustChangePassword && <span className="chip bg-amber-500/10 text-amber-300">{T.pendingPassword}</span>}
            {overrides > 0 && <span className="chip bg-blue-500/10 text-blue-300"><SlidersHorizontal className="h-3 w-3" />{T.overrides(overrides)}</span>}
          </div>
          <div className="truncate text-xs text-muted">{r.email}</div>
        </div>
        {superAdmin && can ? (
          <Segmented size="sm" value={r.role as Assignable} options={[{ value: 'trainer', label: T.trainer }, { value: 'admin', label: T.admin }]}
            onChange={(v) => void run(() => setRole(r, v))} />
        ) : <RoleChip role={r.role} />}
        {can ? (
          <div className="flex items-center gap-1">
            {superAdmin && (
              <button className={`btn btn-ghost-dark btn-icon btn-sm ${open ? 'bg-surface' : ''}`} title={T.personal} aria-label={T.personal} aria-expanded={open} onClick={onTogglePerms}><SlidersHorizontal /></button>
            )}
            <button className="btn btn-ghost-dark btn-icon btn-sm" title={T.reset} aria-label={T.reset}
              onClick={async () => { if ((await confirmDialog({ title: T.resetConfirm(r.email) }))) void run(() => sendReset(r), T.resetSent(r.email)) }}><KeyRound /></button>
            <button className={`btn btn-ghost-dark btn-icon btn-sm ${r.disabled ? 'text-green-300' : 'text-amber-300'}`} title={r.disabled ? T.unrestrict : T.restrict} aria-label={r.disabled ? T.unrestrict : T.restrict}
              onClick={async () => { if (r.disabled || (await confirmDialog({ title: T.restrictConfirm(r.email), danger: true }))) void run(() => setRestricted(r, !r.disabled)) }}>{r.disabled ? <ShieldCheck /> : <Ban />}</button>
            <button className="btn btn-ghost-dark btn-icon btn-sm text-red-300" title={T.remove} aria-label={T.remove}
              onClick={async () => { if ((await confirmDialog({ title: T.removeConfirm(r.email), danger: true }))) void run(() => removeMember(r)) }}><Trash2 /></button>
          </div>
        ) : r.role === 'super' ? <span className="flex items-center gap-1 text-xs font-semibold text-muted"><Lock className="h-3.5 w-3.5" />{T.protected}</span> : null}
      </div>
      {open && superAdmin && r.role !== 'super' && <PersonalPerms r={r} access={access} onClose={onTogglePerms} run={run} />}
    </li>
  )
}

/** Şəxsə xüsusi icazələr: hər icazə üçün "Rol üzrə / Ver / Alma". */
function PersonalPerms({ r, access, onClose, run }: { r: AdminRow; access: AccessConfig | null; onClose: () => void; run: (fn: () => Promise<unknown>, ok?: string) => Promise<void> }) {
  const [draft, setDraft] = useState<PermMap>(r.perms ?? {})
  const role = r.role === 'admin' ? 'admin' : 'trainer'
  const dirty = JSON.stringify(draft) !== JSON.stringify(r.perms ?? {})
  const set = (k: PermKey, v: 'inherit' | 'allow' | 'deny') => setDraft((d) => {
    const n = { ...d }
    if (v === 'inherit') delete n[k]; else n[k] = v === 'allow'
    return n
  })
  return (
    <div className="border-t border-line bg-surface/60 px-5 py-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{T.personal}</p>
          <p className="text-xs text-muted">{T.personalSub(r.email)}</p>
        </div>
        <button className="btn btn-ghost-dark btn-sm" onClick={onClose}><X />{T.close}</button>
        <button className="btn btn-primary btn-sm" disabled={!dirty} onClick={() => void run(() => setMemberPerms(r, draft), T.saved).then(onClose)}><Save />{T.save}</button>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {PERM_KEYS.map((k) => {
          const def = roleDefault(role, access, k)
          const v = draft[k] === undefined ? 'inherit' : draft[k] ? 'allow' : 'deny'
          return (
            <div key={k} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{T.perms[k]}</div>
                <div className="text-[11px] text-muted">{T.roleSays(def)}</div>
              </div>
              <Segmented size="sm" value={v} options={[{ value: 'inherit', label: T.inherit }, { value: 'allow', label: T.allow }, { value: 'deny', label: T.deny }]} onChange={(x) => set(k, x)} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AddMember({ superAdmin, onAdded }: { superAdmin: boolean; onAdded: () => void }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [newRole, setNewRole] = useState<Assignable>('trainer')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)
  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr(''); setCreated(null)
    try {
      const r = await createMember(email, name, superAdmin ? newRole : 'trainer')
      setCreated({ email, password: r.password }); setEmail(''); setName(''); onAdded()
    } catch (ex) {
      const code = (ex as { code?: string }).code
      setErr(code === 'auth/email-already-in-use' ? T.exists : code === 'permission-denied' ? T.errors.forbidden : t.app.error)
    } finally { setBusy(false) }
  }
  return (
    <Section icon={UserPlus} title={T.add} className="flex flex-col" bodyClassName="flex flex-1 flex-col p-5">
      <form onSubmit={add} className="flex flex-1 flex-col gap-3">
        <Field label={T.email}><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label={T.name}><input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></Field>
        {superAdmin
          ? <Field label={T.role}><Segmented value={newRole} options={[{ value: 'trainer', label: T.trainer }, { value: 'admin', label: T.admin }]} onChange={setNewRole} /></Field>
          : <p className="text-xs text-muted">{T.role}: <b>{T.trainer}</b></p>}
        <button className="btn btn-primary mt-auto" disabled={busy}><UserPlus />{T.add}</button>
        {err && <p className="text-sm font-semibold text-red-300" role="alert">{err}</p>}
        {created && (
          <div className="rounded-xl bg-green-500/10 p-3 text-sm text-green-300">
            <p className="mb-2">{T.created}</p>
            <div className="flex items-center gap-2 rounded-lg bg-panel p-2 font-mono text-xs"><span className="flex-1 truncate">{created.email} · {created.password}</span>
              <button type="button" className="btn btn-ghost-dark btn-icon btn-sm" aria-label="Copy" onClick={() => void navigator.clipboard.writeText(`${created.email}\n${created.password}`)}><Copy /></button></div>
          </div>
        )}
      </form>
    </Section>
  )
}

/** Rol icazələri: super admin dəyişir; digərlərinə yalnız baxış. */
function RolePermissions({ editable, access, onSaved, className = '' }: { editable: boolean; access: AccessConfig | null; onSaved: () => void; className?: string }) {
  const base = useMemo<AccessConfig>(() => ({
    admin: Object.fromEntries(PERM_KEYS.map((k) => [k, roleDefault('admin', access, k)])),
    trainer: Object.fromEntries(PERM_KEYS.map((k) => [k, roleDefault('trainer', access, k)])),
  }), [access])
  const [draft, setDraft] = useState<AccessConfig>(base)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { setDraft(base) }, [base])
  const dirty = JSON.stringify(draft) !== JSON.stringify(base)
  const isDefault = JSON.stringify(draft) === JSON.stringify({ admin: DEFAULT_ACCESS.admin, trainer: DEFAULT_ACCESS.trainer })
  const save = async () => {
    setBusy(true); setErr('')
    try { await saveAccess(draft, access); onSaved() } catch { setErr(T.errors.failed) } finally { setBusy(false) }
  }
  const cell = (on: boolean, onChange?: (v: boolean) => void, label = '') => (
    <td className="px-3 py-3 text-center">
      <div className="flex justify-center">{onChange ? <Toggle on={on} onChange={onChange} disabled={!editable} label={label} /> : on ? <Check className="h-4 w-4 text-green-300" aria-label="✓" /> : <Minus className="h-4 w-4 text-slate-300" aria-label="—" />}</div>
    </td>
  )
  return (
    <Section className={className} icon={ShieldCheck} title={T.editorTitle} sub={editable ? T.editorSub : T.editorReadOnly}
      actions={editable ? (
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost-dark btn-sm" disabled={isDefault} onClick={() => setDraft({ admin: { ...DEFAULT_ACCESS.admin }, trainer: { ...DEFAULT_ACCESS.trainer } })}><RotateCcw />{T.resetDefaults}</button>
          <button className="btn btn-primary btn-sm" disabled={!dirty || busy} onClick={() => void save()}><Save />{T.save}</button>
        </div>
      ) : undefined} bodyClassName="p-0">
      {err && <p className="mx-5 mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300">{err}</p>}
      {/* Telefon: hər icazə ayrıca kart, rol açarları altında */}
      <div className="divide-y divide-line md:hidden">
        {PERM_GROUPS.map((g) => (
          <div key={g.key}>
            <p className="bg-surface/70 px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-muted">{T.groups[g.key]}</p>
            {g.perms.map((k) => (
              <div key={k} className="border-t border-line px-5 py-3">
                <div className="font-semibold">{T.perms[k]}</div>
                <div className="text-xs text-muted">{T.permDesc[k]}</div>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-muted"><Check className="h-4 w-4 text-green-300" />{T.super}</span>
                  <label className="flex items-center gap-2">{T.admin}<Toggle on={!!draft.admin[k]} disabled={!editable} label={`${T.admin}: ${T.perms[k]}`} onChange={(v) => setDraft((d) => ({ ...d, admin: { ...d.admin, [k]: v } }))} /></label>
                  <label className="flex items-center gap-2">{T.trainer}<Toggle on={!!draft.trainer[k]} disabled={!editable} label={`${T.trainer}: ${T.perms[k]}`} onChange={(v) => setDraft((d) => ({ ...d, trainer: { ...d.trainer, [k]: v } }))} /></label>
                </div>
              </div>
            ))}
          </div>
        ))}
        <div className="px-5 py-3">
          <div className="flex items-center gap-1.5 font-semibold"><Lock className="h-3.5 w-3.5 text-muted" />{T.perms.manageAdmins}</div>
          <div className="text-xs text-muted">{T.permDesc.manageAdmins}</div>
        </div>
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold" />
              {(['super', 'admin', 'trainer'] as Role[]).map((r) => <th key={r} className="w-40 px-3 py-3 text-center font-semibold"><RoleChip role={r} /></th>)}
            </tr>
          </thead>
          <tbody>
            {PERM_GROUPS.map((g) => (
              <PermGroup key={g.key} title={T.groups[g.key]}>
                {g.perms.map((k) => (
                  <tr key={k} className="border-b border-line last:border-0">
                    <td className="px-5 py-3"><div className="font-semibold">{T.perms[k]}</div><div className="text-xs text-muted">{T.permDesc[k]}</div></td>
                    {cell(true)}
                    {cell(!!draft.admin[k], (v) => setDraft((d) => ({ ...d, admin: { ...d.admin, [k]: v } })), `${T.admin}: ${T.perms[k]}`)}
                    {cell(!!draft.trainer[k], (v) => setDraft((d) => ({ ...d, trainer: { ...d.trainer, [k]: v } })), `${T.trainer}: ${T.perms[k]}`)}
                  </tr>
                ))}
              </PermGroup>
            ))}
            <tr>
              <td className="px-5 py-3"><div className="flex items-center gap-1.5 font-semibold"><Lock className="h-3.5 w-3.5 text-muted" />{T.perms.manageAdmins}</div><div className="text-xs text-muted">{T.permDesc.manageAdmins}</div></td>
              {cell(true)}{cell(false)}{cell(false)}
            </tr>
          </tbody>
        </table>
      </div>
    </Section>
  )
}

function PermGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <tr className="bg-surface/70"><td colSpan={4} className="px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-muted">{title}</td></tr>
      {children}
    </>
  )
}
