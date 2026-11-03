import { useEffect, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { t } from '../i18n/az'

export function Spinner({ label = t.app.loading }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8" role="status">
      <span className="h-10 w-10 animate-spin rounded-full border-4 border-current/20 border-t-orange-500" style={{ borderColor: 'rgba(127,127,150,.25)', borderTopColor: '#FF5A1F' }} />
      <span className="text-sm opacity-70">{label}</span>
    </div>
  )
}

export function FullScreen({ children, className = 'bg-grad' }: { children: ReactNode; className?: string }) {
  return <div className={`relative flex min-h-dvh flex-col overflow-hidden ${className}`}>{children}</div>
}

export function Page({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }} className="relative z-10 flex flex-1 flex-col">
      {children}
    </motion.div>
  )
}

export function useOnline() {
  const [on, setOn] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const a = () => setOn(true)
    const b = () => setOn(false)
    window.addEventListener('online', a)
    window.addEventListener('offline', b)
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b) }
  }, [])
  return on
}

export function OfflineBanner() {
  const on = useOnline()
  if (on) return null
  return <div className="fixed inset-x-0 top-0 z-50 bg-amber-500 py-2 text-center text-sm font-extrabold text-black" role="alert">{t.app.offline}</div>
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3">
      <span className="text-sm font-semibold">{label}</span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? '' : 'bg-slate-300'}`} style={checked ? { background: 'var(--grad)' } : undefined}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${checked ? 'left-[1.4rem]' : 'left-0.5'}`} />
      </button>
    </label>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0B16]/60 p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <motion.div initial={{ scale: 0.94, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} className={`card max-h-[90dvh] w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} overflow-auto p-6`} style={{ boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button type="button" className="btn btn-ghost-dark btn-icon" onClick={onClose} aria-label={t.app.close}><X /></button>
        </div>
        {children}
      </motion.div>
    </div>
  )
}

export function RouteError() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-night p-6 text-center text-white">
      <div className="text-6xl">😵</div>
      <p className="text-xl font-extrabold">{t.app.error}</p>
      <button className="btn btn-secondary" onClick={() => window.location.reload()}>↻</button>
    </div>
  )
}

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div className="mr-auto min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {children}
    </div>
  )
}
