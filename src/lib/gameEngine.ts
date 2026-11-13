import {
  collection, doc, getDoc, getDocFromServer, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch, query, where,
} from 'firebase/firestore'
import { pointQr, releaseQr } from './permQr'
import { db } from '../firebase/config'
import { loadQuiz, orgIdFor } from '../firebase/db'
import type { Answer, AvatarData, Award, Fastest, Game, GameStats, HistoryItem, HostProfile, LeaderEntry, LobbyEntry, Player, PowerType, PublicQuestion, Question, QuizSettings, Reveal, TrainerProfile } from '../types'
import { POWER_START } from './defaults'
import { applyConfidence, evaluateAnswer, matchRightId, normalizeText, parseBlanks, rankPlayers, SCORED_TYPES, basePoints, streakBonus } from './scoring'
import { randomPin } from './pin'
import { seededShuffle, shuffle } from './shuffle'
import { serverNow } from './timeSync'
import { shortName } from './nameFilter'
import { track } from '../firebase/extras'
import { computeTeams, pickTeam } from './teams'
import { planInfo } from './roles'

export const MIN_READ_MS = 3000
export const readMsFor = (settings: QuizSettings | undefined, q?: Question) => (q?.type === 'slide' ? 1500 : Math.max(MIN_READ_MS, (settings?.readTime ?? 4) * 1000))
export const GRACE_MS = 1500
/** Sual iştirakçının ekranına gec çatanda (zəif şəbəkə) sürət xalı üçün ən çox bu qədər güzəşt edilir. */
export const MAX_LAG_MS = 5000
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

  const prof = await getDoc(doc(db, 'profiles', hostUid)).catch(() => null)
  const p = prof?.exists() ? (prof.data() as TrainerProfile) : null
  const host: HostProfile | null = p?.name ? { name: p.name, title: p.title || '', org: p.org || '', avatar: p.avatar ?? null, photoUrl: p.photoUrl || '' } : null

  // Plan: özü qeydiyyatdan keçən təlimçinin sınağı/lisenziyası bitibsə — pulsuz plan, oyunda maks. 10 iştirakçı
  const member = await getDoc(doc(db, 'admins', hostUid)).catch(() => null)
  const plan = planInfo(member?.exists() ? (member.data() as Parameters<typeof planInfo>[0]) : null)
  const orgId = await orgIdFor(hostUid)
  // müəssisə təlimçisinin planı sahibin lisenziyasından gəlir
  const owner = member?.get('source') === 'org' && orgId ? await getDoc(doc(db, 'admins', orgId)).catch(() => null) : null
  const planR = owner ? planInfo(member!.data() as Parameters<typeof planInfo>[0], Date.now(), owner.exists() ? (owner.data() as Parameters<typeof planInfo>[0]) : null) : plan
  const free = planR.selfServe && !planR.active
  // plan pilləsinə görə iştirakçı limiti (Rules eyni limiti tətbiq edir)
  const settings: QuizSettings = planR.selfServe ? { ...quiz.settings, maxPlayers: Math.min(quiz.settings.maxPlayers || planR.players, planR.players) } : quiz.settings

  const gameRef = doc(collection(db, 'games'))
  const game: Omit<Game, 'id'> = {
    host,
    pin, quizId, hostUid, title: quiz.title, settings, plan: free ? 'free' : planR.selfServe ? 'pro' : 'team', ...(orgId ? { orgId } : {}),
    phase: 'lobby', locked: false, questionIndex: -1, totalQuestions: questions.length,
    currentQuestion: null, questionStartedAt: null, questionEndsAt: null, pausedRemainingMs: null,
    reveal: null, lobby: [], leaderboard: [], playerCount: 0, answeredCount: 0,
    startedAt: null, finishedAt: null, stats: null,
  }
  const batch = writeBatch(db)
  // uyğunlaşdırma sualları üçün hər oyuna təsadüfi duz (sağ tərəfin id-ləri cütləri açıqlamasın)
  const secretQs = questions.map((q) => (q.type === 'match' ? { ...q, matchSalt: Math.random().toString(36).slice(2, 12) } : q))
  batch.set(doc(db, 'games', gameRef.id, 'secret', 'key'), { questions: JSON.parse(JSON.stringify(secretQs)) })
  batch.set(gameRef, { ...game, createdAt: serverTimestamp() })
  batch.set(doc(db, 'pins', pin), { gameId: gameRef.id, active: true, createdAt: serverTimestamp() })
  // Daimi QR: tapşırıq rejimi canlı təlimin QR-ını dəyişmir; hər təlimçinin öz QR-ı da var
  if (quiz.settings.mode !== 'assign') {
    // platforma üzrə ümumi QR yalnız komanda üzvləri üçündür — müştərilər bir-birinin QR-ını dəyişməsin
    if (!plan.selfServe) batch.set(doc(db, 'settings', 'current'), { activeGameId: gameRef.id, pin, updatedAt: serverTimestamp() })
    await pointQr(batch, hostUid, gameRef.id, pin)
  }
  await batch.commit()
  void track('game_created', { mode: quiz.settings.mode, questions: questions.length })
  return gameRef.id
}

export async function loadSecret(gameId: string): Promise<Question[]> {
  const s = await getDoc(doc(db, 'games', gameId, 'secret', 'key'))
  return (s.get('questions') as Question[]) ?? []
}

