import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ensureAnonymous } from '../../firebase/auth'
import { useGame, usePlayer, useInterval } from '../../lib/hooks'
import { heartbeat, sendReaction, submitAnswer } from '../../lib/gameEngine'
import { syncClock } from '../../lib/timeSync'
import { shortName } from '../../lib/nameFilter'
import { t } from '../../i18n/az'
import { FullScreen, Spinner } from '../../components/ui'
import { FloatingShapes } from '../../components/FloatingShapes'
import { Avatar } from '../../components/Avatar'
import { MuteButton } from '../../components/MuteButton'
import { ReactionBar } from '../../components/ReactionBar'
import { FloatingEmojis, useFlying } from '../../components/FloatingEmojis'
import { Countdown } from '../../components/Countdown'
import { TimerRing } from '../../components/TimerRing'
import { Sticker } from '../../components/Sticker'
import { Leaderboard, Delta } from '../../components/Leaderboard'
import { burst, celebrate } from '../../components/Confetti'
import { AnswerTile } from '../../components/AnswerTile'
import { QuestionInput } from './QuestionInputs'
import PlayerResults from './PlayerResults'
import { CORRECT, WRONG, STICKERS_OK, STICKERS_BAD, pick, streakText } from '../../content/feedback'
import { audio } from '../../audio/AudioEngine'
import { useSession } from '../../store/gameStore'
import type { AnswerValue, Game, Player } from '../../types'

