import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { History, LayoutDashboard, ListChecks, LogOut, Settings } from 'lucide-react'
import { logout, useAdmin } from '../../firebase/auth'
import { t } from '../../i18n/az'
import { Spinner } from '../../components/ui'
import { Logo } from '../../components/Brand'

const NAV = [
  { to: '/admin', end: true, icon: LayoutDashboard, label: t.admin.nav.dashboard },
  { to: '/admin/quizzes', icon: ListChecks, label: t.admin.nav.quizzes },
  { to: '/admin/games', icon: History, label: t.admin.nav.games },
  { to: '/admin/settings', icon: Settings, label: t.admin.nav.settings },
]

export default function AdminLayout() {
  const admin = useAdmin()
  if (admin.loading) return <div className="flex min-h-dvh items-center justify-center bg-surface text-ink"><Spinner /></div>
  if (!admin.isAdmin) return <Navigate to="/admin/login" replace />
  const email = admin.user?.email ?? ''
  return (
    <div className="min-h-dvh bg-surface text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-white p-4 lg:flex">
        <div className="px-2 py-3"><Logo size={36} dark={false} sub="Live quiz" /></div>
        <nav className="mt-6 flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink key={n.to} end={n.end} to={n.to}
              className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'text-white shadow-[var(--glow)]' : 'text-[#4A4E69] hover:bg-surface'}`}
              style={({ isActive }) => (isActive ? { background: 'var(--grad)' } : undefined)}>
              <n.icon className="h-[18px] w-[18px]" />{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-xl border border-line p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: 'var(--grad)' }}>{email[0]?.toUpperCase()}</span>
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-muted">{email}</span>
          <button className="btn btn-ghost-dark btn-icon" onClick={() => void logout()} aria-label={t.admin.logout} title={t.admin.logout}><LogOut className="h-4 w-4" /></button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white/85 px-4 py-3 backdrop-blur lg:hidden">
        <Logo size={30} dark={false} />
        <button className="btn btn-ghost-dark btn-icon" onClick={() => void logout()} aria-label={t.admin.logout}><LogOut className="h-4 w-4" /></button>
      </header>

      <div className="pb-24 lg:pb-0 lg:pl-64">
        <Outlet context={admin} />
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.map((n) => (
          <NavLink key={n.to} end={n.end} to={n.to} className={({ isActive }) => `flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${isActive ? 'text-brand' : 'text-muted'}`}>
            <n.icon className="h-5 w-5" />{n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
