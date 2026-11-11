import { Languages } from 'lucide-react'
import { currentLang, setLang, type Lang } from '../i18n/az'

/** AZ / RU / EN dil dəyişdiricisi. */
export function LangSwitch({ dark = true, className = '' }: { dark?: boolean; className?: string }) {
  const cur = currentLang()
  return (
    <div className={`inline-flex items-center gap-1 rounded-full p-1 text-xs font-bold ${dark ? 'bg-white/10 text-white' : 'bg-surface text-ink'} ${className}`} role="radiogroup" aria-label="Language / Dil">
      <Languages className="mx-1 h-3.5 w-3.5 opacity-60" />
      {(['az', 'ru', 'en'] as Lang[]).map((l) => (
        <button key={l} type="button" role="radio" aria-checked={cur === l} onClick={() => cur !== l && setLang(l)}
          className={`rounded-full px-2.5 py-1 uppercase ${cur === l ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={cur === l ? { background: 'var(--grad)' } : undefined}>{l}</button>
      ))}
    </div>
  )
}
