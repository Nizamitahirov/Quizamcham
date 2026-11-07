import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** Bölmə kartı: ikon + başlıq + alt başlıq + məzmun. Bütün admin səhifələrində vahid görünüş. */
export function Section({ icon: Icon, title, sub, children, actions, className = '', bodyClassName = 'p-5' }: { icon?: LucideIcon; title: string; sub?: string; children: ReactNode; actions?: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={`card overflow-hidden ${className}`}>
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        {Icon && <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-brand" style={{ background: 'var(--grad-soft)' }}><Icon className="h-5 w-5" /></span>}
        <div className="min-w-[12rem] flex-1">
          <h2 className="text-base font-bold leading-tight">{title}</h2>
          {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
        </div>
        {actions}
      </header>
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

export function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <span className="label">{label}</span>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

export interface OptionDef<T extends string | number> { value: T; title: string; desc?: string; icon?: LucideIcon; emoji?: string }

/** Böyük seçim kartları (radio). */
export function OptionCards<T extends string | number>({ value, options, onChange, cols = 3 }: { value: T; options: OptionDef<T>[]; onChange: (v: T) => void; cols?: 2 | 3 | 4 }) {
  const grid = cols === 2 ? 'sm:grid-cols-2' : cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'
  return (
    <div className={`grid gap-3 ${grid}`} role="radiogroup">
      {options.map((o) => {
        const on = o.value === value
        return (
          <motion.button key={String(o.value)} type="button" role="radio" aria-checked={on} whileTap={{ scale: 0.98 }} onClick={() => onChange(o.value)}
            className={`relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition ${on ? 'border-transparent bg-white shadow-[0_0_0_2px_#E8202A,0_12px_28px_-12px_rgba(232,32,42,.45)]' : 'border-line bg-white hover:border-[#d5d8e6]'}`}>
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${on ? 'text-white' : 'text-brand'}`} style={{ background: on ? 'var(--grad)' : 'var(--grad-soft)' }}>
              {o.icon ? <o.icon className="h-5 w-5" /> : o.emoji}
            </span>
            <span className="text-sm font-bold">{o.title}</span>
            {o.desc && <span className="text-xs leading-relaxed text-muted">{o.desc}</span>}
            {on && <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full text-white" style={{ background: 'var(--grad)' }}><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>}
          </motion.button>
        )
      })}
    </div>
  )
}

/** Seqment düymələri (kiçik seçimlər üçün). */
export function Segmented<T extends string | number>({ value, options, onChange, size = 'md' }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div className="inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-surface p-1" role="radiogroup">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button key={String(o.value)} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={`rounded-lg font-semibold transition ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm'} ${on ? 'bg-white text-ink shadow-[var(--shadow-sm)] ring-1 ring-line' : 'text-muted hover:text-ink'}`}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Açar keçirici sətri (başlıq + izah + switch). */
export function SwitchRow({ checked, onChange, label, desc, icon: Icon }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string; icon?: LucideIcon }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-3">
      {Icon && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-muted"><Icon className="h-4 w-4" /></span>}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        {desc && <span className="block text-xs text-muted">{desc}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? '' : 'bg-slate-300'}`} style={checked ? { background: 'var(--grad)' } : undefined}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? 'left-[1.4rem]' : 'left-0.5'}`} />
      </button>
    </label>
  )
}

/** Tab naviqasiyası. */
export function Tabs<T extends string>({ value, tabs, onChange }: { value: T; tabs: { value: T; label: string; icon?: LucideIcon; badge?: number }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line" role="tablist">
      {tabs.map((tb) => {
        const on = tb.value === value
        return (
          <button key={tb.value} type="button" role="tab" aria-selected={on} onClick={() => onChange(tb.value)}
            className={`relative flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-semibold transition ${on ? 'text-ink' : 'text-muted hover:text-ink'}`}>
            {tb.icon && <tb.icon className="h-4 w-4" />}{tb.label}
            {tb.badge ? <span className="rounded-full bg-red-100 px-1.5 text-[10px] font-bold text-red-700">{tb.badge}</span> : null}
            {on && <motion.span layoutId="tab-underline" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full" style={{ background: 'var(--grad)' }} />}
          </button>
        )
      })}
    </div>
  )
}
