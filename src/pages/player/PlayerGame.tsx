import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Clock, Flame, Hourglass, Trophy } from 'lucide-react'
import { ensureAnonymous } from '../../firebase/auth'
import { useGame, usePlayer, useInterval } from '../../lib/hooks'
import { heartbeat, sendReaction, submitAnswer } from '../../lib/gameEngine'
import { serverNow, syncClock } from '../../lib/timeSync'
import { shortName } from '../../lib/nameFilter'
import { t } from '../../i18n/az'
import { Spinner } from '../../components/ui'
import { FuturisticBg } from '../../components/FuturisticBg'
import { Avatar } from '../../components/Avatar'
import { MuteButton } from '../../components/MuteButton'
import { ReactionBar } from '../../components/ReactionBar'
import { FloatingEmojis, useFlying } from '../../components/FloatingEmojis'
import { QuestionIntro } from '../../components/QuestionIntro'
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
import { useWakeLock } from '../../lib/useWakeLock'
import type { AnswerValue, Game, Player } from '../../types'
import { SelfPlay } from './SelfPlay'
import { PowerBar, POWERS } from './PowerBar'
import { loadSounds } from '../../firebase/db'

export default function PlayerGame() {
  const { gameId } = useParams()
  const [uid, setUid] = useState<string | null>(null)
  useEffect(() => { void ensureAnonymous().then((u) => setUid(u.uid)) }, [])
  const { data: game, loading: gl, missing: gMissing } = useGame(gameId)
  const { data: player, loading: pl, missing: pMissing } = usePlayer(gameId, uid)
  const flying = useFlying()
  const setGame = useSession((s) => s.setGame)

  useEffect(() => {
    if (!gameId || !uid || !player) return
    void syncClock(`games/${gameId}/players/${uid}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, uid, !!player])
  const beat = useCallback(() => { if (gameId && uid && document.visibilityState === 'visible') void heartbeat(gameId, uid).catch(() => {}) }, [gameId, uid])
  useInterval(beat, player && !player.kicked && game?.phase !== 'finished' ? 30000 : null)

  useEffect(() => {
    const h = () => audio.unlock()
    window.addEventListener('pointerdown', h, { once: true })
    return () => window.removeEventListener('pointerdown', h)
  }, [])

  const phase = game?.phase
  useEffect(() => {
    if (!game) return
    audio.setTheme(game.settings.music?.theme ?? 'energetic')
    audio.setVolume(game.settings.music?.on === false ? 0 : game.settings.music?.volume ?? 60)
    if (phase === 'lobby') void audio.play('lobby')
    else if (phase === 'self') audio.stopMusic()
    else if (phase === 'question' && game.currentQuestion?.type !== 'slide') void audio.play('question')
    else if (phase === 'podium') audio.fanfare()
    else audio.stopMusic()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, game?.questionIndex])
  useEffect(() => () => audio.stopMusic(), [])
  useEffect(() => { if (game?.phase === 'finished') setGame(null) }, [game?.phase, setGame])
  useWakeLock(!!game && game.phase !== 'finished')
  const stalled = useStall(game)
  // Admin yüklədiyi düz/səhv cavab səsləri
  useEffect(() => { void loadSounds().then((snd) => audio.loadClips(snd)) }, [])

  if (!gameId) return <Navigate to="/join" replace />
  if (gl || pl || !uid) return <div className="flex min-h-dvh items-center justify-center bg-night"><Spinner /></div>
  if (gMissing || !game) return <Navigate to="/join" replace />
  if (pMissing || !player) return <Navigate to={`/join?pin=${game.pin}`} replace />
  if (player.kicked) return <Message emoji="🚪" text={t.join.kicked} />

  const react = (e: string) => { flying.add(e); void sendReaction(game.id, uid, e).catch(() => {}) }
  const rank = player.lastResult?.rank ?? 0
  const reveal = game.phase === 'reveal' && player.lastResult?.questionIndex === game.questionIndex && !player.lastResult.poll
  const tint = reveal ? (player.lastResult!.correct ? 'from-green-600/40' : 'from-red-600/35') : ''

  return (
    <div className="noise relative flex min-h-dvh flex-col overflow-hidden bg-night">
      <FuturisticBg floor={game.phase === 'lobby'} intensity={game.phase === 'question' ? 0.5 : 0.9} />
      {tint && <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${tint} to-transparent`} />}
      <FloatingEmojis items={flying.items} />
      {stalled && <div className="fixed inset-x-0 top-0 z-50 bg-amber-400 px-3 py-2 text-center text-sm font-bold text-black" role="alert">{t.game.hostStalled}</div>}
      <header className="relative z-20 flex items-center justify-between gap-2 px-3 pt-3">
        <div className="glass flex min-w-0 items-center gap-2 rounded-full py-1 pl-1 pr-3">
          <Avatar avatar={player.avatar} size={34} />
          <span className="truncate text-sm font-bold">{shortName(player.firstName, player.lastName)}</span>
        </div>
        <div className="flex items-center gap-2">
          {game.phase !== 'lobby' && (
            <span className="glass flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black tabular-nums">
              {rank > 0 && <span className="flex items-center gap-1 text-orange-300"><Trophy className="h-4 w-4" />{rank}</span>}
              {player.score.toLocaleString('az-AZ')}
            </span>
          )}
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
    </div>
  )
}

