import { Languages } from 'lucide-react'
import { currentLang, setLang, type Lang } from '../i18n/az'

/** AZ / RU / EN dil dəyişdiricisi. */
export function LangSwitch({ className = '' }: { dark?: boolean; className?: string }) {
  const cur = currentLang()
  return (
    <div className={`inline-flex items-center gap-0.5 rounded-full border border-line bg-white/[.04] p-0.5 text-[11px] font-semibold ${className}`} role="radiogroup" aria-label="Language / Dil">
      <Languages className="mx-1.5 h-3.5 w-3.5 text-muted" />
      {(['az', 'ru', 'en'] as Lang[]).map((l) => (
        <button key={l} type="button" role="radio" aria-checked={cur === l} onClick={() => cur !== l && setLang(l)}
          className={`rounded-full px-2.5 py-1 uppercase transition ${cur === l ? 'bg-white/[.12] text-fg' : 'text-muted hover:text-fg'}`}>{l}</button>
      ))}
    </div>
  )
}