export const toPublic = (q: Question, settings?: QuizSettings): PublicQuestion => ({
  id: q.id, type: q.type,
  // boşluq doldurma: cavablar ([...]) oyunçuya göstərilmir
  text: q.type === 'fill' ? parseBlanks(q.text).display : q.text,
  imageUrl: q.imageUrl || undefined,
  shuffle: !['truefalse', 'order', 'match', 'fill', 'hotspot'].includes(q.type) && (q.shuffleOptions ?? settings?.shuffleOptions ?? false),
  body: q.type === 'slide' ? q.explanation || undefined : undefined,
  // uyğunlaşdırmada sol tərəf (cüt olmadan), sağ tərəf ayrıca qarışdırılmış və gizli id-lərlə
  options: q.type === 'order' ? shuffle(q.options ?? []) : q.type === 'fill' || q.type === 'hotspot' ? [] : (q.options ?? []).map((o) => ({ id: o.id, text: o.text })),
  right: q.type === 'match' ? shuffle((q.options ?? []).map((o) => ({ id: matchRightId(q.matchSalt ?? '', o.id), text: o.pair ?? '' }))) : undefined,
  blanks: q.type === 'fill' ? parseBlanks(q.text).answers.length : undefined,
  timeLimit: q.timeLimit, points: q.points,
  slider: q.slider ? { min: q.slider.min, max: q.slider.max, step: q.slider.step } : undefined,
  multiCount: q.type === 'multi' ? q.correct.length : undefined,
})

/** Yeni növlər üçün açıqlama məlumatı (yalnız sual bitəndən sonra göstərilir). */
function extraReveal(q: Question) {
  if (q.type === 'match') return { pairs: q.options.map((o) => ({ left: o.text, right: o.pair ?? '' })) }
  if (q.type === 'fill') return { text: parseBlanks(q.text).display, blanks: parseBlanks(q.text).answers }
  if (q.type === 'hotspot' && q.hotspot) return { hotspot: q.hotspot }
  return {}
}

// ============ Host əməliyyatları ============

const gref = (gameId: string) => doc(db, 'games', gameId)

export const updateLobby = (gameId: string, players: Player[]) => {
  const active = players.filter((p) => !p.kicked)
  const lobby: LobbyEntry[] = active
    .sort((a, b) => (a.joinedAt?.toMillis() ?? 0) - (b.joinedAt?.toMillis() ?? 0))
    .map((p) => ({ uid: p.uid, firstName: p.firstName, lastName: p.lastName, avatar: p.avatar, ...(p.team != null ? { team: p.team } : {}) }))
  // Sənəd ölçüsünü və hər oyunçunun oxuduğu həcmi məhdudlaşdırmaq üçün yalnız son 60 nəfər (say isə tam)
  return updateDoc(gref(gameId), { lobby: lobby.slice(-60), playerCount: active.length })
}

export const setLocked = (gameId: string, locked: boolean) => updateDoc(gref(gameId), { locked })

/**
 * Komandaları host bölüşdürür (yeganə yazan → yarış vəziyyəti yoxdur).
 * Komandası olmayan oyunçular qoşulma sırası ilə ən az üzvü olan komandaya düşür.
 */
export async function assignTeams(gameId: string, players: Player[], n: number) {
  const counts = Array.from({ length: n }, () => 0)
  players.forEach((p) => { if (!p.kicked && p.team != null && p.team < n) counts[p.team]++ })
  const pending = players.filter((p) => !p.kicked && (p.team == null || p.team >= n))
    .sort((a, b) => (a.joinedAt?.toMillis() ?? 0) - (b.joinedAt?.toMillis() ?? 0))
  if (!pending.length) return
  for (let i = 0; i < pending.length; i += 450) {
    const batch = writeBatch(db)
    pending.slice(i, i + 450).forEach((p) => { const tm = pickTeam(counts); counts[tm]++; batch.update(doc(db, 'games', gameId, 'players', p.uid), { team: tm }) })
    await batch.commit()
  }
}

export const kickPlayer = (gameId: string, uid: string) => updateDoc(doc(db, 'games', gameId, 'players', uid), { kicked: true })

/**
 * Növbəti sual: əvvəlcə yalnız mətn göstərilir (oxuma vaxtı), sonra cavablar açılır.
 * Sualın ictimai hissəsi və başlama/bitmə vaxtı ELƏ BU MƏRHƏLƏDƏ yazılır — iştirakçının telefonu
 * cavabları server saatı ilə özü açır və hostun ikinci yazısını gözləmir. Beləliklə şəbəkə gecikməsi
 * oxuma vaxtının içində "əriyir" və heç kimin vaxtı texniki səbəbdən yanmır.
 */
export async function toCountdown(gameId: string, index: number, q: Question, settings: QuizSettings, extra: Record<string, unknown> = {}) {
  await updateDoc(gref(gameId), {
    phase: 'countdown', questionIndex: index, reveal: null,
    currentQuestion: JSON.parse(JSON.stringify(toPublic(q, settings))),
    preview: JSON.parse(JSON.stringify({ index, text: q.text, type: q.type, imageUrl: q.imageUrl || undefined, points: q.points, readMs: readMsFor(settings, q) })),
    countdownAt: serverTimestamp(), questionStartedAt: null, questionEndsAt: null, pausedRemainingMs: null, answeredCount: 0, ...extra,
  })
  await scheduleQuestion(gameId, index, q, settings).catch(() => { /* host ekranı təmir edəcək */ })
}

