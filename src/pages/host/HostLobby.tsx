import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Smartphone, UserX } from 'lucide-react'
import { t } from '../../i18n/az'
import { QRBlock } from '../../components/QRBlock'
import { Avatar } from '../../components/Avatar'
import { shortName } from '../../lib/nameFilter'
import { serverNow } from '../../lib/timeSync'
import { TEAMS } from '../../lib/teams'
import type { Player } from '../../types'
import type { HostCtx } from './HostGame'

function useQrSize() {
  const calc = () => Math.round(Math.max(240, Math.min(470, window.innerHeight * 0.44, window.innerWidth * 0.26)))
  const [s, setS] = useState(calc)
  useEffect(() => {
    const h = () => setS(calc())
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return s
}

export function HostLobby({ game, players, onKick }: HostCtx & { onKick: (p: Player) => void }) {
  const url = `${window.location.origin}/join?pin=${game.pin}`
  const short = `${window.location.host}`
  const qr = useQrSize()
  const sorted = [...players].sort((a, b) => (a.joinedAt?.toMillis() ?? 0) - (b.joinedAt?.toMillis() ?? 0))
  const now = serverNow()
  return (
    <div className="flex min-h-0 flex-1 gap-8 p-8">
      <section className="glass-strong gradient-border flex shrink-0 flex-col items-center justify-center gap-5 p-8">
        <QRBlock url={url} size={qr} />
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-xl text-white/70"><Smartphone className="h-5 w-5" />{t.host.joinAt} <b className="text-white">{short}</b></div>
          <div className="label-dark mt-4">PIN</div>
          <div className="font-display text-grad text-8xl font-black tracking-[.12em]">{game.pin}</div>
        </div>
      </section>
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="mb-6 flex items-end justify-between gap-6">
          <div className="min-w-0">
            <div className="label-dark">{t.app.tagline}</div>
            <h1 className="truncate text-5xl font-black">{game.title}</h1>
          </div>
          {game.host?.name && (
            <div className="glass flex shrink-0 items-center gap-3 py-2 pl-2 pr-5">
              {game.host.photoUrl ? <img src={game.host.photoUrl} alt="" className="h-12 w-12 rounded-full object-cover" /> : game.host.avatar ? <Avatar avatar={game.host.avatar} size={48} /> : null}
              <div><div className="text-[10px] font-bold uppercase tracking-widest text-white/50">{t.profile.trainer}</div><div className="text-lg font-bold">{game.host.name}</div>{game.host.title && <div className="text-xs text-white/55">{game.host.title}</div>}</div>
            </div>
          )}
          <motion.div key={players.length} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="flex shrink-0 items-center gap-3 rounded-2xl px-6 py-3" style={{ background: 'var(--grad)', boxShadow: 'var(--glow)' }}>
            <span className="font-display text-5xl font-black">{players.length}</span>
            <span className="text-lg font-bold leading-tight">{t.games.players}</span>
          </motion.div>
        </div>
        {game.locked && <div className="chip mb-4 self-start bg-amber-400 text-black">🔒 {t.join.locked}</div>}
        {players.length === 0 ? (
          <div className="m-auto flex flex-col items-center gap-5 text-3xl text-white/60">
            <motion.span animate={{ y: [0, -14, 0] }} transition={{ repeat: Infinity, duration: 1.6 }}><Smartphone className="h-24 w-24 text-orange-400" /></motion.span>
            {t.host.waitingPlayers}
          </div>
        ) : (
          <div className="scrollbar-thin flex min-h-0 flex-wrap content-start gap-3 overflow-auto pb-4">
            <AnimatePresence>
              {sorted.map((p, i) => {
                const idle = p.lastSeen ? now - p.lastSeen.toMillis() > 90000 : false
                return (
                  <motion.div key={p.uid} layout initial={{ y: -300, opacity: 0, rotate: -20 }} animate={{ y: 0, opacity: 1, rotate: 0, scale: [1, 1.15, 1] }} exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 14, delay: Math.min(i, 5) * 0.03 }}
                    className="glass group relative flex items-center gap-3 rounded-full py-1.5 pl-1.5 pr-5" title={idle ? t.host.idle : undefined}>
                    <span className="rounded-full" style={p.team != null && TEAMS[p.team] ? { boxShadow: `0 0 0 3px ${TEAMS[p.team].color}` } : undefined}><Avatar avatar={p.avatar} size={52} dim={idle} /></span>
                    <span className="max-w-44 truncate text-xl font-bold">{shortName(p.firstName, p.lastName)}</span>
                    <button className="absolute -right-1 -top-1 hidden h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white group-hover:flex" onClick={() => onKick(p)} aria-label={t.host.kick}><UserX className="h-4 w-4" /></button>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  )
}
