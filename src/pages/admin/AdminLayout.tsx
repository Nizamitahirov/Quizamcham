import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { logout, useAdmin } from '../../firebase/auth'
import { t } from '../../i18n/az'
import { Spinner } from '../../components/ui'
import { AboutButton } from '../../components/About'

export default function AdminLayout() {
  const admin = useAdmin()
  if (admin.loading) return <div className="flex min-h-dvh items-center justify-center bg-deep"><Spinner /></div>
  if (!admin.isAdmin) return <Navigate to="/admin/login" replace />
  const link = ({ isActive }: { isActive: boolean }) => `rounded-xl px-3 py-2 font-extrabold ${isActive ? 'bg-white text-ink' : 'text-white/85 hover:bg-white/10'}`
  return (
    <div className="min-h-dvh bg-slate-100 text-ink">
      <header className="sticky top-0 z-30 bg-deep text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2">
          <span className="font-display mr-4 text-xl">🎯 {t.app.name}</span>
          <nav className="flex gap-1">
            <NavLink end to="/admin" className={link}>{t.admin.nav.quizzes}</NavLink>
            <NavLink to="/admin/games" className={link}>{t.admin.nav.games}</NavLink>
            <NavLink to="/admin/settings" className={link}>{t.admin.nav.settings}</NavLink>
          </nav>
          <span className="ml-auto hidden text-sm opacity-70 sm:inline">{admin.user?.email}</span>
          <AboutButton className="text-white" />
          <button className="btn btn-ghost min-h-10 py-1 text-sm" onClick={() => void logout()}>{t.admin.logout}</button>
        </div>
      </header>
      <Outlet context={admin} />
    </div>
  )
}