/** Başlama = countdownAt (server) + oxuma vaxtı; bitmə = başlama + sualın vaxtı. Host saatından asılı deyil. */
export async function scheduleQuestion(gameId: string, index: number, q: Question, settings: QuizSettings) {
  let lastErr: unknown
  for (let i = 0; i < 3; i++) {
    try {
      const snap = await getDocFromServer(gref(gameId))
      if (snap.get('phase') !== 'countdown' || snap.get('questionIndex') !== index || snap.get('questionStartedAt')) return
      const at = snap.get('countdownAt') as Timestamp | null
      const start = (at ? at.toMillis() : serverNow()) + readMsFor(settings, q)
      await updateDoc(gref(gameId), {
        questionStartedAt: Timestamp.fromMillis(start),
        questionEndsAt: q.type === 'slide' ? null : Timestamp.fromMillis(start + q.timeLimit * 1000),
      })
      return
    } catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 400 * (i + 1))) }
  }
  throw lastErr
}

/** Host ekranı üçün fazanı "question"-a keçirir (iştirakçılar sualı artıq vaxtında görür). */
export async function toQuestion(gameId: string, index: number, q: Question, settings: QuizSettings) {
  const snap = await getDocFromServer(gref(gameId))
  if (snap.get('phase') !== 'countdown' || snap.get('questionIndex') !== index) return
  if (snap.get('questionStartedAt')) {
    await updateDoc(gref(gameId), { phase: 'question', preview: null })
    return
  }
  // Plan yazısı heç alınmayıbsa: köhnə üsulla indi başlat
  await updateDoc(gref(gameId), {
    phase: 'question', currentQuestion: JSON.parse(JSON.stringify(toPublic(q, settings))), preview: null, questionStartedAt: serverTimestamp(), questionEndsAt: null, pausedRemainingMs: null,
  })
  if (q.type === 'slide') return
  await setQuestionEnd(gameId, q.timeLimit)
}

/** İştirakçı sualı gec gördü (şəbəkə): server vaxtı ilə qeyd — sürət xalı bu andan hesablanır (ən çox MAX_LAG_MS). */
export const markSeenLate = (gameId: string, uid: string, qi: number) =>
  setDoc(doc(db, 'games', gameId, 'starts', `${uid}_${qi}`), { uid, q: qi, startedAt: serverTimestamp() })

/**
 * Bitmə vaxtını server başlanğıc vaxtından hesablayıb yazır (3 cəhd).
 * Bu yazı alınmasa, cavab plitələri aktivləşməz — host ekranı bunu ayrıca təmir edir (repairQuestionEnd).
 */
export async function setQuestionEnd(gameId: string, timeLimitSec: number) {
  let lastErr: unknown
  for (let i = 0; i < 3; i++) {
    try {
      const snap = await getDocFromServer(gref(gameId))
      if (snap.get('phase') !== 'question' || snap.get('questionEndsAt') || snap.get('pausedRemainingMs') != null) return
      const started = snap.get('questionStartedAt') as Timestamp | null
      const startMs = started ? started.toMillis() : serverNow()
      await updateDoc(gref(gameId), { questionEndsAt: Timestamp.fromMillis(startMs + timeLimitSec * 1000) })
      return
    } catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 400 * (i + 1))) }
  }
  throw lastErr
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

/** 50/50: oyunçunun sorğusuna cavab olaraq iki səhv variantı gizlədir (yalnız həmin oyunçuya). */
export async function grantFifty(gameId: string, p: Player, q: Question, qi: number) {
  const inv = p.powerups?.fifty ?? 0
  if (inv <= 0 || p.fiftyHide?.q === qi) return
  const wrong = shuffle(q.options.filter((o) => !q.correct.includes(o.id)).map((o) => o.id))
  const n = Math.min(2, wrong.length, Math.floor(q.options.length / 2))
  if (n <= 0) return
  await updateDoc(doc(db, 'games', gameId, 'players', p.uid), { fiftyHide: { q: qi, ids: wrong.slice(0, n) }, 'powerups.fifty': inv - 1 })
}

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

