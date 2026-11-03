import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { audio } from '../audio/AudioEngine'

export function Countdown({ label, big }: { label: string; big?: boolean }) {
  const [n, setN] = useState(3)
  useEffect(() => {
    audio.beep()
    const id = setInterval(() => setN((x) => {
      const nx = x - 1
      if (nx > 0) audio.beep()
      else if (nx === 0) audio.beep(true)
      return nx
    }), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="flex flex-col items-center justify-center gap-6">
      <div className={`font-display text-white/85 ${big ? 'text-5xl' : 'text-2xl'}`}>{label}</div>
      <div className={`relative flex items-center justify-center ${big ? 'h-80 w-80' : 'h-48 w-48'}`}>
        <AnimatePresence mode="popLayout">
          <motion.span
            key={n}
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{ scale: [0.2, 1.3, 1], opacity: 1 }}
            exit={{ scale: 2.4, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className={`font-display absolute ${big ? 'text-[14rem]' : 'text-9xl'}`}
          >
            {n > 0 ? n : '🚀'}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  )
}
