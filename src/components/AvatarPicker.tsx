import { motion } from 'framer-motion'
import { t } from '../i18n/az'
import type { AvatarData } from '../types'
import { ACCESSORIES, Avatar, type AvatarStyle } from './Avatar'

const STYLES: AvatarStyle[] = ['fun-emoji', 'adventurer', 'bottts']
const SEEDS = ['Aysel', 'Murad', 'Leyla', 'Tural', 'Nigar', 'Elvin', 'Günay', 'Rauf']
export const PRESETS: AvatarData[] = STYLES.flatMap((style) => SEEDS.map((seed) => ({ style, seed })))

export function randomAvatar(): AvatarData {
  const style = STYLES[Math.floor(Math.random() * STYLES.length)]
  return { style, seed: Math.random().toString(36).slice(2, 10) }
}

export function AvatarPicker({ value, onChange }: { value: AvatarData; onChange: (a: AvatarData) => void }) {
  const isSel = (a: AvatarData) => a.style === value.style && a.seed === value.seed
  return (
    <div>
      <div className="mb-3 flex items-center justify-center">
        <motion.div key={value.style + value.seed + (value.accessory ?? '')} initial={{ scale: 0.4, rotate: -10 }} animate={{ scale: [0.4, 1.2, 1], rotate: 0 }} transition={{ duration: 0.45 }}>
          <Avatar avatar={value} size={104} />
        </motion.div>
      </div>
      <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label={t.join.chooseAvatar}>
        {PRESETS.map((a) => (
          <motion.button
            type="button"
            key={a.style + a.seed}
            role="radio"
            aria-checked={isSel(a)}
            whileTap={{ scale: 0.85 }}
            onClick={() => onChange({ ...a, accessory: value.accessory })}
            className={`flex min-h-12 items-center justify-center rounded-full p-0.5 transition ${isSel(a) ? 'ring-4 ring-yellow-300 shadow-[0_0_18px_rgba(253,224,71,.9)]' : 'opacity-90'}`}
          >
            <Avatar avatar={a} size={44} />
          </motion.button>
        ))}
      </div>
      <button type="button" className="btn btn-ghost mt-3 w-full" onClick={() => onChange({ ...randomAvatar(), accessory: value.accessory })}>
        {t.join.random}
      </button>
      <div className="mt-3">
        <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-white/80">{t.join.accessory}</span>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`btn btn-ghost min-w-12 px-3 text-sm ${!value.accessory ? 'ring-2 ring-yellow-300' : ''}`} onClick={() => onChange({ ...value, accessory: undefined })}>
            {t.join.noAccessory}
          </button>
          {ACCESSORIES.map((e) => (
            <button type="button" key={e} aria-label={e} className={`btn btn-ghost min-w-12 px-3 text-xl ${value.accessory === e ? 'ring-2 ring-yellow-300' : ''}`} onClick={() => onChange({ ...value, accessory: e })}>
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
