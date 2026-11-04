import { motion } from 'framer-motion'
import { Users } from 'lucide-react'
import { TEAMS } from '../lib/teams'
import type { TeamEntry } from '../types'

export function TeamChip({ team, className = '' }: { team?: number; className?: string }) {
  if (team == null || !TEAMS[team]) return null
  const tm = TEAMS[team]
  return <span className={`chip text-white ${className}`} style={{ background: tm.color }}>{tm.emoji} {tm.name}</span>
}

/** Komanda reytinqi (orta xal üzrə). */
export function TeamBoard({ rows, big, highlight }: { rows: TeamEntry[]; big?: boolean; highlight?: number }) {
  if (!rows?.length) return null
  const max = Math.max(1, ...rows.map((r) => r.score))
  return (
    <div className={`flex flex-col ${big ? 'gap-3' : 'gap-2'}`}>
      {rows.map((r, i) => {
        const tm = TEAMS[r.team]
        return (
          <motion.div key={r.team} layout initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
            className={`relative overflow-hidden rounded-2xl border ${highlight === r.team ? 'border-white/60' : 'border-white/10'} bg-white/[.06] ${big ? 'px-6 py-4' : 'px-3 py-2.5'}`}>
            <motion.div className="absolute inset-y-0 left-0 opacity-35" style={{ background: tm.color }} initial={{ width: 0 }} animate={{ width: `${(r.score / max) * 100}%` }} transition={{ duration: 0.9 }} />
            <div className={`relative flex items-center gap-3 font-bold ${big ? 'text-3xl' : 'text-sm'}`}>
              <span className="font-display w-8 font-black">{i + 1}</span>
              <span>{tm.emoji} {tm.name}</span>
              <span className={`flex items-center gap-1 text-white/60 ${big ? 'text-xl' : 'text-xs'}`}><Users className={big ? 'h-5 w-5' : 'h-3.5 w-3.5'} />{r.members}</span>
              <span className="font-display ml-auto font-black tabular-nums">{r.score.toLocaleString('az-AZ')}</span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
