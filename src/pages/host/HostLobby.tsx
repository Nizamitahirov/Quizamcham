import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { t } from '../../i18n/az'
import { QRBlock } from '../../components/QRBlock'
import { Avatar } from '../../components/Avatar'
import { shortName } from '../../lib/nameFilter'
import { serverNow } from '../../lib/timeSync'
import type { Player } from '../../types'
import type { HostCtx } from './HostGame'

function useQrSize() {
  const calc = () => Math.round(Math.max(260, Math.min(560, window.innerHeight * 0.5, window.innerWidth * 0.3)))
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
  const short = `${window.location.host}/join`
  const qr = useQrSize()
  const sorted = [...players].sort((a, b) => (a.joinedAt?.toMillis() ?? 0) - (b.joinedAt?.toMillis() ?? 0))
  const now = serverNow()
  return (
    <div className="flex min-h-0 flex-1 gap-10 p-8">
      <section className="flex shrink-0 flex-col items-center justify-center gap-5">
        <QRBlock url={url} size={qr} />
        <div className="text-center">
          <div className="text-2xl opacity-90">{t.host.joinAt} <b>{short}</b></div>
          <div className="font-display mt-2 rounded-3xl bg-white px-8 py-3 text-7xl tracking-[.15em] text-ink shadow-2xl">{game.pin}</div>
        </div>
      </section>
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-5xl">{game.title}</h1>
          <motion.div key={players.length} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="font-display rounded-2xl bg-white/15 px-6 py-3 text-4xl">
            {t.host.playersJoined(players.length)}
          </motion.div>
        </div>
        {game.locked && <div className="mb-4 self-start rounded-xl bg-amber-400 px-4 py-2 font-extrabold text-black">🔒</div>}
        {players.length === 0 ? (
          <div className="m-auto flex flex-col items-center gap-4 text-3xl opacity-80">
            <motion.span animate={{ y: [0, -14, 0] }} transition={{ repeat: Infinity, duration: 1.6 }} className="text-8xl">📱</motion.span>
            {t.host.waitingPlayers}
          </div>
        ) : (
          <div className="flex min-h-0 flex-wrap content-start gap-5 overflow-auto pb-4">
            <AnimatePresence>
              {sorted.map((p, i) => {
                const idle = p.lastSeen ? now - p.lastSeen.toMillis() > 90000 : false
                return (
                  <motion.div
                    key={p.uid}
                    layout
                    initial={{ y: -300, opacity: 0, rotate: -20 }}
                    animate={{ y: 0, opacity: 1, rotate: 0, scale: [1, 1.2, 1] }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 14, delay: Math.min(i, 5) * 0.03 }}
                    className="group relative flex w-32 flex-col items-center gap-1"
                    title={idle ? t.host.idle : undefined}
                  >
                    <Avatar avatar={p.avatar} size={88} dim={idle} />
                    <span className="max-w-32 truncate rounded-full bg-black/30 px-3 py-0.5 text-lg font-extrabold">{shortName(p.firstName, p.lastName)}</span>
                    <button className="absolute right-2 top-0 hidden h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white group-hover:flex" onClick={() => onKick(p)} aria-label={t.host.kick}>✕</button>
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
