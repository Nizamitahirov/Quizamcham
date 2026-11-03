import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useState } from 'react'

export interface Flying { id: number; emoji: string; x: number }

let nextId = 1
export function useFlying() {
  const [items, setItems] = useState<Flying[]>([])
  const add = useCallback((emoji: string) => {
    const it = { id: nextId++, emoji, x: 10 + Math.random() * 80 }
    setItems((s) => [...s.slice(-30), it])
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== it.id)), 2600)
  }, [])
  return { items, add }
}

export function FloatingEmojis({ items, size = 44 }: { items: Flying[]; size?: number }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
      <AnimatePresence>
        {items.map((it) => (
          <motion.span
            key={it.id}
            initial={{ y: '100vh', opacity: 0, scale: 0.5 }}
            animate={{ y: '-10vh', opacity: [0, 1, 1, 0], scale: [0.5, 1.2, 1], x: [0, 20, -20, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.5, ease: 'easeOut' }}
            className="absolute"
            style={{ left: `${it.x}%`, fontSize: size }}
          >
            {it.emoji}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  )
}
