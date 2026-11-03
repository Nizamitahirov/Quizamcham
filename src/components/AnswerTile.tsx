import { motion } from 'framer-motion'

export const TILE_COLORS = ['var(--tile-a)', 'var(--tile-b)', 'var(--tile-c)', 'var(--tile-d)', 'var(--tile-e)', 'var(--tile-f)']
export const TILE_NAMES = ['A', 'B', 'C', 'D', 'E', 'F']

export function Shape({ i, size = 28 }: { i: number; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'white', 'aria-hidden': true } as const
  switch (i % 6) {
    case 0: return <svg {...p}><path d="M12 3 22 20H2z" /></svg>
    case 1: return <svg {...p}><path d="M12 2 22 12 12 22 2 12z" /></svg>
    case 2: return <svg {...p}><circle cx="12" cy="12" r="10" /></svg>
    case 3: return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
    case 4: return <svg {...p}><path d="m12 2 2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z" /></svg>
    default: return <svg {...p}><path d="M12 2 21 7v10l-9 5-9-5V7z" /></svg>
  }
}

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
}

export function AnswerTile({ index, text, onClick, selected, dimmed, checked, correct, disabled, big, count }: Props) {
  return (
    <motion.button
      type="button"
      layout
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      animate={{ opacity: dimmed ? 0.35 : 1, scale: selected ? 1.03 : 1 }}
      aria-pressed={selected || checked}
      aria-label={`${TILE_NAMES[index]}: ${text}`}
      className={`relative flex w-full items-center gap-3 rounded-2xl text-left font-extrabold text-white shadow-[0_5px_0_rgba(0,0,0,.25)] disabled:cursor-default ${big ? 'min-h-28 p-6 text-3xl' : 'min-h-20 p-4 text-lg'} ${selected || checked ? 'ring-4 ring-white' : ''}`}
      style={{ background: TILE_COLORS[index % 6] }}
    >
      <span className="shrink-0"><Shape i={index} size={big ? 44 : 28} /></span>
      <span className="min-w-0 flex-1 break-words leading-tight">{text}</span>
      {checked !== undefined && (
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-white text-xl ${checked ? 'bg-white text-black' : ''}`} aria-hidden>
          {checked ? '✓' : ''}
        </span>
      )}
      {correct === true && <span className="shrink-0 text-3xl" aria-hidden>✅</span>}
      {correct === false && <span className="shrink-0 text-3xl" aria-hidden>✖</span>}
      {count !== undefined && <span className="shrink-0 rounded-full bg-black/25 px-3 py-1 text-2xl">{count}</span>}
    </motion.button>
  )
}
