import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Award, BookOpen, Flame, History, Layers, Play, Search, Sparkles, Star, Target, Trophy } from 'lucide-react'
import { listCatalog, myAttempts, myPlays, ratingStats, useAccount, type Attempt, type CatalogItem } from '../../lib/account'
import { fmtDateTime } from '../../lib/format'
import { catLabel, t } from '../../i18n/az'
import { Spinner } from '../../components/ui'
import { EmptyState, PctBadge, Segmented } from '../../components/kit'
import { SectionTitle, StudentShell } from '../../components/StudentShell'
import { MyClasses } from './MyClasses'
import { computeGamify, type Gamify } from '../../lib/gamify'

const A = t.acct
const L2 = t.learn2
const pct = (a: Pick<Attempt, 'correct' | 'total'>) => (a.total ? Math.round((a.correct / a.total) * 100) : 0)

/** Tələbə portalı: irəliləyiş, siniflər, ictimai kataloq və tarixçə. */
export default function Learn() {
  const { loading, user, profile } = useAccount()
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
  const g = useMemo(() => computeGamify(attempts, plays), [attempts, plays])

  // sinif linki (?join=KOD) giriş/qeydiyyatdan sonra da itməsin
  try { const j = new URLSearchParams(location.search).get('join'); if (j) sessionStorage.setItem('jabr.join', j) } catch { /* noop */ }
  if (loading) return <div className="bg-app flex min-h-dvh items-center justify-center"><Spinner /></div>
  if (!user) return <Navigate to={`/start?next=${encodeURIComponent('/learn' + location.search)}`} replace />
  if (!profile?.onboarded) return <Navigate to="/onboarding" replace />

  const avg = attempts.length ? Math.round(attempts.reduce((s, a) => s + pct(a), 0) / attempts.length) : 0
  const top = attempts.length ? Math.max(...attempts.map(pct)) : 0
  const last = attempts[0]
  return (
    <StudentShell>
      <Hero name={profile.firstName} g={g} stats={[{ icon: History, label: A.attempts, v: String(attempts.length) }, { icon: Target, label: A.avg, v: `${avg}%` }, { icon: Award, label: A.best, v: `${top}%` }]}
        cta={last ? <Link to={`/learn/${last.quizId}`} className="btn btn-primary"><Play className="fill-current" />{L2.continue}: <span className="max-w-48 truncate">{last.quizTitle}</span></Link>
          : <a href="#catalog" className="btn btn-primary"><Sparkles />{L2.explore}</a>} />

      <Badges g={g} />

      <MyClasses name={`${profile.firstName} ${profile.lastName}`.trim()} email={user.email ?? ''} />

      <section id="catalog" className="scroll-mt-20">
        <SectionTitle icon={BookOpen} aside={
          <label className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input className="input pl-9" placeholder={A.search} value={q} onChange={(e) => setQ(e.target.value)} aria-label={A.search} />
          </label>
        }>{A.catalog}</SectionTitle>
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <div className="-mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-thin">
            {['', ...tags].map((x) => <button key={x || 'all'} onClick={() => setTag(x)} aria-pressed={tag === x} className={`chip shrink-0 py-1.5 ${tag === x ? 'chip-brand' : 'chip-muted hover:text-fg'}`}>{x ? catLabel(x) : A.all}</button>)}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select className="input h-9 min-h-9 w-auto py-0 text-sm" value={level} onChange={(e) => setLevel(e.target.value)} aria-label={A.difficulty}>
              <option value="">{A.difficulty}: {A.all}</option>
              {(['easy', 'medium', 'hard'] as const).map((l) => <option key={l} value={l}>{A.levelsQ[l]}</option>)}
            </select>
            <Segmented size="sm" value={sort} onChange={setSort} options={[{ value: 'new', label: t.rating.sortNew }, { value: 'top', label: t.rating.sortTop }]} />
          </div>
        </div>
        {!items ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-52" />)}</div>
          : shown.length === 0 ? <EmptyState icon={Search} title={A.emptyCatalog} />
          : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((i, n) => {
                const r = ratings.get(i.id)
                const color = i.coverColor ?? '#F0262F'
                return (
                  <motion.article key={i.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(n, 9) * 0.03 }} className="card card-hover group flex flex-col overflow-hidden">
                    <Link to={`/learn/${i.id}`} className="relative flex h-24 items-center gap-3 overflow-hidden px-5" style={{ background: `radial-gradient(120% 140% at 0% 0%, ${color}50, transparent 62%)` }}>
                      <span className="pointer-events-none absolute -right-3 -top-5 select-none text-[96px] leading-none opacity-[.12] transition group-hover:scale-110">{i.coverEmoji ?? '🎯'}</span>
                      <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 text-2xl shadow-lg" style={{ background: `${color}33` }}>{i.coverEmoji ?? '🎯'}</span>
                      {r && r.count > 0 && <span className="chip relative ml-auto bg-black/30 text-amber-200" aria-label={t.rating.avg(r.avg, r.count)}><Star className="h-3 w-3 fill-current" />{r.avg.toFixed(1)}<span className="text-muted">({r.count})</span></span>}
                    </Link>
                    <div className="flex flex-1 flex-col gap-2 border-t border-line p-5">
                      <h3 className="font-sans text-[15px] font-semibold leading-snug">{i.title}</h3>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="chip chip-muted">{A.questions(i.questionCount)}</span>
                        <span className={`chip ${i.level === 'hard' ? 'chip-bad' : i.level === 'easy' ? 'chip-ok' : 'chip-warn'}`}>{A.levelsQ[i.level ?? 'medium']}</span>
                        {i.category && <span className="chip chip-muted">{catLabel(i.category)}</span>}
                      </div>
                      {i.description && <p className="line-clamp-2 text-sm text-muted">{i.description}</p>}
                      <div className="mt-auto flex items-center gap-2 pt-2">
                        {best.has(i.id) && <span className="mr-auto flex items-center gap-1.5 whitespace-nowrap text-xs text-muted">{A.best} <PctBadge pct={best.get(i.id)!} /></span>}
                        <Link to={`/learn/${i.id}/cards`} className={`btn btn-secondary btn-sm ${best.has(i.id) ? '' : 'ml-auto'}`}><Layers />{t.cards.open}</Link>
                        <Link to={`/learn/${i.id}`} className="btn btn-primary btn-sm"><Play className="fill-current" />{best.has(i.id) ? A.again : A.start}</Link>
                      </div>
                    </div>
                  </motion.article>
                )
              })}
            </div>
          )}
      </section>

      <section>
        <SectionTitle icon={History}>{L2.history}</SectionTitle>
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div className="card overflow-hidden">
            <h3 className="flex items-center gap-2 border-b border-line px-5 py-3.5 font-sans text-sm font-semibold"><Trophy className="h-4 w-4 text-amber-300" />{A.liveGames}</h3>
            {plays.length === 0 ? <p className="px-5 py-6 text-sm text-muted">{A.noLive}</p> : (
              <ul className="divide-y divide-line">
                {plays.slice(0, 8).map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{p.title}</span><span className="text-xs text-muted">{p.at ? fmtDateTime(p.at.toDate()) : ''}</span></span>
                    <span className={`chip ${p.rank <= 3 ? 'chip-warn' : 'chip-muted'} tabular`}>{p.rank <= 3 ? ['🥇', '🥈', '🥉'][p.rank - 1] : '#'}{A.rankOf(p.rank, p.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card overflow-hidden">
            <h3 className="flex items-center gap-2 border-b border-line px-5 py-3.5 font-sans text-sm font-semibold"><Target className="h-4 w-4 text-orange-300" />{A.recent}</h3>
            {attempts.length === 0 ? <p className="px-5 py-6 text-sm text-muted">{A.noAttempts}</p> : (
              <ul className="divide-y divide-line">
                {attempts.slice(0, 8).map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{a.quizTitle}</span><span className="text-xs text-muted">{a.at ? fmtDateTime(a.at.toDate()) : ''} · {a.correct}/{a.total}</span></span>
                    <PctBadge pct={pct(a)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </StudentShell>
  )
}

/** Salamlama + səviyyə halqası + seriya + qısa göstəricilər. */
function Hero({ name, g, stats, cta }: { name: string; g: Gamify; stats: { icon: typeof History; label: string; v: string }[]; cta: React.ReactNode }) {
  const G = t.gamify
  const frac = Math.min(1, (g.xp - g.levelFrom) / Math.max(1, g.levelTo - g.levelFrom))
  const R = 46, C = 2 * Math.PI * R
  return (
    <section className="card hairline-top relative grid gap-6 overflow-hidden p-6 sm:p-8 lg:grid-cols-[1fr_auto]">
      <span className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-25 blur-3xl" style={{ background: 'var(--grad)' }} />
      <div className="relative flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{A.learnHello(name)}</h1>
          <p className="mt-1.5 max-w-xl text-fg2">{A.learnSub}</p>
        </div>
        <div className="flex flex-wrap gap-2">{cta}</div>
        <div className="mt-2 grid max-w-lg grid-cols-3 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="raised px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted"><s.icon className="h-3.5 w-3.5" />{s.label}</p>
              <p className="mt-0.5 font-display text-xl font-extrabold tabular">{s.v}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="relative flex items-center gap-6 lg:flex-col lg:justify-center lg:gap-4">
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 110 110" className="h-full w-full -rotate-90" aria-hidden>
            <defs><linearGradient id="lvl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#EE1D2C" /><stop offset="1" stopColor="#FF8A1A" /></linearGradient></defs>
            <circle cx="55" cy="55" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="9" />
            <motion.circle cx="55" cy="55" r={R} fill="none" stroke="url(#lvl)" strokeWidth="9" strokeLinecap="round" strokeDasharray={C}
              initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - frac) }} transition={{ duration: 1, ease: 'easeOut' }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center" role="img" aria-label={`${G.level(g.level)} · ${G.xp(g.xp)}`}>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">{L2.level}</span>
            <span className="font-display text-4xl font-black leading-none">{g.level}</span>
            <span className="mt-0.5 text-[11px] font-semibold text-orange-300 tabular">{G.xp(g.xp)}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1 lg:items-center lg:text-center">
          <p className="flex items-center gap-1.5 font-semibold"><Flame className={`h-5 w-5 ${g.streak ? 'text-orange-400' : 'text-muted'}`} />{G.streak(g.streak)}</p>
          <p className="text-xs text-muted">{g.today ? L2.todayDone : G.practiceToday}</p>
          <p className="text-xs text-muted">{G.toNext(g.levelTo - g.xp)}</p>
        </div>
      </div>
    </section>
  )
}

function Badges({ g }: { g: Gamify }) {
  const G = t.gamify
  const earned = g.badges.filter((b) => b.earned).length
  return (
    <section>
      <SectionTitle icon={Award} aside={<span className="chip chip-muted">{L2.badgesEarned(earned, g.badges.length)}</span>}>{G.badges}</SectionTitle>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12">
        {g.badges.map((b) => (
          <li key={b.id} title={G.names[b.id]} aria-label={`${G.names[b.id]}${b.earned ? ' ✓' : ''}`}
            className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition ${b.earned ? 'border-orange-400/25 bg-gradient-to-b from-orange-500/[.12] to-transparent' : 'border-line bg-white/[.02]'}`}>
            <span className={`text-2xl ${b.earned ? '' : 'opacity-25 grayscale'}`}>{b.emoji}</span>
            <span className={`text-[11px] font-medium leading-tight ${b.earned ? 'text-fg2' : 'text-muted/60'}`}>{G.names[b.id]}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
