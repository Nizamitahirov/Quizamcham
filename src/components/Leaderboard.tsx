import { motion } from 'framer-motion'
import type { LeaderEntry } from '../types'
import { Avatar } from './Avatar'
import { AnimatedNumber } from './AnimatedNumber'

export function Delta({ d }: { d: number }) {
  if (!d) return null
  return <span className={`text-sm font-extrabold ${d > 0 ? 'text-green-300' : 'text-red-300'}`}>{d > 0 ? `▲${d}` : `▼${-d}`}</span>
}

export function Leaderboard({ entries, highlight, big, max = 10 }: { entries: LeaderEntry[]; highlight?: string; big?: boolean; max?: number }) {
  return (
    <ol className="flex flex-col gap-2">
      {entries.slice(0, max).map((e, i) => (
        <motion.li
          layout
          key={e.uid}
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.06, type: 'spring', stiffness: 300, damping: 26 }}
          className={`flex items-center gap-3 rounded-2xl px-4 ${big ? 'py-3 text-3xl' : 'py-2 text-lg'} ${e.uid === highlight ? 'bg-yellow-300 text-ink' : 'bg-white/12 text-white'}`}
          style={{ background: e.uid === highlight ? undefined : 'rgba(255,255,255,.12)' }}
        >
          <span className="font-display w-10 text-center">{e.rank}</span>
          <Avatar avatar={e.avatar} size={big ? 56 : 36} />
          <span className="min-w-0 flex-1 truncate font-extrabold">{e.name}</span>
          <Delta d={e.delta} />
          <span className="font-display tabular-nums"><AnimatedNumber value={e.score} /></span>
        </motion.li>
      ))}
    </ol>
  )
}