/** Sualı gec görənlərin server vaxtları (uid → ms). */
async function fetchSeen(gameId: string, qi: number): Promise<Map<string, number>> {
  const m = new Map<string, number>()
  try {
    const snap = await getDocs(query(collection(db, 'games', gameId, 'starts'), where('q', '==', qi)))
    snap.docs.forEach((d) => { const ts = d.get('startedAt') as Timestamp | null; if (ts) m.set(d.get('uid') as string, ts.toMillis()) })
  } catch { /* güzəştsiz davam */ }
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
  // Təkrar hesablamaya qarşı (məs. iki host tabı): serverdəki faza artıq dəyişibsə, heç nə etmə
  const fresh = await getDocFromServer(gref(game.id))
  if (fresh.get('phase') !== 'question' || fresh.get('questionIndex') !== qi) return
  const [players, answers, seen] = await Promise.all([fetchPlayers(game.id), fetchAnswers(game.id, qi), fetchSeen(game.id, qi)])
  const startedMs = (fresh.get('questionStartedAt') as Timestamp | null)?.toMillis() ?? game.questionStartedAt?.toMillis() ?? 0
  // Sual ekrana gec çatıbsa, sürət o andan sayılır (ən çox MAX_LAG_MS güzəşt)
  const startFor = (uid: string) => { const s = seen.get(uid); return s && s > startedMs ? startedMs + Math.min(MAX_LAG_MS, s - startedMs) : startedMs }
  const settings = game.settings
  const prevRanked = rankPlayers(players.filter((p) => !p.kicked))
  const prevRank = new Map(qi > 0 ? prevRanked.map((p) => [p.uid, p.rank] as [string, number]) : [])

  const distribution: Record<string, number> = {}
  const texts: string[] = []
  if (['single', 'multi', 'truefalse', 'poll'].includes(q.type)) q.options.forEach((o) => (distribution[o.id] = 0))

  const updated = players.map((p) => {
    // kənarlaşdırılmış və ya bu sual üçün artıq hesablanmış oyunçu toxunulmaz qalır
    if (p.kicked || (p.history ?? []).some((h) => h.q === qi)) return { p, item: null as HistoryItem | null, bonus: 0, answered: false, ev: null, used: null as PowerType | null, shielded: false, timeMs: null as number | null }
    const a = answers.get(p.uid)
    const answered = !!a
    const timeMs = a?.answeredAt ? Math.max(0, a.answeredAt.toMillis() - startFor(p.uid)) : null
    // ciddi rejim: sual ərzində tabdan çıxıbsa cavab sayılmır
    const value = settings.integrity === 'strict' && a?.away ? null : a?.value ?? null
    if (a) {
      if (Array.isArray(a.value)) a.value.forEach((v) => { if (v in distribution) distribution[v]++ })
      else if (q.type === 'single' || q.type === 'truefalse' || q.type === 'poll') { const v = String(a.value); if (v in distribution) distribution[v]++ }
      else if (q.type === 'type' || q.type === 'wordcloud' || q.type === 'open') { if (texts.length < 200) texts.push(String(a.value).slice(0, 140)) }
      else if (q.type === 'slider') { const k = String(a.value); distribution[k] = (distribution[k] ?? 0) + 1 }
      if (q.type === 'type') { const k = normalizeText(String(a.value)); distribution[k] = (distribution[k] ?? 0) + 1 }
      if (q.type === 'hotspot' && texts.length < 300) texts.push(String(a.value)) // host ekranında nöqtələr
    }
    const ev0 = applyConfidence(evaluateAnswer(q, value, timeMs ?? q.timeLimit * 1000, settings.scoring), settings.confidence ? a?.conf : undefined, basePoints(q.points))
    // güc artırıcı (yalnız bu sual üçün aktivləşdirilibsə və inventarda varsa)
    const used: PowerType | null = settings.powerUps !== false && ev0.scored && p.power?.q === qi && p.power.type !== 'fifty' && (p.powerups?.[p.power.type] ?? 0) > 0 ? p.power.type : null
    const ev = used === 'double' ? { ...ev0, points: ev0.points * 2 } : ev0
    const shielded = used === 'shield' && !ev.correct && answered
    let bonus = 0
    const np = { ...p }
    if (used) np.powerups = { ...(p.powerups ?? { ...POWER_START }), [used]: Math.max(0, (p.powerups?.[used] ?? 0) - 1) }
    const fiftyUsed = p.fiftyHide?.q === qi ? 'fifty' as const : null
    if (ev.scored) {
      if (ev.correct) {
        np.streak = (p.streak ?? 0) + 1
        np.bestStreak = Math.max(p.bestStreak ?? 0, np.streak)
        np.correctCount = (p.correctCount ?? 0) + 1
        np.totalCorrectTimeMs = (p.totalCorrectTimeMs ?? 0) + (timeMs ?? 0)
        if (settings.streakBonus && basePoints(q.points) > 0) bonus = streakBonus(np.streak)
      } else if (!shielded) {
        np.streak = 0
      }
      np.score = Math.max(0, (p.score ?? 0) + ev.points + bonus)
    }
    const item: HistoryItem = { q: qi, answer: value, correct: ev.correct, points: ev.points + bonus, timeMs, power: used ?? fiftyUsed }
    np.history = [...(p.history ?? []), item]
    return { p: np, item, bonus, answered, ev, used: used ?? fiftyUsed, shielded, timeMs }
  })

  let fastest: Fastest | null = null
  for (const u of updated) {
    if (u.p.kicked || !u.ev?.correct || u.timeMs == null) continue
    if (!fastest || u.timeMs < fastest.ms) fastest = { uid: u.p.uid, name: shortName(u.p.firstName, u.p.lastName), avatar: u.p.avatar, ms: u.timeMs }
  }
  const correctCount = updated.filter((u) => !u.p.kicked && u.ev?.correct).length

  const ranked = rankPlayers(updated.filter((u) => !u.p.kicked).map((u) => u.p))
  const rankMap = new Map(ranked.map((p) => [p.uid, p.rank]))

  const reveal: Reveal = {
    correct: q.type === 'poll' ? [] : q.correct,
    accepted: q.type === 'type' ? q.accepted : undefined,
    sliderAnswer: q.slider?.answer,
    explanation: q.explanation || undefined,
    pairs: q.type === 'match' ? q.options.map((o) => ({ left: o.text, right: o.pair ?? '' })) : undefined,
    blanks: q.type === 'fill' ? parseBlanks(q.text).answers : undefined,
    hotspot: q.type === 'hotspot' ? q.hotspot : undefined,
    distribution,
    answeredCount: answers.size,
    texts: texts.length ? texts : undefined,
    fastest,
    correctCount,
  }

  // Server bir batch-da ≤500 yazı qəbul edir: 1000+ oyunçuda nəticələr hissə-hissə yazılır,
  // oyunun "reveal" fazası isə ƏN SONDA — telefonlar nəticəni öz xalları artıq yazılmış halda görür.
  let batch = writeBatch(db), ops = 0
  const flush = async () => { if (ops) { await batch.commit(); batch = writeBatch(db); ops = 0 } }
  for (const u of updated) {
    if (u.p.kicked || !u.item) continue
    const ev = u.ev!
    if (ops >= 450) await flush()
    ops++
    batch.update(doc(db, 'games', game.id, 'players', u.p.uid), {
      score: u.p.score, correctCount: u.p.correctCount ?? 0, streak: u.p.streak ?? 0, bestStreak: u.p.bestStreak ?? 0,
      totalCorrectTimeMs: u.p.totalCorrectTimeMs ?? 0, history: u.p.history,
      ...(u.p.powerups ? { powerups: u.p.powerups } : {}),
      lastResult: {
        timeMs: u.timeMs ?? null, power: u.used ?? null, shielded: !!u.shielded,
        questionIndex: qi, correct: ev.correct, points: ev.points, streakBonus: u.bonus, rank: rankMap.get(u.p.uid) ?? 0,
        prevRank: prevRank.get(u.p.uid) ?? 0, answered: u.answered, poll: !ev.scored, streak: u.p.streak ?? 0, total: ranked.length,
      },
    })
  }
  batch.update(gref(game.id), {
    ...(settings.teams ? { teamBoard: computeTeams(updated.map((u) => u.p), settings.teams) } : {}),
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

/** Quizi işə salır və açılmalı olan səhifəni qaytarır (tapşırıq → hesabat, digərləri → host ekranı). */
export async function launchQuiz(quizId: string, hostUid: string): Promise<string> {
  const id = await createGame(quizId, hostUid)
  const g = await getDoc(gref(id))
  const settings = g.get('settings') as QuizSettings
  if (settings.mode === 'assign') {
    await startAssignment(id, await loadSecret(id), settings)
    return `/admin/games/${id}`
  }
  return `/host/${id}`
}

// ============ Tapşırıq rejimi (host olmadan, son tarixli link) ============

/** Oyunu dərhal açır: suallar ictimai (rəqabət yoxdur), cavablar son tarixə qədər qəbul olunur. */
export async function startAssignment(gameId: string, questions: Question[], settings: QuizSettings) {
  await updateDoc(gref(gameId), {
    phase: 'self', questionIndex: questions.length - 1, startedAt: Timestamp.fromMillis(serverNow()),
    'settings.lateJoin': true, 'settings.powerUps': false, 'settings.teams': 0,
    publicQuestions: JSON.parse(JSON.stringify(questions.map((q) => toPublic(q, settings)))),
    selfEndsAt: Timestamp.fromMillis(serverNow() + (settings.assignDays || 7) * 86_400_000),
  })
}

/** Təlimçi: bütün cavabları qiymətləndirir və tapşırığı yekunlaşdırır. */
export async function gradeAssignment(game: Game, questions: Question[], onProgress?: (done: number, total: number) => void) {
  const [players, snap] = await Promise.all([fetchPlayers(game.id), getDocs(collection(db, 'games', game.id, 'answers'))])
  const byUid = new Map<string, Answer[]>()
  snap.docs.forEach((d) => { const a = d.data() as Answer; byUid.set(a.uid, [...(byUid.get(a.uid) ?? []), a]) })
  let done = 0
  for (const p of players) {
    let cur: Player = p
    for (const a of (byUid.get(p.uid) ?? []).sort((x, y) => x.questionIndex - y.questionIndex)) {
      const next = await scoreSelfAnswer(game, questions, cur, a)
      if (next) cur = next
    }
    onProgress?.(++done, players.length)
  }
  await finishGame({ ...game, phase: 'self' }, questions)
}

// ============ Öz tempində rejimi ============

/** Bütün sualların ictimai hissəsini yayımlayır; hər oyunçu öz sürəti ilə irəliləyir. */
export async function startSelf(game: Game, questions: Question[]) {
  const minutes = game.settings.selfMinutes || 15
  // Suallar ictimai sənədə yazılmır: hər oyunçu yalnız öz növbəti sualını öz sənədində alır (qabaqcadan oxumaq olmur)
  await updateDoc(gref(game.id), {
    phase: 'self', questionIndex: questions.length - 1, startedAt: Timestamp.fromMillis(serverNow()),
    selfEndsAt: Timestamp.fromMillis(serverNow() + minutes * 60_000),
  })
  const players = (await fetchPlayers(game.id)).filter((p) => !p.kicked && !p.selfQ)
  for (let i = 0; i < players.length; i += 400) {
    const b = writeBatch(db)
    players.slice(i, i + 400).forEach((p) => b.update(doc(db, 'games', game.id, 'players', p.uid), { selfQ: selfQFor(questions, 0, game.settings, game.id, p.uid) }))
    await b.commit()
  }
}

/**
 * Öz tempində / tapşırıq: iştirakçının sual ardıcıllığı (addım → sual indeksi).
 * "Hər iştirakçıya fərqli ardıcıllıq" açıqdırsa, uid ilə toxumlanmış qarışdırma — host və telefon eyni nəticəni hesablayır,
 * ona görə ardıcıllığı saxlamağa ehtiyac yoxdur. Yanaşı oturanlar eyni anda fərqli suallar görür.
 */
export function selfOrder(gameId: string, uid: string, n: number, settings: Partial<QuizSettings> | undefined): number[] {
  const base = Array.from({ length: n }, (_, i) => i)
  return settings?.selfShuffle === false ? base : seededShuffle(base, `${gameId}:${uid}`)
}

/** Addım üçün sual (ictimai hissə). step ≥ n → sual qalmayıb. */
export function selfQFor(questions: Question[], step: number, settings: QuizSettings, gameId: string, uid: string) {
  if (step >= questions.length) return { index: questions.length, step, q: null }
  const index = selfOrder(gameId, uid, questions.length, settings)[step]
  return JSON.parse(JSON.stringify({ index, step, q: toPublic(questions[index], settings) }))
}

/** Gec qoşulan oyunçuya ilk sualı ver. */
export const deliverFirstSelfQ = (gameId: string, uid: string, questions: Question[], settings: QuizSettings) =>
  updateDoc(doc(db, 'games', gameId, 'players', uid), { selfQ: selfQFor(questions, 0, settings, gameId, uid) })

/** Cavab gələn kimi növbəti sualı dərhal göndər (qiymətləndirməni gözləmədən) — iştirakçı ləngimədən irəliləyir. */
export function deliverNextSelfQ(gameId: string, uid: string, answeredQi: number, questions: Question[], settings: QuizSettings) {
  const step = selfOrder(gameId, uid, questions.length, settings).indexOf(answeredQi)
  if (step < 0) return Promise.resolve()
  return updateDoc(doc(db, 'games', gameId, 'players', uid), { selfQ: selfQFor(questions, step + 1, settings, gameId, uid) })
}

export const startSelfQuestion = (gameId: string, uid: string, qi: number) =>
  setDoc(doc(db, 'games', gameId, 'starts', `${uid}_${qi}`), { uid, q: qi, startedAt: serverTimestamp() })

export const selfAnswersQuery = (gameId: string) => collection(db, 'games', gameId, 'answers')

/** Öz tempində rejimində bir cavabı dərhal qiymətləndirir və oyunçuya fərdi nəticə yazır. */
export async function scoreSelfAnswer(game: Game, questions: Question[], player: Player, answer: Answer) {
  const qi = answer.questionIndex
  const q = questions[qi]
  if (!q || (player.history ?? []).some((h) => h.q === qi)) return null
  const st = await getDoc(doc(db, 'games', game.id, 'starts', `${player.uid}_${qi}`))
  const startedMs = (st.get('startedAt') as Timestamp | undefined)?.toMillis() ?? answer.answeredAt?.toMillis() ?? 0
  const raw = answer.answeredAt ? answer.answeredAt.toMillis() - startedMs : null
  const late = raw != null && raw > q.timeLimit * 1000 + GRACE_MS
  const value = late || answer.value === null || answer.value === undefined || (game.settings.integrity === 'strict' && answer.away) ? null : answer.value
  const timeMs = value === null ? null : Math.max(0, raw ?? 0)
  const settings = game.settings
  const ev0 = applyConfidence(evaluateAnswer(q, value, timeMs ?? q.timeLimit * 1000, settings.scoring), settings.confidence ? answer.conf : undefined, basePoints(q.points))
  const used: PowerType | null = settings.powerUps !== false && ev0.scored && player.power?.q === qi && player.power.type !== 'fifty' && (player.powerups?.[player.power.type] ?? 0) > 0 ? player.power.type : null
  const ev = used === 'double' ? { ...ev0, points: ev0.points * 2 } : ev0
  const shielded = used === 'shield' && !ev.correct && value !== null
  const np: Player = { ...player }
  if (used) np.powerups = { ...(player.powerups ?? { ...POWER_START }), [used]: Math.max(0, (player.powerups?.[used] ?? 0) - 1) }
  let bonus = 0
  if (ev.scored) {
    if (ev.correct) {
      np.streak = (player.streak ?? 0) + 1
      np.bestStreak = Math.max(player.bestStreak ?? 0, np.streak)
      np.correctCount = (player.correctCount ?? 0) + 1
      np.totalCorrectTimeMs = (player.totalCorrectTimeMs ?? 0) + (timeMs ?? 0)
      if (settings.streakBonus && basePoints(q.points) > 0) bonus = streakBonus(np.streak)
    } else if (!shielded) np.streak = 0
    np.score = Math.max(0, (player.score ?? 0) + ev.points + bonus)
  }
  const fifty = player.fiftyHide?.q === qi ? 'fifty' as const : null
  np.history = [...(player.history ?? []), { q: qi, answer: value, correct: ev.correct, points: ev.points + bonus, timeMs, power: used ?? fifty }]
  await updateDoc(doc(db, 'games', game.id, 'players', player.uid), {
    score: np.score ?? 0, correctCount: np.correctCount ?? 0, streak: np.streak ?? 0, bestStreak: np.bestStreak ?? 0,
    totalCorrectTimeMs: np.totalCorrectTimeMs ?? 0, history: np.history, ...(np.powerups ? { powerups: np.powerups } : {}),
    // növbəti sual artıq göndərilib (deliverNextSelfQ); yalnız geri qaytarmadan ehtiyat üçün yazılır
    ...(np.history.length > (player.selfQ?.step ?? -1) ? { selfQ: selfQFor(questions, np.history.length, settings, game.id, player.uid) } : {}),
    lastResult: JSON.parse(JSON.stringify({
      questionIndex: qi, correct: ev.correct, points: ev.points, streakBonus: bonus, rank: 0, prevRank: 0, answered: value !== null,
      poll: !ev.scored, streak: np.streak ?? 0, total: 0, timeMs, power: used ?? fifty, shielded,
      reveal: { correct: q.type === 'poll' ? [] : q.correct, accepted: q.accepted ?? null, sliderAnswer: q.slider?.answer ?? null, explanation: q.explanation ?? null, ...extraReveal(q) },
    })),
  })
  return np
}

/** Canlı reytinqi (top 10) yeniləyir. */
export async function updateLeaderboard(gameId: string, players: Player[], prev: LeaderEntry[] = [], teams = 0) {
  const ranked = rankPlayers(players.filter((p) => !p.kicked))
  const prevRank = new Map(prev.map((e) => [e.uid, e.rank]))
  await updateDoc(gref(gameId), { leaderboard: leaderboardOf(ranked, prevRank), playerCount: ranked.length, ...(teams ? { teamBoard: computeTeams(players, teams) } : {}) })
}

/** Oyunu bitir: statistika + oyunçular üçün sual icmalı. */
export async function finishGame(game: Game, questions: Question[]) {
  const players = (await fetchPlayers(game.id)).filter((p) => !p.kicked)
  const ranked = rankPlayers(players)
  const asked = game.phase === 'self' || game.settings.mode === 'self' ? questions.length : Math.max(0, Math.min(game.totalQuestions, game.questionIndex + (game.phase === 'question' || game.phase === 'countdown' ? 0 : 1)))
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
    sliderAnswer: q.slider?.answer ?? null, explanation: q.explanation ?? null, scored: SCORED_TYPES.has(q.type), ...extraReveal(q),
  }))
  const prevRank = new Map(ranked.map((p) => [p.uid, p.rank]))
  const awards = computeAwards(players, scoredIdx.length)
  const batch = writeBatch(db)
  batch.update(gref(game.id), {
    ...(game.settings.teams ? { teamBoard: computeTeams(players, game.settings.teams) } : {}),
    awards: JSON.parse(JSON.stringify(awards)),
    phase: 'finished', finishedAt: serverTimestamp(), stats: JSON.parse(JSON.stringify(stats)),
    leaderboard: leaderboardOf(ranked, prevRank, 200), scoredCount: scoredIdx.length,
    currentQuestion: null, questionEndsAt: null, selfEndsAt: null,
  })
  // Daimi QR bu oyuna aparırdısa, boşalt (bitmiş oyuna yönləndirməsin)
  const cur = await getDoc(doc(db, 'settings', 'current')).catch(() => null)
  if (cur?.get('activeGameId') === game.id) batch.set(doc(db, 'settings', 'current'), { activeGameId: null, pin: null, updatedAt: serverTimestamp() })
  await releaseQr(batch, game.hostUid, game.id).catch(() => {})
  // Düzgün cavablı icmal ayrıca sənəddədir: yalnız iştirakçılar və host oxuya bilər
  batch.set(doc(db, 'games', game.id, 'results', 'review'), { items: JSON.parse(JSON.stringify(review)) })
  batch.update(doc(db, 'pins', game.pin), { active: false })
  await batch.commit()
  void track('game_finished', { players: players.length, mode: game.settings.mode })
}

