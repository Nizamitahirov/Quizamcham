import {
  collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc, writeBatch, limit as qLimit,
} from 'firebase/firestore'
import { db } from './config'
import type { AppSettings, Question, Quiz, SoundClip, SoundSettings, TrainerProfile } from '../types'
import { DEFAULT_APP_SETTINGS, convertType, uid6, withDefaults } from '../lib/defaults'

// ---------------- Quizlər ----------------

export async function listQuizzes(): Promise<(Quiz & { count: number })[]> {
  const snap = await getDocs(query(collection(db, 'quizzes'), orderBy('updatedAt', 'desc')))
  return snap.docs.map((d) => {
    const data = d.data() as Omit<Quiz, 'id'>
    return { ...normalizeQuiz({ ...data, id: d.id }), count: (data.questionOrder ?? []).length }
  })
}

export function normalizeQuiz(q: Partial<Quiz> & { id: string }): Quiz {
  return {
    id: q.id,
    title: q.title ?? '',
    description: q.description ?? '',
    coverEmoji: q.coverEmoji ?? '🎯',
    coverColor: q.coverColor ?? '#E4202E',
    settings: withDefaults(q.settings),
    questionOrder: q.questionOrder ?? [],
    ownerUid: q.ownerUid ?? '',
    tags: q.tags ?? [],
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
  }
}

export async function loadQuiz(quizId: string): Promise<{ quiz: Quiz; questions: Question[] } | null> {
  const qs = await getDoc(doc(db, 'quizzes', quizId))
  if (!qs.exists()) return null
  const quiz = normalizeQuiz({ ...(qs.data() as Omit<Quiz, 'id'>), id: qs.id })
  const snap = await getDocs(collection(db, 'quizzes', quizId, 'questions'))
  const map = new Map(snap.docs.map((d) => { const q = d.data() as Question; return [d.id, { ...q, options: q.options ?? [], correct: q.correct ?? [], id: d.id }] }))
  const ordered = quiz.questionOrder.map((id) => map.get(id)).filter(Boolean) as Question[]
  // sırada olmayan (itmiş) sualları sona əlavə et
  map.forEach((q, id) => { if (!quiz.questionOrder.includes(id)) ordered.push(q) })
  return { quiz, questions: ordered }
}

const quizMeta = (quiz: Quiz, questions: Question[]) => ({
  title: quiz.title,
  description: quiz.description,
  coverEmoji: quiz.coverEmoji,
  coverColor: quiz.coverColor,
  settings: quiz.settings,
  questionOrder: questions.map((q) => q.id),
  ownerUid: quiz.ownerUid,
  tags: quiz.tags ?? [],
  updatedAt: serverTimestamp(),
})

const cleanQuestion = (q: Question) => JSON.parse(JSON.stringify(q)) as Question

/** Bütün quizi bir batch ilə yazır; dəyişməyən sualları yazmır, silinənləri silir. */
export async function saveQuizFull(quiz: Quiz, questions: Question[], dirtyIds: Set<string> | 'all', removedIds: string[]) {
  const batch = writeBatch(db)
  batch.set(doc(db, 'quizzes', quiz.id), quizMeta(quiz, questions), { merge: true })
  for (const q of questions) {
    if (dirtyIds === 'all' || dirtyIds.has(q.id)) batch.set(doc(db, 'quizzes', quiz.id, 'questions', q.id), cleanQuestion(q))
  }
  for (const id of removedIds) batch.delete(doc(db, 'quizzes', quiz.id, 'questions', id))
  await batch.commit()
}

export async function createQuiz(ownerUid: string, partial: Partial<Quiz> = {}, questions: Question[] = []): Promise<string> {
  const ref = doc(collection(db, 'quizzes'))
  // təlimçinin standart ayarları (profil) → quizin öz ayarları üstündür
  const defaults = (await loadProfile(ownerUid))?.defaults ?? {}
  const quiz = normalizeQuiz({ ...partial, settings: { ...withDefaults(defaults as Quiz['settings']), ...(partial.settings ?? {}) } as Quiz['settings'], id: ref.id, ownerUid })
  const batch = writeBatch(db)
  batch.set(ref, { ...quizMeta(quiz, questions), createdAt: serverTimestamp() })
  questions.forEach((q) => batch.set(doc(db, 'quizzes', ref.id, 'questions', q.id), cleanQuestion(q)))
  await batch.commit()
  return ref.id
}

