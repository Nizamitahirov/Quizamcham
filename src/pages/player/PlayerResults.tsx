import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { t } from '../../i18n/az'
import { Avatar } from '../../components/Avatar'
import { AnimatedNumber } from '../../components/AnimatedNumber'
import { burst, celebrate } from '../../components/Confetti'
import { shortName } from '../../lib/nameFilter'
import type { AnswerValue, Game, Player, ReviewItem } from '../../types'

function fmtAnswer(item: ReviewItem, v: AnswerValue | null): string {
  if (v === null || v === undefined) return t.game.noAnswer
  if (Array.isArray(v)) return v.map((id) => item.options.find((o) => o.id === id)?.text ?? id).join(item.type === 'order' ? ' → ' : ', ')
  return String(v)
}

function correctText(item: ReviewItem): string {
  if (item.type === 'type') return (item.accepted ?? []).filter(Boolean).join(' · ')
  if (item.type === 'slider') return String(item.sliderAnswer ?? '')
  return item.correct.map((id) => item.options.find((o) => o.id === id)?.text ?? id).join(item.type === 'order' ? ' → ' : ', ')
}

export default function PlayerResults({ game, player }: { game: Game; player: Player }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const entry = game.leaderboard.find((e) => e.uid === player.uid)
  const rank = entry?.rank ?? player.lastResult?.rank ?? 0
  const scored = game.scoredCount ?? player.history.length
  const accuracy = scored ? Math.round((player.correctCount / scored) * 100) : 0
  const avgTime = useMemo(() => {
    const ts = player.history.filter((h) => h.timeMs != null && h.answer != null).map((h) => h.timeMs as number)
    return ts.length ? ts.reduce((a, b) => a + b, 0) / ts.length / 1000 : 0
  }, [player.history])

  useEffect(() => {
    if (rank === 1) celebrate(5000)
    else if (rank > 0 && rank <= 3) burst(1.4)
  }, [rank])

  const share = async () => {
    const text = t.results.shareText(shortName(player.firstName, player.lastName), rank, player.score)
    try {
      if (navigator.share) await navigator.share({ text })
      else { await navigator.clipboard.writeText(text); setCopied(true) }
    } catch { /* ləğv edildi */ }
  }

  const stats = [
    { label: t.results.totalScore, value: <AnimatedNumber value={player.score} /> },
    { label: t.results.correctCount, value: `${player.correctCount} / ${scored}` },
    { label: t.results.accuracy, value: `${accuracy}%` },
    { label: t.results.bestStreak, value: `🔥 ${player.bestStreak}` },
    { label: t.results.avgTime, value: t.results.seconds(avgTime) },
  ]

  return (
    <div className="flex flex-col gap-4 pb-6">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring' }} className="card flex flex-col items-center gap-2 p-6 text-center" id="result-card">
        {rank === 1 && <span className="wobble text-6xl">👑</span>}
        <Avatar avatar={player.avatar} size={110} />
        <p className="text-xl font-extrabold">{player.firstName} {player.lastName}</p>
        {rank > 0 && <p className="font-display text-5xl text-brand">{t.results.place(rank)}</p>}
        <p className="font-bold text-slate-600">{rank === 1 ? t.results.champion : rank > 0 && rank <= 3 ? t.results.podium : t.results.thanks}</p>
        <div className="mt-3 grid w-full grid-cols-2 gap-2">
          {stats.map((s, i) => (
            <div key={s.label} className={`rounded-2xl bg-slate-100 p-3 ${i === 0 ? 'col-span-2' : ''}`}>
              <div className="text-xs font-extrabold uppercase text-slate-500">{s.label}</div>
              <div className={`font-display ${i === 0 ? 'text-4xl' : 'text-2xl'}`}>{s.value}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">{game.title}</p>
      </motion.div>
      <div className="grid grid-cols-2 gap-3">
        <button className="btn btn-secondary" onClick={() => setOpen((o) => !o)}>{open ? t.results.hideReview : t.results.review}</button>
        <button className="btn btn-ghost" onClick={share}>{copied ? t.results.copied : t.results.share}</button>
      </div>
      {open && game.review && (
        <ol className="flex flex-col gap-3">
          {game.review.map((item, i) => {
            const h = player.history.find((x) => x.q === i)
            return (
              <li key={i} className="card p-4">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <span className="font-extrabold">{i + 1}. {item.text}</span>
                  {item.scored && <span className="shrink-0 text-xl">{h?.correct ? '✅' : '❌'}</span>}
                </div>
                <p className="text-sm"><b>{t.game.yourAnswer}:</b> {fmtAnswer(item, h?.answer ?? null)}</p>
                {item.scored && <p className="text-sm text-green-700"><b>{t.game.correctAnswer}</b> {correctText(item)}</p>}
                {h && item.scored && <p className="text-sm text-slate-500">+{h.points} {t.game.points}</p>}
                {item.explanation && <p className="mt-1 rounded-xl bg-slate-100 p-2 text-sm">💡 {item.explanation}</p>}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