/** Oyun sonu mükafatları. */
export function computeAwards(players: Player[], scoredCount: number): Award[] {
  const out: Award[] = []
  const nm = (p: Player) => shortName(p.firstName, p.lastName)
  if (!players.length || !scoredCount) return out
  const withTimes = players
    .map((p) => { const ts = (p.history ?? []).filter((h) => h.correct && h.timeMs != null).map((h) => h.timeMs as number); return { p, avg: ts.length ? ts.reduce((a, b) => a + b, 0) / ts.length : Infinity, n: ts.length } })
    .filter((x) => x.n >= Math.max(1, Math.ceil(scoredCount / 2)))
    .sort((a, b) => a.avg - b.avg)
  if (withTimes[0]) out.push({ key: 'fastest', uid: withTimes[0].p.uid, name: nm(withTimes[0].p), avatar: withTimes[0].p.avatar, value: `${(withTimes[0].avg / 1000).toFixed(1)} s` })
  const streak = [...players].sort((a, b) => (b.bestStreak ?? 0) - (a.bestStreak ?? 0))[0]
  if (streak && (streak.bestStreak ?? 0) >= 3) out.push({ key: 'streak', uid: streak.uid, name: nm(streak), avatar: streak.avatar, value: `${streak.bestStreak}` })
  players.filter((p) => (p.correctCount ?? 0) >= scoredCount).slice(0, 5).forEach((p) => out.push({ key: 'perfect', uid: p.uid, name: nm(p), avatar: p.avatar, value: '100%' }))
  const sharp = [...players].sort((a, b) => (b.correctCount ?? 0) - (a.correctCount ?? 0) || (a.totalCorrectTimeMs ?? 0) - (b.totalCorrectTimeMs ?? 0))[0]
  if (sharp && !out.some((a) => a.key === 'perfect') && (sharp.correctCount ?? 0) > 0) out.push({ key: 'sharp', uid: sharp.uid, name: nm(sharp), avatar: sharp.avatar, value: `${Math.round(((sharp.correctCount ?? 0) / scoredCount) * 100)}%` })
  return out
}

