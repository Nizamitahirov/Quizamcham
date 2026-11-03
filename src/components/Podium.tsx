import { motion } from 'framer-motion'
import type { LeaderEntry } from '../types'
import { Avatar } from './Avatar'

const ORDER = [1, 0, 2] // 2-ci, 1-ci, 3-cü
const HEIGHTS = ['h-64', 'h-48', 'h-36']
const MEDALS = ['🥇', '🥈', '🥉']
const COLORS = ['#FFD166', '#CBD5E1', '#F59E0B']

export function Podium({ entries, big = true }: { entries: LeaderEntry[]; big?: boolean }) {
  return (
    <div className="flex items-end justify-center gap-4">
      {ORDER.map((idx, col) => {
        const e = entries[idx]
        if (!e) return <div key={col} className="w-48" />
        return (
          <div key={e.uid} className="flex w-56 flex-col items-center">
            <motion.div initial={{ y: -500, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 + (2 - idx) * 0.9, type: 'spring', stiffness: 120, damping: 12 }} className="mb-3 flex flex-col items-center">
              {idx === 0 && <span className="wobble text-6xl">👑</span>}
              <Avatar avatar={e.avatar} size={big ? 120 : 72} />
              <span className="font-display mt-2 max-w-56 truncate text-center text-2xl">{e.name}</span>
              <span className="text-xl text-white/85">{e.score.toLocaleString('az-AZ')}</span>
            </motion.div>
            <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} style={{ originY: 1, background: COLORS[idx] }} transition={{ delay: 0.2 + (2 - idx) * 0.3, duration: 0.6 }} className={`flex w-full ${HEIGHTS[idx]} items-start justify-center rounded-t-2xl pt-3 text-6xl shadow-2xl`}>
              {MEDALS[idx]}
            </motion.div>
          </div>
        )
      })}
    </div>
  )
}
