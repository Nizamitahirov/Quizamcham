import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Ban, Crown, Menu, BarChart3, BookOpen, Building2, Gauge, GraduationCap, Sparkles, History, LayoutDashboard, ListChecks, LogOut, Music2, ScrollText, Settings, UserRound, Users } from 'lucide-react'
import { ForcePasswordChange } from '../../components/ForcePasswordChange'
import type { PermKey } from '../../lib/roles'
import { useEffect, useState } from 'react'
import { loadProfile } from '../../firebase/db'
import type { TrainerProfile } from '../../types'
import { logout, useAdmin, type AdminState } from '../../firebase/auth'
import { LOCALE, t } from '../../i18n/az'
import { Spinner } from '../../components/ui'
import { Logo } from '../../components/Brand'
import { AccountMenu, type MenuLink } from '../../components/AccountMenu'

type NavItem = { to: string; end?: boolean; icon: typeof Settings; label: string; perm?: PermKey }
const GROUPS: { label: string; items: NavItem[] }[] = [
  { label: t.shell.content, items: [
    { to: '/admin', end: true, icon: LayoutDashboard, label: t.admin.nav.dashboard },
    { to: '/admin/quizzes', icon: ListChecks, label: t.admin.nav.quizzes },
    { to: '/admin/games', icon: History, label: t.admin.nav.games },
  ] },
  { label: t.shell.teaching, items: [
    { to: '/admin/classes', icon: GraduationCap, label: t.cls.nav },
    { to: '/admin/courses', icon: BookOpen, label: t.course.nav },
    { to: '/admin/analytics', icon: BarChart3, label: t.admin.nav.analytics },
  ] },
  { label: t.shell.manage, items: [
    { to: '/admin/profile', icon: UserRound, label: t.admin.nav.profile },
    { to: '/admin/team', icon: Users, label: t.admin.nav.team, perm: 'trainers' },
    { to: '/admin/sounds', icon: Music2, label: t.admin.nav.sounds, perm: 'settings' },
    { to: '/admin/settings', icon: Settings, label: t.admin.nav.settings, perm: 'settings' },
    { to: '/admin/console', icon: Gauge, label: t.admin.nav.console, perm: 'console' },
    { to: '/admin/logs', icon: ScrollText, label: t.admin.nav.logs, perm: 'logs' },
  ] },
]
const MOBILE = ['/admin', '/admin/quizzes', '/admin/classes', '/admin/games']

function useNav(admin: AdminState) {
  const extra: NavItem[] = [
    ...(admin.org.role === 'owner' ? [{ to: '/admin/org', icon: Building2, label: t.acct.org.nav }] : []),
    ...(admin.plan.selfServe && admin.org.role !== 'member' ? [{ to: '/account', icon: UserRound, label: t.acct.myAccount }] : []),
  ]
  const ok = (n: NavItem) => !n.perm || admin.perms[n.perm]
  return GROUPS.map((g, i) => ({ ...g, items: [...g.items, ...(i === 2 ? extra : [])].filter(ok) }))
}

