import { motion } from 'framer-motion'
import { Dices } from 'lucide-react'
import { t } from '../i18n/az'
import type { AvatarData } from '../types'
import { ACCESSORIES, AVATAR_STYLES, Avatar, preloadAvatarStyles } from './Avatar'
import { useEffect, useRef } from 'react'
import { Sparkles } from 'lucide-react'
import { auth } from '../firebase/config'
import { useAvatarThumb } from '../lib/avatar3d'

const STYLES = [...AVATAR_STYLES]
const SEEDS = ['Aysel', 'Murad', 'Leyla', 'Tural', 'Nigar', 'Elvin', 'Günay', 'Rauf']
export const PRESETS: AvatarData[] = STYLES.flatMap((style) => SEEDS.map((seed) => ({ style, seed })))

export function randomAvatar(): AvatarData {
  const style = STYLES[Math.floor(Math.random() * STYLES.length)]
  return { style, seed: Math.random().toString(36).slice(2, 10) }
}

export function AvatarPicker({ value, onChange }: { value: AvatarData; onChange: (a: AvatarData) => void }) {
  useEffect(() => { void preloadAvatarStyles() }, [])
  // qeydiyyatlı istifadəçinin 3D avatarı varsa — birinci seçim və avtomatik seçilir
  const me = auth.currentUser && !auth.currentUser.isAnonymous ? auth.currentUser.uid : undefined
  const thumb = useAvatarThumb(me)
  const auto = useRef(false)
  useEffect(() => {
    if (me && thumb && !auto.current && value.style !== '3d') { auto.current = true; onChange({ style: '3d', seed: me, accessory: value.accessory }) }
  }, [me, thumb, value.style, value.accessory, onChange])
  const mine3d: AvatarData | null = me && thumb ? { style: '3d', seed: me } : null
  const isSel = (a: AvatarData) => a.style === value.style && a.seed === value.seed
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center">
        <motion.div key={value.style + value.seed + (value.accessory ?? '')} initial={{ scale: 0.4, rotate: -10 }} animate={{ scale: [0.4, 1.2, 1], rotate: 0 }} transition={{ duration: 0.45 }}
          className="rounded-full p-1.5" style={{ background: 'var(--grad)', boxShadow: 'var(--glow)' }}>
          <Avatar avatar={value} size={108} />
        </motion.div>
      </div>
      {mine3d && (
        <button type="button" role="radio" aria-checked={value.style === '3d'} onClick={() => onChange({ ...mine3d, accessory: value.accessory })}
          className={`flex items-center gap-3 rounded-2xl border p-2.5 text-left transition ${value.style === '3d' ? 'border-orange-400/60 bg-orange-500/10' : 'border-line bg-white/[.03] hover:bg-white/[.06]'}`}>
          <Avatar avatar={mine3d} size={44} />
          <span className="flex-1 text-sm font-semibold">{t.av.mine}</span>
          <span className="chip chip-brand">3D</span>
        </button>
      )}
      {me && !thumb && (
        <a href="/avatar" target="_blank" rel="noopener" className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong p-2.5 text-sm font-semibold text-fg2 hover:text-fg">
          <Sparkles className="h-4 w-4 text-orange-300" />{t.av.create}
        </a>
      )}
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
