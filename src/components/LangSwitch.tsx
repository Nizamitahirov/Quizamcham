import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Globe } from 'lucide-react'
import { currentLang, setLang, t, type Lang } from '../i18n/az'

export const LANGS: { code: Lang; flag: string; name: string }[] = [
  { code: 'az', flag: '🇦🇿', name: 'Azərbaycanca' },
  { code: 'ru', flag: '🇷🇺', name: 'Русский' },
  { code: 'en', flag: '🇬🇧', name: 'English' },
]

/** Dil siyahısı (hesab menyusunun içində və ya ayrıca açılan menyuda). */
export function LangList({ onPick }: { onPick?: () => void }) {
  const cur = currentLang()
  return (
    <div role="radiogroup" aria-label={t.menu.language} className="flex flex-col gap-0.5">
      {LANGS.map((l) => (
        <button key={l.code} type="button" role="radio" aria-checked={cur === l.code} lang={l.code}
          onClick={() => { onPick?.(); if (cur !== l.code) setLang(l.code) }}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${cur === l.code ? 'bg-white/[.07] text-fg' : 'text-fg2 hover:bg-white/[.05] hover:text-fg'}`}>
          <span className="text-base leading-none" aria-hidden>{l.flag}</span>
          <span className="flex-1 font-medium">{l.name}</span>
          {cur === l.code && <Check className="h-4 w-4 text-orange-300" />}
        </button>
      ))}
    </div>
  )
}

/** Yığcam dil seçimi: 🌐 AZ ▾ → açılan siyahı (giriş etməmiş səhifələr üçün). */
export function LangSwitch({ className = '' }: { dark?: boolean; className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [open])
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={`${t.menu.language}: ${currentLang().toUpperCase()}`}
        className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-white/[.04] px-3 text-xs font-semibold text-fg2 transition hover:border-line-strong hover:text-fg">
        <Globe className="h-4 w-4" /><span className="uppercase">{currentLang()}</span><ChevronDown className={`h-3.5 w-3.5 opacity-60 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
            className="absolute right-0 top-full z-50 mt-2 w-52 origin-top-right rounded-xl border border-line-strong bg-raised p-1 shadow-[var(--shadow-lg)]">
            <LangList onPick={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
