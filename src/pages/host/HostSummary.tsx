import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Download, LayoutDashboard, RefreshCw, Target, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { t } from '../../i18n/az'
import { Leaderboard } from '../../components/Leaderboard'
import { Avatar } from '../../components/Avatar'
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
      <section className="flex w-[44%] flex-col gap-4">
        <div>
          <div className="label-dark">{game.title}</div>
          <h1 className="text-5xl font-black">{t.host.summary}</h1>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Stat icon={<Users />} label={t.host.participants} value={String(s?.players ?? game.playerCount)} />
          <Stat icon={<Target />} label={t.host.avgAccuracy} value={pct(s?.avgAccuracy ?? 0)} />
        </div>
        {s?.hardest && <Stat icon={<TrendingDown />} label={`${t.host.hardest} · ${pct(s.hardest.accuracy)}`} value={`${s.hardest.index + 1}. ${s.hardest.text}`} small />}
        {s?.easiest && <Stat icon={<TrendingUp />} label={`${t.host.easiest} · ${pct(s.easiest.accuracy)}`} value={`${s.easiest.index + 1}. ${s.easiest.text}`} small />}
        {(game.awards ?? []).length > 0 && (
          <div className="glass p-5">
            <div className="label-dark">{t.host.awards}</div>
            <div className="grid grid-cols-2 gap-3">
              {game.awards!.map((a, i) => (
                <motion.div key={a.key + i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="flex items-center gap-3 rounded-2xl bg-white/[.06] p-3">
                  <Avatar avatar={a.avatar} size={44} />
                  <div className="min-w-0"><div className="text-sm font-bold text-orange-300">{t.awards[a.key]}</div><div className="truncate font-bold">{a.name} <span className="text-white/50">· {a.value}</span></div></div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-3">
          <button className="btn btn-white" onClick={exportCsv} disabled={busy}><Download />{t.host.exportCsv}</button>
          <button className="btn btn-primary" onClick={() => { setBusy(true); void onNewGame().finally(() => setBusy(false)) }} disabled={busy}><RefreshCw />{t.host.newGame}</button>
          <Link className="btn btn-ghost" to="/admin"><LayoutDashboard />{t.host.backToAdmin}</Link>
        </div>
      </section>
      <section className="scrollbar-thin min-h-0 flex-1 overflow-auto pr-2">
        <Leaderboard entries={game.leaderboard} max={200} />
      </section>
    </div>
  )
}

function Stat({ icon, label, value, small }: { icon: React.ReactNode; label: string; value: string; small?: boolean }) {
  return (
    <div className="glass p-5">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white/55"><span className="text-orange-400 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>{label}</div>
      <div className={`font-display font-black ${small ? 'text-2xl leading-snug' : 'text-6xl'}`}>{value}</div>
    </div>
  )
}
