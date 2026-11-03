import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Timestamp } from 'firebase/firestore'
import { deleteGame, listGames } from '../../firebase/db'
import { t } from '../../i18n/az'
import { Spinner } from '../../components/ui'
import type { Phase } from '../../types'

type Row = { id: string; title?: string; pin?: string; playerCount?: number; phase?: Phase; createdAt?: Timestamp }

export default function Games() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const reload = useCallback(() => { void listGames().then((r) => setRows(r as Row[])).catch(() => setRows([])) }, [])
  useEffect(reload, [reload])
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <h1 className="mb-6 text-3xl">{t.games.title}</h1>
      {!rows ? <Spinner /> : rows.length === 0 ? <p className="rounded-2xl bg-white p-8 text-center text-slate-500">{t.games.empty}</p> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="p-3">{t.games.date}</th><th className="p-3">{t.games.quiz}</th><th className="p-3">PIN</th><th className="p-3">{t.games.players}</th><th className="p-3">{t.games.status}</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.id} className="border-t border-slate-100">
                  <td className="p-3 text-sm">{g.createdAt?.toDate().toLocaleString('az-AZ', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td className="p-3 font-bold">{g.title}</td>
                  <td className="p-3 font-mono">{g.pin}</td>
                  <td className="p-3">{g.playerCount ?? 0}</td>
                  <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-extrabold ${g.phase === 'finished' ? 'bg-slate-100' : 'bg-green-100 text-green-800'}`}>{g.phase ? t.games.phases[g.phase] : ''}</span></td>
                  <td className="flex flex-wrap justify-end gap-2 p-3">
                    {g.phase !== 'finished' && <Link className="btn btn-ghost-dark min-h-10 py-1 text-sm" to={`/host/${g.id}`}>{t.games.host}</Link>}
                    <Link className="btn btn-secondary min-h-10 py-1 text-sm" to={`/admin/games/${g.id}`}>{t.games.open}</Link>
                    <button className="btn btn-danger min-h-10 py-1 text-sm" onClick={async () => { if (confirm(`${t.games.delete}?`)) { await deleteGame(g.id, g.pin); reload() } }}>🗑</button>
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
