import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, LogOut, UserRound } from 'lucide-react'
import { t } from '../i18n/az'
import { logout } from '../firebase/auth'
import { useAccount } from '../lib/account'
import { Logo } from './Brand'
import { LangSwitch } from './LangSwitch'

/** Tələbə səhifələri üçün vahid çərçivə: yapışqan başlıq + fon (təlimçi panelindəki ilə eyni üslub). */
export function StudentShell({ children, back, title, width = 'max-w-6xl', actions }: { children: ReactNode; back?: string; title?: ReactNode; width?: string; actions?: ReactNode }) {
  const { user, profile } = useAccount()
  const nav = useNavigate()
  const A = t.acct
  return (
    <div className="bg-app min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-[#0B0C19]/80 backdrop-blur-xl">
        <div className={`mx-auto flex w-full ${width} items-center gap-3 px-4 py-2.5 sm:px-6`}>
          {back && <Link to={back} className="btn btn-ghost-dark btn-icon btn-sm" aria-label={t.app.back}><ArrowLeft /></Link>}
          <Link to="/learn" aria-label={t.app.home} className="shrink-0"><Logo size={26} /></Link>
          {title && <span className="hidden min-w-0 truncate border-l border-line pl-3 text-sm font-medium text-fg2 sm:block">{title}</span>}
          <div className="ml-auto flex items-center gap-1.5">
            {actions}
            <LangSwitch className="hidden sm:inline-flex" />
            {user && (
              <Link to="/account" className="flex items-center gap-2 rounded-full border border-line bg-white/[.04] py-1 pl-1 pr-1 text-sm font-medium transition hover:border-line-strong sm:pr-3" title={A.myAccount} aria-label={A.myAccount}>
                {user.photoURL ? <img src={user.photoURL} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
                  : <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: 'var(--grad)' }}>{profile?.firstName?.[0] ?? <UserRound className="h-3.5 w-3.5" />}</span>}
                <span className="hidden sm:inline">{profile?.firstName}</span>
              </Link>
            )}
            {user && <button className="btn btn-ghost-dark btn-icon btn-sm" aria-label={A.signOut} title={A.signOut} onClick={() => void logout().then(() => nav('/'))}><LogOut /></button>}
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
