import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Award, Bell, BellOff, Bot, Calendar, CheckCheck, CheckCircle2, Clock, Crown, EyeOff, Flag, Flame, Gamepad2, Inbox, Plus, Share2, Sparkles, Users, type LucideIcon } from 'lucide-react'
import { t } from '../i18n/az'
import { timeAgo, useNotices, type Icon, type Notice, type Tone } from '../lib/notifications'

const ICONS: Record<Icon, LucideIcon> = { clock: Clock, crown: Crown, bot: Bot, users: Users, check: CheckCircle2, calendar: Calendar, game: Gamepad2, eye: EyeOff, share: Share2, inbox: Inbox, flag: Flag, sparkles: Sparkles, flame: Flame, award: Award, plus: Plus }
const TONE: Record<Tone, string> = {
  brand: 'border-orange-400/25 bg-orange-500/10 text-orange-300', ok: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  warn: 'border-amber-400/25 bg-amber-500/10 text-amber-300', bad: 'border-red-500/25 bg-red-500/10 text-red-300', info: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
}
const N = t.nt

/** Bildiriş zəngi: oxunmamış sayğacı + panel (masaüstündə açılan, telefonda aşağıdan vərəq). */
export function NotificationBell({ load, align = 'right' }: { load: (() => Promise<Notice[]>) | null; align?: 'left' | 'right' }) {
  const { items, read, unread, refresh, markOne, markAll } = useNotices(load)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const nav = useNavigate()
  useEffect(() => {
    if (!open) return
    refresh()
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node) && !(e.target as Element).closest?.('[data-nt-sheet]')) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [open, refresh])
  const go = (n: Notice) => { markOne(n.id); setOpen(false); if (n.to.includes('#')) { nav(n.to.split('#')[0]); setTimeout(() => document.getElementById(n.to.split('#')[1])?.scrollIntoView({ behavior: 'smooth' }), 400) } else nav(n.to) }

  const panel = (
    <>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <h2 className="font-sans text-[15px] font-semibold">{N.title}</h2>
        {unread > 0 && <span className="chip chip-brand whitespace-nowrap">{N.unread(unread)}</span>}
        {unread > 0 && <button type="button" className="btn btn-ghost-dark btn-sm ml-auto shrink-0" onClick={markAll} title={N.markAll}><CheckCheck /><span className="hidden sm:inline">{N.markAll}</span></button>}
      </div>
      <div className="max-h-[min(70dvh,30rem)] overflow-y-auto scrollbar-thin">
        {!items ? <div className="flex flex-col gap-2 p-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-14" />)}</div>
          : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-white/[.03] text-muted"><BellOff className="h-5 w-5" /></span>
              <p className="font-semibold">{N.empty}</p><p className="text-sm text-muted">{N.emptySub}</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((n) => {
                const I = ICONS[n.icon], isNew = !read.has(n.id)
                return (
                  <li key={n.id}>
                    <button type="button" onClick={() => go(n)} className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/[.04] ${isNew ? 'bg-white/[.025]' : ''}`}>
                      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${TONE[n.tone]}`}><I className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm leading-snug ${isNew ? 'font-semibold text-fg' : 'font-medium text-fg2'}`}>{n.title}</span>
                        {n.body && <span className="mt-0.5 block text-xs leading-snug text-muted">{n.body}</span>}
                        <span className="mt-1 block text-[11px] text-muted/80">{timeAgo(n.at)}</span>
                      </span>
                      {isNew && <span className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--grad)' }} aria-label="●" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
      </div>
    </>
  )
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} aria-label={unread ? `${N.open} (${N.unread(unread)})` : N.open} title={N.title}
        className={`relative flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white/[.04] text-fg2 transition hover:border-line-strong hover:text-fg ${open ? 'border-line-strong text-fg' : ''}`}>
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-[#0B0C19]" style={{ background: 'var(--grad)' }}>{unread > 9 ? '9+' : unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="dialog" aria-label={N.title} initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.14 }}
            className={`absolute top-full z-50 mt-2 hidden w-[24rem] overflow-hidden rounded-2xl border border-line-strong bg-raised shadow-[var(--shadow-lg)] sm:block ${align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'}`}>
            {panel}
          </motion.div>
        )}
      </AnimatePresence>
      {createPortal(<AnimatePresence>{open && (
        <motion.div data-nt-sheet className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm sm:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
          <motion.div role="dialog" aria-label={N.title} className="absolute inset-x-0 bottom-0 overflow-hidden rounded-t-3xl border-t border-line-strong bg-raised pb-[env(safe-area-inset-bottom)]"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 36 }} onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/20" />
            {panel}
          </motion.div>
        </motion.div>
      )}</AnimatePresence>, document.body)}
    </div>
  )
}
