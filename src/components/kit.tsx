import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** Bölmə kartı: ikon + başlıq + alt başlıq + məzmun. Bütün səhifələrdə vahid görünüş. */
export function Section({ icon: Icon, title, sub, children, actions, className = '', bodyClassName = 'p-5' }: { icon?: LucideIcon; title: string; sub?: string; children: ReactNode; actions?: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={`card overflow-hidden ${className}`}>
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        {Icon && <span className="icon-tile h-9 w-9"><Icon className="h-[18px] w-[18px]" /></span>}
        <div className="min-w-[10rem] flex-1">
          <h2 className="font-sans text-[15px] font-semibold leading-tight tracking-tight">{title}</h2>
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
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
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
            className={`relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition ${on ? 'border-orange-400/60 bg-orange-500/[.07] shadow-[0_0_0_3px_rgba(255,90,31,.15)]' : 'border-line bg-white/[.02] hover:border-line-strong hover:bg-white/[.04]'}`}>
            <span className={on ? 'icon-tile-solid' : 'icon-tile'}>{o.icon ? <o.icon className="h-5 w-5" /> : <span className="text-lg">{o.emoji}</span>}</span>
            <span className="text-sm font-semibold">{o.title}</span>
            {o.desc && <span className="text-xs leading-relaxed text-muted">{o.desc}</span>}
            {on && <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full text-[#fff]" style={{ background: 'var(--grad)' }}><Check className="h-3 w-3" strokeWidth={3} /></span>}
          </motion.button>
        )
      })}
    </div>
  )
}

/** Seqment düymələri (kiçik seçimlər üçün). */
export function Segmented<T extends string | number>({ value, options, onChange, size = 'md' }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div className="inline-flex max-w-full flex-wrap gap-0.5 rounded-xl border border-line bg-white/[.03] p-1" role="radiogroup">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button key={String(o.value)} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={`relative rounded-lg font-semibold transition ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'} ${on ? 'text-fg' : 'text-muted hover:text-fg'}`}>
            {on && <motion.span layoutId={`seg-${options.map((x) => x.value).join('')}`} className="absolute inset-0 rounded-lg border border-line-strong bg-raised2 shadow-[var(--shadow-sm)]" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Açar keçirici. */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition ${checked ? 'border-transparent' : 'border-line-strong bg-white/10'}`} style={checked ? { background: 'var(--grad)' } : undefined}>
      <span className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-[#fff] shadow transition-all ${checked ? 'left-[22px]' : 'left-[3px]'}`} />
    </button>
  )
}

