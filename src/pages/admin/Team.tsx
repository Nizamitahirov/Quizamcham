import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Copy, Crown, ShieldAlert, Trash2, UserPlus, Users } from 'lucide-react'
import { t } from '../../i18n/az'
import { PageHeader, Spinner } from '../../components/ui'
import { Field, Section, Segmented } from '../../components/kit'
import { createTrainer, listAdmins, removeAdmin, setRole, type AdminRow } from '../../lib/team'
import type { AdminState, Role } from '../../firebase/auth'

const T = t.team

export default function Team() {
  const { user, role } = useOutletContext<AdminState>()
  const [rows, setRows] = useState<AdminRow[] | null>(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [newRole, setNewRole] = useState<Role>('trainer')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)
  const reload = useCallback(() => { void listAdmins().then(setRows).catch(() => setRows([])) }, [])
  useEffect(reload, [reload])
  const owner = role === 'owner'

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setMsg(''); setCreated(null)
    try {
      const r = await createTrainer(email, name, newRole)
      setCreated({ email, password: r.password }); setEmail(''); setName(''); reload()
    } catch (ex) {
      setMsg((ex as { code?: string }).code === 'auth/email-already-in-use' ? T.exists : t.app.error)
    } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-8">
      <PageHeader title={T.title} sub={T.sub} />
      {!owner && <p className="card mb-4 flex items-center gap-2 p-4 text-sm font-semibold text-amber-800"><ShieldAlert className="h-4 w-4" />{T.ownerOnly}</p>}
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Section icon={Users} title={T.title} sub={T.roleHint}>
          {!rows ? <Spinner /> : (
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li key={r.uid} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full font-bold text-white" style={{ background: 'var(--grad)' }}>{(r.name || r.email)[0]?.toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{r.name || r.email.split('@')[0]} {r.uid === user?.uid && <span className="text-muted">({T.you})</span>}</div>
                    <div className="truncate text-xs text-muted">{r.email}</div>
                  </div>
                  {owner && r.uid !== user?.uid ? (
                    <>
                      <Segmented size="sm" value={r.role} options={[{ value: 'trainer', label: T.trainer }, { value: 'owner', label: T.owner }]} onChange={async (v) => { await setRole(r.uid, r, v); reload() }} />
                      <button className="btn btn-ghost-dark btn-icon btn-sm text-red-600" title={T.remove} onClick={async () => { if (confirm(T.removeConfirm(r.email))) { await removeAdmin(r.uid); reload() } }}><Trash2 /></button>
                    </>
                  ) : <span className={`chip ${r.role === 'owner' ? 'chip-brand' : 'bg-surface text-[#4A4E69]'}`}>{r.role === 'owner' && <Crown className="h-3.5 w-3.5" />}{r.role === 'owner' ? T.owner : T.trainer}</span>}
                </li>
              ))}
            </ul>
          )}
        </Section>
        {owner && (
          <Section icon={UserPlus} title={T.add}>
            <form onSubmit={add} className="flex flex-col gap-3">
              <Field label={T.email}><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              <Field label={T.name}><input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label={T.role}><Segmented value={newRole} options={[{ value: 'trainer', label: T.trainer }, { value: 'owner', label: T.owner }]} onChange={setNewRole} /></Field>
              <button className="btn btn-primary" disabled={busy}><UserPlus />{T.add}</button>
              {msg && <p className="text-sm font-semibold text-red-600">{msg}</p>}
              {created && (
                <div className="rounded-xl bg-green-50 p-3 text-sm text-green-900">
                  <p className="mb-2">{T.created}</p>
                  <div className="flex items-center gap-2 rounded-lg bg-white p-2 font-mono text-xs"><span className="flex-1 truncate">{created.email} · {created.password}</span>
                    <button type="button" className="btn btn-ghost-dark btn-icon btn-sm" onClick={() => void navigator.clipboard.writeText(`${created.email}\n${created.password}`)}><Copy /></button></div>
                </div>
              )}
            </form>
          </Section>
        )}
      </div>
    </div>
  )
}
