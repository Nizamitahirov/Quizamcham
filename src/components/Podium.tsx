import { LOCALE } from '../i18n/az'
import { motion } from 'framer-motion'
import { Crown } from 'lucide-react'
import type { LeaderEntry } from '../types'
import { Avatar } from './Avatar'

const ORDER = [1, 0, 2]
const HEIGHTS = ['h-72', 'h-52', 'h-40']
const GRADS = ['linear-gradient(180deg,#FFD166,#F59E0B)', 'linear-gradient(180deg,#F1F5F9,#94A3B8)', 'linear-gradient(180deg,#FDBA74,#C2410C)']

export function Podium({ entries, big = true }: { entries: LeaderEntry[]; big?: boolean }) {
  return (
    <div className="flex items-end justify-center gap-5">
      {ORDER.map((idx, col) => {
        const e = entries[idx]
        if (!e) return <div key={col} className="w-56" />
        return (
          <div key={e.uid} className="flex w-60 flex-col items-center">
            <motion.div initial={{ y: -500, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 + (2 - idx) * 0.9, type: 'spring', stiffness: 120, damping: 12 }} className="mb-4 flex flex-col items-center">
              {idx === 0 && <Crown className="wobble mb-1 h-14 w-14 text-yellow-300 drop-shadow-[0_0_20px_rgba(253,224,71,.8)]" fill="currentColor" />}
              <div className="rounded-full p-1.5" style={{ background: GRADS[idx] }}><Avatar avatar={e.avatar} size={big ? 120 : 72} /></div>
              <span className="font-display mt-3 max-w-60 truncate text-center text-2xl font-black">{e.name}</span>
              <span className="mt-1 rounded-full bg-black/25 px-4 py-1 text-xl font-bold tabular-nums">{e.score.toLocaleString(LOCALE)}</span>
            </motion.div>
            <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} style={{ originY: 1, background: GRADS[idx] }} transition={{ delay: 0.2 + (2 - idx) * 0.3, duration: 0.6 }}
              className={`relative flex w-full ${HEIGHTS[idx]} items-start justify-center overflow-hidden rounded-t-3xl pt-4 shadow-2xl`}>
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/30 to-transparent" />
              <span className="font-display relative text-7xl font-black text-black/25">{idx + 1}</span>
            </motion.div>
          </div>
        )
      })}
    </div>
  )
}
