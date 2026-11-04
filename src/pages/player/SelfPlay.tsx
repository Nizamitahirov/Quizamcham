import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, Clock, Flame, Hourglass, PartyPopper, X } from 'lucide-react'
import { LOCALE, t } from '../../i18n/az'
import { audio } from '../../audio/AudioEngine'
import { startSelfQuestion, submitAnswer } from '../../lib/gameEngine'
import { serverNow } from '../../lib/timeSync'
import { burst } from '../../components/Confetti'
import { Sticker } from '../../components/Sticker'
import { AnswerTile } from '../../components/AnswerTile'
import { QuestionInput } from './QuestionInputs'
import { PowerBar } from './PowerBar'
import { CORRECT, WRONG, STICKERS_OK, STICKERS_BAD, pick } from '../../content/feedback'
import type { AnswerValue, Game, Player, PublicQuestion } from '../../types'

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  if (s >= 3600) return t.assign.left(Math.floor(s / 86400), Math.floor((s % 86400) / 3600))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Öz tempində rejimi: oyunçu sualları ardıcıl, öz sürəti ilə cavablayır. */
export function SelfPlay({ game, player, uid }: { game: Game; player: Player; uid: string }) {
  const key = `qz.self.${game.id}`
  const total = game.totalQuestions
  const [idx, setIdx] = useState(() => { try { return Math.max(player.history?.length ?? 0, Number(sessionStorage.getItem(key) ?? 0)) } catch { return player.history?.length ?? 0 } })
  const [stage, setStage] = useState<'answer' | 'wait' | 'result'>('answer')
  const [now, setNow] = useState(serverNow())
  useEffect(() => { const id = setInterval(() => setNow(serverNow()), 250); return () => clearInterval(id) }, [])
  const left = (game.selfEndsAt?.toMillis() ?? now) - now
  // Sualları host hər oyunçunun öz sənədinə bir-bir göndərir; nəticə ekranı üçün yadda saxlayırıq
  const [cache, setCache] = useState<Record<number, PublicQuestion>>(() => (player.selfQ?.q ? { [player.selfQ.index]: player.selfQ.q } : {}))
  const sq = player.selfQ
  useEffect(() => { if (sq?.q) setCache((c) => (c[sq.index] ? c : { ...c, [sq.index]: sq.q! })) }, [sq])
  const qFor = (i: number) => cache[i] ?? game.publicQuestions?.[i] ?? null

  const assign = game.settings.mode === 'assign'
  const advance = () => { const n = idx + 1; try { sessionStorage.setItem(key, String(n)) } catch { /* noop */ } setIdx(n); setStage('answer') }
  if (assign && (idx >= total || left <= 0)) {
    return (
      <div className="m-auto flex flex-col items-center gap-4 text-center">
        <Sticker emoji="📨" size={110} />
        <h2 className="text-3xl font-black">{t.assign.submitted}</h2>
        <p className="max-w-xs text-white/60">{t.assign.pending}</p>
      </div>
    )
  }
  if (idx >= total || left <= 0) {
    return (
      <div className="m-auto flex flex-col items-center gap-4 text-center">
        <Sticker emoji="🏁" size={110} />
        <h2 className="text-3xl font-black">{left <= 0 && idx < total ? t.game.timeUp : t.game.selfDone}</h2>
        <p className="text-white/60">{t.game.selfDoneSub}</p>
        <div className="glass flex items-center gap-6 px-6 py-4">
          <div><div className="label-dark">{t.results.totalScore}</div><div className="font-display text-3xl font-black">{player.score.toLocaleString(LOCALE)}</div></div>
          <div><div className="label-dark">{t.results.correctCount}</div><div className="font-display text-3xl font-black">{player.correctCount}/{total}</div></div>
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="chip chip-dark">{t.game.questionOf(idx + 1, total)}</span>
        <span className={`chip ${left < 60000 ? 'bg-red-500/25 text-red-200' : 'chip-dark'}`}><Clock className="h-3.5 w-3.5" />{t.game.totalLeft}: {fmt(left)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full" style={{ background: 'var(--grad)' }} animate={{ width: `${(idx / total) * 100}%` }} /></div>
      <AnimatePresence mode="wait">
        <motion.div key={idx + stage} className="flex flex-1 flex-col" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.22 }}>
          {stage === 'result'
            ? <SelfResult game={game} player={player} qi={idx} q={qFor(idx)} onNext={advance} />
            : qFor(idx) ? <SelfQuestion game={game} player={player} uid={uid} qi={idx} q={qFor(idx)!} waiting={stage === 'wait'} onSent={() => { if (!assign) setStage('wait') }} onSubmitted={assign ? advance : undefined} onResult={() => setStage('result')} /> : <div className="m-auto"><Hourglass className="h-10 w-10 animate-spin text-orange-400" /></div>}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function SelfQuestion({ game, player, uid, qi, q, waiting, onSent, onResult, onSubmitted }: { game: Game; player: Player; uid: string; qi: number; q: PublicQuestion; waiting: boolean; onSent: () => void; onResult: () => void; onSubmitted?: () => void }) {
  const startRef = useRef<number>(Date.now())
  const sent = useRef(false)
  const [remaining, setRemaining] = useState((q?.timeLimit ?? 30) * 1000)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    startRef.current = Date.now()
    void startSelfQuestion(game.id, uid, qi).catch(() => { /* artıq başlanıb (səhifə yeniləndi) */ }).finally(() => setReady(true))
  }, [game.id, uid, qi])

  const submit = useCallback(async (v: AnswerValue | null) => {
    if (sent.current) return
    sent.current = true
    if (v !== null) audio.click()
    onSent()
    try { await submitAnswer(game.id, uid, qi, v) } catch { /* təkrar və ya gec — host nəticəni yazacaq */ }
    onSubmitted?.()
  }, [game.id, uid, qi, onSent, onSubmitted])

  useEffect(() => {
    if (!q) return
    const id = setInterval(() => {
      const r = q.timeLimit * 1000 - (Date.now() - startRef.current)
      setRemaining(r)
      if (r <= 0) { clearInterval(id); void submit(null) }
    }, 200)
    return () => clearInterval(id)
  }, [q, submit])

  // Host nəticəni yazanda
  useEffect(() => { if (player.lastResult?.questionIndex === qi && (waiting || sent.current)) onResult() }, [player.lastResult, qi, waiting, onResult])

  if (!q) return null
  const hide = player.fiftyHide?.q === qi ? player.fiftyHide.ids : []
  const frac = Math.max(0, remaining / (q.timeLimit * 1000))
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${frac * 100}%`, background: remaining < 5000 ? '#ef4444' : 'linear-gradient(90deg,#FFB020,#FF4D1F)' }} /></div>
        <span className="font-display w-10 text-right text-xl font-black tabular-nums">{Math.max(0, Math.ceil(remaining / 1000))}</span>
      </div>
      <h2 className="font-display text-center text-[22px] font-black leading-snug">{q.text}</h2>
      {q.imageUrl && <img src={q.imageUrl} alt="" className="mx-auto max-h-40 rounded-2xl object-contain" />}
      {!waiting && <PowerBar game={game} player={player} q={q} qi={qi} disabled={!ready} />}
      <div className="mt-auto">
        {waiting ? (
          <div className="glass flex flex-col items-center gap-3 px-4 py-10 text-center">
            <motion.div animate={{ rotate: [0, 180, 360] }} transition={{ repeat: Infinity, duration: 2.4, ease: 'linear' }}><Hourglass className="h-12 w-12 text-orange-400" /></motion.div>
            <p className="text-lg font-bold">{t.game.waitingResult}</p>
            <StallNotice />
          </div>
        ) : q.type === 'slide' ? (
          <div className="flex flex-col items-center gap-4 text-center">
            {q.body && <p className="text-lg text-white/80">{q.body}</p>}
            <button className="btn btn-primary btn-lg w-full" onClick={() => void submit(null)}>{t.game.next}<ArrowRight /></button>
          </div>
        ) : (
          <QuestionInput q={q} uid={uid} disabled={!ready} onSubmit={(v) => void submit(v)} hide={hide} />
        )}
      </div>
    </div>
  )
}

function SelfResult({ game, player, qi, q, onNext }: { game: Game; player: Player; qi: number; q: PublicQuestion | null; onNext: () => void }) {
  const r = player.lastResult
  const seed = useMemo(() => Math.random(), [])
  const fx = useRef(false)
  useEffect(() => {
    if (!r || fx.current || r.poll || q?.type === 'slide') return
    fx.current = true
    if (r.correct) { audio.correct(); burst(0.7) } else audio.wrong()
  }, [r, q])
  useEffect(() => { if (q?.type === 'slide') onNext() }, [q, onNext])
  if (!r || !q) return null
  const rv = r.reveal
  const correctOpts = q.options.map((o, i) => ({ o, i })).filter(({ o }) => rv?.correct?.includes(o.id))
  const showCorrect = game.settings.showCorrect !== false
  return (
    <div className="flex flex-1 flex-col items-center gap-3 text-center">
      {r.poll ? <><Sticker emoji="🗳️" /><h2 className="text-3xl font-black">{t.game.pollThanks}</h2></>
        : !r.answered ? <><Sticker emoji="⏰" /><h2 className="text-3xl font-black">{t.game.timeUp}</h2></>
          : r.correct ? <><Sticker emoji={pick(STICKERS_OK, seed)} /><h2 className="flex items-center gap-2 text-3xl font-black"><Check className="h-8 w-8 text-green-400" />{pick(CORRECT, seed)}</h2></>
            : <><Sticker emoji={pick(STICKERS_BAD, seed)} /><h2 className="flex items-center gap-2 text-3xl font-black"><X className="h-8 w-8 text-red-400" />{pick(WRONG, seed)}</h2></>}
      {!r.poll && r.points > 0 && <div className="font-display rounded-2xl px-6 py-2 text-3xl font-black" style={{ background: 'var(--grad)', boxShadow: 'var(--glow)' }}>{t.game.pointsPlus(r.points + (r.streakBonus ?? 0))}</div>}
      {r.streak >= 2 && <span className="chip chip-dark"><Flame className="h-4 w-4 text-orange-400" />{t.game.streak(r.streak)}</span>}
      {!r.poll && showCorrect && !r.correct && rv && (
        <div className="glass w-full p-3 text-left">
          <p className="label-dark">{rv.accepted ? t.game.acceptedAnswers : t.game.correctAnswer}</p>
          {correctOpts.length > 0 && q.type !== 'order' && <div className="flex flex-col gap-2">{correctOpts.map(({ o, i }) => <AnswerTile key={o.id} index={i} text={o.text} disabled />)}</div>}
          {q.type === 'order' && <ol className="list-decimal pl-6 font-bold">{(rv.correct ?? []).map((id) => <li key={id}>{q.options.find((o) => o.id === id)?.text}</li>)}</ol>}
          {rv.accepted && <p className="text-xl font-black">{rv.accepted.filter(Boolean).join(' · ')}</p>}
          {rv.sliderAnswer != null && q.type === 'slider' && <p className="font-display text-3xl font-black">{rv.sliderAnswer}</p>}
        </div>
      )}
      {rv?.explanation && <div className="glass w-full p-3 text-left text-sm leading-relaxed"><b className="text-orange-300">💡 {t.game.explanation}:</b> {rv.explanation}</div>}
      {r.timeMs != null && <span className="chip chip-dark"><Clock className="h-3.5 w-3.5" />{t.game.answerTime(`${(r.timeMs / 1000).toFixed(2)} s`)}</span>}
      <button className="btn btn-primary btn-lg mt-auto w-full" onClick={onNext}>{qi + 1 >= game.totalQuestions ? <><PartyPopper />{t.game.gameOver}</> : <>{t.game.next}<ArrowRight /></>}</button>
    </div>
  )
}

/** Nəticə 10 saniyədən çox gecikirsə (host ekranı bağlanıb/yuxudadır) — xəbərdarlıq. Cavab artıq saxlanılıb. */
function StallNotice() {
  const [show, setShow] = useState(false)
  useEffect(() => { const id = setTimeout(() => setShow(true), 10000); return () => clearTimeout(id) }, [])
  if (!show) return null
  return <p className="rounded-xl bg-amber-400/15 px-3 py-2 text-sm font-semibold text-amber-200" role="alert">{t.game.hostStalledSelf}</p>
}
