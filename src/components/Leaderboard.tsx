import { motion } from 'framer-motion'
import { TrendingDown, TrendingUp } from 'lucide-react'
import type { LeaderEntry } from '../types'
import { Avatar } from './Avatar'
import { AnimatedNumber } from './AnimatedNumber'

export function Delta({ d }: { d: number }) {
  if (!d) return null
  const up = d > 0
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold ${up ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
      {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}{Math.abs(d)}
    </span>
  )
}

const MEDAL = ['linear-gradient(135deg,#FFD166,#F59E0B)', 'linear-gradient(135deg,#E2E8F0,#94A3B8)', 'linear-gradient(135deg,#FDBA74,#C2410C)']

export function Leaderboard({ entries, highlight, big, max = 10 }: { entries: LeaderEntry[]; highlight?: string; big?: boolean; max?: number }) {
  return (
    <ol className="flex flex-col gap-2">
      {entries.slice(0, max).map((e, i) => {
        const me = e.uid === highlight
        return (
          <motion.li
            layout
            key={e.uid}
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, type: 'spring', stiffness: 300, damping: 26 }}
            className={`relative flex items-center gap-3 overflow-hidden rounded-2xl border px-4 ${big ? 'py-3 text-3xl' : 'py-2.5 text-base'} ${me ? 'border-transparent text-[#fff]' : 'border-white/10 bg-white/[.06] text-[#fff] backdrop-blur'}`}
            style={me ? { background: 'var(--grad)', boxShadow: 'var(--glow)' } : undefined}
          >
            <span className={`font-display flex shrink-0 items-center justify-center rounded-xl font-black ${big ? 'h-14 w-14 text-2xl' : 'h-9 w-9 text-sm'} ${e.rank > 3 ? 'bg-white/10' : 'text-onlight'}`} style={e.rank <= 3 ? { background: MEDAL[e.rank - 1] } : undefined}>
              {e.rank}
            </span>
            <Avatar avatar={e.avatar} size={big ? 56 : 36} />
            <span className="min-w-0 flex-1 truncate font-bold">{e.name}</span>
            <Delta d={e.delta} />
            <span className="font-display font-black tabular-nums"><AnimatedNumber value={e.score} /></span>
          </motion.li>
        )
      })}
    </ol>
  )
}
