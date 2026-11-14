import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Globe, LogOut, Moon, Sun, type LucideIcon } from 'lucide-react'
import { setTheme, useTheme } from '../lib/theme'
import { currentLang, t } from '../i18n/az'
import { logout } from '../firebase/auth'
import { LangList, LANGS } from './LangSwitch'
import { isUploaded } from '../lib/media'
import { useAvatarThumb } from '../lib/avatar3d'

export interface MenuLink { to: string; label: string; icon: LucideIcon; hint?: string }

/** Profil şəkli: 3D avatar → foto → baş hərflər (qradiyentdə). */
export function UserAvatar({ uid, name, photo, size = 32, ring = false }: { uid?: string; name: string; photo?: string | null; size?: number; ring?: boolean }) {
  const thumb = useAvatarThumb(uid)
  // öz yüklədiyi şəkil > 3D avatar > Google şəkli
  const src = isUploaded(photo) ? photo : thumb || photo
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?'
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${ring ? 'ring-2 ring-white/10' : ''}`}
      style={{ width: size, height: size, background: src ? '#1F2340' : 'var(--grad)' }}>
      {src ? <img src={src} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" draggable={false} />
        : <span className="font-semibold text-[#fff]" style={{ fontSize: size * 0.4 }}>{initials}</span>}
    </span>
  )
}

/**
 * Hesab menyusu: avatar + ad düyməsi → açılan panel (ad, e-poçt, rol/plan, keçidlər, dil, çıxış).
 * Kiçik ekranda aşağıdan açılan vərəq kimi göstərilir.
 */
export function AccountMenu({ uid, name, email, photo, badge, links, compact = false, placement = 'down', wide = false }: {
  uid?: string; name: string; email?: string | null; photo?: string | null; badge?: string; links: MenuLink[]; compact?: boolean; placement?: 'down' | 'up'; wide?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const nav = useNavigate()
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node) && !(e.target as Element).closest?.('[data-acct-sheet]')) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [open])
  const lang = LANGS.find((l) => l.code === currentLang())
  const close = () => setOpen(false)
  const panel = (
    <>
      <div className="flex items-center gap-3 border-b border-line p-4">
        <UserAvatar uid={uid} name={name} photo={photo} size={44} ring />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{name}</p>
          {email && <p className="truncate text-xs text-muted">{email}</p>}
          {badge && <span className="chip chip-brand mt-1.5">{badge}</span>}
        </div>
      </div>
      <nav className="flex flex-col gap-0.5 p-1.5">
        {links.map((l) => (
          <Link key={l.to} to={l.to} onClick={close} role="menuitem"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-fg2 transition hover:bg-white/[.06] hover:text-fg">
            <l.icon className="h-4 w-4 text-muted" /><span className="flex-1">{l.label}</span>{l.hint && <span className="text-xs text-muted">{l.hint}</span>}
          </Link>
        ))}
      </nav>
      <ThemeRow />
      <div className="border-t border-line p-1.5">
        <p className="flex items-center gap-2 px-3 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[.12em] text-muted"><Globe className="h-3.5 w-3.5" />{t.menu.language}</p>
        <LangList onPick={close} />
      </div>
      <div className="border-t border-line p-1.5">
        <button type="button" role="menuitem" onClick={() => { close(); void logout().then(() => nav('/')) }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/10">
          <LogOut className="h-4 w-4" />{t.acct.signOut}
        </button>
      </div>
    </>
  )
  return (
    <div ref={ref} className="relative">
      {wide ? (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={t.menu.account}
          className={`flex w-full items-center gap-2.5 rounded-xl border border-line bg-white/[.02] p-2 text-left transition hover:border-line-strong hover:bg-white/[.05] ${open ? 'border-line-strong bg-white/[.05]' : ''}`}>
          <UserAvatar uid={uid} name={name} photo={photo} size={34} />
          <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold">{name}</span><span className="block truncate text-[11px] text-muted">{badge ?? email}</span></span>
          <span className="text-xs" aria-hidden>{lang?.flag}</span>
          <ChevronDown className={`h-4 w-4 text-muted transition ${open ? '' : 'rotate-180'}`} />
        </button>
      ) : <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={t.menu.account}
        className={`group flex items-center gap-2 rounded-full border border-line bg-white/[.04] p-1 transition hover:border-line-strong hover:bg-white/[.07] ${compact ? '' : 'sm:pr-2.5'} ${open ? 'border-line-strong bg-white/[.07]' : ''}`}>
        <UserAvatar uid={uid} name={name} photo={photo} size={30} />
        {!compact && <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">{name.split(' ')[0]}</span>}
        {!compact && <span className="hidden text-xs leading-none sm:inline" aria-hidden>{lang?.flag}</span>}
        <ChevronDown className={`mr-1 hidden h-3.5 w-3.5 text-muted transition sm:block ${open ? 'rotate-180' : ''}`} />
      </button>}
      <AnimatePresence>
        {open && (
          <>
            {/* masaüstü: açılan panel */}
            <motion.div role="menu" initial={{ opacity: 0, y: placement === 'up' ? 6 : -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.14 }}
              className={`absolute ${wide ? 'left-0' : 'right-0'} z-50 hidden w-72 overflow-hidden rounded-2xl border border-line-strong bg-raised shadow-[var(--shadow-lg)] sm:block ${placement === 'up' ? 'bottom-full mb-2 origin-bottom-right' : 'top-full mt-2 origin-top-right'}`}>
              {panel}
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* mobil: aşağıdan vərəq — portal ilə (başlıqdakı backdrop-filter "fixed" mövqeyini pozmasın) */}
      {createPortal(<AnimatePresence>{open && (
            <motion.div data-acct-sheet className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm sm:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
              <motion.div role="menu" className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl border-t border-line-strong bg-raised pb-[env(safe-area-inset-bottom)]"
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 36 }} onClick={(e) => e.stopPropagation()}>
                <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/20" />
                {panel}
              </motion.div>
            </motion.div>
      )}</AnimatePresence>, document.body)}
    </div>
  )
}

/** Rəng rejimi: tünd / açıq (seçim yadda qalır). */
function ThemeRow() {
  const theme = useTheme()
  return (
    <div className="border-t border-line p-1.5">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className="flex-1 text-sm font-medium text-fg2">{t.menu.theme}</span>
        <div className="inline-flex rounded-lg border border-line bg-white/[.03] p-0.5" role="radiogroup" aria-label={t.menu.theme}>
          {([['dark', Moon, t.menu.dark], ['light', Sun, t.menu.light]] as const).map(([v, Icon, l]) => (
            <button key={v} type="button" role="radio" aria-checked={theme === v} title={l} aria-label={l} onClick={() => setTheme(v)}
              className={`flex h-7 w-8 items-center justify-center rounded-md transition ${theme === v ? 'bg-white/[.1] text-fg shadow-sm' : 'text-muted hover:text-fg'}`}><Icon className="h-4 w-4" /></button>
          ))}
        </div>
      </div>
    </div>
  )
}
