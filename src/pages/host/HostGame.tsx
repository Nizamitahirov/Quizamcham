import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { collection, onSnapshot, query, where, orderBy, Timestamp } from 'firebase/firestore'
import { AnimatePresence, motion } from 'framer-motion'
import { db } from '../../firebase/config'
import { useAdmin } from '../../firebase/auth'
import { useGame } from '../../lib/hooks'
import {
  answersQuery, COUNTDOWN_MS, createGame, endTimeNow, finishGame, finishQuestion, GRACE_MS, kickPlayer, loadSecret, nextAfterReveal,
  pauseQuestion, resumeQuestion, setLocked, toCountdown, toPhase, toQuestion, updateLobby,
} from '../../lib/gameEngine'
import { serverNow, syncClock } from '../../lib/timeSync'
import { t } from '../../i18n/az'
import { audio } from '../../audio/AudioEngine'
import { Spinner } from '../../components/ui'
import { useMuted } from '../../components/MuteButton'
import { FloatingShapes } from '../../components/FloatingShapes'
import { FloatingEmojis, useFlying } from '../../components/FloatingEmojis'
import { Countdown } from '../../components/Countdown'
import { celebrate } from '../../components/Confetti'
import { HostLobby } from './HostLobby'
import { HostQuestion, HostReveal } from './HostQuestion'
import { HostLeaderboard, HostPodium } from './HostPodium'
import HostSummary from './HostSummary'
import type { Game, Player, Question } from '../../types'

export default function HostGame() {
  const { gameId } = useParams()
  const admin = useAdmin()
  if (admin.loading) return <div className="flex min-h-dvh items-center justify-center bg-deep"><Spinner /></div>
  if (!admin.isAdmin) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-deep p-6 text-center">
        <p className="text-xl">{t.host.notHost}</p>
        <Link className="btn btn-primary" to="/admin/login">{t.admin.signIn}</Link>
      </div>
    )
  }
  return <HostConsole gameId={gameId!} uid={admin.user!.uid} />
}

