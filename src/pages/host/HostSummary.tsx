import { useState } from 'react'
import { Link } from 'react-router-dom'
import { t } from '../../i18n/az'
import { Leaderboard } from '../../components/Leaderboard'
import { download } from '../../lib/csv'
import { loadReport, reportCsv } from '../../lib/report'
import type { Game } from '../../types'

export default function HostSummary({ game, onNewGame }: { game: Game; onNewGame: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const s = game.stats
  const exportCsv = async () => {
    setBusy(true)
    try { download(`quizamcham-${game.pin}.csv`, reportCsv(await loadReport(game.id))) } finally { setBusy(false) }
  }
  const pct = (x: number) => `${Math.round(x * 100)}%`
  return (
    <div className="flex min-h-0 flex-1 gap-8 overflow-auto p-8">
      <section className="flex w-[40%] flex-col gap-4">
        <h1 className="text-5xl">{t.host.summary}</h1>
        <p className="text-2xl opacity-80">{game.title}</p>
        <div className="grid grid-cols-2 gap-4">
          <Stat label={t.host.participants} value={String(s?.players ?? game.playerCount)} />
          <Stat label={t.host.avgAccuracy} value={pct(s?.avgAccuracy ?? 0)} />
        </div>
        {s?.hardest && <Stat label={`${t.host.hardest} · ${pct(s.hardest.accuracy)}`} value={`${s.hardest.index + 1}. ${s.hardest.text}`} small />}
        {s?.easiest && <Stat label={`${t.host.easiest} · ${pct(s.easiest.accuracy)}`} value={`${s.easiest.index + 1}. ${s.easiest.text}`} small />}
        <div className="mt-2 flex flex-wrap gap-3">
          <button className="btn btn-secondary text-lg" onClick={exportCsv} disabled={busy}>{t.host.exportCsv}</button>
          <button className="btn btn-primary text-lg" onClick={() => { setBusy(true); void onNewGame().finally(() => setBusy(false)) }} disabled={busy}>{t.host.newGame}</button>
          <Link className="btn btn-ghost text-lg" to="/admin">{t.host.backToAdmin}</Link>
        </div>
      </section>
      <section className="min-h-0 flex-1 overflow-auto">
        <Leaderboard entries={game.leaderboard} max={200} />
      </section>
    </div>
  )
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-3xl p-5" style={{ background: 'rgba(255,255,255,.12)' }}>
      <div className="text-lg font-extrabold uppercase opacity-70">{label}</div>
      <div className={`font-display ${small ? 'text-2xl' : 'text-6xl'}`}>{value}</div>
    </div>
  )
}
