import { confirmDialog } from '../../components/dialogs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bug, RefreshCw, ScrollText, Search, Trash2 } from 'lucide-react'
import { t } from '../../i18n/az'
import { fmtDateTime } from '../../lib/format'
import { listAudit, logAudit, type AuditRow } from '../../lib/audit'
import { clearErrors, listErrors } from '../../lib/dataAdmin'
import { PageHeader, Spinner } from '../../components/ui'
import { Section, Segmented } from '../../components/kit'

const L = t.logs
type Tab = 'audit' | 'errors'

/** Yalnız super admin: audit jurnalı (kim nə etdi) və klient xəta jurnalı. */
export default function Logs() {
  const [tab, setTab] = useState<Tab>('audit')
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <PageHeader title={L.title} sub={L.sub}>
        <Segmented value={tab} options={[{ value: 'audit', label: L.audit }, { value: 'errors', label: L.errors }]} onChange={setTab} />
      </PageHeader>
      {tab === 'audit' ? <AuditLog /> : <ErrorLog />}
    </div>
  )
}

const ACTION_TONE: Record<string, string> = {
  member_restricted: 'bg-red-500/10 text-red-300', member_removed: 'bg-red-500/10 text-red-300', quiz_deleted: 'bg-red-500/10 text-red-300',
  game_deleted: 'bg-red-500/10 text-red-300', data_cleanup: 'bg-red-500/10 text-red-300', logs_cleared: 'bg-red-500/10 text-red-300',
  member_created: 'bg-green-500/10 text-green-300', member_unrestricted: 'bg-green-500/10 text-green-300',
  member_role: 'bg-amber-500/10 text-amber-300', password_reset_sent: 'bg-amber-500/10 text-amber-300', settings_saved: 'bg-amber-500/10 text-amber-300', sounds_saved: 'bg-amber-500/10 text-amber-300',
}

function AuditLog() {
  const [rows, setRows] = useState<AuditRow[] | null>(null)
  const [q, setQ] = useState('')
  const [action, setAction] = useState('')
  const load = useCallback(() => { setRows(null); void listAudit(500).then(setRows).catch(() => setRows([])) }, [])
  useEffect(load, [load])
  const shown = useMemo(() => (rows ?? []).filter((r) =>
    (!action || r.action === action)
    && (!q || `${r.actorEmail} ${r.targetEmail ?? ''} ${L.actions[r.action] ?? r.action}`.toLowerCase().includes(q.toLowerCase()))), [rows, q, action])
  const actions = useMemo(() => [...new Set((rows ?? []).map((r) => r.action))].sort(), [rows])
  return (
    <Section icon={ScrollText} title={L.audit} actions={<button className="btn btn-ghost-dark btn-sm" onClick={load}><RefreshCw />{L.refresh}</button>}>
      <div className="mb-3 flex flex-wrap gap-2">
        <label className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder={L.search} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="input w-auto" value={action} onChange={(e) => setAction(e.target.value)} aria-label={L.what}>
          <option value="">{L.all}</option>
          {actions.map((a) => <option key={a} value={a}>{L.actions[a] ?? a}</option>)}
        </select>
      </div>
      {!rows ? <Spinner /> : shown.length === 0 ? <p className="text-sm text-muted">{L.empty}</p> : (
        <div className="scrollbar-thin max-h-[65vh] overflow-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="sticky top-0 bg-panel text-left text-xs uppercase tracking-wide text-muted">
              <tr><th className="py-2 pr-3 font-semibold">{L.when}</th><th className="py-2 pr-3 font-semibold">{L.who}</th><th className="py-2 pr-3 font-semibold">{L.what}</th><th className="py-2 font-semibold">{L.target}</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="whitespace-nowrap py-2.5 pr-3 tabular-nums text-muted">{r.at ? fmtDateTime(r.at.toDate()) : '…'}</td>
                  <td className="py-2.5 pr-3 font-medium">{r.actorEmail || r.actor}</td>
                  <td className="py-2.5 pr-3"><span className={`chip ${ACTION_TONE[r.action] ?? 'bg-surface text-fg2'}`}>{L.actions[r.action] ?? r.action}</span></td>
                  <td className="py-2.5 text-muted">
                    {r.targetEmail || r.target || '—'}
                    {r.details && Object.keys(r.details).length > 0 && <div className="mt-0.5 text-xs">{Object.entries(r.details).map(([k, v]) => `${k}: ${String(v)}`).join(' · ')}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

function ErrorLog() {
  const D = t.data
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listErrors>> | null>(null)
  const load = useCallback(() => { setRows(null); void listErrors(200).then(setRows).catch(() => setRows([])) }, [])
  useEffect(load, [load])
  const clear = async () => { if (!(await confirmDialog({ title: D.clearErrors + '?', danger: true }))) return; await clearErrors(); void logAudit('logs_cleared'); load() }
  return (
    <Section icon={Bug} title={L.errors} actions={
      <div className="flex gap-2">
        <button className="btn btn-ghost-dark btn-sm" onClick={load}><RefreshCw />{L.refresh}</button>
        {!!rows?.length && <button className="btn btn-ghost-dark btn-sm text-red-300" onClick={() => void clear()}><Trash2 />{D.clearErrors}</button>}
      </div>}>
      {!rows ? <Spinner /> : rows.length === 0 ? <p className="text-sm text-muted">{D.noErrors}</p> : (
        <ul className="scrollbar-thin flex max-h-[65vh] flex-col gap-2 overflow-auto">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl bg-surface p-3 text-xs">
              <div className="font-bold text-red-300">{r.message}</div>
              <div className="mt-1 break-all text-muted">{(r.at ? fmtDateTime(r.at.toDate()) : '')} · {r.url} · {r.context}</div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
