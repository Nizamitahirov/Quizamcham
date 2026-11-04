import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { visibleGames } from '../../lib/access'
import type { AdminState } from '../../firebase/auth'
import { Link } from 'react-router-dom'
import type { Timestamp } from 'firebase/firestore'
import { deleteGame, listGames } from '../../firebase/db'
import { LOCALE, t } from '../../i18n/az'
import { PageHeader, Spinner } from '../../components/ui'
import { BarChart3, MonitorPlay, Trash2 } from 'lucide-react'
import type { Phase } from '../../types'

type Row = { id: string; hostUid?: string; title?: string; pin?: string; playerCount?: number; phase?: Phase; createdAt?: Timestamp }

export default function Games() {
  const admin = useOutletContext<AdminState>()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [msg, setMsg] = useState('')
  const reload = useCallback(() => { void listGames().then((r) => setRows(visibleGames(admin, r as Row[]))).catch(() => setRows([])) }, [admin])
  useEffect(reload, [reload])
  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-8">
      <PageHeader title={t.games.title} />
      {msg && <p className="mb-4 rounded-xl bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800" role="status">{msg}</p>}
      {!rows ? <Spinner /> : rows.length === 0 ? <p className="card p-8 text-center text-muted">{t.games.empty}</p> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface text-[11px] uppercase tracking-wider text-muted">
              <tr><th className="p-3">{t.games.date}</th><th className="p-3">{t.games.quiz}</th><th className="p-3">PIN</th><th className="p-3">{t.games.players}</th><th className="p-3">{t.games.status}</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.id} className="border-t border-line text-sm hover:bg-surface/60">
                  <td className="p-3 text-sm">{g.createdAt?.toDate().toLocaleString(LOCALE, { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td className="p-3 font-bold">{g.title}</td>
                  <td className="p-3 font-mono">{g.pin}</td>
                  <td className="p-3">{g.playerCount ?? 0}</td>
                  <td className="p-3"><span className={`chip ${g.phase === 'finished' ? 'bg-surface text-[#4A4E69]' : 'bg-green-100 text-green-700'}`}>{g.phase ? t.games.phases[g.phase] : ''}</span></td>
                  <td className="flex flex-wrap justify-end gap-2 p-3">
                    {g.phase !== 'finished' && <Link className="btn btn-soft btn-sm" to={`/host/${g.id}`}><MonitorPlay />{t.games.host}</Link>}
                    <Link className="btn btn-secondary btn-sm" to={`/admin/games/${g.id}`}><BarChart3 />{t.games.open}</Link>
                    <button className="btn btn-ghost-dark btn-sm btn-icon text-red-600" onClick={async () => { if (confirm(`${t.games.delete}?`)) { try { await deleteGame(g.id, g.pin) } catch { setMsg(t.admin.deleteFailed) } reload() } }}><Trash2 /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
