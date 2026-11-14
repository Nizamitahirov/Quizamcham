import { BrandLogo, brandVars } from '../../components/CompanyBrand'
import { confirmDialog } from '../../components/dialogs'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { collection, onSnapshot, query, where, orderBy, Timestamp } from 'firebase/firestore'
import { AnimatePresence, motion } from 'framer-motion'
import { db } from '../../firebase/config'
import { useAdmin } from '../../firebase/auth'
import { useGame } from '../../lib/hooks'
import {
  answersQuery, assignTeams, createGame, grantFifty, setQuestionEnd, readMsFor, startSelf, endTimeNow, finishGame, finishQuestion, GRACE_MS, kickPlayer, loadSecret, nextAfterReveal,
  pauseQuestion, resumeQuestion, scheduleQuestion, updateLeaderboard, fetchPlayers, setLocked, toCountdown, toPhase, toQuestion, updateLobby,
} from '../../lib/gameEngine'
import { serverNow, syncClock } from '../../lib/timeSync'
import { t } from '../../i18n/az'
import { audio } from '../../audio/AudioEngine'
import { Spinner } from '../../components/ui'
import { useMuted } from '../../components/MuteButton'
import { FloatingShapes } from '../../components/FloatingShapes'
import { FloatingEmojis, useFlying } from '../../components/FloatingEmojis'
import { QuestionIntro } from '../../components/QuestionIntro'
import { useLeaveGuard, useWakeLock } from '../../lib/useWakeLock'
import { useOnline } from '../../components/ui'
import { FuturisticBg } from '../../components/FuturisticBg'
import { Lock, Unlock, Maximize, Volume2, VolumeX, Pause, Play, SkipForward, Flag, ChevronRight, Users } from 'lucide-react'
import { celebrate } from '../../components/Confetti'
import { HostLobby } from './HostLobby'
import { HostQuestion, HostReveal } from './HostQuestion'
import { HostLeaderboard, HostPodium } from './HostPodium'
import HostSummary from './HostSummary'
import { HostSelf } from './HostSelf'
import { useSelfEngine } from './useSelfEngine'
import { HostQA, useQA } from '../../components/QA'
import { MessageCircleQuestion, ShieldAlert } from 'lucide-react'
import { IntegrityTable, useIntegrityRows } from '../../components/IntegrityPanel'
import { flagSevere } from '../../lib/integrity'
import { Modal } from '../../components/ui'
import type { Game, Player, Question } from '../../types'

export default function HostGame() {
  const { gameId } = useParams()
  const admin = useAdmin()
  if (admin.loading) return <div className="flex min-h-dvh items-center justify-center bg-night"><Spinner /></div>
  if (!admin.isAdmin) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-night p-6 text-center">
        <p className="text-xl">{t.host.notHost}</p>
        <Link className="btn btn-primary" to="/admin/login">{t.admin.signIn}</Link>
      </div>
    )
  }
  // ilk girişdə şifrə dəyişdirilməyibsə, əvvəlcə admin panelində yeni şifrə təyin olunmalıdır
  if (admin.mustChangePassword) return <Navigate to="/admin" replace />
  return <HostConsole gameId={gameId!} uid={admin.user!.uid} isOwner={admin.perms.allContent} />
}

