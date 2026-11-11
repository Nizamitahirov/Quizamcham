import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Award, BookOpen, History, Layers, LogOut, Play, Search, Target, Trophy, UserRound } from 'lucide-react'
import { listCatalog, myAttempts, myPlays, ratingStats, useAccount, type Attempt, type CatalogItem } from '../../lib/account'
import { logout } from '../../firebase/auth'
import { fmtDateTime } from '../../lib/format'
import { catLabel, t } from '../../i18n/az'
import { FuturisticBg } from '../../components/FuturisticBg'
import { Logo } from '../../components/Brand'
import { LangSwitch } from '../../components/LangSwitch'
import { Spinner } from '../../components/ui'
import { MyClasses } from './MyClasses'
import { computeGamify } from '../../lib/gamify'

const A = t.acct
const pct = (a: Pick<Attempt, 'correct' | 'total'>) => (a.total ? Math.round((a.correct / a.total) * 100) : 0)

/** Tələbə portalı: ictimai kataloq + öz nəticələri. */
export default function Learn() {
  const { loading, user, profile } = useAccount()
  const nav = useNavigate()
  const [items, setItems] = useState<CatalogItem[] | null>(null)
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [q, setQ] = useState('')
  const [tag, setTag] = useState('')
  const [level, setLevel] = useState('')
  const [plays, setPlays] = useState<Awaited<ReturnType<typeof myPlays>>>([])
  const [ratings, setRatings] = useState<Map<string, { avg: number; count: number }>>(new Map())
  const [sort, setSort] = useState<'new' | 'top'>('new')
  useEffect(() => {
    if (!user) return
    void listCatalog().then(setItems).catch(() => setItems([]))
    void myAttempts(user.uid).then(setAttempts).catch(() => {})
    void myPlays(user.uid).then(setPlays).catch(() => {})
    void ratingStats().then(setRatings).catch(() => {})
  }, [user])
  const tags = useMemo(() => [...new Set((items ?? []).map((i) => i.category).filter(Boolean) as string[])].slice(0, 12), [items])
  const shown0 = useMemo(() => (items ?? []).filter((i) => (!tag || i.category === tag) && (!level || (i.level ?? 'medium') === level) && (!q || `${i.title} ${i.description ?? ''}`.toLowerCase().includes(q.toLowerCase()))), [items, q, tag, level])
  const shown = useMemo(() => (sort === 'top' ? [...shown0].sort((a, b) => (ratings.get(b.id)?.avg ?? 0) - (ratings.get(a.id)?.avg ?? 0)) : shown0), [shown0, sort, ratings])
  const best = useMemo(() => { const m = new Map<string, number>(); attempts.forEach((a) => m.set(a.quizId, Math.max(m.get(a.quizId) ?? 0, pct(a)))); return m }, [attempts])

  // sinif linki (?join=KOD) giriş/qeydiyyatdan sonra da itməsin
  try { const j = new URLSearchParams(location.search).get('join'); if (j) sessionStorage.setItem('jabr.join', j) } catch { /* noop */ }
  if (loading) return <div className="flex min-h-dvh items-center justify-center bg-night"><Spinner /></div>
  if (!user) return <Navigate to={`/start?next=${encodeURIComponent('/learn' + location.search)}`} replace />
  if (!profile?.onboarded) return <Navigate to="/onboarding" replace />

  const avg = attempts.length ? Math.round(attempts.reduce((s, a) => s + pct(a), 0) / attempts.length) : 0
  const top = attempts.length ? Math.max(...attempts.map(pct)) : 0
  return (
    <div className="noise relative min-h-dvh overflow-hidden bg-night text-white">
      <FuturisticBg floor={false} intensity={0.55} />
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 pt-5 sm:px-8">
        <Link to="/" aria-label={t.app.home}><Logo size={32} /></Link>
        <div className="flex items-center gap-2">
          <LangSwitch />
          <Link to="/account" className="hidden items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3 text-sm font-semibold hover:bg-white/15 sm:flex" title={A.myAccount}>
            {user.photoURL ? <img src={user.photoURL} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: 'var(--grad)' }}>{profile.firstName[0]}</span>}
            {profile.firstName}
          </Link>
          <Link to="/account" className="btn btn-ghost btn-icon sm:hidden" aria-label={A.myAccount}><UserRound className="h-4 w-4" /></Link>
          <button className="btn btn-ghost btn-icon" aria-label={A.signOut} title={A.signOut} onClick={() => void logout().then(() => nav('/'))}><LogOut className="h-4 w-4" /></button>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-8">
        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="glass-strong flex flex-col justify-center gap-2 p-6 sm:p-8">
            <h1 className="text-3xl font-black sm:text-4xl">{A.learnHello(profile.firstName)}</h1>
            <p className="text-white/65">{A.learnSub}</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[{ icon: History, label: A.attempts, v: String(attempts.length) }, { icon: Target, label: A.avg, v: `${avg}%` }, { icon: Award, label: A.best, v: `${top}%` }].map((s) => (
              <div key={s.label} className="glass flex flex-col justify-center gap-1 p-4">
                <s.icon className="h-5 w-5 text-orange-300" />
                <div className="font-display text-3xl font-black tabular-nums">{s.v}</div>
                <div className="text-xs font-semibold text-white/55">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        <GamifyPanel attempts={attempts} plays={plays} />

        <MyClasses name={`${profile.firstName} ${profile.lastName}`.trim()} email={user.email ?? ''} />

        <section>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="flex items-center gap-2 text-xl font-black"><BookOpen className="h-5 w-5 text-orange-300" />{A.catalog}</h2>
            <label className="relative ml-auto w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input className="input-dark h-11 pl-9" placeholder={A.search} value={q} onChange={(e) => setQ(e.target.value)} aria-label={A.search} />
            </label>
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {['', ...tags].map((x) => <button key={x || 'all'} onClick={() => setTag(x)} aria-pressed={tag === x} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${tag === x ? 'text-white' : 'bg-white/5 text-white/65 hover:bg-white/10'}`} style={tag === x ? { background: 'var(--grad)' } : undefined}>{x ? catLabel(x) : A.all}</button>)}
            <select className="input-dark ml-auto h-9 w-auto py-0 text-sm" value={sort} onChange={(e) => setSort(e.target.value as 'new' | 'top')} aria-label={t.rating.sortTop}>
              <option value="new">{t.rating.sortNew}</option><option value="top">{t.rating.sortTop}</option>
            </select>
            <select className="input-dark h-9 w-auto py-0 text-sm" value={level} onChange={(e) => setLevel(e.target.value)} aria-label={A.difficulty}>
              <option value="">{A.difficulty}: {A.all}</option>
              {(['easy', 'medium', 'hard'] as const).map((l) => <option key={l} value={l}>{A.levelsQ[l]}</option>)}
            </select>
          </div>
          {!items ? <Spinner /> : shown.length === 0 ? <p className="glass p-6 text-center text-white/60">{A.emptyCatalog}</p> : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((i) => (
                <div key={i.id} className="glass group flex flex-col gap-3 p-5 transition hover:bg-white/10">
                  <div className="flex items-start gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl" style={{ background: i.coverColor ?? 'var(--grad)' }}>{i.coverEmoji ?? '🎯'}</span>
                    <div className="min-w-0">
                      <h3 className="font-bold leading-snug">{i.title}</h3>
                      <p className="mt-0.5 text-xs text-white/55">{A.questions(i.questionCount)} · {A.levelsQ[i.level ?? 'medium']}{i.category ? ` · ${catLabel(i.category)}` : ''}</p>
                      {(ratings.get(i.id)?.count ?? 0) > 0 && <p className="mt-0.5 text-xs font-bold text-yellow-300" aria-label={t.rating.avg(ratings.get(i.id)!.avg, ratings.get(i.id)!.count)}>★ {ratings.get(i.id)!.avg.toFixed(1)} <span className="font-normal text-white/50">({ratings.get(i.id)!.count})</span></p>}
                    </div>
                  </div>
                  {i.description && <p className="line-clamp-2 text-sm text-white/65">{i.description}</p>}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                    {best.has(i.id) ? <span className="chip bg-green-500/15 text-green-300">{A.best}: {best.get(i.id)}%</span> : <span />}
                    <span className="flex gap-2">
                      <Link to={`/learn/${i.id}/cards`} className="btn btn-ghost btn-sm"><Layers className="h-4 w-4" />{t.cards.open}</Link>
                      <Link to={`/learn/${i.id}`} className="btn btn-primary btn-sm"><Play className="fill-current" />{best.has(i.id) ? A.again : A.start}</Link>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className="glass p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-black"><Trophy className="h-5 w-5 text-orange-300" />{A.liveGames}</h2>
          {plays.length === 0 ? <p className="text-sm text-white/55">{A.noLive}</p> : (
            <ul className="divide-y divide-white/10">
              {plays.slice(0, 10).map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate font-semibold">{p.title}</span>
                  <span className="text-white/50">{p.at ? fmtDateTime(p.at.toDate()) : ''}</span>
                  <span className="font-display font-black tabular-nums">{A.rankOf(p.rank, p.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="glass p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-black"><History className="h-5 w-5 text-orange-300" />{A.recent}</h2>
          {attempts.length === 0 ? <p className="text-sm text-white/55">{A.noAttempts}</p> : (
            <ul className="divide-y divide-white/10">
              {attempts.slice(0, 10).map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate font-semibold">{a.quizTitle}</span>
                  <span className="text-white/50">{a.at ? fmtDateTime(a.at.toDate()) : ''}</span>
                  <span className="font-display w-14 text-right font-black tabular-nums">{pct(a)}%</span>
                  <span className="w-16 text-right text-white/60 tabular-nums">{a.correct}/{a.total}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        </div>
      </main>
    </div>
  )
}

/** XP, səviyyə, gündəlik seriya və nişanlar. */
function GamifyPanel({ attempts, plays }: { attempts: Attempt[]; plays: { score: number; rank: number; at?: Attempt['at'] }[] }) {
  const G = t.gamify
  const g = useMemo(() => computeGamify(attempts, plays), [attempts, plays])
  const frac = Math.min(1, (g.xp - g.levelFrom) / Math.max(1, g.levelTo - g.levelFrom))
  return (
    <section className="glass grid gap-4 p-5 lg:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-display text-2xl font-black">{G.level(g.level)}</span>
          <span className="text-sm font-bold text-orange-300">{G.xp(g.xp)}</span>
          <span className="ml-auto flex items-center gap-1.5 text-sm font-bold"><span aria-hidden>🔥</span>{G.streak(g.streak)}</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(frac * 100)} aria-label={G.toNext(g.levelTo - g.xp)}>
          <div className="h-full rounded-full" style={{ width: `${frac * 100}%`, background: 'var(--grad)' }} />
        </div>
        <p className="mt-1.5 text-xs text-white/55">{G.toNext(g.levelTo - g.xp)}{!g.today && <> · <b className="text-orange-300">{G.practiceToday}</b></>}</p>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-white/50">{G.badges}</p>
        <ul className="flex flex-wrap gap-1.5">
          {g.badges.map((b) => (
            <li key={b.id} title={G.names[b.id]} aria-label={`${G.names[b.id]}${b.earned ? ' ✓' : ''}`}
              className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl ${b.earned ? 'bg-white/15' : 'bg-white/5 opacity-30 grayscale'}`}>{b.emoji}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}