export default function PlayerGame() {
  const { gameId } = useParams()
  const [uid, setUid] = useState<string | null>(null)
  useEffect(() => { void ensureAnonymous().then((u) => setUid(u.uid)) }, [])
  const { data: game, loading: gl, missing: gMissing } = useGame(gameId)
  const { data: player, loading: pl, missing: pMissing } = usePlayer(gameId, uid)
  const flying = useFlying()
  const setGame = useSession((s) => s.setGame)

  // Saat sinxronu və heartbeat (30 s)
  useEffect(() => {
    if (!gameId || !uid || !player) return
    void syncClock(`games/${gameId}/players/${uid}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, uid, !!player])
  const beat = useCallback(() => { if (gameId && uid && document.visibilityState === 'visible') void heartbeat(gameId, uid).catch(() => {}) }, [gameId, uid])
  useInterval(beat, player && !player.kicked && game?.phase !== 'finished' ? 30000 : null)

  // İlk toxunuşda səsi aç
  useEffect(() => {
    const h = () => audio.unlock()
    window.addEventListener('pointerdown', h, { once: true })
    return () => window.removeEventListener('pointerdown', h)
  }, [])

  // Musiqi fazaya görə
  const phase = game?.phase
  useEffect(() => {
    if (!game) return
    audio.setTheme(game.settings.music?.theme ?? 'energetic')
    audio.setVolume(game.settings.music?.on === false ? 0 : game.settings.music?.volume ?? 60)
    if (phase === 'lobby') void audio.play('lobby')
    else if (phase === 'question' && game.currentQuestion?.type !== 'slide') void audio.play('question')
    else if (phase === 'podium') audio.fanfare()
    else audio.stopMusic()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, game?.questionIndex])
  useEffect(() => () => audio.stopMusic(), [])

  useEffect(() => { if (game?.phase === 'finished') setGame(null) }, [game?.phase, setGame])

  if (!gameId) return <Navigate to="/join" replace />
  if (gl || pl || !uid) return <FullScreen><div className="m-auto"><Spinner /></div></FullScreen>
  if (gMissing || !game) return <Navigate to="/join" replace />
  if (pMissing || !player) return <Navigate to={`/join?pin=${game.pin}`} replace />
  if (player.kicked) return <Message emoji="🚪" text={t.join.kicked} />

  const react = (e: string) => { flying.add(e); void sendReaction(game.id, uid, e).catch(() => {}) }

  return (
    <FullScreen className={game.phase === 'question' || game.phase === 'countdown' ? 'bg-deep' : 'bg-grad'}>
      {(game.phase === 'lobby' || game.phase === 'podium' || game.phase === 'finished') && <FloatingShapes count={8} />}
      <FloatingEmojis items={flying.items} />
      <header className="relative z-20 flex items-center justify-between gap-2 px-3 pt-3">
        <div className="flex min-w-0 items-center gap-2 rounded-full bg-black/25 py-1 pl-1 pr-3">
          <Avatar avatar={player.avatar} size={36} />
          <span className="truncate text-sm font-extrabold">{shortName(player.firstName, player.lastName)}</span>
        </div>
        <div className="flex items-center gap-2">
          {game.phase !== 'lobby' && <span className="font-display rounded-full bg-black/25 px-3 py-2 text-sm tabular-nums">{player.score.toLocaleString('az-AZ')}</span>}
          <MuteButton />
        </div>
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col p-4">
        <AnimatePresence mode="wait">
          <motion.div key={game.phase + game.questionIndex} className="flex flex-1 flex-col" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.25 }}>
            <PhaseView game={game} player={player} uid={uid} onReact={react} />
          </motion.div>
        </AnimatePresence>
      </main>
    </FullScreen>
  )
}

function Message({ emoji, text }: { emoji: string; text: string }) {
  const nav = useNavigate()
  return (
    <FullScreen>
      <div className="m-auto flex flex-col items-center gap-4 p-6 text-center">
        <div className="text-7xl">{emoji}</div>
        <p className="text-2xl font-extrabold">{text}</p>
        <button className="btn btn-secondary" onClick={() => nav('/')}>{t.app.home}</button>
      </div>
    </FullScreen>
  )
}

function PhaseView({ game, player, uid, onReact }: { game: Game; player: Player; uid: string; onReact: (e: string) => void }) {
  switch (game.phase) {
    case 'lobby': return <LobbyView game={game} player={player} onReact={onReact} />
    case 'countdown': return <div className="m-auto"><Countdown label={t.game.questionOf(game.questionIndex + 1, game.totalQuestions)} /></div>
    case 'question': return <QuestionView game={game} uid={uid} />
    case 'reveal': return <RevealView game={game} player={player} />
    case 'leaderboard': return <LeaderboardView game={game} player={player} />
    case 'podium': return <PodiumWait player={player} />
    case 'finished': return <PlayerResults game={game} player={player} />
  }
}

function LobbyView({ game, player, onReact }: { game: Game; player: Player; onReact: (e: string) => void }) {
  const [tip, setTip] = useState(0)
  useInterval(useCallback(() => setTip((x) => (x + 1) % t.lobby.tips.length), []), 4000)
  const others = game.lobby.filter((p) => p.uid !== player.uid)
  return (
    <div className="flex flex-1 flex-col items-center gap-5 text-center">
      <h1 className="mt-2 text-3xl">{t.lobby.youAreIn}</h1>
      <div className="breathe"><Avatar avatar={player.avatar} size={150} /></div>
      <p className="text-2xl font-extrabold">{player.firstName} {player.lastName}</p>
      <p className="opacity-90">{t.lobby.waiting}</p>
      <AnimatePresence mode="wait">
        <motion.p key={tip} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="min-h-12 rounded-2xl bg-white/15 px-4 py-3 font-bold">
          {t.lobby.tips[tip]}
        </motion.p>
      </AnimatePresence>
      <div className="font-display text-lg">{t.lobby.joined(game.playerCount || game.lobby.length)}</div>
      <div className="flex flex-wrap justify-center gap-2">
        <AnimatePresence>
          {others.slice(-40).map((p) => (
            <motion.div key={p.uid} initial={{ x: 200, scale: 0 }} animate={{ x: 0, scale: [0, 1.2, 1] }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
              <Avatar avatar={p.avatar} size={40} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="mt-auto w-full pb-2"><ReactionBar onReact={onReact} /></div>
    </div>
  )
}

function QuestionView({ game, uid }: { game: Game; uid: string }) {
  const q = game.currentQuestion
  const key = `qz.ans.${game.id}.${game.questionIndex}`
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'late' | 'error'>(() => { try { return sessionStorage.getItem(key) ? 'sent' : 'idle' } catch { return 'idle' } })
  const [remaining, setRemaining] = useState(Infinity)
  const sentRef = useRef(false)
  if (!q) return <Spinner />
  if (q.type === 'slide') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <h2 className="text-3xl">{q.text}</h2>
        {q.imageUrl && <img src={q.imageUrl} alt="" className="max-h-56 rounded-2xl object-contain" />}
        {q.body && <p className="text-lg opacity-90">{q.body}</p>}
        <p className="mt-6 text-sm opacity-70">{t.game.slideNext}</p>
      </div>
    )
  }
  const paused = game.pausedRemainingMs != null
  const timeUp = !paused && game.questionEndsAt != null && remaining <= 0
  const notReady = !game.questionEndsAt && !paused

  async function submit(v: AnswerValue) {
    if (sentRef.current) return
    sentRef.current = true
    audio.click()
    setState('sending')
    try {
      await submitAnswer(game.id, uid, game.questionIndex, v)
      try { sessionStorage.setItem(key, '1') } catch { /* noop */ }
      setState('sent')
    } catch (e) {
      const code = (e as { code?: string }).code
      // Sənəd artıq varsa (təkrar) — cavab qəbul olunub
      if (code === 'permission-denied' && remaining > 0) { setState('sent'); return }
      setState(remaining <= 0 ? 'late' : 'error')
      sentRef.current = false
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="font-display text-sm opacity-80">{t.game.questionOf(game.questionIndex + 1, game.totalQuestions)}</span>
        <TimerRing endsAt={game.questionEndsAt} total={q.timeLimit} pausedMs={game.pausedRemainingMs} onTick={setRemaining} />
      </div>
      <h2 className="font-display text-center text-2xl leading-snug">{q.text}</h2>
      {q.imageUrl && <img src={q.imageUrl} alt="" className="mx-auto max-h-44 rounded-2xl object-contain" />}
      {paused && <p className="text-center text-xl font-extrabold">{t.game.paused}</p>}
      <div className="mt-auto" aria-live="polite">
        {state === 'sent' || state === 'sending' ? (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-3 py-10 text-center">
            <motion.div animate={{ rotate: [0, 15, -15, 0], y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 1.6 }} className="text-7xl">🛸</motion.div>
            <p className="text-2xl font-extrabold">{t.game.submitted}</p>
            <p className="opacity-80">{t.game.waitingOthers}</p>
          </motion.div>
        ) : state === 'late' || timeUp ? (
          <p className="py-10 text-center text-3xl font-extrabold">{t.game.timeUp}</p>
        ) : (
          <>
            {state === 'error' && <p className="mb-2 text-center font-bold text-red-300" role="alert">{t.game.answerFailed}</p>}
            <QuestionInput q={q} uid={uid} disabled={paused || notReady} onSubmit={submit} />
          </>
        )}
      </div>
    </div>
  )
}

function RevealView({ game, player }: { game: Game; player: Player }) {
  const r = player.lastResult
  const fresh = r && r.questionIndex === game.questionIndex
  const fx = useRef(false)
  const seed = useMemo(() => Math.random(), [])
  useEffect(() => {
    if (!fresh || fx.current || !r) return
    fx.current = true
    if (r.poll) return
    if (r.correct) { audio.correct(); burst(r.streak >= 3 ? 1.4 : 0.8) } else audio.wrong()
  }, [fresh, r])
  if (!fresh || !r) return <div className="m-auto"><Spinner label={t.game.waitingResult} /></div>
  const q = game.currentQuestion
  const rv = game.reveal
  const showCorrect = game.settings.showCorrect !== false
  const correctOpts = q && rv ? (q.options ?? []).map((o, i) => ({ o, i })).filter(({ o }) => (rv.correct ?? []).includes(o.id)) : []
  const bg = r.poll ? '' : r.correct ? 'bg-green-600/90' : 'bg-red-600/85'
  return (
    <div className={`-m-4 flex flex-1 flex-col items-center gap-3 p-6 text-center ${bg}`} aria-live="assertive">
      <span className="sr-only">{t.feedback.aria(r.correct, r.points)}</span>
      {r.poll ? (
        <><Sticker emoji="🗳️" /><h2 className="text-3xl">{t.game.pollThanks}</h2></>
      ) : !r.answered ? (
        <><Sticker emoji="⏰" /><h2 className="text-4xl">{t.game.timeUp}</h2></>
      ) : r.correct ? (
        <>
          <Sticker emoji={pick(STICKERS_OK, seed)} />
          <h2 className="text-4xl">{pick(CORRECT, seed)}</h2>
          <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} transition={{ delay: 0.3 }} className="font-display rounded-2xl bg-white/20 px-6 py-2 text-4xl">{t.game.pointsPlus(r.points)}</motion.div>
          {r.streakBonus > 0 && <p className="font-extrabold">{t.game.streakBonus(r.streakBonus)}</p>}
          {r.streak >= 2 && <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5 }} className="text-2xl font-extrabold">{streakText(r.streak)}</motion.p>}
        </>
      ) : (
        <>
          <Sticker emoji={pick(STICKERS_BAD, seed)} />
          <h2 className="text-4xl">{pick(WRONG, seed)}</h2>
          {r.points > 0 && <div className="font-display text-3xl">{t.game.pointsPlus(r.points)}</div>}
        </>
      )}
      {!r.poll && showCorrect && !r.correct && rv && (
        <div className="mt-2 w-full rounded-2xl bg-black/25 p-3 text-left">
          <p className="mb-2 text-sm font-extrabold opacity-90">{rv.accepted ? t.game.acceptedAnswers : t.game.correctAnswer}</p>
          {correctOpts.length > 0 && <div className="flex flex-col gap-2">{correctOpts.map(({ o, i }) => <AnswerTile key={o.id} index={i} text={o.text} disabled />)}</div>}
          {rv.accepted && <p className="text-xl font-extrabold">{rv.accepted.filter(Boolean).join(' · ')}</p>}
          {rv.sliderAnswer != null && q?.type === 'slider' && <p className="font-display text-3xl">{rv.sliderAnswer}</p>}
          {q?.type === 'order' && rv.correct.length > 0 && <ol className="list-decimal pl-6 font-bold">{rv.correct.map((id) => <li key={id}>{q.options.find((o) => o.id === id)?.text}</li>)}</ol>}
        </div>
      )}
      {rv?.explanation && <div className="w-full rounded-2xl bg-white/15 p-3 text-left text-sm"><b>💡 {t.game.explanation}:</b> {rv.explanation}</div>}
      {!r.poll && r.rank > 0 && <p className="font-display mt-auto text-2xl">{t.game.yourPlace(r.rank)}</p>}
    </div>
  )
}

function LeaderboardView({ game, player }: { game: Game; player: Player }) {
  const r = player.lastResult
  const inTop = game.leaderboard.slice(0, 5).some((e) => e.uid === player.uid)
  return (
    <div className="flex flex-1 flex-col gap-4">
      <h2 className="text-center text-3xl">{t.game.leaderboard}</h2>
      <Leaderboard entries={game.leaderboard} highlight={player.uid} max={5} />
      {!inTop && r && r.rank > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-yellow-300 px-4 py-3 text-lg text-ink">
          <span className="font-display w-10 text-center">{r.rank}</span>
          <Avatar avatar={player.avatar} size={36} />
          <span className="flex-1 font-extrabold">{t.game.you}</span>
          <Delta d={r.prevRank ? r.prevRank - r.rank : 0} />
          <span className="font-display">{player.score.toLocaleString('az-AZ')}</span>
        </div>
      )}
    </div>
  )
}

function PodiumWait({ player }: { player: Player }) {
  const r = player.lastResult
  useEffect(() => { if (r && r.rank > 0 && r.rank <= 3) setTimeout(() => celebrate(3000), 2500) }, [r])
  return (
    <div className="m-auto flex flex-col items-center gap-4 text-center">
      <Sticker emoji="🏆" size={130} />
      <h2 className="text-3xl">{t.game.gameOver}</h2>
      {r && r.rank > 0 && <p className="font-display text-4xl">{t.game.yourPlace(r.rank)}</p>}
    </div>
  )
}