function HostConsole({ gameId, uid, isOwner }: { gameId: string; uid: string; isOwner: boolean }) {
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

  useEffect(() => { void loadSecret(gameId).then(setQuestions).catch(() => setQuestions([])) }, [gameId])
  const running = !!game && game.phase !== 'finished' && game.phase !== 'lobby'
  useWakeLock(!!game && game.phase !== 'finished')
  useLeaveGuard(running)
  const online = useOnline()
  const [qaOpen, setQaOpen] = useState(false)
  const [igOpen, setIgOpen] = useState(false)
  const qaItems = useQA(gameId, game?.settings.qa !== false)
  const qaOpenCount = qaItems.filter((q) => !q.answered && !q.hidden).length
  useEffect(() => { void syncClock(`games/${gameId}/secret/clock`) }, [gameId])

  // Oyunçular (yalnız host bütün kolleksiyanı dinləyir)
  useEffect(() => onSnapshot(collection(db, 'games', gameId, 'players'), (snap) => setPlayers(snap.docs.map((d) => ({ ...(d.data() as Player), uid: d.id })))), [gameId])

  const active = useMemo(() => players.filter((p) => !p.kicked), [players])

  // Lobbi massivini denormalizə et (debounce)
  const lobbySig = useMemo(() => [...active].sort((a, b) => (a.joinedAt?.toMillis() ?? 0) - (b.joinedAt?.toMillis() ?? 0)).slice(-60).map((p) => `${p.uid}:${p.firstName}:${p.lastName}:${p.avatar?.seed}:${p.avatar?.accessory ?? ''}`).sort().join('|') + `#${active.length}`, [active])
  const gameLobbySig = useMemo(() => (game?.lobby ?? []).map((p) => `${p.uid}:${p.firstName}:${p.lastName}:${p.avatar?.seed}:${p.avatar?.accessory ?? ''}`).sort().join('|') + `#${game?.playerCount ?? 0}`, [game?.lobby, game?.playerCount])
  const prevCount = useRef(0)
  useEffect(() => {
    if (!game || game.phase === 'finished' || lobbySig === gameLobbySig) return
    const id = setTimeout(() => void updateLobby(gameId, players).catch(() => {}), 1200)
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
    if (game.phase === 'lobby' || game.phase === 'self') void audio.play('lobby')
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
    const qi = game.questionIndex
    const startMs = game.questionStartedAt?.toMillis()
    if (!startMs) {
      // Başlama vaxtı yazılmayıb (şəbəkə): 2.5 s sonra təmir, alınmasa oxuma vaxtından sonra köhnə üsulla başlat
      const readMs = game.preview?.readMs ?? readMsFor(game.settings, q)
      const a = setTimeout(() => void once(`sch-${qi}`, () => scheduleQuestion(gameId, qi, q, game.settings)), 2500)
      const b = setTimeout(() => void once(`q-${qi}`, () => toQuestion(gameId, qi, q, game.settings)), readMs + 4000)
      return () => { clearTimeout(a); clearTimeout(b) }
    }
    const id = setTimeout(() => void once(`q-${qi}`, () => toQuestion(gameId, qi, q, game.settings)), Math.max(0, startMs - serverNow()))
    return () => clearTimeout(id)
  }, [game, questions, gameId, once])

  // 50/50 sorğularını emal et
  useEffect(() => {
    if (!game || !questions || (game.phase !== 'question' && game.phase !== 'self') || game.settings.powerUps === false) return
    players.forEach((p) => {
      const qi = game.phase === 'self' ? p.power?.q ?? -1 : game.questionIndex
      const q = questions[qi]
      if (!q || p.kicked || p.power?.type !== 'fifty' || p.power.q !== qi || p.fiftyHide?.q === qi) return
      const key = `ff-${qi}-${p.uid}`
      if (guard.current.has(key)) return
      guard.current.add(key)
      void grantFifty(gameId, p, q, qi).catch(() => guard.current.delete(key))
    })
  }, [game, questions, players, gameId])

  const activeCount = active.length
  useEffect(() => {
    if (!game || !questions || game.phase !== 'question' || game.currentQuestion?.type === 'slide') return
    const check = () => {
      if (game.pausedRemainingMs != null) return
      if (!game.questionEndsAt) {
        // Təmir: bitmə vaxtı yazılmayıbsa (şəbəkə kəsintisi), 3 s sonra yenidən yaz — yoxsa oyunçular cavab verə bilməz
        const started = game.questionStartedAt?.toMillis()
        if (started && serverNow() - started > 3000) void once(`end-${game.questionIndex}-${Math.floor(serverNow() / 5000)}`, () => setQuestionEnd(gameId, game.currentQuestion?.timeLimit ?? 30))
        return
      }
      const left = game.questionEndsAt.toMillis() - serverNow()
      const allIn = activeCount > 0 && answered.size >= activeCount
      if (left <= -GRACE_MS || (allIn && left > 0)) void once(`f-${game.questionIndex}`, () => finishQuestion(game, questions))
      else if (left <= 0 && allIn) void once(`f-${game.questionIndex}`, () => finishQuestion(game, questions))
    }
    check()
    const id = setInterval(check, 250)
    return () => clearInterval(id)
  }, [game, questions, answered, activeCount, once, gameId])

  // Komandaları host bölüşdürür (yeni qoşulanlar)
  const teamSig = useMemo(() => active.map((p) => `${p.uid}:${p.team ?? '-'}`).join('|'), [active])
  useEffect(() => {
    const n = game?.settings.teams ?? 0
    if (!game || !n || game.phase === 'finished' || !active.some((p) => p.team == null || p.team >= n)) return
    const id = setTimeout(() => void assignTeams(gameId, active, n).catch(() => {}), 400)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamSig, game?.settings.teams, game?.phase])

  // ---- Öz tempində rejimi (ayrıca hook) ----
  const gameRef = useSelfEngine({ game, questions, active, gameId, guard, once })

  // ---- İdarə ----
  const next = useCallback(() => {
    if (!game || !questions || busy) return
    const i = game.questionIndex
    switch (game.phase) {
      case 'lobby':
        if (activeCount === 0) return
        audio.unlock()
        if (game.settings.mode === 'self') void once('start', () => startSelf(game, questions))
        else void once('start', () => toCountdown(gameId, 0, questions[0], game.settings, { startedAt: Timestamp.fromMillis(serverNow()) }))
        break
      case 'self':
        // nəticələr podiumda açıqlanır
        void once('self-end', async () => {
          await updateLeaderboard(gameId, await fetchPlayers(gameId), game.leaderboard ?? [], game.settings.teams ?? 0)
          await toPhase(gameId, 'podium')
        })
        break
      case 'question':
        if (game.currentQuestion?.type === 'slide') {
          if (i >= game.totalQuestions - 1) void once(`p`, () => toPhase(gameId, 'podium'))
          else void once(`c-${i + 1}`, () => toCountdown(gameId, i + 1, questions[i + 1], game.settings))
        } else void once(`e-${i}`, () => endTimeNow(gameId))
        break
      case 'reveal': {
        const step = nextAfterReveal(game)
        if (step === 'leaderboard') void once(`l-${i}`, () => toPhase(gameId, 'leaderboard'))
        else if (step === 'podium') void once('p', () => toPhase(gameId, 'podium'))
        else void once(`c-${i + 1}`, () => toCountdown(gameId, i + 1, questions[i + 1], game.settings))
        break
      }
      case 'leaderboard':
        void once(`c-${i + 1}`, () => toCountdown(gameId, i + 1, questions[i + 1], game.settings))
        break
      case 'podium':
        void once('fin', () => finishGame(game, questions))
        break
    }
  }, [game, questions, busy, activeCount, gameId, once])

  // Avtomatik rejim: nəticə / reytinq / podium ekranlarından özü keçir
  const [autoLeft, setAutoLeft] = useState<number | null>(null)
  const nextRef = useRef(next)
  useEffect(() => { nextRef.current = next }, [next])
  useEffect(() => {
    if (!game || game.settings.mode !== 'auto' || !['reveal', 'leaderboard', 'podium'].includes(game.phase)) { setAutoLeft(null); return }
    const total = (game.phase === 'podium' ? 10 : game.settings.autoDelay || 6) * 1000
    const start = Date.now()
    const startPhase = game.phase
    const startQi = game.questionIndex
    setAutoLeft(Math.ceil(total / 1000))
    const id = setInterval(() => {
      const left = total - (Date.now() - start)
      setAutoLeft(Math.max(0, Math.ceil(left / 1000)))
      if (left <= 0) {
        // host əməliyyatı hələ bitməyibsə (busy), növbəti tikdə yenidən cəhd et
        nextRef.current()
        if (gameRef.current?.phase !== startPhase || gameRef.current?.questionIndex !== startQi) clearInterval(id)
      }
    }, 250)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.phase, game?.questionIndex, game?.settings.mode])

  const togglePause = useCallback(() => {
    if (!game || game.phase !== 'question') return
    if (game.pausedRemainingMs != null) void resumeQuestion(game)
    else void pauseQuestion(game)
  }, [game])

  const skip = useCallback(() => {
    if (!game || !questions) return
    const i = game.questionIndex
    if (i >= game.totalQuestions - 1) void once('p', () => toPhase(gameId, 'podium'))
    else void once(`c-${i + 1}`, () => toCountdown(gameId, i + 1, questions[i + 1], game.settings))
  }, [game, questions, gameId, once])

  const endGame = useCallback(async () => {
    if (!game || !questions || !(await confirmDialog({ title: t.host.endGameConfirm, danger: true }))) return
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

  if (loading || !questions) return <div className="flex min-h-dvh items-center justify-center bg-night"><Spinner /></div>
  if (missing || !game) return <div className="flex min-h-dvh items-center justify-center bg-night text-2xl">{t.app.notFound}</div>
  if (game.hostUid !== uid && !isOwner) return <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-night p-6 text-center text-xl">{t.admin.noAccess}<Link className="btn btn-primary" to="/admin">{t.host.backToAdmin}</Link></div>

  const nextLabel = game.phase === 'lobby' ? t.host.start
    : game.phase === 'reveal' ? ({ leaderboard: t.host.showLeaderboard, podium: t.host.showPodium, question: t.host.next })[nextAfterReveal(game)]
      : game.phase === 'podium' ? t.host.fullList : t.host.next
  const ctx: HostCtx = { game, questions, players: active, answered, busy }
  const progress = game.totalQuestions ? Math.max(0, (game.questionIndex + (game.phase === 'reveal' || game.phase === 'leaderboard' ? 1 : 0)) / game.totalQuestions) : 0
  const isQ = game.phase === 'question' && game.currentQuestion?.type !== 'slide'

  return (
    <div className={`noise relative flex h-dvh flex-col overflow-hidden ${game.phase === 'podium' ? 'bg-brand' : 'bg-night'}`} style={brandVars(game.brand)}>
      {game.phase !== 'podium' && <FuturisticBg floor={game.phase === 'lobby' || game.phase === 'leaderboard'} intensity={isQ ? 0.5 : 1} />}
      {(game.phase === 'podium' || game.phase === 'leaderboard') && <FloatingShapes count={16} />}
      <FloatingEmojis items={flying.items} size={64} />
      {!online && <div className="absolute inset-x-0 top-0 z-50 bg-red-600 py-2 text-center text-lg font-bold" role="alert">{t.host.offline}</div>}
      {!opened && game.phase !== 'finished' && (
        <button className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-night/90 text-[#fff] backdrop-blur" onClick={() => { audio.unlock(); setOpened(true) }}>
          <BrandLogo brand={game.brand} size={72} />
          <span className="btn btn-primary btn-lg text-2xl"><Play className="fill-current" />{t.host.openLobby}</span>
          <span className="text-lg text-white/60">{t.host.openLobbyHint}</span>
        </button>
      )}
      <header className="relative z-20 flex items-center gap-2 px-4 pt-4 sm:gap-4 lg:px-8 lg:pt-5">
        <BrandLogo brand={game.brand} size={36} mono={game.phase === 'podium'} />
        {game.brand && <span className="hidden text-[10px] font-semibold uppercase tracking-widest text-white/40 sm:inline">Jabr</span>}
        <span className="chip chip-dark"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />{t.host.live}</span>
        {game.phase !== 'lobby' && game.phase !== 'finished' && (
          <div className="mx-2 h-2 flex-1 overflow-hidden rounded-full bg-white/10 lg:mx-6">
            <motion.div className="h-full rounded-full" style={{ background: 'var(--grad)' }} animate={{ width: `${progress * 100}%` }} />
          </div>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="chip chip-dark text-base"><Users className="h-4 w-4" />{active.length}</span>
          <span className="font-display whitespace-nowrap rounded-xl border border-white/15 bg-white/[.06] px-2.5 py-1 text-base font-black tracking-widest sm:px-4 sm:py-1.5 sm:text-xl">PIN {game.pin}</span>
        </span>
      </header>
      {qaOpen && <HostQA gameId={gameId} onClose={() => setQaOpen(false)} />}
      <main className="relative z-10 flex min-h-0 flex-1 flex-col">
        <AnimatePresence mode="wait">
          <motion.div key={game.phase + game.questionIndex} className="flex min-h-0 flex-1 flex-col" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            {game.phase === 'lobby' && <HostLobby {...ctx} onKick={async (p) => (await confirmDialog({ title: t.host.kickConfirm(`${p.firstName} ${p.lastName}`), danger: true })) && void kickPlayer(gameId, p.uid)} />}
            {game.phase === 'countdown' && game.preview && <div className="m-auto w-full"><QuestionIntro big preview={game.preview} total={game.totalQuestions} /></div>}
            {game.phase === 'question' && <HostQuestion {...ctx} />}
            {game.phase === 'reveal' && <HostReveal {...ctx} />}
            {game.phase === 'leaderboard' && <HostLeaderboard game={game} />}
            {game.phase === 'podium' && <HostPodium game={game} />}
            {game.phase === 'finished' && <HostSummary game={game} onNewGame={newGame} />}
            {game.phase === 'self' && <HostSelf game={game} players={active} />}
          </motion.div>
        </AnimatePresence>
      </main>
      {game.phase !== 'finished' && (
        <footer className="relative z-20 m-4 mt-0 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-night2/80 px-4 py-3 backdrop-blur-xl">
          {game.phase === 'lobby' && (
            <button className="btn btn-ghost" onClick={() => void setLocked(gameId, !game.locked)}>{game.locked ? <><Unlock />{t.host.unlock}</> : <><Lock />{t.host.lock}</>}</button>
          )}
          {isQ && (
            <>
              <button className="btn btn-ghost" onClick={togglePause}>{game.pausedRemainingMs != null ? <><Play />{t.host.resume}</> : <><Pause />{t.host.pause}</>}</button>
              <button className="btn btn-ghost" onClick={skip} disabled={busy}><SkipForward />{t.host.skip}</button>
            </>
          )}
          <button className="btn btn-ghost btn-icon" aria-label={t.a11y.music} onClick={() => { audio.unlock(); audio.toggleMute() }}>{muted ? <VolumeX /> : <Volume2 />}</button>
          <button className="btn btn-ghost btn-icon" aria-label={t.a11y.fullscreen} onClick={toggleFs}><Maximize /></button>
          {game.settings.qa !== false && <button className="btn btn-ghost" onClick={() => setQaOpen((o) => !o)}><MessageCircleQuestion />{t.qa.hostTitle(qaOpenCount)}</button>}
          {(game.settings.integrity ?? 'off') !== 'off' && <IntegrityButton gameId={game.id} open={igOpen} setOpen={setIgOpen} />}
          {game.phase !== 'lobby' && <button className="btn btn-ghost" onClick={endGame}><Flag />{t.host.endGame}</button>}
          <span className="ml-auto hidden text-xs text-white/40 xl:inline">{t.host.shortcuts}</span>
          {autoLeft != null && <span className="chip chip-dark text-sm">{t.host.autoNext(autoLeft)}</span>}
          {game.phase !== 'countdown' && (
            <button className="btn btn-primary btn-lg min-w-52" onClick={next} disabled={busy || (game.phase === 'lobby' && activeCount === 0)} title={game.phase === 'lobby' && activeCount === 0 ? t.host.minPlayers : undefined}>
              {isQ ? t.host.endTime : game.phase === 'self' ? t.host.finish : nextLabel}<ChevronRight />
            </button>
          )}
        </footer>
      )}
    </div>
  )
}

export interface HostCtx { game: Game; questions: Question[]; players: Player[]; answered: Set<string>; busy: boolean }

/** Host: dürüstlük qeydləri — şübhəli iştirakçıların sayı və cədvəl. */
function IntegrityButton({ gameId, open, setOpen }: { gameId: string; open: boolean; setOpen: (v: boolean) => void }) {
  const rows = useIntegrityRows(gameId)
  const flagged = rows.filter((r) => flagSevere(r.counts) > 0).length
  return (
    <>
      <button className={`btn ${flagged ? 'btn-danger' : 'btn-ghost'}`} onClick={() => setOpen(true)} title={t.integrity.report}><ShieldAlert />{flagged ? t.integrity.flagged(flagged) : t.integrity.title}</button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.integrity.report} wide><div className="-mx-6"><IntegrityTable rows={rows} /></div></Modal>
    </>
  )
}
