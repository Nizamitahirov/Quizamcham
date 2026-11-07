import { useEffect, useMemo, useState } from 'react'
import { fmtDayMonth } from '../../lib/format'
import type { Timestamp } from 'firebase/firestore'
import { BarChart3, Brain, Gamepad2, Target, Trophy, Users } from 'lucide-react'
import { listGames } from '../../firebase/db'
import { useOutletContext } from 'react-router-dom'
import { orgGamesScope, scopeUid, visibleGames } from '../../lib/access'
import type { AdminState } from '../../firebase/auth'
import { LOCALE, t } from '../../i18n/az'
import { PageHeader, Spinner } from '../../components/ui'
import { Section } from '../../components/kit'
import type { GameStats, LeaderEntry } from '../../types'

type G = { id: string; hostUid?: string; title?: string; quizId?: string; phase?: string; playerCount?: number; createdAt?: Timestamp; stats?: GameStats | null; leaderboard?: LeaderEntry[] }
const A = t.analytics
const WEEK = 7 * 86_400_000

export default function Analytics() {
  const admin = useOutletContext<AdminState>()
  const [games, setGames] = useState<G[] | null>(null)
  useEffect(() => { void listGames(500, scopeUid(admin), orgGamesScope(admin)).then((g) => setGames(visibleGames(admin, g as G[]).filter((x) => x.phase === 'finished'))).catch(() => setGames([])) }, [admin])

  const data = useMemo(() => {
    const gs = games ?? []
    const players = gs.reduce((a, g) => a + (g.stats?.players ?? g.playerCount ?? 0), 0)
    const accs = gs.filter((g) => g.stats).map((g) => g.stats!.avgAccuracy)
    // həftələr (bazar ertəsi başlanğıcı)
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const monday = new Date(now.getTime() - ((now.getDay() + 6) % 7) * 86_400_000)
    const weeks = Array.from({ length: 12 }, (_, i) => ({ start: new Date(monday.getTime() - (11 - i) * WEEK), value: 0, games: 0 }))
    gs.forEach((g) => {
      const ms = g.createdAt?.toMillis(); if (!ms) return
      const w = weeks.find((x) => ms >= x.start.getTime() && ms < x.start.getTime() + WEEK)
      if (w) { w.value += g.stats?.players ?? g.playerCount ?? 0; w.games++ }
    })
    const byQuiz = new Map<string, { key: string; title: string; runs: number; people: number; acc: number[] }>()
    gs.forEach((g) => {
      const k = g.quizId ?? g.title ?? g.id
      const r = byQuiz.get(k) ?? { key: k, title: g.title ?? '—', runs: 0, people: 0, acc: [] }
      r.runs++; r.people += g.stats?.players ?? g.playerCount ?? 0; if (g.stats) r.acc.push(g.stats.avgAccuracy)
      byQuiz.set(k, r)
    })
    const people = new Map<string, { key: string; name: string; played: number; points: number; best: number }>()
    gs.forEach((g) => (g.leaderboard ?? []).forEach((e) => {
      // eyni adlı fərqli insanları birləşdirməmək üçün ad + avatar
      const k = `${e.name.toLocaleLowerCase('az-AZ')}|${e.avatar?.style}:${e.avatar?.seed}`
      const r = people.get(k) ?? { key: k, name: e.name, played: 0, points: 0, best: Infinity }
      r.played++; r.points += e.score; r.best = Math.min(r.best, e.rank)
      people.set(k, r)
    }))
    const hardest = gs.filter((g) => g.stats?.hardest).map((g) => ({ game: g.title ?? '', ...g.stats!.hardest! })).sort((a, b) => a.accuracy - b.accuracy).slice(0, 8)
    return {
      count: gs.length, players, accuracy: accs.length ? accs.reduce((a, b) => a + b, 0) / accs.length : 0, avgPlayers: gs.length ? players / gs.length : 0,
      weeks, byQuiz: [...byQuiz.values()].sort((a, b) => b.runs - a.runs),
      top: [...people.values()].filter((p) => p.played > 1).sort((a, b) => b.played - a.played || b.points - a.points).slice(0, 10), hardest,
    }
  }, [games])

  if (!games) return <div className="p-10"><Spinner /></div>
  const pct = (x: number) => `${Math.round(x * 100)}%`
  const kpis = [
    { icon: Gamepad2, label: A.games, value: data.count },
    { icon: Users, label: A.players, value: data.players },
    { icon: Target, label: A.accuracy, value: pct(data.accuracy) },
    { icon: Users, label: A.avgPlayers, value: data.avgPlayers.toFixed(1) },
  ]
  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-8">
      <PageHeader title={A.title} sub={A.sub} />
      {data.count === 0 ? <p className="card p-8 text-center text-muted">{A.empty}</p> : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="card p-5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-brand" style={{ background: 'var(--grad-soft)' }}><k.icon className="h-5 w-5" /></div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted">{k.label}</div>
                <div className="mt-1 text-3xl font-black tracking-tight tabular-nums">{k.value}</div>
              </div>
            ))}
          </div>
          <Section icon={BarChart3} title={A.weekly} sub={A.weeklySub}><WeeklyColumns weeks={data.weeks} /></Section>
          <div className="grid gap-4 lg:grid-cols-2">
            <Section icon={Gamepad2} title={A.byQuiz}>
              <table className="w-full text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wider text-muted"><tr><th className="pb-2">{A.quiz}</th><th className="pb-2 text-right">{A.runs}</th><th className="pb-2 text-right">{A.people}</th><th className="pb-2 text-right">{A.acc}</th></tr></thead>
                <tbody>{data.byQuiz.map((q) => (
                  <tr key={q.key} className="border-t border-line"><td className="py-2 pr-2 font-semibold">{q.title}</td><td className="py-2 text-right tabular-nums">{q.runs}</td><td className="py-2 text-right tabular-nums">{q.people}</td>
                    <td className="py-2 text-right tabular-nums">{q.acc.length ? pct(q.acc.reduce((a, b) => a + b, 0) / q.acc.length) : '—'}</td></tr>
                ))}</tbody>
              </table>
            </Section>
            <Section icon={Trophy} title={A.top} sub={A.topSub}>
              {data.top.length === 0 ? <p className="text-sm text-muted">—</p> : (
                <table className="w-full text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wider text-muted"><tr><th className="pb-2">{A.name}</th><th className="pb-2 text-right">{A.played}</th><th className="pb-2 text-right">{A.points}</th><th className="pb-2 text-right">{A.best}</th></tr></thead>
                  <tbody>{data.top.map((p) => (
                    <tr key={p.key} className="border-t border-line"><td className="py-2 font-semibold">{p.name}</td><td className="py-2 text-right tabular-nums">{p.played}</td><td className="py-2 text-right tabular-nums">{p.points.toLocaleString(LOCALE)}</td><td className="py-2 text-right tabular-nums">#{p.best}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </Section>
          </div>
          <Section icon={Brain} title={A.hardest} sub={A.hardestSub}>
            <ul className="flex flex-col gap-2">
              {data.hardest.map((h, i) => (
                <li key={i} className="flex items-center gap-3 rounded-xl bg-surface p-3 text-sm">
                  <span className="w-12 shrink-0 text-right font-black tabular-nums text-ink">{pct(h.accuracy)}</span>
                  <span className="min-w-0 flex-1"><span className="block font-semibold">{h.text}</span><span className="text-xs text-muted">{h.game}</span></span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}
    </div>
  )
}

/** Tək seriyalı sütun qrafiki: nazik sütunlar, 4px yuvarlaq uclar, səssiz tor, hover-də tooltip. */
function WeeklyColumns({ weeks }: { weeks: { start: Date; value: number; games: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...weeks.map((w) => w.value))
  const ticks = [0, Math.ceil(max / 2), max]
  const fmt = (d: Date) => fmtDayMonth(d)
  return (
    <div>
      <div className="relative flex h-56 gap-[2px] pl-8">
        {ticks.map((v) => (
          <div key={v} className="pointer-events-none absolute left-8 right-0 border-t border-line" style={{ bottom: `${(v / max) * 100}%` }}>
            <span className="absolute -left-8 -translate-y-1/2 text-[11px] tabular-nums text-muted">{v}</span>
          </div>
        ))}
        {weeks.map((w, i) => (
          <div key={i} className="relative flex flex-1 items-end justify-center" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0}
            aria-label={`${A.weekOf(fmt(w.start))}: ${w.value} ${A.people}, ${w.games} ${A.runs}`}>
            <div className="w-full max-w-7 rounded-t-[4px] transition-opacity" style={{ height: `${(w.value / max) * 100}%`, minHeight: w.value ? 3 : 0, background: '#E8202A', opacity: hover === null || hover === i ? 1 : 0.45 }} />
            {hover === i && (
              <div className="pointer-events-none absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-lg bg-ink px-3 py-2 text-xs text-white shadow-lg">
                <div className="font-bold">{A.weekOf(fmt(w.start))}</div>
                <div className="tabular-nums">{w.value} {A.people} · {w.games} {A.runs}</div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-[2px] pl-8 text-[10px] text-muted">
        {weeks.map((w, i) => <span key={i} className="flex-1 text-center">{i % 2 === 0 ? fmt(w.start) : ''}</span>)}
      </div>
    </div>
  )
}