/** Host irəliləmirsə (sualın vaxtı keçib, amma faza dəyişmir) xəbərdarlıq — əlavə Firestore xərci olmadan. */
function useStall(game: Game | null) {
  const [stalled, setStalled] = useState(false)
  useEffect(() => {
    if (!game) return
    const check = () => {
      const ends = game.phase === 'question' && game.pausedRemainingMs == null ? game.questionEndsAt?.toMillis() : null
      setStalled(!!ends && serverNow() > ends + 10000)
    }
    check()
    const id = setInterval(check, 2000)
    return () => clearInterval(id)
  }, [game])
  return stalled
}

function Message({ emoji, text }: { emoji: string; text: string }) {
  const nav = useNavigate()
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center gap-4 overflow-hidden bg-night p-6 text-center">
      <FuturisticBg floor={false} />
      <div className="relative text-7xl">{emoji}</div>
      <p className="relative text-2xl font-bold">{text}</p>
      <button className="btn btn-primary relative" onClick={() => nav('/')}>{t.app.home}</button>
    </div>
  )
}

function PhaseView({ game, player, uid, onReact }: { game: Game; player: Player; uid: string; onReact: (e: string) => void }) {
  switch (game.phase) {
    case 'lobby': return <LobbyView game={game} player={player} onReact={onReact} />
    case 'countdown': return game.preview ? <div className="m-auto w-full"><QuestionIntro preview={game.preview} total={game.totalQuestions} /></div> : <Spinner />
    case 'question': return <QuestionView game={game} uid={uid} player={player} />
    case 'reveal': return <RevealView game={game} player={player} />
    case 'leaderboard': return <LeaderboardView game={game} player={player} />
    case 'podium': return <PodiumWait player={player} />
    case 'finished': return <PlayerResults game={game} player={player} />
    case 'self': return <SelfPlay game={game} player={player} uid={uid} />
  }
}