/** Sualı başqa quizin sonuna köçürür (yeni id ilə). */
export async function copyQuestionTo(targetQuizId: string, q: Question) {
  const target = await loadQuiz(targetQuizId)
  if (!target) throw new Error('not-found')
  const copy = { ...JSON.parse(JSON.stringify(q)), id: uid6() } as Question
  const batch = writeBatch(db)
  batch.set(doc(db, 'quizzes', targetQuizId, 'questions', copy.id), copy)
  batch.set(doc(db, 'quizzes', targetQuizId), { questionOrder: [...target.quiz.questionOrder, copy.id], ownerUid: target.quiz.ownerUid, updatedAt: serverTimestamp() }, { merge: true })
  await batch.commit()
  return target.quiz.title
}

export async function deleteQuiz(quizId: string) {
  const snap = await getDocs(collection(db, 'quizzes', quizId, 'questions'))
  const batch = writeBatch(db)
  snap.docs.forEach((d) => batch.delete(d.ref))
  batch.delete(doc(db, 'quizzes', quizId))
  await batch.commit()
}

export async function duplicateQuiz(quizId: string, ownerUid: string, suffix: string) {
  const data = await loadQuiz(quizId)
  if (!data) return
  const qs = data.questions.map((q) => ({ ...q, id: uid6() }))
  return createQuiz(ownerUid, { ...data.quiz, title: data.quiz.title + suffix }, qs)
}

// ---------------- JSON idxal / ixrac (bölmə 23) ----------------

export interface QuizJson {
  title: string
  description?: string
  coverEmoji?: string
  coverColor?: string
  settings?: Partial<Quiz['settings']>
  questions: Partial<Question>[]
}

export function parseQuizJson(raw: unknown): { quiz: Partial<Quiz>; questions: Question[] } {
  const j = raw as QuizJson
  if (!j || typeof j !== 'object' || !Array.isArray(j.questions)) throw new Error('bad-json')
  const questions = j.questions.map((q) => {
    const type = (q.type ?? 'single') as Question['type']
    const base: Question = {
      id: uid6(),
      type,
      text: String(q.text ?? ''),
      imageUrl: q.imageUrl || undefined,
      explanation: q.explanation || undefined,
      timeLimit: Number(q.timeLimit) || j.settings?.defaultTime || 45,
      points: (q.points as Question['points']) ?? 'standard',
      options: Array.isArray(q.options) ? q.options.map((o, i) => ({ id: String(o?.id ?? `o${i}`), text: String(o?.text ?? '') })) : [],
      correct: Array.isArray(q.correct) ? q.correct.map(String) : [],
      accepted: Array.isArray(q.accepted) ? q.accepted.map(String) : undefined,
      softMatch: q.softMatch,
      slider: q.slider,
      shuffleOptions: q.shuffleOptions,
    }
    if (type === 'truefalse' && base.options.length !== 2) return convertType(base, 'truefalse')
    if (type === 'order' && base.correct.length === 0) base.correct = base.options.map((o) => o.id)
    if (type === 'type') base.softMatch = base.softMatch ?? true
    return JSON.parse(JSON.stringify(base)) as Question
  })
  return {
    quiz: { title: String(j.title ?? ''), description: j.description ?? '', coverEmoji: j.coverEmoji ?? '🎯', coverColor: j.coverColor ?? '#E4202E', settings: withDefaults(j.settings as Quiz['settings']) },
    questions,
  }
}