// ============ Oyunçu əməliyyatları ============

/** PIN → oyun. Bitmiş oyunun PIN-i də qaytarılır (iştirakçı nəticəsinə qayıda bilsin). */
export async function lookupPin(pin: string): Promise<{ gameId: string; active: boolean } | null> {
  const s = await getDoc(doc(db, 'pins', pin))
  if (!s.exists()) return null
  return { gameId: s.get('gameId') as string, active: s.get('active') !== false }
}

/**
 * Qoşulma — bir şəbəkə gedişi (əvvəlcədən oxu yoxdur). Təkrara davamlıdır: əvvəlki cəhd serverə çatıb,
 * amma cavabı itibsə (zəif şəbəkə), ikinci yazı "update" sayılıb rədd olunur — onda sənədin artıq
 * mövcud olduğu yoxlanır və qoşulma uğurlu sayılır (əvvəl bu hal "Lobbi bağlıdır" kimi göstərilirdi).
 */
export async function joinGame(gameId: string, uid: string, firstName: string, lastName: string, avatar: AvatarData, team?: number) {
  const ref = doc(db, 'games', gameId, 'players', uid)
  try {
    await setDoc(ref, {
      firstName, lastName, avatar, joinedAt: serverTimestamp(), lastSeen: serverTimestamp(), kicked: false,
      score: 0, correctCount: 0, streak: 0, bestStreak: 0, totalCorrectTimeMs: 0, lastResult: null, history: [],
      powerups: { ...POWER_START }, power: null, fiftyHide: null,
      ...(team != null ? { team } : {}),
    })
    void track('player_joined')
  } catch (e) {
    if ((e as { code?: string }).code !== 'permission-denied') throw e
    const mine = await getDocFromServer(ref).catch(() => null)
    if (!mine?.exists()) throw e
    if (mine.get('kicked')) throw Object.assign(new Error('kicked'), { code: 'kicked' })
    // artıq qoşulub — profili (lobbidədirsə) yenilə, alınmasa da problem deyil
    await updateDoc(ref, { firstName, lastName, avatar, lastSeen: serverTimestamp() }).catch(() => {})
  }
}