function HostConsole({ gameId, uid }: { gameId: string; uid: string }) {
  const nav = useNavigate()
  const { data: game, loading, missing } = useGame(gameId)
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [answered, setAnswered] = useState<Set<string>>(new Set())
  const [opened, setOpened] = useState(false)
  const [busy, setBusy] = useState(false)
  const muted = useMuted()
  const flying = useFlying()
  const guard = useRef<Set<string>>(new Set())

  useEffect(() => { void loadSecret(gameId).then(setQuestions) }, [gameId])
  useEffect(() => { void syncClock(`games/${gameId}/secret/clock`) }, [gameId])

  // Oyunçular (yalnız host bütün kolleksiyanı dinləyir)
  useEffect(() => onSnapshot(collection(db, 'games', gameId, 'players'), (snap) => setPlayers(snap.docs.map((d) => ({ ...(d.data() as Player), uid: d.id })))), [gameId])

  const active = useMemo(() => players.filter((p) => !p.kicked), [players])

  // Lobbi massivini denormalizə et (debounce)
  const lobbySig = useMemo(() => active.map((p) => `${p.uid}:${p.firstName}:${p.lastName}:${p.avatar?.seed}:${p.avatar?.accessory ?? ''}`).sort().join('|'), [active])
  const gameLobbySig = useMemo(() => (game?.lobby ?? []).map((p) => `${p.uid}:${p.firstName}:${p.lastName}:${p.avatar?.seed}:${p.avatar?.accessory ?? ''}`).sort().join('|'), [game?.lobby])
  const prevCount = useRef(0)
  useEffect(() => {
    if (!game || game.phase === 'finished' || lobbySig === gameLobbySig) return
    const id = setTimeout(() => void updateLobby(gameId, players).catch(() => {}), 700)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbySig, gameLobbySig])
  useEffect(() => {
    if (active.length > prevCount.current && game?.phase === 'lobby') audio.pop()
    prevCount.current = active.length
  }, [active.length, game?.phase])

  // Cari sualın cavabları
  const qi = game?.questionIndex ?? -1
  useEffect(() => {
    if (qi < 0) return
    setAnswered(new Set())
    return onSnapshot(answersQuery(gameId, qi), (snap) => setAnswered(new Set(snap.docs.map((d) => d.get('uid') as string))))
  }, [gameId, qi])

  // Reaksiyalar (yalnız bu sessiyadan sonrakılar)
  useEffect(() => {
    const since = Timestamp.fromMillis(Date.now() - 5000)
    return onSnapshot(query(collection(db, 'games', gameId, 'reactions'), where('createdAt', '>', since), orderBy('createdAt')), (snap) => {
      snap.docChanges().forEach((c) => { if (c.type === 'added') flying.add(c.doc.get('emoji')) })
    }, () => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId])

  // Musiqi
  useEffect(() => {
    if (!game || !opened) return
    audio.setTheme(game.settings.music?.theme ?? 'energetic')
    audio.setVolume(game.settings.music?.on === false ? 0 : game.settings.music?.volume ?? 60)
    if (game.phase === 'lobby') void audio.play('lobby')
    else if (game.phase === 'question' && game.currentQuestion?.type !== 'slide') void audio.play('question')
    else if (game.phase === 'podium') { audio.fanfare(); celebrate(5000) }
    else audio.stopMusic()
    if (game.phase === 'reveal') audio.whoosh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.phase, game?.questionIndex, opened])
  useEffect(() => () => audio.stopMusic(), [])

  const once = useCallback(async (key: string, fn: () => Promise<unknown>) => {
    if (guard.current.has(key)) return
    guard.current.add(key)
    setBusy(true)
    try { await fn() } catch (e) { console.error(e); guard.current.delete(key) } finally { setBusy(false) }
  }, [])

  // ---- Faza mühərriki ----
  useEffect(() => {
    if (!game || !questions || game.phase !== 'countdown') return
    const q = questions[game.questionIndex]
    if (!q) return
    const id = setTimeout(() => void once(`q-${game.questionIndex}`, () => toQuestion(gameId, q, game.settings)), COUNTDOWN_MS)
    return () => clearTimeout(id)
  }, [game, questions, gameId, once])

  const activeCount = active.length
  useEffect(() => {
    if (!game || !questions || game.phase !== 'question' || game.currentQuestion?.type === 'slide') return
    const check = () => {
      if (game.pausedRemainingMs != null || !game.questionEndsAt) return
      const left = game.questionEndsAt.toMillis() - serverNow()
      const allIn = activeCount > 0 && answered.size >= activeCount
      if (left <= -GRACE_MS || (allIn && left > 0)) void once(`f-${game.questionIndex}`, () => finishQuestion(game, questions))
      else if (left <= 0 && allIn) void once(`f-${game.questionIndex}`, () => finishQuestion(game, questions))
    }
    check()
    const id = setInterval(check, 250)
    return () => clearInterval(id)
  }, [game, questions, answered, activeCount, once])

  // ---- İdarə ----
  const next = useCallback(() => {
    if (!game || !questions || busy) return
    const i = game.questionIndex
    switch (game.phase) {
      case 'lobby':
        if (activeCount === 0) return
        audio.unlock()
        void once('start', () => toCountdown(gameId, 0, { startedAt: Timestamp.fromMillis(serverNow()) }))
        break
      case 'question':
        if (game.currentQuestion?.type === 'slide') {
          if (i >= game.totalQuestions - 1) void once(`p`, () => toPhase(gameId, 'podium'))
          else void once(`c-${i + 1}`, () => toCountdown(gameId, i + 1))
        } else void once(`e-${i}`, () => endTimeNow(gameId))
        break
      case 'reveal': {
        const step = nextAfterReveal(game)
        if (step === 'leaderboard') void once(`l-${i}`, () => toPhase(gameId, 'leaderboard'))
        else if (step === 'podium') void once('p', () => toPhase(gameId, 'podium'))
        else void once(`c-${i + 1}`, () => toCountdown(gameId, i + 1))
        break
      }
      case 'leaderboard':
        void once(`c-${i + 1}`, () => toCountdown(gameId, i + 1))
        break
      case 'podium':
        void once('fin', () => finishGame(game, questions))
        break
    }
  }, [game, questions, busy, activeCount, gameId, once])

  const togglePause = useCallback(() => {
    if (!game || game.phase !== 'question') return
    if (game.pausedRemainingMs != null) void resumeQuestion(game)
    else void pauseQuestion(game)
  }, [game])

  const skip = useCallback(() => {
    if (!game) return
    const i = game.questionIndex
    if (i >= game.totalQuestions - 1) void once('p', () => toPhase(gameId, 'podium'))
    else void once(`c-${i + 1}`, () => toCountdown(gameId, i + 1))
  }, [game, gameId, once])

  const endGame = useCallback(() => {
    if (!game || !questions || !confirm(t.host.endGameConfirm)) return
    void once('fin', () => finishGame(game, questions))
  }, [game, questions, once])

  const toggleFs = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen().catch(() => {}) }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.code === 'Space') { e.preventDefault(); next() }
      else if (e.key === 'p' || e.key === 'P') togglePause()
      else if (e.key === 'm' || e.key === 'M') { audio.unlock(); audio.toggleMute() }
      else if (e.key === 'f' || e.key === 'F') toggleFs()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [next, togglePause])

  const newGame = async () => {
    if (!game) return
    const id = await createGame(game.quizId, uid)
    nav(`/host/${id}`)
  }

  if (loading || !questions) return <div className="flex min-h-dvh items-center justify-center bg-deep"><Spinner /></div>
  if (missing || !game) return <div className="flex min-h-dvh items-center justify-center bg-deep text-2xl">{t.app.notFound}</div>

  const nextLabel = game.phase === 'lobby' ? t.host.start
    : game.phase === 'reveal' ? ({ leaderboard: t.host.showLeaderboard, podium: t.host.showPodium, question: t.host.next })[nextAfterReveal(game)]
      : game.phase === 'podium' ? t.host.fullList : t.host.next

  const bg = game.phase === 'question' || game.phase === 'countdown' || game.phase === 'reveal' ? 'bg-deep' : game.phase === 'podium' ? 'bg-grad-hot' : 'bg-grad'
  const ctx: HostCtx = { game, questions, players: active, answered, busy }

  return (
    <div className={`relative flex h-dvh flex-col overflow-hidden ${bg}`}>
      {(game.phase === 'lobby' || game.phase === 'podium' || game.phase === 'leaderboard') && <FloatingShapes count={18} />}
      <FloatingEmojis items={flying.items} size={64} />
      {!opened && game.phase !== 'finished' && (
        <button className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/70 text-white" onClick={() => { audio.unlock(); setOpened(true) }}>
          <span className="font-display text-6xl">{t.host.openLobby}</span>
          <span className="text-xl opacity-80">{t.host.openLobbyHint}</span>
        </button>
      )}
      <main className="relative z-10 flex min-h-0 flex-1 flex-col">
        <AnimatePresence mode="wait">
          <motion.div key={game.phase + game.questionIndex} className="flex min-h-0 flex-1 flex-col" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            {game.phase === 'lobby' && <HostLobby {...ctx} onKick={(p) => confirm(t.host.kickConfirm(`${p.firstName} ${p.lastName}`)) && void kickPlayer(gameId, p.uid)} />}
            {game.phase === 'countdown' && <div className="m-auto"><Countdown big label={t.game.questionOf(game.questionIndex + 1, game.totalQuestions)} /></div>}
            {game.phase === 'question' && <HostQuestion {...ctx} />}
            {game.phase === 'reveal' && <HostReveal {...ctx} />}
            {game.phase === 'leaderboard' && <HostLeaderboard game={game} />}
            {game.phase === 'podium' && <HostPodium game={game} />}
            {game.phase === 'finished' && <HostSummary game={game} onNewGame={newGame} />}
          </motion.div>
        </AnimatePresence>
      </main>
      {game.phase !== 'finished' && (
        <footer className="relative z-20 flex flex-wrap items-center gap-3 bg-black/30 px-6 py-3 backdrop-blur">
          <span className="font-display rounded-xl bg-white/15 px-4 py-2 text-xl">PIN {game.pin}</span>
          {game.phase === 'lobby' && (
            <button className="btn btn-ghost" onClick={() => void setLocked(gameId, !game.locked)}>{game.locked ? t.host.unlock : t.host.lock}</button>
          )}
          {game.phase === 'question' && game.currentQuestion?.type !== 'slide' && (
            <>
              <button className="btn btn-ghost" onClick={togglePause}>{game.pausedRemainingMs != null ? t.host.resume : t.host.pause}</button>
              <button className="btn btn-ghost" onClick={skip} disabled={busy}>{t.host.skip}</button>
            </>
          )}
          <button className="btn btn-ghost" onClick={() => { audio.unlock(); audio.toggleMute() }}>{muted ? '🔇' : t.host.music}</button>
          <button className="btn btn-ghost" onClick={toggleFs}>{t.host.fullscreen}</button>
          {game.phase !== 'lobby' && <button className="btn btn-ghost" onClick={endGame}>{t.host.endGame}</button>}
          <span className="ml-auto hidden text-sm opacity-60 xl:inline">{t.host.shortcuts}</span>
          {game.phase !== 'countdown' && (
            <button className="btn btn-primary min-w-48 text-xl" onClick={next} disabled={busy || (game.phase === 'lobby' && activeCount === 0)} title={game.phase === 'lobby' && activeCount === 0 ? t.host.minPlayers : undefined}>
              {game.phase === 'question' && game.currentQuestion?.type !== 'slide' ? t.host.endTime : nextLabel}
            </button>
          )}
        </footer>
      )}
    </div>
  )
}

export interface HostCtx { game: Game; questions: Question[]; players: Player[]; answered: Set<string>; busy: boolean }
