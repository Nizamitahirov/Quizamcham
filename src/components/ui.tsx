import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useRouteError } from 'react-router-dom'
import { logError } from '../lib/errorLog'
import { t } from '../i18n/az'
import { Switch } from './kit'

export function Spinner({ label = t.app.loading }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8" role="status">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px]" style={{ borderColor: 'rgba(255,255,255,.1)', borderTopColor: '#FF5A1F' }} />
      <span className="text-sm text-muted">{label}</span>
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
      <Switch checked={checked} onChange={onChange} label={label} />
    </label>
  )
}

export function Modal({ open, onClose, title, children, wide, sub }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; sub?: string }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = prev }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }} role="dialog" aria-modal="true" aria-label={title}>
      <motion.div initial={{ y: 30, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className={`card flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-b-none sm:rounded-b-[var(--radius)] ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`} style={{ boxShadow: 'var(--shadow-lg)' }}>
        <div className="flex items-start gap-3 border-b border-line px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold leading-snug">{title}</h2>
            {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
          </div>
          <button type="button" className="btn btn-ghost-dark btn-icon btn-sm -mr-2" onClick={onClose} aria-label={t.app.close}><X /></button>
        </div>
        <div className="overflow-y-auto px-6 py-5 scrollbar-thin">{children}</div>
      </motion.div>
    </div>,
    document.body,
  )
}

export function RouteError() {
  const err = useRouteError()
  useEffect(() => { logError(err, 'route') }, [err])
  return (
    <div className="bg-app flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 text-3xl">😵</span>
      <p className="text-xl font-extrabold">{t.app.error}</p>
      <button className="btn btn-secondary" onClick={() => window.location.reload()}>↻</button>
    </div>
  )
}

export function PageHeader({ title, sub, children, eyebrow }: { title: string; sub?: string; children?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-3 sm:mb-8">
      <div className="mr-auto min-w-0">
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <h1 className="break-words text-[26px] font-extrabold leading-tight tracking-tight sm:text-[32px]">{title}</h1>
        {sub && <p className="mt-1.5 max-w-2xl text-sm text-muted sm:text-[15px]">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
