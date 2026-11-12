import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Clock, Footprints } from 'lucide-react'
import { LOCALE, t } from '../../i18n/az'
import { Avatar } from '../../components/Avatar'
import { shortName } from '../../lib/nameFilter'
import { rankPlayers } from '../../lib/scoring'
import { serverNow } from '../../lib/timeSync'
import type { Game, Player } from '../../types'

const fmt = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }

/** Öz tempində rejimi: hər iştirakçının irəliləyişi və canlı reytinq. */
export function HostSelf({ game, players }: { game: Game; players: Player[] }) {
  const [now, setNow] = useState(serverNow())
  useEffect(() => { const id = setInterval(() => setNow(serverNow()), 500); return () => clearInterval(id) }, [])
  const left = (game.selfEndsAt?.toMillis() ?? now) - now
  // "Nəticələr sonda" rejimində proyektorda xal/yer göstərilmir — yalnız irəliləyiş
  const hidden = game.settings.selfFeedback === false
  const ranked = hidden
    ? [...players].sort((a, b) => (b.history?.length ?? 0) - (a.history?.length ?? 0) || a.firstName.localeCompare(b.firstName)).map((p, i) => ({ ...p, rank: i + 1 }))
    : rankPlayers(players)
  const done = players.filter((p) => (p.history?.length ?? 0) >= game.totalQuestions).length
  return (
    <div className="flex min-h-0 flex-1 gap-8 p-8">
      <section className="flex w-[34%] shrink-0 flex-col gap-4">
        <div className="chip chip-dark self-start text-base"><Footprints className="h-4 w-4" />{t.settings.modes.self.title}</div>
        <h1 className="text-5xl font-black leading-tight">{game.title}</h1>
        <div className="glass-strong gradient-border flex flex-col items-center gap-2 p-8">
          <span className="label-dark flex items-center gap-2"><Clock className="h-4 w-4" />{t.host.timeLeft}</span>
          <span className={`font-display text-8xl font-black tabular-nums ${left < 60000 ? 'text-red-400' : 'text-grad'}`}>{fmt(left)}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="glass p-5"><div className="label-dark">{t.host.participants}</div><div className="font-display text-5xl font-black">{players.length}</div></div>
          <div className="glass p-5"><div className="label-dark">{t.host.done}</div><div className="font-display text-5xl font-black">{done}</div></div>
        </div>
        <p className="text-lg text-white/60">PIN <b className="text-[#fff]">{game.pin}</b> · {window.location.host}</p>
      </section>
      <section className="scrollbar-thin min-h-0 flex-1 overflow-auto pr-2">
        <div className="label-dark">{t.host.progress}</div>
        <ol className="flex flex-col gap-2">
          {ranked.map((p) => {
            const n = p.history?.length ?? 0
            const pct = Math.min(100, (n / game.totalQuestions) * 100)
            return (
              <motion.li layout key={p.uid} className="glass flex items-center gap-4 px-4 py-3">
                {!hidden && <span className="font-display w-8 text-center text-2xl font-black text-white/60">{p.rank}</span>}
                <Avatar avatar={p.avatar} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-xl font-bold">{shortName(p.firstName, p.lastName)}</span>
                    <span className="flex items-center gap-2 text-lg font-black tabular-nums">{n >= game.totalQuestions && <CheckCircle2 className="h-5 w-5 text-green-400" />}{n}/{game.totalQuestions}{!hidden && <> · {p.score.toLocaleString(LOCALE)}</>}</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full" style={{ background: 'var(--grad)' }} animate={{ width: `${pct}%` }} /></div>
                </div>
              </motion.li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