export function quizToJson(quiz: Quiz, questions: Question[]): QuizJson {
  return {
    title: quiz.title,
    description: quiz.description,
    coverEmoji: quiz.coverEmoji,
    coverColor: quiz.coverColor,
    settings: quiz.settings,
    questions: questions.map((q) => {
      const { id: _id, ...rest } = q
      void _id
      return rest
    }),
  }
}

// ---------------- Admin ayarları ----------------

export async function loadAppSettings(): Promise<AppSettings> {
  try {
    const s = await getDoc(doc(db, 'settings', 'app'))
    return { ...DEFAULT_APP_SETTINGS, ...(s.exists() ? (s.data() as Partial<AppSettings>) : {}) }
  } catch {
    return DEFAULT_APP_SETTINGS
  }
}
export const saveAppSettings = (s: AppSettings) => setDoc(doc(db, 'settings', 'app'), s)

// ---------------- Səslər (düz / səhv cavab) ----------------

/**
 * Səs parçaları böyükdür (~350 KB): yalnız kiçik "meta" sənədi hər dəfə oxunur,
 * parça versiyası dəyişməyibsə brauzer keşindən (localStorage) götürülür.
 */
export async function loadSounds(): Promise<SoundSettings> {
  try {
    const m = await getDoc(doc(db, 'sounds', 'meta'))
    const enabled = m.exists() ? m.get('enabled') !== false : true
    const out: SoundSettings = { enabled, correct: null, wrong: null }
    for (const k of ['correct', 'wrong'] as const) {
      const v = m.get(`${k}V`) as number | undefined
      const cacheKey = `qz.snd.${k}`
      if (v === 0) continue // silinib
      try {
        const c = JSON.parse(localStorage.getItem(cacheKey) ?? 'null') as { v: number; clip: SoundClip } | null
        if (v && c?.v === v) { out[k] = c.clip; continue }
      } catch { /* keş yoxdur */ }
      const d = await getDoc(doc(db, 'sounds', k))
      if (!d.exists()) continue
      out[k] = d.data() as SoundClip
      if (v) try { localStorage.setItem(cacheKey, JSON.stringify({ v, clip: out[k] })) } catch { /* yer yoxdur */ }
    }
    return out
  } catch {
    return { enabled: false }
  }
}
export async function saveSoundClip(kind: 'correct' | 'wrong', clip: SoundClip | null) {
  if (clip) await setDoc(doc(db, 'sounds', kind), clip)
  else await deleteDoc(doc(db, 'sounds', kind))
  await setDoc(doc(db, 'sounds', 'meta'), { [`${kind}V`]: clip ? Date.now() : 0 }, { merge: true })
}
export const setSoundsEnabled = (enabled: boolean) => setDoc(doc(db, 'sounds', 'meta'), { enabled }, { merge: true })

// ---------------- Təlimçi profili ----------------

export async function loadProfile(uid: string): Promise<TrainerProfile | null> {
  try { const s = await getDoc(doc(db, 'profiles', uid)); return s.exists() ? (s.data() as TrainerProfile) : null } catch { return null }
}
export const saveProfile = (uid: string, p: TrainerProfile) => setDoc(doc(db, 'profiles', uid), JSON.parse(JSON.stringify(p)))

// ---------------- Oyunlar (admin) ----------------

export async function listGames(max = 100) {
  const snap = await getDocs(query(collection(db, 'games'), orderBy('createdAt', 'desc'), qLimit(max)))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
}

export async function deleteGame(gameId: string, pin?: string) {
  for (const sub of ['players', 'answers', 'reactions', 'secret']) {
    const snap = await getDocs(collection(db, 'games', gameId, sub))
    for (let i = 0; i < snap.docs.length; i += 400) {
      const b = writeBatch(db)
      snap.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref))
      await b.commit()
    }
  }
  if (pin) await deleteDoc(doc(db, 'pins', pin)).catch(() => {})
  await deleteDoc(doc(db, 'games', gameId))
}

export const touchQuiz = (quizId: string) => updateDoc(doc(db, 'quizzes', quizId), { updatedAt: serverTimestamp() })
