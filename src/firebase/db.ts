import {
  collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch, limit as qLimit,
} from 'firebase/firestore'
import { auth, db } from './config'
import type { AppSettings, Question, Quiz, SoundClip, SoundSettings, TrainerProfile } from '../types'
import { DEFAULT_APP_SETTINGS, convertType, uid6, withDefaults } from '../lib/defaults'

// ---------------- Quizlər ----------------

/**
 * Quizlər. ownerScope verilibsə (təlimçi): yalnız öz quizləri + kitabxanaya paylaşılanlar
 * (Rules təlimçiyə süzgəcsiz siyahını qadağan edir). Admin/super: hamısı.
 */
export async function listQuizzes(ownerScope?: string, withLibrary = true, orgScope?: string): Promise<(Quiz & { count: number })[]> {
  const docs = ownerScope
    ? (await Promise.all([
      getDocs(query(collection(db, 'quizzes'), where('ownerUid', '==', ownerScope))),
      ...(withLibrary ? [getDocs(query(collection(db, 'quizzes'), where('shared', '==', true)))] : []),
      ...(orgScope ? [getDocs(query(collection(db, 'quizzes'), where('orgId', '==', orgScope)))] : []),
      // birgə redaktə üçün mənimlə paylaşılanlar
      ...(auth.currentUser?.email ? [getDocs(query(collection(db, 'quizzes'), where('editors', 'array-contains', auth.currentUser.email.toLowerCase()))).catch(() => ({ docs: [] }))] : []),
    ])).flatMap((s) => s.docs)
    : (await getDocs(query(collection(db, 'quizzes'), orderBy('updatedAt', 'desc')))).docs
  const seen = new Set<string>()
  return docs
    .filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)))
    .map((d) => {
      const data = d.data() as Omit<Quiz, 'id'>
      return { ...normalizeQuiz({ ...data, id: d.id }), count: (data.questionOrder ?? []).length }
    })
    .sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0))
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
    shared: q.shared === true,
    orgId: q.orgId || undefined,
    tags: q.tags ?? [],
    folder: q.folder || undefined,
    editors: Array.isArray(q.editors) ? q.editors : [],
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

/** Kitabxanaya paylaşma (ayrıca yazı — avtomatik yadda saxlama və surətlər bu sahəyə toxunmur). */
export const setQuizShared = (quizId: string, shared: boolean) => updateDoc(doc(db, 'quizzes', quizId), { shared })

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

/** Yaradanın təşkilatı: müəssisə təlimçisi → orgId, müəssisə sahibi → öz uid-i, digərləri → '' (Rules-dakı orgOf ilə eyni). */
export async function orgIdFor(uid: string): Promise<string> {
  const s = await getDoc(doc(db, 'admins', uid)).catch(() => null)
  if (!s?.exists()) return ''
  if (s.get('source') === 'org') return String(s.get('orgId') ?? '')
  return s.get('source') === 'signup' && s.get('plan') === 'institution' ? uid : ''
}

export async function createQuiz(ownerUid: string, partial: Partial<Quiz> = {}, questions: Question[] = []): Promise<string> {
  const ref = doc(collection(db, 'quizzes'))
  const orgId = await orgIdFor(ownerUid)
  // təlimçinin standart ayarları (profil) → quizin öz ayarları üstündür
  const defaults = (await loadProfile(ownerUid))?.defaults ?? {}
  const quiz = normalizeQuiz({ ...partial, settings: { ...withDefaults(defaults as Quiz['settings']), ...(partial.settings ?? {}) } as Quiz['settings'], id: ref.id, ownerUid })
  const batch = writeBatch(db)
  batch.set(ref, { ...quizMeta(quiz, questions), ...(orgId ? { orgId } : {}), createdAt: serverTimestamp() })
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
      options: Array.isArray(q.options) ? q.options.map((o, i) => ({ id: String(o?.id ?? `o${i}`), text: String(o?.text ?? ''), ...((o as { pair?: unknown })?.pair !== undefined ? { pair: String((o as { pair?: unknown }).pair) } : {}) })) : [],
      correct: Array.isArray(q.correct) ? q.correct.map(String) : [],
      accepted: Array.isArray(q.accepted) ? q.accepted.map(String) : undefined,
      softMatch: q.softMatch,
      slider: q.slider,
      shuffleOptions: q.shuffleOptions,
      hotspot: (q as { hotspot?: Question['hotspot'] }).hotspot,
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

/** Oyunlar. hostScope verilibsə (təlimçi) — yalnız onun oyunları (Rules bunu tələb edir). */
export async function listGames(max = 100, hostScope?: string, orgScope?: string) {
  if (orgScope) {
    // müəssisə sahibi: öz oyunları + təlimçilərinin oyunları
    const [own, org] = await Promise.all([
      getDocs(query(collection(db, 'games'), where('hostUid', '==', hostScope ?? orgScope), orderBy('createdAt', 'desc'), qLimit(max))),
      getDocs(query(collection(db, 'games'), where('orgId', '==', orgScope), orderBy('createdAt', 'desc'), qLimit(max))),
    ])
    const seen = new Set<string>()
    return [...own.docs, ...org.docs].filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)))
      .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as { id: string; createdAt?: { toMillis(): number } } & Record<string, unknown>)
      .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
      .slice(0, max)
  }
  const snap = await getDocs(hostScope
    ? query(collection(db, 'games'), where('hostUid', '==', hostScope), orderBy('createdAt', 'desc'), qLimit(max))
    : query(collection(db, 'games'), orderBy('createdAt', 'desc'), qLimit(max)))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
}

export async function deleteGame(gameId: string, pin?: string) {
  // bütün alt kolleksiyalar (əks halda yarımçıq silinmə qalır)
  for (const sub of ['players', 'answers', 'starts', 'reactions', 'qa', 'feedback', 'results', 'secret']) {
    const snap = await getDocs(collection(db, 'games', gameId, sub))
    for (let i = 0; i < snap.docs.length; i += 400) {
      const b = writeBatch(db)
      snap.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref))
      await b.commit()
    }
  }
  if (pin) await deleteDoc(doc(db, 'pins', pin)).catch(() => {})
  // daimi QR silinən oyuna aparmasın
  const host = (await getDoc(doc(db, 'games', gameId)).catch(() => null))?.get('hostUid') as string | undefined
  if (host) { const { releaseQr } = await import('../lib/permQr'); const b = writeBatch(db); await releaseQr(b, host, gameId).catch(() => {}); await b.commit().catch(() => {}) }
  const cur = await getDoc(doc(db, 'settings', 'current')).catch(() => null)
  if (cur?.get('activeGameId') === gameId) await setDoc(doc(db, 'settings', 'current'), { activeGameId: null, pin: null, updatedAt: serverTimestamp() }).catch(() => {})
  await deleteDoc(doc(db, 'games', gameId))
}

export const touchQuiz = (quizId: string) => updateDoc(doc(db, 'quizzes', quizId), { updatedAt: serverTimestamp() })

/** Həmmüəllifləri yeniləyir (yalnız sahib). */
export const setQuizEditors = (quizId: string, emails: string[]) =>
  updateDoc(doc(db, 'quizzes', quizId), { editors: [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))].slice(0, 20) })
/** Qovluq (boş — qovluqsuz). */
export const setQuizFolder = (quizId: string, folder: string) => updateDoc(doc(db, 'quizzes', quizId), { folder: folder.trim().slice(0, 40) })
