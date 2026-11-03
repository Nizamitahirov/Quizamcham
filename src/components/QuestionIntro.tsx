import { motion } from 'framer-motion'
import { useEffect } from 'react'
import { Timer } from 'lucide-react'
import { t } from '../i18n/az'
import { audio } from '../audio/AudioEngine'
import type { Preview } from '../types'

/** Sual cavablardan əvvəl göstərilir (Kahoot üslubunda oxuma vaxtı). */
export function QuestionIntro({ preview, total, big }: { preview: Preview; total: number; big?: boolean }) {
  useEffect(() => { audio.whoosh() }, [])
  return (
    <div className={`flex w-full flex-col items-center justify-center text-center ${big ? 'gap-10 px-16' : 'gap-6 px-2'}`}>
      <motion.div initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }}
        className={`chip chip-dark ${big ? 'px-6 py-2 text-2xl' : ''}`}>
        <Timer className={big ? 'h-6 w-6' : 'h-4 w-4'} /> {t.game.questionOf(preview.index + 1, total)} · {t.types[preview.type]}
        {preview.points === 'double' && <span className="ml-1 rounded-full bg-yellow-300 px-2 text-ink">2x</span>}
      </motion.div>
      <motion.h2 initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}
        className={`font-display font-black leading-tight ${big ? 'max-w-6xl text-7xl' : 'text-[28px]'}`}>
        {preview.text}
      </motion.h2>
      {preview.imageUrl && <motion.img initial={{ opacity: 0 }} animate={{ opacity: 1 }} src={preview.imageUrl} alt="" className={`rounded-3xl object-contain ${big ? 'max-h-[34vh]' : 'max-h-40'}`} />}
      <div className={`overflow-hidden rounded-full bg-white/10 ${big ? 'h-4 w-[40vw]' : 'h-2.5 w-full'}`}>
        <motion.div className="h-full rounded-full" style={{ background: 'var(--grad)', boxShadow: 'var(--glow)' }} initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: preview.readMs / 1000, ease: 'linear' }} />
      </div>
    </div>
  )
}