/** Qoşulmanın niyə mümkün olmadığını oyun vəziyyətindən izah edir (null → mane yoxdur). */
export function joinBlockReason(g: Pick<Game, 'phase' | 'locked' | 'settings' | 'playerCount'>): 'finished' | 'locked' | 'started' | 'full' | null {
  if (g.phase === 'finished') return 'finished'
  if (g.locked) return 'locked'
  if (g.phase !== 'lobby' && !g.settings?.lateJoin) return 'started'
  if ((g.playerCount ?? 0) >= (g.settings?.maxPlayers ?? 200)) return 'full'
  return null
}

export const submitAnswer = (gameId: string, uid: string, questionIndex: number, value: Answer['value'] | null, conf?: boolean, away?: boolean) =>
  setDoc(doc(db, 'games', gameId, 'answers', `${uid}_${questionIndex}`), { uid, questionIndex, value, answeredAt: serverTimestamp(), ...(conf !== undefined ? { conf } : {}), ...(away ? { away: true } : {}) })

/** Dürüstlük qeydləri: games/{gid}/integrity/{uid} — oyunçu özü yazır, yalnız host oxuyur. */
export const writeIntegrity = (gameId: string, uid: string, name: string, counts: Record<string, number>, events: { k: string; q: number; at: number }[]) =>
  setDoc(doc(db, 'games', gameId, 'integrity', uid), { uid, name: name.slice(0, 80), counts, events: events.slice(-30), updatedAt: serverTimestamp() })
export const integrityQuery = (gameId: string) => collection(db, 'games', gameId, 'integrity')

export const heartbeat = (gameId: string, uid: string) => updateDoc(doc(db, 'games', gameId, 'players', uid), { lastSeen: serverTimestamp() })

export const activatePower = (gameId: string, uid: string, q: number, type: PowerType) =>
  updateDoc(doc(db, 'games', gameId, 'players', uid), { power: { q, type } })
/** Cavab verilməmiş seçilmiş gücü ləğv edir (sayı yalnız cavab zamanı azalır, ona görə itki yoxdur). */
export const cancelPower = (gameId: string, uid: string) =>
  updateDoc(doc(db, 'games', gameId, 'players', uid), { power: null })

/** Sənəd id-si 2 saniyəlik pəncərəyə bağlıdır — Rules oyunçu başına 2 s-də 1 reaksiyaya icazə verir. */
export const sendReaction = (gameId: string, uid: string, emoji: string) =>
  setDoc(doc(db, 'games', gameId, 'reactions', `${uid}_${Math.floor(serverNow() / 2000)}`), { uid, emoji, createdAt: serverTimestamp() })

export type { QuizSettings }