function LobbyView({ game, player, onReact }: { game: Game; player: Player; onReact: (e: string) => void }) {
  const [tip, setTip] = useState(0)
  useInterval(useCallback(() => setTip((x) => (x + 1) % t.lobby.tips.length), []), 4000)
  const others = game.lobby.filter((p) => p.uid !== player.uid)
  return (
    <div className="flex flex-1 flex-col items-center gap-5 text-center">
      <span className="chip chip-dark mt-2"><span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />{t.lobby.youAreIn}</span>
      <div className="relative">
        <div className="absolute -inset-4 animate-spin rounded-full opacity-60 blur-xl" style={{ background: 'conic-gradient(from 0deg, #E8202A, #FF8A1A, #FFB020, #E8202A)', animationDuration: '6s' }} />
        <div className="breathe relative rounded-full p-1.5" style={{ background: 'var(--grad)' }}><Avatar avatar={player.avatar} size={148} /></div>
      </div>
      <div>
        <p className="text-2xl font-black">{player.firstName} {player.lastName}</p>
        <p className="mt-1 text-sm text-white/60">{t.lobby.waiting}</p>
      </div>
      {game.host?.name && (
        <div className="glass flex w-full items-center gap-3 p-3 text-left">
          {game.host.photoUrl ? <img src={game.host.photoUrl} alt="" className="h-11 w-11 rounded-full object-cover" /> : game.host.avatar ? <Avatar avatar={game.host.avatar} size={44} /> : <span className="flex h-11 w-11 items-center justify-center rounded-full font-black" style={{ background: 'var(--grad)' }}>{game.host.name[0]}</span>}
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/50">{t.profile.trainer}</div>
            <div className="truncate font-bold">{game.host.name}</div>
            {(game.host.title || game.host.org) && <div className="truncate text-xs text-white/55">{[game.host.title, game.host.org].filter(Boolean).join(' · ')}</div>}
          </div>
        </div>
      )}
      <AnimatePresence mode="wait">
        <motion.p key={tip} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="glass w-full px-4 py-3 text-sm font-semibold">
          {t.lobby.tips[tip]}
        </motion.p>
      </AnimatePresence>
      {game.settings.powerUps !== false && (
        <div className="grid w-full grid-cols-3 gap-2">
          {POWERS.map((p) => (
            <div key={p.type} className="glass flex flex-col items-center gap-1 p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: p.bg }}><p.icon className="h-5 w-5" /></span>
              <span className="text-xs font-bold">{p.label}</span>
            </div>
          ))}
        </div>
      )}
      <div className="w-full">
        <div className="mb-2 text-sm font-bold text-white/70">{t.lobby.joined(game.playerCount || game.lobby.length)}</div>
        <div className="flex flex-wrap justify-center gap-1.5">
          <AnimatePresence>
            {others.slice(-40).map((p) => (
              <motion.div key={p.uid} initial={{ x: 200, scale: 0 }} animate={{ x: 0, scale: [0, 1.2, 1] }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
                <Avatar avatar={p.avatar} size={38} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
      <div className="mt-auto w-full pb-2"><ReactionBar onReact={onReact} /></div>
    </div>
  )
}

function QuestionView({ game, uid, player }: { game: Game; uid: string; player: Player }) {
  const q = game.currentQuestion
  const key = `qz.ans.${game.id}.${game.questionIndex}`
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'late' | 'error'>(() => { try { return sessionStorage.getItem(key) ? 'sent' : 'idle' } catch { return 'idle' } })
  const [remaining, setRemaining] = useState(Infinity)
  const sentRef = useRef(false)
  if (!q) return <Spinner />
  if (q.type === 'slide') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <h2 className="text-3xl font-black">{q.text}</h2>
        {q.imageUrl && <img src={q.imageUrl} alt="" className="max-h-56 rounded-2xl object-contain" />}
        {q.body && <p className="text-lg text-white/80">{q.body}</p>}
        <p className="mt-6 text-sm text-white/50">{t.game.slideNext}</p>
      </div>
    )
  }
  const paused = game.pausedRemainingMs != null
  const timeUp = !paused && game.questionEndsAt != null && remaining <= 0
  const notReady = !game.questionEndsAt && !paused
  const hide = player.fiftyHide?.q === game.questionIndex ? player.fiftyHide.ids : []

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
      if (code === 'permission-denied' && remaining > 0) { setState('sent'); return }
      setState(remaining <= 0 ? 'late' : 'error')
      sentRef.current = false
    }
  }

  const done = state === 'sent' || state === 'sending'
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="chip chip-dark">{t.game.questionOf(game.questionIndex + 1, game.totalQuestions)}</span>
          {q.points === 'double' && <span className="chip ml-1 bg-yellow-300 text-ink">2x</span>}
        </div>
        <TimerRing endsAt={game.questionEndsAt} total={q.timeLimit} pausedMs={game.pausedRemainingMs} onTick={setRemaining} />
      </div>
      <h2 className="font-display text-center text-[22px] font-black leading-snug">{q.text}</h2>
      {q.imageUrl && <img src={q.imageUrl} alt="" className="mx-auto max-h-40 rounded-2xl object-contain" />}
      {paused && <p className="text-center text-xl font-bold">{t.game.paused}</p>}
      {!done && !timeUp && <PowerBar game={game} player={player} disabled={paused || notReady} />}
      <div className="mt-auto" aria-live="polite">
        {done ? (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass flex flex-col items-center gap-3 px-4 py-10 text-center">
            <motion.div animate={{ rotate: [0, 180, 360] }} transition={{ repeat: Infinity, duration: 2.4, ease: 'linear' }}><Hourglass className="h-14 w-14 text-orange-400" /></motion.div>
            <p className="text-2xl font-black">{t.game.submitted}</p>
            <p className="text-white/60">{t.game.waitingOthers}</p>
            {player.power?.q === game.questionIndex && <span className="chip chip-brand bg-white">{POWERS.find((p) => p.type === player.power?.type)?.label} · {t.power.active}</span>}
          </motion.div>
        ) : state === 'late' || timeUp ? (
          <p className="py-10 text-center text-3xl font-black">{t.game.timeUp}</p>
        ) : (
          <>
            {state === 'error' && <p className="mb-2 text-center font-bold text-red-300" role="alert">{t.game.answerFailed}</p>}
            <QuestionInput q={q} uid={uid} disabled={paused || notReady} onSubmit={submit} hide={hide} />
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
  const youFastest = rv?.fastest?.uid === player.uid
  return (
    <div className="flex flex-1 flex-col items-center gap-3 text-center" aria-live="assertive">
      <span className="sr-only">{t.feedback.aria(r.correct, r.points)}</span>
      {r.poll ? (
        <><Sticker emoji="🗳️" /><h2 className="text-3xl font-black">{t.game.pollThanks}</h2></>
      ) : !r.answered ? (
        <><Sticker emoji="⏰" /><h2 className="text-4xl font-black">{t.game.timeUp}</h2></>
      ) : r.correct ? (
        <>
          <Sticker emoji={pick(STICKERS_OK, seed)} />
          <h2 className="text-4xl font-black">{pick(CORRECT, seed)}</h2>
          <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} transition={{ delay: 0.3 }} className="font-display rounded-2xl px-6 py-2 text-4xl font-black" style={{ background: 'var(--grad)', boxShadow: 'var(--glow)' }}>
            {t.game.pointsPlus(r.points)}
          </motion.div>
          <div className="flex flex-wrap justify-center gap-2">
            {r.power === 'double' && <span className="chip bg-yellow-300 text-ink">{t.power.doubled}</span>}
            {r.streakBonus > 0 && <span className="chip chip-dark">{t.game.streakBonus(r.streakBonus)}</span>}
            {r.streak >= 2 && <span className="chip chip-dark"><Flame className="h-4 w-4 text-orange-400" />{streakText(r.streak)}</span>}
          </div>
        </>
      ) : (
        <>
          <Sticker emoji={pick(STICKERS_BAD, seed)} />
          <h2 className="text-4xl font-black">{pick(WRONG, seed)}</h2>
          {r.points > 0 && <div className="font-display text-3xl font-black">{t.game.pointsPlus(r.points)}</div>}
          {r.shielded && <span className="chip chip-dark">{t.power.shielded}</span>}
        </>
      )}
      {r.answered && r.timeMs != null && !r.poll && <span className="chip chip-dark"><Clock className="h-3.5 w-3.5" />{t.game.answerTime(`${(r.timeMs / 1000).toFixed(2)} s`)}</span>}
      {youFastest ? <span className="chip bg-yellow-300 font-black text-ink">{t.game.youFastest}</span>
        : rv?.fastest && <span className="text-xs text-white/60">{t.game.fastest(rv.fastest.name, `${(rv.fastest.ms / 1000).toFixed(2)} s`)}</span>}
      {!r.poll && showCorrect && !r.correct && rv && (
        <div className="glass mt-1 w-full p-3 text-left">
          <p className="label-dark">{rv.accepted ? t.game.acceptedAnswers : t.game.correctAnswer}</p>
          {correctOpts.length > 0 && <div className="flex flex-col gap-2">{correctOpts.map(({ o, i }) => <AnswerTile key={o.id} index={i} text={o.text} disabled />)}</div>}
          {rv.accepted && <p className="text-xl font-black">{rv.accepted.filter(Boolean).join(' · ')}</p>}
          {rv.sliderAnswer != null && q?.type === 'slider' && <p className="font-display text-3xl font-black">{rv.sliderAnswer}</p>}
          {q?.type === 'order' && rv.correct.length > 0 && <ol className="list-decimal pl-6 font-bold">{rv.correct.map((id) => <li key={id}>{q.options.find((o) => o.id === id)?.text}</li>)}</ol>}
        </div>
      )}
      {rv?.explanation && <div className="glass w-full p-3 text-left text-sm leading-relaxed"><b className="text-orange-300">💡 {t.game.explanation}:</b> {rv.explanation}</div>}
      {!r.poll && r.rank > 0 && (
        <div className="glass mt-auto flex w-full items-center justify-between px-5 py-3">
          <span className="text-sm font-bold text-white/60">{t.game.rank}</span>
          <span className="flex items-center gap-2"><Delta d={r.prevRank ? r.prevRank - r.rank : 0} /><span className="font-display text-3xl font-black">#{r.rank}</span><span className="text-sm text-white/50">/ {r.total}</span></span>
        </div>
      )}
    </div>
  )
}

function LeaderboardView({ game, player }: { game: Game; player: Player }) {
  const r = player.lastResult
  const inTop = game.leaderboard.slice(0, 5).some((e) => e.uid === player.uid)
  return (
    <div className="flex flex-1 flex-col gap-4">
      <h2 className="flex items-center justify-center gap-2 text-3xl font-black"><Trophy className="h-7 w-7 text-orange-400" />{t.game.leaderboard}</h2>
      <Leaderboard entries={game.leaderboard} highlight={player.uid} max={5} />
      {!inTop && r && r.rank > 0 && (
        <>
          <div className="text-center text-white/40">⋯</div>
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: 'var(--grad)', boxShadow: 'var(--glow)' }}>
            <span className="font-display w-9 text-center font-black">{r.rank}</span>
            <Avatar avatar={player.avatar} size={36} />
            <span className="flex-1 font-bold">{t.game.you}</span>
            <Delta d={r.prevRank ? r.prevRank - r.rank : 0} />
            <span className="font-display font-black">{player.score.toLocaleString('az-AZ')}</span>
          </div>
        </>
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
      <h2 className="text-3xl font-black">{t.game.gameOver}</h2>
      {r && r.rank > 0 && <p className="font-display text-grad text-6xl font-black">#{r.rank}</p>}
    </div>
  )
}
