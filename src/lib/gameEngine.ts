import {
  collection, doc, getDoc, getDocFromServer, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch, query, where,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { loadQuiz } from '../firebase/db'
import type { Answer, AvatarData, Game, GameStats, HistoryItem, LeaderEntry, LobbyEntry, Player, PublicQuestion, Question, QuizSettings, Reveal } from '../types'
import { evaluateAnswer, normalizeText, rankPlayers, SCORED_TYPES, basePoints, streakBonus } from './scoring'
import { randomPin } from './pin'
import { shuffle } from './shuffle'
import { serverNow } from './timeSync'
import { shortName } from './nameFilter'

export const COUNTDOWN_MS = 3000
export const GRACE_MS = 1500
export const ACTIVE_GAME_KEY = 'qz.activeGame'

// ============ Oyunun yaradılması (bölmə 10.3) ============

export async function createGame(quizId: string, hostUid: string): Promise<string> {
  const data = await loadQuiz(quizId)
  if (!data) throw new Error('quiz-not-found')
  const { quiz } = data
  const questions = quiz.settings.shuffleQuestions ? shuffle(data.questions) : data.questions
  if (questions.length === 0) throw new Error('no-questions')

  let pin = ''
  for (let i = 0; i < 20; i++) {
    const p = randomPin()
    const s = await getDoc(doc(db, 'pins', p))
    if (!s.exists() || s.get('active') === false) { pin = p; break }
  }
  if (!pin) throw new Error('pin-failed')

  const gameRef = doc(collection(db, 'games'))
  const game: Omit<Game, 'id'> = {
    pin, quizId, hostUid, title: quiz.title, settings: quiz.settings,
    phase: 'lobby', locked: false, questionIndex: -1, totalQuestions: questions.length,
    currentQuestion: null, questionStartedAt: null, questionEndsAt: null, pausedRemainingMs: null,
    reveal: null, lobby: [], leaderboard: [], playerCount: 0, answeredCount: 0,
    startedAt: null, finishedAt: null, stats: null,
  }
  const batch = writeBatch(db)
  batch.set(doc(db, 'games', gameRef.id, 'secret', 'key'), { questions: JSON.parse(JSON.stringify(questions)) })
  batch.set(gameRef, { ...game, createdAt: serverTimestamp() })
  batch.set(doc(db, 'pins', pin), { gameId: gameRef.id, active: true, createdAt: serverTimestamp() })
  batch.set(doc(db, 'settings', 'current'), { activeGameId: gameRef.id, pin, updatedAt: serverTimestamp() })
  await batch.commit()
  return gameRef.id
}

export async function loadSecret(gameId: string): Promise<Question[]> {
  const s = await getDoc(doc(db, 'games', gameId, 'secret', 'key'))
  return (s.get('questions') as Question[]) ?? []
}

export const toPublic = (q: Question, settings?: QuizSettings): PublicQuestion => ({
  id: q.id, type: q.type, text: q.text, imageUrl: q.imageUrl || undefined,
  shuffle: q.type !== 'truefalse' && q.type !== 'order' && (q.shuffleOptions ?? settings?.shuffleOptions ?? false),
  body: q.type === 'slide' ? q.explanation || undefined : undefined,
  options: q.type === 'order' ? shuffle(q.options ?? []) : q.options ?? [],
  timeLimit: q.timeLimit, points: q.points,
  slider: q.slider ? { min: q.slider.min, max: q.slider.max, step: q.slider.step } : undefined,
  multiCount: q.type === 'multi' ? q.correct.length : undefined,
})

// ============ Host əməliyyatları ============

const gref = (gameId: string) => doc(db, 'games', gameId)

export const updateLobby = (gameId: string, players: Player[]) => {
  const active = players.filter((p) => !p.kicked)
  const lobby: LobbyEntry[] = active
    .sort((a, b) => (a.joinedAt?.toMillis() ?? 0) - (b.joinedAt?.toMillis() ?? 0))
    .map((p) => ({ uid: p.uid, firstName: p.firstName, lastName: p.lastName, avatar: p.avatar }))
  return updateDoc(gref(gameId), { lobby, playerCount: active.length })
}

export const setLocked = (gameId: string, locked: boolean) => updateDoc(gref(gameId), { locked })

export const kickPlayer = (gameId: string, uid: string) => updateDoc(doc(db, 'games', gameId, 'players', uid), { kicked: true })

/** Növbəti sualın geri sayımı. */
export const toCountdown = (gameId: string, index: number, extra: Record<string, unknown> = {}) =>
  updateDoc(gref(gameId), {
    phase: 'countdown', questionIndex: index, currentQuestion: null, reveal: null,
    questionStartedAt: null, questionEndsAt: null, pausedRemainingMs: null, answeredCount: 0, ...extra,
  })

/** Sualı aç: əvvəl server vaxtı ilə başlanğıc, sonra bitmə vaxtı. */
export async function toQuestion(gameId: string, q: Question, settings: QuizSettings) {
  await updateDoc(gref(gameId), {
    phase: 'question', currentQuestion: JSON.parse(JSON.stringify(toPublic(q, settings))), questionStartedAt: serverTimestamp(), questionEndsAt: null, pausedRemainingMs: null,
  })
  if (q.type === 'slide') return
  const snap = await getDocFromServer(gref(gameId))
  const started = snap.get('questionStartedAt') as Timestamp | null
  const startMs = started ? started.toMillis() : serverNow()
  await updateDoc(gref(gameId), { questionEndsAt: Timestamp.fromMillis(startMs + q.timeLimit * 1000) })
}

export async function pauseQuestion(game: Game) {
  if (!game.questionEndsAt) return
  const remaining = Math.max(0, game.questionEndsAt.toMillis() - serverNow())
  await updateDoc(gref(game.id), { pausedRemainingMs: remaining, questionEndsAt: null })
}

export async function resumeQuestion(game: Game) {
  if (game.pausedRemainingMs == null) return
  await updateDoc(gref(game.id), { questionEndsAt: Timestamp.fromMillis(serverNow() + game.pausedRemainingMs), pausedRemainingMs: null })
}

/** Vaxtı dərhal bitir (bir az gecikmə ilə cavabların çatması üçün). */
export const endTimeNow = (gameId: string) => updateDoc(gref(gameId), { questionEndsAt: Timestamp.fromMillis(serverNow()), pausedRemainingMs: null })

export const answersQuery = (gameId: string, qIndex: number) => query(collection(db, 'games', gameId, 'answers'), where('questionIndex', '==', qIndex))

export async function fetchAnswers(gameId: string, qIndex: number): Promise<Map<string, Answer>> {
  const snap = await getDocs(answersQuery(gameId, qIndex))
  const m = new Map<string, Answer>()
  snap.docs.forEach((d) => {
    const a = d.data() as Answer
    m.set(a.uid, a)
  })
  return m
}

export async function fetchPlayers(gameId: string): Promise<Player[]> {
  const snap = await getDocs(collection(db, 'games', gameId, 'players'))
  return snap.docs.map((d) => ({ ...(d.data() as Player), uid: d.id }))
}

const leaderboardOf = (ranked: (Player & { rank: number })[], prevRank: Map<string, number>, n = 10): LeaderEntry[] =>
  ranked.slice(0, n).map((p) => ({
    uid: p.uid, name: shortName(p.firstName, p.lastName), avatar: p.avatar, score: p.score, rank: p.rank,
    delta: prevRank.has(p.uid) ? prevRank.get(p.uid)! - p.rank : 0,
  }))

/**
 * Sualı bağla və xalları hesabla (bölmə 10.4, addım 3).
 * Bir batch: bütün oyunçu sənədləri + oyun sənədi (phase=reveal).
 */
export async function finishQuestion(game: Game, questions: Question[]) {
  const qi = game.questionIndex
  const q = questions[qi]
  if (!q) return
  const [players, answers] = await Promise.all([fetchPlayers(game.id), fetchAnswers(game.id, qi)])
  const startedMs = game.questionStartedAt?.toMillis() ?? 0
  const settings = game.settings
  const prevRanked = rankPlayers(players.filter((p) => !p.kicked))
  const prevRank = new Map(qi > 0 ? prevRanked.map((p) => [p.uid, p.rank] as [string, number]) : [])

  const distribution: Record<string, number> = {}
  const texts: string[] = []
  if (['single', 'multi', 'truefalse', 'poll'].includes(q.type)) q.options.forEach((o) => (distribution[o.id] = 0))

  const updated = players.map((p) => {
    if (p.kicked) return { p, item: null as HistoryItem | null, bonus: 0, answered: false }
    const a = answers.get(p.uid)
    const answered = !!a
    const timeMs = a?.answeredAt ? Math.max(0, a.answeredAt.toMillis() - startedMs) : null
    const value = a?.value ?? null
    if (a) {
      if (Array.isArray(a.value)) a.value.forEach((v) => { if (v in distribution) distribution[v]++ })
      else if (q.type === 'single' || q.type === 'truefalse' || q.type === 'poll') { const v = String(a.value); if (v in distribution) distribution[v]++ }
      else if (q.type === 'type' || q.type === 'wordcloud' || q.type === 'open') { if (texts.length < 200) texts.push(String(a.value).slice(0, 140)) }
      else if (q.type === 'slider') { const k = String(a.value); distribution[k] = (distribution[k] ?? 0) + 1 }
      if (q.type === 'type') { const k = normalizeText(String(a.value)); distribution[k] = (distribution[k] ?? 0) + 1 }
    }
    const ev = evaluateAnswer(q, value, timeMs ?? q.timeLimit * 1000, settings.scoring)
    let bonus = 0
    const np = { ...p }
    if (ev.scored) {
      if (ev.correct) {
        np.streak = (p.streak ?? 0) + 1
        np.bestStreak = Math.max(p.bestStreak ?? 0, np.streak)
        np.correctCount = (p.correctCount ?? 0) + 1
        np.totalCorrectTimeMs = (p.totalCorrectTimeMs ?? 0) + (timeMs ?? 0)
        if (settings.streakBonus && basePoints(q.points) > 0) bonus = streakBonus(np.streak)
      } else {
        np.streak = 0
      }
      np.score = (p.score ?? 0) + ev.points + bonus
    }
    const item: HistoryItem = { q: qi, answer: value, correct: ev.correct, points: ev.points + bonus, timeMs }
    np.history = [...(p.history ?? []), item]
    return { p: np, item, bonus, answered, ev }
  })

  const ranked = rankPlayers(updated.filter((u) => !u.p.kicked).map((u) => u.p))
  const rankMap = new Map(ranked.map((p) => [p.uid, p.rank]))

  const reveal: Reveal = {
    correct: q.type === 'poll' ? [] : q.correct,
    accepted: q.type === 'type' ? q.accepted : undefined,
    sliderAnswer: q.slider?.answer,
    explanation: q.explanation || undefined,
    distribution,
    answeredCount: answers.size,
    texts: texts.length ? texts : undefined,
  }

  const batch = writeBatch(db)
  for (const u of updated) {
    if (u.p.kicked || !u.item) continue
    const ev = (u as { ev?: { correct: boolean; points: number; scored: boolean } }).ev!
    batch.update(doc(db, 'games', game.id, 'players', u.p.uid), {
      score: u.p.score, correctCount: u.p.correctCount ?? 0, streak: u.p.streak ?? 0, bestStreak: u.p.bestStreak ?? 0,
      totalCorrectTimeMs: u.p.totalCorrectTimeMs ?? 0, history: u.p.history,
      lastResult: {
        questionIndex: qi, correct: ev.correct, points: ev.points, streakBonus: u.bonus, rank: rankMap.get(u.p.uid) ?? 0,
        prevRank: prevRank.get(u.p.uid) ?? 0, answered: u.answered, poll: !ev.scored, streak: u.p.streak ?? 0, total: ranked.length,
      },
    })
  }
  batch.update(gref(game.id), {
    phase: 'reveal', reveal: JSON.parse(JSON.stringify(reveal)), leaderboard: leaderboardOf(ranked, prevRank),
    answeredCount: answers.size, playerCount: ranked.length, questionEndsAt: null, pausedRemainingMs: null,
  })
  await batch.commit()
}

/** Reveal-dan sonra növbəti addım. */
export function nextAfterReveal(game: Game): 'leaderboard' | 'question' | 'podium' {
  const last = game.questionIndex >= game.totalQuestions - 1
  if (last) return 'podium'
  const every = game.settings.leaderboardEvery
  if (every === 1 || (every === 3 && (game.questionIndex + 1) % 3 === 0)) return 'leaderboard'
  return 'question'
}

export const toPhase = (gameId: string, phase: Game['phase']) => updateDoc(gref(gameId), { phase })

/** Oyunu bitir: statistika + oyunçular üçün sual icmalı. */
export async function finishGame(game: Game, questions: Question[]) {
  const players = (await fetchPlayers(game.id)).filter((p) => !p.kicked)
  const ranked = rankPlayers(players)
  const asked = Math.max(0, Math.min(game.totalQuestions, game.questionIndex + (game.phase === 'question' || game.phase === 'countdown' ? 0 : 1)))
  const scoredIdx = questions.slice(0, asked).map((q, i) => ({ q, i })).filter(({ q }) => SCORED_TYPES.has(q.type))
  const perQ = scoredIdx.map(({ q, i }) => {
    const answered = players.filter((p) => p.history?.some((h) => h.q === i))
    const correct = players.filter((p) => p.history?.some((h) => h.q === i && h.correct)).length
    return { index: i, text: q.text, accuracy: players.length ? correct / players.length : 0, answered: answered.length }
  })
  const totalCorrect = players.reduce((s, p) => s + (p.correctCount ?? 0), 0)
  const stats: GameStats = {
    players: players.length,
    avgAccuracy: players.length && scoredIdx.length ? totalCorrect / (players.length * scoredIdx.length) : 0,
  }
  if (perQ.length) {
    const sorted = [...perQ].sort((a, b) => a.accuracy - b.accuracy)
    stats.hardest = { index: sorted[0].index, text: sorted[0].text, accuracy: sorted[0].accuracy }
    stats.easiest = { index: sorted[sorted.length - 1].index, text: sorted[sorted.length - 1].text, accuracy: sorted[sorted.length - 1].accuracy }
  }
  const review = questions.slice(0, asked).map((q) => ({
    type: q.type, text: q.text, options: q.options, correct: q.type === 'poll' ? [] : q.correct, accepted: q.accepted ?? null,
    sliderAnswer: q.slider?.answer ?? null, explanation: q.explanation ?? null, scored: SCORED_TYPES.has(q.type),
  }))
  const prevRank = new Map(ranked.map((p) => [p.uid, p.rank]))
  const batch = writeBatch(db)
  batch.update(gref(game.id), {
    phase: 'finished', finishedAt: serverTimestamp(), stats: JSON.parse(JSON.stringify(stats)),
    leaderboard: leaderboardOf(ranked, prevRank, 200), review: JSON.parse(JSON.stringify(review)), scoredCount: scoredIdx.length,
    currentQuestion: null, questionEndsAt: null,
  })
  batch.update(doc(db, 'pins', game.pin), { active: false })
  await batch.commit()
}

// ============ Oyunçu əməliyyatları ============

export async function lookupPin(pin: string): Promise<string | null> {
  const s = await getDoc(doc(db, 'pins', pin))
  if (!s.exists() || s.get('active') === false) return null
  return s.get('gameId') as string
}

export async function joinGame(gameId: string, uid: string, firstName: string, lastName: string, avatar: AvatarData) {
  const ref = doc(db, 'games', gameId, 'players', uid)
  const existing = await getDoc(ref).catch(() => null)
  if (existing?.exists()) {
    await updateDoc(ref, { firstName, lastName, avatar, lastSeen: serverTimestamp() })
    return
  }
  await setDoc(ref, {
    firstName, lastName, avatar, joinedAt: serverTimestamp(), lastSeen: serverTimestamp(), kicked: false,
    score: 0, correctCount: 0, streak: 0, bestStreak: 0, totalCorrectTimeMs: 0, lastResult: null, history: [],
  })
}

export const submitAnswer = (gameId: string, uid: string, questionIndex: number, value: Answer['value']) =>
  setDoc(doc(db, 'games', gameId, 'answers', `${uid}_${questionIndex}`), { uid, questionIndex, value, answeredAt: serverTimestamp() })

export const heartbeat = (gameId: string, uid: string) => updateDoc(doc(db, 'games', gameId, 'players', uid), { lastSeen: serverTimestamp() })

export const sendReaction = (gameId: string, uid: string, emoji: string) =>
  setDoc(doc(collection(db, 'games', gameId, 'reactions')), { uid, emoji, createdAt: serverTimestamp() })

export type { QuizSettings }