function NavItemLink({ n, onClick }: { n: NavItem; onClick?: () => void }) {
  return (
    <NavLink end={n.end} to={n.to} onClick={onClick}
      className={({ isActive }) => `group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium transition ${isActive ? 'bg-white/[.07] text-fg' : 'text-muted hover:bg-white/[.04] hover:text-fg'}`}>
      {({ isActive }) => (
        <>
          {isActive && <motion.span layoutId="nav-active" className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-full" style={{ background: 'var(--grad)' }} />}
          <n.icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-orange-300' : ''}`} />{n.label}
        </>
      )}
    </NavLink>
  )
}

function PlanCard({ admin }: { admin: AdminState }) {
  if (!admin.plan.selfServe) return null
  const tier = admin.plan.tier
  return (
    <Link to="/pricing" className="relative mb-3 block overflow-hidden rounded-xl border border-line bg-white/[.03] p-3 transition hover:border-line-strong">
      <span className="pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full opacity-30 blur-2xl" style={{ background: 'var(--grad)' }} />
      <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted"><Crown className="h-3.5 w-3.5 text-amber-300" />{t.shell.plan}</span>
      <span className="mt-1 flex items-center justify-between gap-2">
        <span className="font-semibold">{t.acct.plans[tier]?.title ?? tier}</span>
        {tier !== 'business' && <span className="chip chip-brand">{t.shell.upgrade}</span>}
      </span>
    </Link>
  )
}

function useAdminMenu(admin: AdminState, prof: TrainerProfile | null) {
  const email = admin.user?.email ?? ''
  const role = admin.role === 'super' ? t.team.super : admin.role === 'admin' ? t.team.admin : t.team.trainer
  const links: MenuLink[] = [
    { to: '/admin/profile', label: t.menu.profile, icon: UserRound },
    { to: '/avatar', label: t.menu.avatar, icon: Sparkles, hint: '3D' },
    { to: '/learn', label: t.menu.learn, icon: BookOpen },
    ...(admin.plan.selfServe && admin.org.role !== 'member' ? [{ to: '/account', label: t.acct.myAccount, icon: Settings }] : []),
  ]
  return { name: prof?.name || admin.user?.displayName || email.split('@')[0], email, photo: prof?.photoUrl || admin.user?.photoURL || null, badge: admin.plan.selfServe ? `${role} · ${t.acct.plans[admin.plan.tier]?.title ?? ''}` : role, links }
}

export default function AdminLayout() {
  const admin = useAdmin()
  const [prof, setProf] = useState<TrainerProfile | null>(null)
  const [sheet, setSheet] = useState(false)
  const loc = useLocation()
  const uid = admin.user?.uid
  useEffect(() => { if (uid) void loadProfile(uid).then(setProf) }, [uid])
  useEffect(() => { setSheet(false) }, [loc.pathname])
  const groups = useNav(admin)
  const menu = useAdminMenu(admin, prof)
  if (admin.loading) return <div className="bg-app flex min-h-dvh items-center justify-center"><Spinner /></div>
  if (admin.disabled) {
    return (
      <div className="bg-app flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 text-red-300"><Ban className="h-7 w-7" /></span>
        <h1 className="text-2xl font-black">{t.access.restrictedTitle}</h1>
        <p className="max-w-md text-muted">{t.access.restrictedText}</p>
        <button className="btn btn-primary" onClick={() => void logout()}><LogOut className="h-4 w-4" />{t.admin.logout}</button>
      </div>
    )
  }
  if (!admin.isAdmin) return <Navigate to="/admin/login" replace />
  const all = groups.flatMap((g) => g.items)
  return (
    <div className="bg-app min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-[#0B0C19]/90 px-3 py-4 backdrop-blur-xl lg:flex">
        <Link to="/admin" className="px-3 py-2"><Logo size={32} dark sub="Live quiz" /></Link>
        <nav className="mt-6 flex flex-1 flex-col gap-5 overflow-y-auto px-3 scrollbar-thin">
          {groups.filter((g) => g.items.length).map((g) => (
            <div key={g.label}>
              <p className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[.12em] text-muted/70">{g.label}</p>
              <div className="flex flex-col gap-0.5">{g.items.map((n) => <NavItemLink key={n.to} n={n} />)}</div>
            </div>
          ))}
        </nav>
        <div className="px-0 pt-3">
          <PlanCard admin={admin} />
          <AccountMenu uid={uid} {...menu} wide placement="up" />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-[#0B0C19]/85 px-4 py-2.5 backdrop-blur-xl lg:hidden">
        <Link to="/admin"><Logo size={26} dark /></Link>
        <div className="ml-auto"><AccountMenu uid={uid} {...menu} compact /></div>
      </header>

      <div className="pb-24 lg:pb-0 lg:pl-64">
        {admin.plan.selfServe && <PlanBanner plan={admin.plan} />}
        <main className="fade-up" key={loc.pathname.split('/').slice(0, 3).join('/')}><Outlet context={admin} /></main>
        {admin.mustChangePassword && admin.user && <ForcePasswordChange user={admin.user} />}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-[#0B0C19]/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        {MOBILE.map((to) => all.find((n) => n.to === to)).filter(Boolean).map((n) => (
          <NavLink key={n!.to} end={n!.end} to={n!.to} className={({ isActive }) => `flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-semibold ${isActive ? 'text-orange-300' : 'text-muted'}`}>
            {n && <n.icon className="h-5 w-5" />}<span className="max-w-full truncate px-1">{n!.label}</span>
          </NavLink>
        ))}
        <button onClick={() => setSheet(true)} className={`flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-semibold ${sheet ? 'text-orange-300' : 'text-muted'}`} aria-haspopup="dialog">
          <Menu className="h-5 w-5" />{t.shell.more}
        </button>
      </nav>

      <AnimatePresence>
        {sheet && (
          <motion.div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheet(false)}>
            <motion.div role="dialog" aria-label={t.shell.menu} className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-line-strong bg-panel px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 36 }} onClick={(e) => e.stopPropagation()}>
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
              {groups.filter((g) => g.items.length).map((g) => (
                <div key={g.label} className="mb-4">
                  <p className="mb-2 px-1 text-[10.5px] font-semibold uppercase tracking-[.12em] text-muted/70">{g.label}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {g.items.map((n) => (
                      <NavLink key={n.to} end={n.end} to={n.to} className={({ isActive }) => `flex flex-col items-center gap-2 rounded-2xl border p-3 text-center text-xs font-semibold ${isActive ? 'border-orange-400/40 bg-orange-500/10 text-fg' : 'border-line bg-white/[.03] text-fg2'}`}>
                        <n.icon className="h-5 w-5" />{n.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
              <PlanCard admin={admin} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Özü qeydiyyatdan keçən təlimçi üçün sınaq / lisenziya zolağı. */
function PlanBanner({ plan }: { plan: AdminState['plan'] }) {
  const [, tick] = useState(0)
  useEffect(() => { const id = setInterval(() => tick((x) => x + 1), 60_000); return () => clearInterval(id) }, [])
  const left = plan.endsAt ? plan.endsAt.getTime() - Date.now() : 0
  const A = t.acct
  if (plan.licensed && plan.active && left > 7 * 86_400_000) return null
  const ended = !plan.active || left <= 0
  const text = ended ? (plan.licensed ? A.licenseEnded : A.trialEnded)
    : plan.licensed ? A.licensedUntil(plan.endsAt!.toLocaleDateString(LOCALE)) : A.trialLeft(Math.floor(left / 86_400_000), Math.floor((left % 86_400_000) / 3_600_000))
  return (
    <div className={`flex flex-wrap items-center gap-3 border-b px-4 py-2.5 text-sm font-semibold sm:px-8 ${ended ? 'border-red-500/25 bg-red-500/10 text-red-300' : 'border-amber-500/25 bg-amber-500/10 text-amber-300'}`} role="status">
      <Sparkles className="h-4 w-4 shrink-0" /><span className="flex-1">{text}</span>
      <Link to="/pricing#request" className="btn btn-primary btn-sm">{A.getLicense}</Link>
    </div>
  )
}