/** Açar keçirici sətri (başlıq + izah + switch). */
export function SwitchRow({ checked, onChange, label, desc, icon: Icon }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string; icon?: LucideIcon }) {
  return (
    <div className="flex cursor-pointer items-center gap-3 py-3" onClick={() => onChange(!checked)}>
      {Icon && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-white/[.03] text-muted"><Icon className="h-4 w-4" /></span>}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        {desc && <span className="block text-xs text-muted">{desc}</span>}
      </span>
      <span onClick={(e) => e.stopPropagation()}><Switch checked={checked} onChange={onChange} label={label} /></span>
    </div>
  )
}

/** Tab naviqasiyası (pill üslubu). */
export function Tabs<T extends string>({ value, tabs, onChange, id = 'tabs' }: { value: T; tabs: { value: T; label: string; icon?: LucideIcon; badge?: number; count?: number }[]; onChange: (v: T) => void; id?: string }) {
  return (
    <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-white/[.03] p-1 scrollbar-thin" role="tablist">
      {tabs.map((tb) => {
        const on = tb.value === value
        return (
          <button key={tb.value} type="button" role="tab" aria-selected={on} onClick={() => onChange(tb.value)}
            className={`relative flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${on ? 'text-fg' : 'text-muted hover:text-fg'}`}>
            {on && <motion.span layoutId={`${id}-pill`} className="absolute inset-0 rounded-lg border border-line-strong bg-raised2" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span className="relative flex items-center gap-2">
              {tb.icon && <tb.icon className="h-4 w-4" />}{tb.label}
              {tb.count != null && <span className={`rounded-md px-1.5 text-[11px] font-bold tabular ${on ? 'bg-white/10 text-fg' : 'bg-white/5 text-muted'}`}>{tb.count}</span>}
              {tb.badge ? <span className="rounded-full bg-red-500/20 px-1.5 text-[10px] font-bold text-red-300">{tb.badge}</span> : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Boş vəziyyət: ikon + başlıq + izah + hərəkət. */
export function EmptyState({ icon: Icon, title, text, action, className = '' }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={`card flex flex-col items-center gap-3 px-6 py-12 text-center ${className}`}>
      <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-white/[.03] text-orange-300">
        <span className="absolute inset-0 rounded-2xl opacity-40 blur-xl" style={{ background: 'var(--grad)' }} />
        <Icon className="relative h-6 w-6" />
      </span>
      <h3 className="font-sans text-base font-semibold">{title}</h3>
      {text && <p className="max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/** Göstərici kartı. */
export function Stat({ icon: Icon, label, value, hint, tone = 'brand' }: { icon: LucideIcon; label: string; value: ReactNode; hint?: ReactNode; tone?: 'brand' | 'ok' | 'warn' | 'info' }) {
  const toneCls = { brand: 'icon-tile', ok: 'bg-emerald-500/12 text-emerald-300 border border-emerald-500/20', warn: 'bg-amber-500/12 text-amber-300 border border-amber-500/20', info: 'bg-sky-500/12 text-sky-300 border border-sky-500/20' }[tone]
  return (
    <div className="card flex items-start gap-3 p-4 sm:p-5">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneCls}`}><Icon className="h-5 w-5" /></span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted">{label}</p>
        <p className="mt-0.5 font-display text-2xl font-extrabold tabular tracking-tight">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
    </div>
  )
}

/** Faiz nişanı: 80+ yaşıl, 50+ sarı, qalanı qırmızı. */
export function PctBadge({ pct }: { pct: number }) {
  return <span className={`chip tabular ${pct >= 80 ? 'chip-ok' : pct >= 50 ? 'chip-warn' : 'chip-bad'}`}>{pct}%</span>
}

/** İrəliləyiş zolağı. */
export function Progress({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-white/[.07] ${className}`} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div className="h-full rounded-full" style={{ background: 'var(--grad)' }} initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, value))}%` }} transition={{ type: 'spring', stiffness: 120, damping: 22 }} />
    </div>
  )
}

export interface MenuItem { label: string; icon?: LucideIcon; onClick: () => void; danger?: boolean; hidden?: boolean; hint?: string }
/** Açılan menyu (… düyməsi və ya istənilən tetikleyici). Klaviatura: Esc bağlayır. */
export function DropMenu({ items, label, children, align = 'right', className = '', btnClass = 'btn btn-ghost-dark btn-icon btn-sm' }: { items: MenuItem[]; label: string; children: ReactNode; align?: 'left' | 'right'; className?: string; btnClass?: string }) {
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left?: number; right?: number; up: boolean } | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const open = !!pos
  const close = () => setPos(null)
  // Menyu portal ilə body-yə çəkilir: kartların overflow-hidden-i onu kəsmir; ekranın altına yaxındırsa yuxarı açılır
  const place = () => {
    const r = btn.current?.getBoundingClientRect()
    if (!r) return
    const h = Math.min(320, items.filter((i) => !i.hidden).length * 40 + 12)
    const up = r.bottom + h + 8 > window.innerHeight && r.top - h - 8 > 0
    setPos({ ...(up ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }), up, ...(align === 'right' ? { right: Math.max(8, window.innerWidth - r.right) } : { left: Math.max(8, r.left) }) })
  }
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { const t = e.target as Node; if (!menu.current?.contains(t) && !btn.current?.contains(t)) close() }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { close(); btn.current?.focus() } }
    const away = () => close()
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key)
    window.addEventListener('scroll', away, true); window.addEventListener('resize', away)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); window.removeEventListener('scroll', away, true); window.removeEventListener('resize', away) }
  }, [open])
  const visible = items.filter((i) => !i.hidden)
  return (
    <div className={`relative ${className}`}>
      <button ref={btn} type="button" className={btnClass} title={label} aria-haspopup="menu" aria-expanded={open} aria-label={label}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (open) close(); else place() }}>{children}</button>
      {createPortal(
        <AnimatePresence>
          {pos && (
            <motion.div ref={menu} role="menu" initial={{ opacity: 0, y: pos.up ? 4 : -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.12 }}
              style={{ position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, right: pos.right }}
              className="z-[80] max-h-80 min-w-52 overflow-y-auto rounded-xl border border-line-strong bg-raised p-1 shadow-[var(--shadow-lg)]">
              {visible.map((it) => (
                <button key={it.label} type="button" role="menuitem" onClick={(e) => { e.stopPropagation(); close(); it.onClick() }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${it.danger ? 'text-red-300 hover:bg-red-500/10' : 'text-fg2 hover:bg-white/[.06] hover:text-fg'}`}>
                  {it.icon && <it.icon className="h-4 w-4 shrink-0 opacity-80" />}
                  <span className="flex-1">{it.label}</span>
                  {it.hint && <span className="text-xs text-muted">{it.hint}</span>}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>, document.body)}
    </div>
  )
}
