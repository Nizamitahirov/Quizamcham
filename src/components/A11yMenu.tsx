import { useEffect, useRef, useState } from 'react'
import { Accessibility, Check, Volume2 } from 'lucide-react'
import { t } from '../i18n/az'
import { setA11y, speak, ttsSupported, useA11y, useReadAloud, type A11yFont } from '../lib/a11y'

const A = t.access2
/** Oyunçu ekranında əlçatanlıq menyusu: səsli oxuma, şrift, böyük mətn, kontrast (bu cihazda yadda qalır). */
export function A11yMenu({ readNow, className = '' }: { readNow?: () => string[]; className?: string }) {
  const a = useA11y()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k) }
  }, [open])
  const on = a.tts || a.font !== 'default' || a.large || a.contrast
  const row = (label: string, checked: boolean, toggle: () => void, hint?: string) => (
    <button type="button" role="menuitemcheckbox" aria-checked={checked} onClick={toggle} className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/10">
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checked ? 'border-orange-400 bg-orange-500 text-[#fff]' : 'border-white/30'}`}>{checked && <Check className="h-3.5 w-3.5" />}</span>
      <span className="min-w-0"><span className="block text-sm font-semibold">{label}</span>{hint && <span className="block text-xs text-white/55">{hint}</span>}</span>
    </button>
  )
  const fonts: A11yFont[] = ['default', 'readable', 'dyslexic']
  return (
    <div ref={box} className={`relative ${className}`}>
      <button type="button" aria-label={A.title} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((x) => !x)}
        className={`relative flex h-11 w-11 items-center justify-center rounded-full border border-white/12 text-[#fff] backdrop-blur transition hover:bg-white/15 ${on ? 'bg-orange-500/30' : 'bg-white/8'}`}>
        <Accessibility className="h-5 w-5" />
      </button>
      {open && (
        <div role="menu" aria-label={A.title} className="theme-dark absolute right-0 top-12 z-50 w-72 rounded-2xl border border-white/12 bg-[#151831] p-2 text-[#fff] shadow-2xl">
          <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-widest text-white/50">{A.title}</p>
          {ttsSupported() && row(A.tts, a.tts, () => setA11y({ tts: !a.tts }), A.ttsHint)}
          {ttsSupported() && readNow && <button type="button" className="mx-3 mb-1 flex items-center gap-2 text-xs font-semibold text-orange-300 hover:underline" onClick={() => speak(readNow())}><Volume2 className="h-3.5 w-3.5" />{A.readNow}</button>}
          <div className="px-3 pb-1 pt-2 text-xs font-semibold text-white/60">{A.font}</div>
          <div className="mx-2 mb-1 grid grid-cols-3 gap-1" role="radiogroup" aria-label={A.font}>
            {fonts.map((f) => <button key={f} type="button" role="radio" aria-checked={a.font === f} onClick={() => setA11y({ font: f })}
              className={`rounded-lg px-2 py-2 text-xs font-semibold ${a.font === f ? 'bg-white/20' : 'hover:bg-white/10'}`} style={{ fontFamily: f !== 'default' ? "'Atkinson Hyperlegible'" : undefined, letterSpacing: f === 'dyslexic' ? '.06em' : undefined }}>{A.fonts[f]}</button>)}
          </div>
          {row(A.large, a.large, () => setA11y({ large: !a.large }))}
          {row(A.contrast, a.contrast, () => setA11y({ contrast: !a.contrast }))}
        </div>
      )}
    </div>
  )
}

/** Sual dəyişəndə (səsli oxuma açıqdırsa) sualı və variantları oxuyur. Heç nə çəkmir. */
export function ReadAloud({ k, text, options = [] }: { k: string | number; text?: string; options?: { text: string }[] }) {
  useReadAloud(k, [text ?? '', ...options.map((o, i) => `${String.fromCharCode(65 + i)}: ${o.text}`)])
  return null
}
/** Hazırkı sualın oxunacaq hissələri (menyu "İndi oxu" üçün). */
export const partsOf = (q?: { text?: string; options?: { text: string }[] } | null) => (q ? [q.text ?? '', ...(q.options ?? []).map((o, i) => `${String.fromCharCode(65 + i)}: ${o.text}`)] : [])
