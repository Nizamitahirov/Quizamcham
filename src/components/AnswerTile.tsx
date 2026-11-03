import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'

export const TILE_COLORS = ['var(--tile-a)', 'var(--tile-b)', 'var(--tile-c)', 'var(--tile-d)', 'var(--tile-e)', 'var(--tile-f)']
export const TILE_HEX = ['#E11D2A', '#2563EB', '#B45309', '#047857', '#7C3AED', '#BE185D']
export const TILE_NAMES = ['A', 'B', 'C', 'D', 'E', 'F']

export function Shape({ i, size = 28 }: { i: number; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'white', 'aria-hidden': true } as const
  switch (i % 6) {
    case 0: return <svg {...p}><path d="M12 3 22 20H2z" /></svg>
    case 1: return <svg {...p}><path d="M12 2 22 12 12 22 2 12z" /></svg>
    case 2: return <svg {...p}><circle cx="12" cy="12" r="10" /></svg>
    case 3: return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="3" /></svg>
    case 4: return <svg {...p}><path d="m12 2 2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z" /></svg>
    default: return <svg {...p}><path d="M12 2 21 7v10l-9 5-9-5V7z" /></svg>
  }
}

const tileBg = (i: number) => `linear-gradient(160deg, color-mix(in srgb, ${TILE_HEX[i % 6]} 88%, white) 0%, ${TILE_HEX[i % 6]} 55%, color-mix(in srgb, ${TILE_HEX[i % 6]} 80%, black) 100%)`

interface Props {
  index: number
  text: string
  onClick?: () => void
  selected?: boolean
  dimmed?: boolean
  checked?: boolean
  correct?: boolean | null
  disabled?: boolean
  big?: boolean
  count?: number
  hidden?: boolean
}

export function AnswerTile({ index, text, onClick, selected, dimmed, checked, correct, disabled, big, count, hidden }: Props) {
  if (hidden) {
    return <div className={`rounded-2xl border-2 border-dashed border-white/10 ${big ? 'min-h-28' : 'min-h-20'}`} aria-hidden />
  }
  return (
    <motion.button
      type="button"
      layout
      onClick={onClick}
      disabled={disabled}
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: dimmed ? 0.3 : 1, y: 0, scale: selected ? 1.03 : 1 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 380, damping: 26 }}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      aria-pressed={selected || checked}
      aria-label={`${TILE_NAMES[index]}: ${text}`}
      className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl text-left font-bold text-white shadow-[0_6px_0_rgba(0,0,0,.28),0_12px_24px_-10px_rgba(0,0,0,.5)] disabled:cursor-default ${big ? 'min-h-28 p-6 text-3xl' : 'min-h-[68px] p-3.5 text-base'} ${selected || checked ? 'ring-4 ring-white' : ''}`}
      style={{ background: tileBg(index) }}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/18 to-transparent" />
      <span className={`relative flex shrink-0 items-center justify-center rounded-xl bg-black/20 ${big ? 'h-16 w-16' : 'h-11 w-11'}`}><Shape i={index} size={big ? 36 : 22} /></span>
      <span className="relative min-w-0 flex-1 leading-snug [overflow-wrap:break-word] [hyphens:auto]" lang="az">{text}</span>
      {checked !== undefined && (
        <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-white ${checked ? 'bg-white text-ink' : ''}`} aria-hidden>
          {checked && <Check className="h-5 w-5" strokeWidth={3.5} />}
        </span>
      )}
      {correct === true && <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-green-700"><Check className="h-6 w-6" strokeWidth={3.5} /></span>}
      {correct === false && <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/30"><X className="h-6 w-6" strokeWidth={3.5} /></span>}
      {count !== undefined && <span className="relative shrink-0 rounded-full bg-black/25 px-3 py-1 text-2xl">{count}</span>}
    </motion.button>
  )
}
