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

/**
 * QR ölçüsü ekranın həm hündürlüyünə, həm enində sığır: başlıq + alt panel + PIN bloku üçün yer saxlanılır
 * (əvvəl 1366×768 kimi noutbuklarda QR çərçivədən kənara çıxırdı).
 */
function useQrSize() {
  const calc = () => {
    const w = window.innerWidth, h = window.innerHeight
    if (w < 1024) return Math.round(Math.max(160, Math.min(300, w - 120, h * 0.38)))
    return Math.round(Math.max(170, Math.min(470, h - 520, w * 0.26)))
  }
  const [s, setS] = useState(calc)
  useEffect(() => {
    const h = () => setS(calc())
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return s
}

const LOBBY_SHOW = 80
export function HostLobby({ game, players, onKick }: HostCtx & { onKick: (p: Player) => void }) {
  const url = `${window.location.origin}/join?pin=${game.pin}`
  const short = `${window.location.host}`
  const qr = useQrSize()
  const sorted = [...players].sort((a, b) => (a.joinedAt?.toMillis() ?? 0) - (b.joinedAt?.toMillis() ?? 0))
  const now = serverNow()
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:flex-row lg:gap-8 lg:overflow-hidden lg:p-8">
      <section className="glass-strong gradient-border flex shrink-0 flex-col items-center justify-center gap-3 p-4 sm:p-6 lg:gap-4 lg:p-8">
        <QRBlock url={url} size={qr} />
        <div className="min-w-0 max-w-full text-center">
          <div className="flex flex-wrap items-center justify-center gap-x-2 text-base text-white/70 sm:text-xl"><Smartphone className="h-5 w-5" />{t.host.joinAt} <b className="break-all text-[#fff]">{short}</b></div>
          <div className="label-dark mt-2 lg:mt-3">PIN</div>
          <div data-testid="lobby-pin" className="font-display text-grad font-black leading-none tracking-[.1em]" style={{ fontSize: 'clamp(2.75rem, min(9vh, 12vw), 6rem)' }}>{game.pin}</div>
        </div>
      </section>
      <section className="flex min-h-[40vh] min-w-0 flex-1 flex-col lg:min-h-0">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 lg:mb-6 lg:gap-6">
          <div className="min-w-0 flex-1">
            <div className="label-dark">{game.brand?.name || t.app.tagline}</div>
            <h1 className="truncate text-2xl font-black sm:text-4xl xl:text-5xl">{game.title}</h1>
          </div>
          {game.host?.name && (
            <div className="glass flex shrink-0 items-center gap-3 py-2 pl-2 pr-5">
              {game.host.photoUrl ? <img src={game.host.photoUrl} alt="" className="h-12 w-12 rounded-full object-cover" /> : game.host.avatar ? <Avatar avatar={game.host.avatar} size={48} /> : null}
              <div><div className="text-[10px] font-bold uppercase tracking-widest text-white/50">{t.profile.trainer}</div><div className="text-lg font-bold">{game.host.name}</div>{game.host.title && <div className="text-xs text-white/55">{game.host.title}</div>}</div>
            </div>
          )}
          <motion.div key={players.length} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="flex shrink-0 items-center gap-3 rounded-2xl px-4 py-2 lg:px-6 lg:py-3" style={{ background: 'var(--grad)', boxShadow: 'var(--glow)' }}>
            <span className="font-display text-3xl font-black lg:text-5xl">{players.length}</span>
            <span className="text-lg font-bold leading-tight">{t.games.players}</span>
          </motion.div>
        </div>
        {game.locked && <div className="chip mb-4 self-start bg-amber-400 text-black">🔒 {t.join.locked}</div>}
        {game.plan === 'free' && (
          <div className="mb-4 flex flex-wrap items-center gap-3 self-start rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold">
            <span>{t.acct.freeLobby(players.length, game.settings.maxPlayers)}</span>
            <a href="/pricing#request" target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">{t.acct.getLicense}</a>
          </div>
        )}
        {players.length === 0 ? (
          <div className="m-auto flex flex-col items-center gap-4 text-center text-xl text-white/60 lg:gap-5 lg:text-3xl">
            <motion.span animate={{ y: [0, -14, 0] }} transition={{ repeat: Infinity, duration: 1.6 }}><Smartphone className="h-14 w-14 text-orange-400 lg:h-24 lg:w-24" /></motion.span>
            {t.host.waitingPlayers}
          </div>
        ) : (
          <div className="scrollbar-thin flex min-h-0 flex-wrap content-start gap-3 overflow-auto pb-4">
            {/* böyük auditoriya: yalnız son qoşulan 80 nəfər göstərilir (1000 animasiyalı element host ekranını yavaşladır) */}
            {sorted.length > LOBBY_SHOW && <div className="glass flex items-center rounded-full px-5 py-3 text-xl font-bold tabular-nums">+{sorted.length - LOBBY_SHOW}</div>}
            <AnimatePresence initial={false}>
              {sorted.slice(-LOBBY_SHOW).map((p, i) => {
                const idle = p.lastSeen ? now - p.lastSeen.toMillis() > 90000 : false
                return (
                  <motion.div key={p.uid} layout={sorted.length <= 40} initial={{ y: -300, opacity: 0, rotate: -20 }} animate={{ y: 0, opacity: 1, rotate: 0, scale: [1, 1.15, 1] }} exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 14, delay: Math.min(i, 5) * 0.03 }}
                    className="glass group relative flex items-center gap-3 rounded-full py-1.5 pl-1.5 pr-5" title={idle ? t.host.idle : undefined}>
                    <span className="rounded-full" style={p.team != null && TEAMS[p.team] ? { boxShadow: `0 0 0 3px ${TEAMS[p.team].color}` } : undefined}><Avatar avatar={p.avatar} size={52} dim={idle} /></span>
                    <span className="max-w-44 truncate text-xl font-bold">{shortName(p.firstName, p.lastName)}</span>
                    <button className="absolute -right-1 -top-1 hidden h-8 w-8 items-center justify-center rounded-full bg-red-600 text-[#fff] group-hover:flex" onClick={() => onKick(p)} aria-label={t.host.kick}><UserX className="h-4 w-4" /></button>
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
