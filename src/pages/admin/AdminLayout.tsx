import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { Ban, BarChart3, History, LayoutDashboard, ListChecks, LogOut, Music2, ScrollText, Settings, UserRound, Users } from 'lucide-react'
import { ForcePasswordChange } from '../../components/ForcePasswordChange'
import { isManagerRole, isSuperRole, type Role } from '../../lib/roles'
import { useEffect, useState } from 'react'
import { loadProfile } from '../../firebase/db'
import { Avatar } from '../../components/Avatar'
import type { TrainerProfile } from '../../types'
import { logout, useAdmin } from '../../firebase/auth'
import { t } from '../../i18n/az'
import { Spinner } from '../../components/ui'
import { Logo } from '../../components/Brand'
import { LangSwitch } from '../../components/LangSwitch'

type Need = 'manager' | 'super'
const NAV: { to: string; end?: boolean; icon: typeof Settings; label: string; need?: Need }[] = [
  { to: '/admin', end: true, icon: LayoutDashboard, label: t.admin.nav.dashboard },
  { to: '/admin/quizzes', icon: ListChecks, label: t.admin.nav.quizzes },
  { to: '/admin/games', icon: History, label: t.admin.nav.games },
  { to: '/admin/analytics', icon: BarChart3, label: t.admin.nav.analytics },
  { to: '/admin/sounds', icon: Music2, label: t.admin.nav.sounds, need: 'manager' },
  { to: '/admin/profile', icon: UserRound, label: t.admin.nav.profile },
  { to: '/admin/team', icon: Users, label: t.admin.nav.team, need: 'manager' },
  { to: '/admin/settings', icon: Settings, label: t.admin.nav.settings, need: 'manager' },
  { to: '/admin/logs', icon: ScrollText, label: t.admin.nav.logs, need: 'super' },
]
const allowed = (need: Need | undefined, role: Role | null) => !need || (need === 'super' ? isSuperRole(role) : isManagerRole(role))
const MOBILE = NAV.filter((n) => ['/admin', '/admin/quizzes', '/admin/games', '/admin/profile'].includes(n.to))

export default function AdminLayout() {
  const admin = useAdmin()
  const [prof, setProf] = useState<TrainerProfile | null>(null)
  const uid = admin.user?.uid
  useEffect(() => { if (uid) void loadProfile(uid).then(setProf) }, [uid])
  if (admin.loading) return <div className="flex min-h-dvh items-center justify-center bg-surface text-ink"><Spinner /></div>
  if (admin.disabled) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface p-6 text-center text-ink">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600"><Ban className="h-7 w-7" /></span>
        <h1 className="text-2xl font-black">{t.access.restrictedTitle}</h1>
        <p className="max-w-md text-muted">{t.access.restrictedText}</p>
        <button className="btn btn-primary" onClick={() => void logout()}><LogOut className="h-4 w-4" />{t.admin.logout}</button>
      </div>
    )
  }
  if (!admin.isAdmin) return <Navigate to="/admin/login" replace />
  const email = admin.user?.email ?? ''
  return (
    <div className="min-h-dvh bg-surface text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-white p-4 lg:flex">
        <div className="px-2 py-3"><Logo size={36} dark={false} sub="Live quiz" /></div>
        <nav className="mt-6 flex flex-col gap-1">
          {NAV.filter((n) => allowed(n.need, admin.role)).map((n) => (
            <NavLink key={n.to} end={n.end} to={n.to}
              className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'text-white shadow-[var(--glow)]' : 'text-[#4A4E69] hover:bg-surface'}`}
              style={({ isActive }) => (isActive ? { background: 'var(--grad)' } : undefined)}>
              <n.icon className="h-[18px] w-[18px]" />{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto mb-3 flex justify-center"><LangSwitch dark={false} /></div>
        <div className="flex items-center gap-3 rounded-xl border border-line p-3">
          <NavLink to="/admin/profile" className="flex min-w-0 flex-1 items-center gap-3">
            {prof?.photoUrl ? <img src={prof.photoUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" /> : prof?.avatar ? <Avatar avatar={prof.avatar} size={36} /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: 'var(--grad)' }}>{email[0]?.toUpperCase()}</span>}
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{prof?.name || email.split('@')[0]}</span>
              <span className="block truncate text-[11px] text-muted">{prof?.title || email}</span>
            </span>
          </NavLink>
          <button className="btn btn-ghost-dark btn-icon" onClick={() => void logout()} aria-label={t.admin.logout} title={t.admin.logout}><LogOut className="h-4 w-4" /></button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white/85 px-4 py-3 backdrop-blur lg:hidden">
        <Logo size={30} dark={false} />
        <LangSwitch dark={false} className="ml-auto mr-2" />
        <button className="btn btn-ghost-dark btn-icon" onClick={() => void logout()} aria-label={t.admin.logout}><LogOut className="h-4 w-4" /></button>
      </header>

      <div className="pb-24 lg:pb-0 lg:pl-64">
        <Outlet context={admin} />
        {admin.mustChangePassword && admin.user && <ForcePasswordChange user={admin.user} />}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {MOBILE.map((n) => (
          <NavLink key={n.to} end={n.end} to={n.to} className={({ isActive }) => `flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${isActive ? 'text-brand' : 'text-muted'}`}>
            <n.icon className="h-5 w-5" />{n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
