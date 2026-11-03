import { motion } from 'framer-motion'
import { Dices } from 'lucide-react'
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center">
        <motion.div key={value.style + value.seed + (value.accessory ?? '')} initial={{ scale: 0.4, rotate: -10 }} animate={{ scale: [0.4, 1.2, 1], rotate: 0 }} transition={{ duration: 0.45 }}
          className="rounded-full p-1.5" style={{ background: 'var(--grad)', boxShadow: 'var(--glow)' }}>
          <Avatar avatar={value} size={108} />
        </motion.div>
      </div>
      <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label={t.join.chooseAvatar}>
        {PRESETS.map((a) => (
          <motion.button type="button" key={a.style + a.seed} role="radio" aria-checked={isSel(a)} whileTap={{ scale: 0.85 }}
            onClick={() => onChange({ ...a, accessory: value.accessory })}
            className={`flex aspect-square items-center justify-center rounded-2xl transition ${isSel(a) ? 'bg-white/20 ring-2 ring-orange-400' : 'hover:bg-white/10'}`}>
            <Avatar avatar={a} size={42} />
          </motion.button>
        ))}
      </div>
      <button type="button" className="btn btn-ghost w-full" onClick={() => onChange({ ...randomAvatar(), accessory: value.accessory })}><Dices />{t.join.random}</button>
      <div>
        <span className="label-dark">{t.join.accessory}</span>
        <div className="grid grid-cols-7 gap-1.5">
          <button type="button" className={`flex h-11 items-center justify-center rounded-xl text-xs font-bold ${!value.accessory ? 'bg-white/20 ring-2 ring-orange-400' : 'bg-white/8'}`} style={{ background: !value.accessory ? undefined : 'rgba(255,255,255,.06)' }} onClick={() => onChange({ ...value, accessory: undefined })}>
            {t.join.noAccessory}
          </button>
          {ACCESSORIES.map((e) => (
            <button type="button" key={e} aria-label={e} className={`flex h-11 items-center justify-center rounded-xl text-xl ${value.accessory === e ? 'bg-white/20 ring-2 ring-orange-400' : ''}`} style={{ background: value.accessory === e ? undefined : 'rgba(255,255,255,.06)' }} onClick={() => onChange({ ...value, accessory: e })}>
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
