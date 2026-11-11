/**
 * Brauzerin confirm/prompt/alert pəncərələrinin əvəzi: üslubla uyğun, klaviatura ilə idarə olunan dialoqlar və bildirişlər.
 *   if (await confirmDialog({ title, danger: true })) …
 *   const name = await promptDialog({ title, initial })
 *   toast('Yadda saxlanıldı')
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { create } from 'zustand'
import { t } from '../i18n/az'

type ConfirmOpts = { title: string; body?: ReactNode; ok?: string; cancel?: string; danger?: boolean }
type PromptOpts = { title: string; body?: ReactNode; label?: string; initial?: string; placeholder?: string; ok?: string; maxLength?: number; suggestions?: string[]; allowEmpty?: boolean }
type Req =
  | { id: number; kind: 'confirm'; o: ConfirmOpts; done: (v: boolean) => void }
  | { id: number; kind: 'prompt'; o: PromptOpts; done: (v: string | null) => void }
  | { id: number; kind: 'alert'; o: ConfirmOpts; done: (v: boolean) => void }
type ToastKind = 'ok' | 'error' | 'info'
type Toast = { id: number; text: string; kind: ToastKind }

const useDlg = create<{ q: Req[]; toasts: Toast[] }>(() => ({ q: [], toasts: [] }))
let seq = 0
const push = (r: Req) => useDlg.setState((s) => ({ q: [...s.q, r] }))
const pop = (id: number) => useDlg.setState((s) => ({ q: s.q.filter((x) => x.id !== id) }))

export const confirmDialog = (o: ConfirmOpts | string) =>
  new Promise<boolean>((done) => push({ id: ++seq, kind: 'confirm', o: typeof o === 'string' ? { title: o } : o, done }))
export const alertDialog = (o: ConfirmOpts | string) =>
  new Promise<boolean>((done) => push({ id: ++seq, kind: 'alert', o: typeof o === 'string' ? { title: o } : o, done }))
export const promptDialog = (o: PromptOpts) => new Promise<string | null>((done) => push({ id: ++seq, kind: 'prompt', o, done }))
export function toast(text: string, kind: ToastKind = 'ok') {
  const id = ++seq
  useDlg.setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, kind }] }))
  setTimeout(() => useDlg.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), kind === 'error' ? 5000 : 2800)
}

function Shell({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <motion.div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }} role="dialog" aria-modal="true" aria-label={label}>
      <motion.div className="card w-full max-w-md p-6" initial={{ y: 24, scale: 0.97, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 12, opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        style={{ boxShadow: 'var(--shadow-lg)' }}>
        {children}
      </motion.div>
    </motion.div>
  )
}

function ConfirmView({ r }: { r: Extract<Req, { kind: 'confirm' | 'alert' }> }) {
  const close = (v: boolean) => { r.done(v); pop(r.id) }
  const ok = useRef<HTMLButtonElement>(null)
  useEffect(() => { ok.current?.focus() }, [])
  const danger = r.o.danger
  return (
    <Shell onClose={() => close(false)} label={r.o.title}>
      <div className="flex gap-4">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${danger ? 'bg-red-500/15 text-red-300' : 'icon-tile'}`}>
          {danger ? <AlertTriangle className="h-5 w-5" /> : <Info className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold leading-snug">{r.o.title}</h2>
          {r.o.body && <div className="mt-1.5 text-sm text-fg2">{r.o.body}</div>}
        </div>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {r.kind === 'confirm' && <button className="btn btn-secondary" onClick={() => close(false)}>{r.o.cancel ?? t.dlg.cancel}</button>}
        <button ref={ok} className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)}>{r.o.ok ?? (danger ? t.dlg.delete : t.dlg.ok)}</button>
      </div>
    </Shell>
  )
}

function PromptView({ r }: { r: Extract<Req, { kind: 'prompt' }> }) {
  const [v, setV] = useState(r.o.initial ?? '')
  const close = (val: string | null) => { r.done(val); pop(r.id) }
  const valid = r.o.allowEmpty || v.trim().length > 0
  return (
    <Shell onClose={() => close(null)} label={r.o.title}>
      <form onSubmit={(e) => { e.preventDefault(); if (valid) close(v.trim()) }}>
        <h2 className="text-lg font-bold">{r.o.title}</h2>
        {r.o.body && <div className="mt-1 text-sm text-fg2">{r.o.body}</div>}
        <label className="label mt-4" htmlFor="dlg-in">{r.o.label ?? r.o.title}</label>
        <input id="dlg-in" autoFocus className="input" value={v} maxLength={r.o.maxLength ?? 120} placeholder={r.o.placeholder} onChange={(e) => setV(e.target.value)} />
        {!!r.o.suggestions?.length && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {r.o.suggestions.map((s) => (
              <button key={s} type="button" onClick={() => setV(s)} className={`chip transition ${v === s ? 'chip-brand' : 'chip-muted hover:border-line-strong'}`}>{s}</button>
            ))}
          </div>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-secondary" onClick={() => close(null)}>{t.dlg.cancel}</button>
          <button className="btn btn-primary" disabled={!valid}>{r.o.ok ?? t.dlg.save}</button>
        </div>
      </form>
    </Shell>
  )
}

const TOAST_ICON = { ok: CheckCircle2, error: XCircle, info: Info }
const TOAST_CLR = { ok: 'text-emerald-300', error: 'text-red-300', info: 'text-sky-300' }

/** Tətbiqin kökündə bir dəfə. */
export function DialogHost() {
  const q = useDlg((s) => s.q)
  const toasts = useDlg((s) => s.toasts)
  const cur = q[0]
  return createPortal(
    <>
      <AnimatePresence>{cur && (cur.kind === 'prompt' ? <PromptView key={cur.id} r={cur} /> : <ConfirmView key={cur.id} r={cur} />)}</AnimatePresence>
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[110] flex flex-col items-center gap-2 px-4 sm:bottom-6" aria-live="polite">
        <AnimatePresence>
          {toasts.map((x) => {
            const Icon = TOAST_ICON[x.kind]
            return (
              <motion.div key={x.id} layout initial={{ y: 16, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 8, opacity: 0 }}
                className="glass-strong pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold" role={x.kind === 'error' ? 'alert' : 'status'}>
                <Icon className={`h-5 w-5 shrink-0 ${TOAST_CLR[x.kind]}`} />
                <span className="min-w-0 flex-1">{x.text}</span>
                <button className="text-muted hover:text-fg" aria-label={t.app.close} onClick={() => useDlg.setState((s) => ({ toasts: s.toasts.filter((y) => y.id !== x.id) }))}><X className="h-4 w-4" /></button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </>,
    document.body,
  )
}
