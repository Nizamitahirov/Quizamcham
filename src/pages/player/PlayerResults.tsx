import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Award, Check, ChevronDown, Download, Share2, X } from 'lucide-react'
import { PlaceBadge } from '../../components/PlaceBadge'
import { LOCALE, t } from '../../i18n/az'
import { Avatar } from '../../components/Avatar'
import { AnimatedNumber } from '../../components/AnimatedNumber'
import { burst, celebrate } from '../../components/Confetti'
import { shortName } from '../../lib/nameFilter'
import { recordPlay } from '../../lib/account'
import { renderCertificate, renderShareCard } from '../../lib/shareCard'
import { FeedbackForm } from '../../components/FeedbackForm'
import { useDocSnap } from '../../lib/hooks'
import { TeamBoard } from '../../components/TeamBoard'
import { download } from '../../lib/csv'
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
  // İcmal ayrıca sənəddədir (köhnə oyunlarda game.review)
  const { data: reviewDoc } = useDocSnap<ReviewItem[]>(open ? `games/${game.id}/results/review` : null, (_id, d) => (d.items as ReviewItem[]) ?? [])
  const review = reviewDoc ?? game.review
  const [busy, setBusy] = useState(false)
  const entry = game.leaderboard.find((e) => e.uid === player.uid)
  const rank = entry?.rank ?? player.lastResult?.rank ?? 0
  const total = game.leaderboard.length || game.playerCount
  const scored = game.scoredCount ?? player.history.length
  const accuracy = scored ? Math.round((player.correctCount / scored) * 100) : 0
  const myAwards = (game.awards ?? []).filter((a) => a.uid === player.uid)
  // Qeydiyyatlı istifadəçi: nəticə hesabındakı "Canlı oyunlarım" tarixçəsinə düşür (bir dəfə)
  useEffect(() => {
    if (!rank) return
    void recordPlay({ gameId: game.id, title: game.title, rank, total, score: player.score, correct: player.correctCount, questions: scored })
  }, [game.id, game.title, rank, total, player.score, player.correctCount, scored])
  const avgTime = useMemo(() => {
    const ts = player.history.filter((h) => h.timeMs != null && h.answer != null).map((h) => h.timeMs as number)
    return ts.length ? ts.reduce((a, b) => a + b, 0) / ts.length / 1000 : 0
  }, [player.history])

  useEffect(() => {
    if (rank === 1) celebrate(5000)
    else if (rank > 0 && rank <= 3) burst(1.4)
  }, [rank])

  const card = async () => {
    setBusy(true)
    try {
      const blob = await renderShareCard({ name: `${player.firstName} ${player.lastName}`, title: game.title, place: rank, total, score: player.score, accuracy, streak: player.bestStreak, avatar: player.avatar, awards: myAwards.map((a) => t.awards[a.key]) })
      const file = new File([blob], 'jabr-netice.png', { type: 'image/png' })
      const text = t.results.shareText(shortName(player.firstName, player.lastName), rank, player.score)
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text })
      else download('jabr-netice.png', blob)
    } catch { /* ləğv edildi */ } finally { setBusy(false) }
  }

  const cert = async () => {
    setBusy(true)
    try {
      const blob = await renderCertificate(
        { name: `${player.firstName} ${player.lastName}`, quiz: game.title, place: rank, total, score: player.score, trainer: game.host?.name, date: new Date() },
        { title: t.cert.title, given: t.cert.given, completed: t.cert.completed, place: t.cert.place(rank, total), score: t.cert.score(player.score.toLocaleString(LOCALE)), trainer: t.cert.trainer, date: t.cert.date },
      )
      download(`sertifikat-${player.firstName}-${player.lastName}.png`, blob)
    } catch { /* noop */ } finally { setBusy(false) }
  }

  const stats = [
    { label: t.results.correctCount, value: `${player.correctCount}/${scored}` },
    { label: t.results.accuracy, value: `${accuracy}%` },
    { label: t.results.bestStreak, value: `🔥 ${player.bestStreak}` },
    { label: t.results.avgTime, value: t.results.seconds(avgTime) },
  ]

  return (
    <div className="flex flex-col gap-4 pb-6">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring' }} className="glass-strong gradient-border relative flex flex-col items-center gap-2 overflow-hidden p-6 text-center" id="result-card">
        <div className="pointer-events-none absolute -top-24 h-48 w-72 rounded-full opacity-50 blur-3xl" style={{ background: 'var(--grad)' }} />
        {rank >= 1 && rank <= 3 && <div className="absolute right-2 top-2 z-10"><PlaceBadge place={rank} size={64} /></div>}
        <div className="relative rounded-full p-1.5" style={{ background: 'var(--grad)' }}><Avatar avatar={player.avatar} size={104} /></div>
        <p className="relative text-xl font-black">{player.firstName} {player.lastName}</p>
        {rank > 0 && <p className="font-display text-grad relative text-6xl font-black">{t.results.place(rank)}</p>}
        <p className="relative text-sm font-semibold text-white/60">{rank === 1 ? t.results.champion : rank > 0 && rank <= 3 ? t.results.podium : t.results.thanks}</p>
        <div className="relative mt-2 w-full rounded-2xl p-4" style={{ background: 'var(--grad)' }}>
          <div className="text-xs font-bold uppercase tracking-widest text-white/80">{t.results.totalScore}</div>
          <div className="font-display text-5xl font-black"><AnimatedNumber value={player.score} /></div>
        </div>
        <div className="relative grid w-full grid-cols-2 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl bg-white/[.06] p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">{s.label}</div>
              <div className="font-display text-2xl font-black">{s.value}</div>
            </div>
          ))}
        </div>
        {myAwards.length > 0 && (
          <div className="relative flex flex-wrap justify-center gap-2 pt-1">
            {myAwards.map((a) => <span key={a.key} className="chip bg-yellow-300 font-black text-ink">{t.awards[a.key]}</span>)}
          </div>
        )}
      </motion.div>

      {(game.teamBoard?.length ?? 0) > 0 && <div className="glass p-4"><p className="label-dark">{t.teamsUi.board}</p><TeamBoard rows={game.teamBoard!} highlight={player.team} /></div>}
      {(game.awards ?? []).length > 0 && (
        <div className="glass p-4">
          <p className="label-dark">{t.awards.title}</p>
          <ul className="flex flex-col gap-2">
            {game.awards!.map((a, i) => (
              <li key={a.key + i} className="flex items-center gap-3"><Avatar avatar={a.avatar} size={32} /><span className="flex-1 text-sm font-bold">{a.name}</span><span className="text-xs font-bold text-orange-300">{t.awards[a.key]} · {a.value}</span></li>
            ))}
          </ul>
        </div>
      )}

      {game.settings.feedback !== false && <FeedbackForm gameId={game.id} uid={player.uid} name={shortName(player.firstName, player.lastName)} />}

      <button className="btn btn-ghost w-full" disabled={busy} onClick={() => void cert()}><Award />{t.cert.button}</button>
      <div className="grid grid-cols-2 gap-3">
        <button className="btn btn-ghost" onClick={() => setOpen((o) => !o)}><ChevronDown className={open ? 'rotate-180' : ''} />{open ? t.results.hideReview : t.results.review}</button>
        <button className="btn btn-primary" onClick={() => void card()} disabled={busy}>{typeof navigator.share === 'function' ? <Share2 /> : <Download />}{t.results.share}</button>
      </div>
      {open && review && (
        <ol className="flex flex-col gap-3">
          {review.map((item, i) => {
            const h = player.history.find((x) => x.q === i)
            return (
              <li key={i} className="glass p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="text-sm font-bold">{i + 1}. {item.text}</span>
                  {item.scored && <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${h?.correct ? 'bg-green-500' : 'bg-red-500/80'}`}>{h?.correct ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}</span>}
                </div>
                <p className="text-sm text-white/75"><b className="text-white/50">{t.game.yourAnswer}:</b> {fmtAnswer(item, h?.answer ?? null)}</p>
                {item.scored && <p className="text-sm text-green-300"><b className="text-white/50">{t.game.correctAnswer}</b> {correctText(item)}</p>}
                {h && item.scored && <p className="text-xs text-white/45">+{h.points} {t.game.points}</p>}
                {item.explanation && <p className="mt-2 rounded-xl bg-white/[.06] p-2 text-xs leading-relaxed text-white/80">💡 {item.explanation}</p>}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
