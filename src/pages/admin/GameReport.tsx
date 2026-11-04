import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { loadReport, reportCsv, answerText, type GameReportData } from '../../lib/report'
import { SCORED_TYPES } from '../../lib/scoring'
import { download } from '../../lib/csv'
import { t } from '../../i18n/az'
import { Spinner } from '../../components/ui'
import { ArrowLeft, Download, Star } from 'lucide-react'
import { useFeedback } from '../../lib/feedback'
import { AssignmentPanel } from './AssignmentPanel'
import { Avatar } from '../../components/Avatar'
import { TILE_COLORS } from '../../components/AnswerTile'
import type { Game } from '../../types'

export default function GameReport() {
  const { gameId } = useParams()
  const [game, setGame] = useState<Game | null>(null)
  const [r, setR] = useState<GameReportData | null>(null)
  const fb = useFeedback(gameId ?? '_')
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!gameId) return
    void getDoc(doc(db, 'games', gameId)).then((s) => setGame(s.exists() ? ({ ...(s.data() as Game), id: s.id }) : null))
    void loadReport(gameId).then(setR)
  }, [gameId, tick])
  if (!r || !game) return <div className="p-10"><Spinner /></div>
  const pct = (x: number) => `${Math.round(x * 100)}%`
  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link to="/admin/games" className="btn btn-ghost-dark btn-icon"><ArrowLeft /></Link>
        <div className="mr-auto">
          <h1 className="text-2xl font-bold sm:text-3xl">{t.games.report}</h1>
          <p className="text-sm text-muted">{game.title} · PIN {game.pin} · {game.createdAt?.toDate().toLocaleString('az-AZ')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => download(`quizamcham-${game.pin}.csv`, reportCsv(r))}><Download />{t.host.exportCsv}</button>
      </div>

      {game.settings?.mode === 'assign' && game.phase === 'self' && <AssignmentPanel game={game} onGraded={() => setTick((x) => x + 1)} />}

      <div className="card mb-8 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-[11px] uppercase tracking-wider text-muted">
            <tr>
              <th className="p-3">#</th><th className="p-3">{t.games.player}</th><th className="p-3">{t.games.score}</th><th className="p-3">{t.games.correct}</th><th className="p-3">{t.games.accuracy}</th><th className="p-3">{t.games.avgTime}</th>
              {r.qstats.map((s) => <th key={s.index} className="p-3 text-center" title={s.q.text}>S{s.index + 1}</th>)}
            </tr>
          </thead>
          <tbody>
            {r.players.map((p) => {
              const times = p.history.filter((h) => h.answer != null && h.timeMs != null).map((h) => h.timeMs as number)
              return (
                <tr key={p.uid} className="border-t border-line">
                  <td className="p-3 font-display">{p.rank}</td>
                  <td className="p-3"><span className="flex items-center gap-2"><Avatar avatar={p.avatar} size={28} /><b>{p.firstName} {p.lastName}</b></span></td>
                  <td className="p-3 font-bold">{p.score}</td>
                  <td className="p-3">{p.correctCount} / {r.scoredCount}</td>
                  <td className="p-3">{r.scoredCount ? pct(p.correctCount / r.scoredCount) : '—'}</td>
                  <td className="p-3">{times.length ? `${(times.reduce((a, b) => a + b, 0) / times.length / 1000).toFixed(1)} s` : '—'}</td>
                  {r.qstats.map((s) => {
                    const h = p.history.find((x) => x.q === s.index)
                    const scored = SCORED_TYPES.has(s.q.type)
                    return <td key={s.index} className="p-3 text-center" title={answerText(s.q, h?.answer)}>{!h || h.answer == null ? '·' : scored ? (h.correct ? '✅' : '❌') : '💬'}</td>
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="card mb-8 p-5">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Star className="h-5 w-5 text-amber-500" fill="currentColor" />{t.feedback2.title}</h2>
        {fb.rows.length === 0 ? <p className="text-sm text-muted">{t.feedback2.none}</p> : (
          <>
            <p className="mb-3 text-3xl font-black">{fb.avg.toFixed(1)} <span className="text-base font-semibold text-muted">/ 5 · {t.feedback2.count(fb.rows.length)}</span></p>
            <ul className="flex flex-col gap-2">
              {fb.rows.filter((x) => x.comment).map((x) => <li key={x.uid} className="rounded-xl bg-surface p-3 text-sm"><b>{'★'.repeat(x.rating)}</b> {x.comment} <span className="text-muted">— {x.name}</span></li>)}
            </ul>
          </>
        )}
      </div>

      <h2 className="mb-4 text-xl font-bold">{t.games.questionStats}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {r.qstats.map((s) => {
          const total = Math.max(1, s.answered)
          const scored = SCORED_TYPES.has(s.q.type)
          return (
            <div key={s.index} className="card p-4">
              <p className="mb-1 text-xs font-extrabold uppercase text-muted">S{s.index + 1} · {t.types[s.q.type]}</p>
              <p className="mb-3 font-bold">{s.q.text}</p>
              <div className="mb-3 flex flex-wrap gap-4 text-sm">
                {scored && <span><b>{t.games.accuracy}:</b> {pct(s.accuracy)}</span>}
                <span><b>{t.games.avgTime}:</b> {(s.avgTimeMs / 1000).toFixed(1)} s</span>
                <span><b>{t.games.players}:</b> {s.answered}</span>
              </div>
              {s.q.options.length > 0 && s.q.type !== 'order' ? (
                <div className="flex flex-col gap-1.5">
                  {s.q.options.map((o, i) => {
                    const n = s.distribution[o.id] ?? 0
                    return (
                      <div key={o.id} className="flex items-center gap-2 text-sm">
                        <span className="w-40 truncate">{s.q.correct.includes(o.id) && s.q.type !== 'poll' ? '✅ ' : ''}{o.text}</span>
                        <div className="h-5 flex-1 rounded bg-surface"><div className="h-5 rounded" style={{ width: `${(n / total) * 100}%`, background: TILE_COLORS[i % 6] }} /></div>
                        <span className="w-8 text-right font-bold">{n}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(s.distribution).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, n]) => <span key={k} className="rounded-lg bg-surface px-2 py-1 text-sm">{k} ×{n}</span>)}
                </div>
              )}
              {s.mostWrong && <p className="mt-3 text-sm text-red-700"><b>{t.games.mostWrong}:</b> {s.mostWrong}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
