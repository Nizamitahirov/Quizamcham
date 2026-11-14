import { useCallback, useEffect, type ReactNode } from 'react'
import { NotificationBell } from './NotificationBell'
import { studentNotices } from '../lib/notifications'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen, LayoutDashboard, Sparkles, UserRound } from 'lucide-react'
import { t } from '../i18n/az'
import { useAccount } from '../lib/account'
import { Logo } from './Brand'
import { LangSwitch } from './LangSwitch'
import { AccountMenu, type MenuLink } from './AccountMenu'

/** Daxil olmuş istifadəçi üçün hesab menyusunun keçidləri. */
export function useAccountLinks(): MenuLink[] {
  const { profile } = useAccount()
  return [
    { to: '/learn', label: t.menu.learn, icon: BookOpen },
    ...(profile && profile.type !== 'student' ? [{ to: '/admin', label: t.menu.panel, icon: LayoutDashboard }] : []),
    { to: '/avatar', label: t.menu.avatar, icon: Sparkles, hint: '3D' },
    { to: '/account', label: t.acct.myAccount, icon: UserRound },
  ]
}

/** Tələbə səhifələri üçün vahid çərçivə: yapışqan başlıq + fon (təlimçi panelindəki ilə eyni üslub). */
/** Tələbə bölmələrinin kodu boş vaxtda əvvəlcədən yüklənir — keçidlər dərhal olur. */
let preloaded = false
function usePreloadStudent() {
  useEffect(() => {
    if (preloaded) return
    preloaded = true
    const run = () => { for (const f of [() => import('../pages/account/Learn'), () => import('../pages/account/CoursePage'), () => import('../pages/account/Practice'), () => import('../pages/account/AssignmentPage'), () => import('../pages/account/Account'), () => import('../pages/account/Flashcards')]) void f().catch(() => {}) }
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
    if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 3000 }); else window.setTimeout(run, 1500)
  }, [])
}

export function StudentShell({ children, back, title, width = 'max-w-6xl', actions }: { children: ReactNode; back?: string; title?: ReactNode; width?: string; actions?: ReactNode }) {
  usePreloadStudent()
  const { user, profile } = useAccount()
  const nav = useNavigate()
  const links = useAccountLinks()
  const uid = user && !user.isAnonymous ? user.uid : ''
  const notices = useCallback(() => studentNotices(uid), [uid])
  const name = profile ? `${profile.firstName} ${profile.lastName}`.trim() : user?.displayName || user?.email?.split('@')[0] || ''
  return (
    <div className="bg-app min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur-xl">
        <div className={`mx-auto flex w-full ${width} items-center gap-3 px-4 py-2.5 sm:px-6`}>
          {back && (back === '-1'
            ? <button onClick={() => (history.length > 1 ? nav(-1) : nav('/learn'))} className="btn btn-ghost-dark btn-icon btn-sm" aria-label={t.app.back}><ArrowLeft /></button>
            : <Link to={back} className="btn btn-ghost-dark btn-icon btn-sm" aria-label={t.app.back}><ArrowLeft /></Link>)}
          <Link to="/learn" aria-label={t.app.home} className="shrink-0"><Logo size={26} /></Link>
          {title && <span className="hidden min-w-0 truncate border-l border-line pl-3 text-sm font-medium text-fg2 sm:block">{title}</span>}
          <div className="ml-auto flex items-center gap-2">
            {actions}
            {user && !user.isAnonymous && <NotificationBell load={notices} />}
            {user && !user.isAnonymous
              ? <AccountMenu uid={user.uid} name={name || '—'} email={user.email} photo={user.photoURL} badge={profile ? (profile.type === 'student' ? t.menu.student : t.menu.trainer) : undefined} links={links} />
              : <LangSwitch />}
          </div>
        </div>
      </header>
      <main className={`fade-up mx-auto flex w-full ${width} flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10`}>{children}</main>
    </div>
  )
}

/** Bölmə başlığı (tələbə səhifələri). */
export function SectionTitle({ icon: Icon, children, aside }: { icon?: React.ComponentType<{ className?: string }>; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <h2 className="flex items-center gap-2.5 font-sans text-lg font-semibold tracking-tight">{Icon && <span className="icon-tile h-8 w-8"><Icon className="h-4 w-4" /></span>}{children}</h2>
      {aside && <div className="ml-auto flex flex-wrap items-center gap-2">{aside}</div>}
    </div>
  )
}
