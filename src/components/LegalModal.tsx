import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { currentLang, t } from '../i18n/az'
import { LEGAL, LEGAL_VERSION, type LegalId } from '../content/legal'

/**
 * Hüquqi sənəd modalda: uzun mətn ekranı doldurmur, istifadəçi istəsə açıb oxuyur.
 * Bir neçə sənəd verilərsə (məs. məxfilik + şərtlər) — tablar. onAccept verilərsə "Oxudum, razıyam" düyməsi.
 */
export function LegalModal({ ids, open, onClose, onAccept }: { ids: LegalId[]; open: boolean; onClose: () => void; onAccept?: () => void }) {
  const docs = LEGAL[currentLang()].filter((d) => ids.includes(d.id))
  const [tab, setTab] = useState(0)
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    setTab(0)
    const prev = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = overflow; prev?.focus() }
  }, [open, onClose])
  if (!open || !docs.length) return null
  const doc = docs[Math.min(tab, docs.length - 1)]
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="legal-title">
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#12142A] text-white shadow-2xl sm:rounded-3xl">
        <header className="flex items-start gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            {docs.length > 1 ? (
              <div className="flex flex-wrap gap-1" role="tablist">
                {docs.map((d, i) => (
                  <button key={d.id} type="button" role="tab" aria-selected={i === tab} onClick={() => setTab(i)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-bold ${i === tab ? 'text-white' : 'text-white/55 hover:bg-white/10'}`} style={i === tab ? { background: 'var(--grad)' } : undefined}>{d.title}</button>
                ))}
              </div>
            ) : <h2 id="legal-title" className="text-lg font-black">{doc.title}</h2>}
            {docs.length > 1 && <h2 id="legal-title" className="sr-only">{doc.title}</h2>}
            <p className="mt-1 text-xs text-white/45">{t.legal.version}: {LEGAL_VERSION}</p>
          </div>
          <button ref={closeRef} type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label={t.app.close}><X className="h-4 w-4" /></button>
        </header>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5 text-sm leading-relaxed text-white/80 sm:px-6">
          <p className="mb-4 text-white/60">{doc.summary}</p>
          <div className="flex flex-col gap-5">
            {doc.sections.map((s) => (
              <section key={s.h}>
                <h3 className="mb-1.5 font-bold text-white">{s.h}</h3>
                {s.p?.map((p) => <p key={p} className="mb-1.5">{p}</p>)}
                {s.list && <ul className="list-disc space-y-1 pl-5">{s.list.map((x) => <li key={x}>{x}</li>)}</ul>}
              </section>
            ))}
          </div>
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t border-white/10 px-5 py-3 sm:px-6">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>{t.app.close}</button>
          {onAccept && <button type="button" className="btn btn-primary btn-sm" onClick={() => { onAccept(); onClose() }}><Check className="h-4 w-4" />{t.legal.accept}</button>}
        </footer>
      </motion.div>
    </div>,
    document.body,
  )
}

/** Mətn içində kiçik "Ətraflı" düyməsi — label-in checkbox-unu dəyişmədən modalı açır. */
export function LegalLink({ onOpen, label }: { onOpen: () => void; label?: string }) {
  return (
    <button type="button" className="font-semibold text-orange-300 underline-offset-2 hover:underline"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpen() }}>{label ?? t.legal.more}</button>
  )
}
