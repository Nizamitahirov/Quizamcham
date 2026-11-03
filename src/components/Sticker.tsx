import { motion } from 'framer-motion'

export function Sticker({ emoji, size = 120 }: { emoji: string; size?: number }) {
  return (
    <motion.div
      initial={{ scale: 0, rotate: -30 }}
      animate={{ scale: [0, 1.35, 1], rotate: [-30, 12, -6, 0] }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      className="select-none drop-shadow-[0_8px_20px_rgba(0,0,0,.35)]"
      style={{ fontSize: size, lineHeight: 1 }}
      aria-hidden
    >
      <span className="wobble inline-block">{emoji}</span>
    </motion.div>
  )
}
