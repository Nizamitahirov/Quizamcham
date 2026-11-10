import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, type User } from 'firebase/auth'
import {
  addDoc, collection, deleteDoc, deleteField, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, Timestamp, updateDoc, where,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { auth, db } from '../firebase/config'
import { loadQuiz, saveProfile } from '../firebase/db'
import { SCORED_TYPES } from './scoring'
import { logAudit } from './audit'
import type { Question } from '../types'
import { LEGAL_VERSION } from '../content/legal'
import { track } from '../firebase/extras'
import { moderateQuiz, type ModIssue } from '../../server/src/moderation'

// ======================= Qeydiyyat =======================

export type AccountType = 'student' | 'trainer' | 'institution'

/** users/{uid}: qeydiyyat zamanı toplanan məlumat. */
export interface UserProfile {
  email: string; displayName?: string; photoURL?: string; type: AccountType
  firstName: string; lastName: string; phone: string; country?: string; city?: string
  // təlimçi / müəssisə
  sector?: string; position?: string; organization?: string; orgType?: string; orgSize?: string; seats?: string; goal?: string
  // tələbə
  institution?: string; field?: string; level?: string; year?: string
  interests?: string[]; source?: string; marketing?: boolean
  onboarded: boolean; createdAt?: Timestamp; lastLoginAt?: Timestamp; termsAt?: Timestamp; lang?: string
  dataConsentAt?: Timestamp; marketingAt?: Timestamp; consentVersion?: string
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  try {
    return (await signInWithPopup(auth, provider)).user
  } catch (e) {
    const code = (e as { code?: string }).code ?? ''
    // telefon brauzerləri popup-u bloklayanda yönləndirmə ilə
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider)
    }
    throw e
  }
}

export async function loadUserProfile(uid: string): Promise<UserProfile | null> {
  const s = await getDoc(doc(db, 'users', uid)).catch(() => null)
  return s?.exists() ? (s.data() as UserProfile) : null
}

/** Qeydiyyatın sonu: profil + (təlimçi/müəssisə üçün) 3 günlük sınaqla təlimçi hesabı. */
export async function completeOnboarding(user: User, p: Omit<UserProfile, 'email' | 'onboarded' | 'createdAt' | 'termsAt'>) {
  const clean = JSON.parse(JSON.stringify(p)) as Record<string, unknown>
  await setDoc(doc(db, 'users', user.uid), {
    ...clean, email: user.email ?? '', displayName: user.displayName ?? '', photoURL: user.photoURL ?? '',
    onboarded: true, createdAt: serverTimestamp(), termsAt: serverTimestamp(), dataConsentAt: serverTimestamp(),
    marketingAt: serverTimestamp(), consentVersion: LEGAL_VERSION, lastLoginAt: serverTimestamp(),
  })
  // razılıq jurnalı (sübut): hər razılıq ayrıca, versiya və server vaxtı ilə
  await Promise.all([
    logConsent('data', true), logConsent('terms', true), logConsent('marketing', !!p.marketing),
  ]).catch(() => {})
  void track('sign_up', { method: 'google', type: p.type })
  if (p.type !== 'student') {
    const name = `${p.firstName} ${p.lastName}`.trim()
    await setDoc(doc(db, 'admins', user.uid), {
      email: user.email ?? '', name, role: 'trainer', source: 'signup', createdAt: serverTimestamp(), disabled: false, mustChangePassword: false,
    })
    // təlimçi profili (oyunçulara görünən ad/vəzifə) avtomatik doldurulur
    await saveProfile(user.uid, { name, title: p.position ?? '', org: p.organization ?? '', email: user.email ?? '' }).catch(() => {})
  }
}

export type ConsentType = 'data' | 'terms' | 'marketing'
export const logConsent = (type: ConsentType, granted: boolean) =>
  addDoc(collection(db, 'consents'), { uid: auth.currentUser?.uid ?? '', type, granted, version: LEGAL_VERSION, at: serverTimestamp() })

export const touchLogin = (uid: string) => { void track('login', { method: 'google' }); return updateDoc(doc(db, 'users', uid), { lastLoginAt: serverTimestamp() }).catch(() => {}) }

/** Hazırkı hesab: Firebase istifadəçisi + qeydiyyat profili (canlı). */
export function useAccount() {
  const [state, setState] = useState<{ loading: boolean; user: User | null; profile: UserProfile | null }>({ loading: true, user: null, profile: null })
  useEffect(() => {
    let unsubDoc: (() => void) | null = null
    const unsub = onAuthStateChanged(auth, (u) => {
      unsubDoc?.(); unsubDoc = null
      if (!u || u.isAnonymous) return setState({ loading: false, user: null, profile: null })
      unsubDoc = onSnapshot(doc(db, 'users', u.uid), { includeMetadataChanges: true },
        (s) => {
          // keşdən gələn "yoxdur" sübut deyil — server cavabını gözlə (yoxsa istifadəçi səhvən qeydiyyata qaytarılır)
          if (!s.exists() && s.metadata.fromCache) return
          setState({ loading: false, user: u, profile: s.exists() ? (s.data() as UserProfile) : null })
        },
        () => setState({ loading: false, user: u, profile: null }))
    })
    return () => { unsub(); unsubDoc?.() }
  }, [])
  return state
}

/** Girişdən sonra hara: admin/təlimçi → panel, tələbə → kataloq, profil yoxdursa → qeydiyyat. */
export async function routeAfterLogin(uid: string): Promise<string> {
  const [admin, profile] = await Promise.all([getDoc(doc(db, 'admins', uid)).catch(() => null), loadUserProfile(uid)])
  if (admin?.exists()) return '/admin'
  if (!profile?.onboarded) return '/onboarding'
  return profile.type === 'student' ? '/learn' : '/admin'
}

// ======================= İctimai kataloq =======================

export interface CatalogItem {
  id: string; title: string; description?: string; coverEmoji?: string; coverColor?: string; tags?: string[]
  questions: Question[]; questionCount: number; publishedBy: string; publishedAt?: Timestamp; author?: string
  category?: string; level?: 'easy' | 'medium' | 'hard'
  /** review — şəkilli quiz admin təsdiqini gözləyir; hidden — şikayət/moderasiya ilə gizlədilib */
  status?: 'live' | 'review'; hidden?: boolean; hiddenReason?: string; hasImages?: boolean
}

/** Avtomatik məzmun yoxlamasından keçməyən dərc cəhdi. */
export class ModerationError extends Error {
  constructor(public issues: ModIssue[]) { super('moderation') }
}

/** Quizi kataloqa dərc edir (yalnız qiymətləndirilən suallar + slaydlar; tələbə limitsiz məşq edə bilir). */
export async function publishToCatalog(quizId: string, author: string, meta: { category?: string; level?: 'easy' | 'medium' | 'hard' } = {}, opts: { trusted?: boolean } = {}) {
  const data = await loadQuiz(quizId)
  if (!data) throw new Error('quiz-not-found')
  const questions = data.questions.filter((q) => SCORED_TYPES.has(q.type) || q.type === 'slide')
  if (!questions.some((q) => SCORED_TYPES.has(q.type))) throw new Error('no-scored')
  const payload = JSON.parse(JSON.stringify({
    title: data.quiz.title, description: data.quiz.description ?? '', coverEmoji: data.quiz.coverEmoji, coverColor: data.quiz.coverColor,
    tags: data.quiz.tags ?? [], questions, questionCount: questions.filter((q) => SCORED_TYPES.has(q.type)).length,
    publishedBy: auth.currentUser?.uid ?? '', author, category: meta.category ?? '', level: meta.level ?? 'medium',
  })) as Record<string, unknown>
  // avtomatik yoxlama (server də eyni yoxlamanı təkrarlayır)
  const m = moderateQuiz(payload)
  if (!m.ok) throw new ModerationError(m.issues)
  // şəkilləri avtomatik yoxlamaq mümkün deyil → super admin təsdiqləyənə qədər "review"
  const status = m.hasImages && !opts.trusted ? 'review' : 'live'
  try {
    await setDoc(doc(db, 'catalog', quizId), { ...payload, hasImages: m.hasImages, status })
  } catch (e) {
    const msg = (e as Error).message ?? ''
    if (msg.startsWith('moderation:')) throw new ModerationError(JSON.parse(msg.slice(11)) as ModIssue[])
    throw e
  }
  await updateDoc(doc(db, 'catalog', quizId), { publishedAt: serverTimestamp() })
  void logAudit('quiz_published', { target: quizId, details: { title: data.quiz.title, status } })
  void track('quiz_published')
  return status
}
export async function unpublish(quizId: string) {
  await deleteDoc(doc(db, 'catalog', quizId))
  void logAudit('quiz_unpublished', { target: quizId })
}
export async function isPublished(quizId: string) {
  return (await getDoc(doc(db, 'catalog', quizId)).catch(() => null))?.exists() ?? false
}
export async function catalogMeta(quizId: string): Promise<Pick<CatalogItem, 'category' | 'level' | 'status' | 'hidden'> | null> {
  const s = await getDoc(doc(db, 'catalog', quizId)).catch(() => null)
  return s?.exists() ? { category: s.get('category'), level: s.get('level'), status: s.get('status'), hidden: s.get('hidden') } : null
}
/** Kataloq: standart olaraq yalnız tələbələrə görünənlər (gizlədilmiş və yoxlamada olanlar çıxarılır). */
export async function listCatalog(all = false): Promise<CatalogItem[]> {
  const s = await getDocs(collection(db, 'catalog'))
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CatalogItem, 'id'>) }))
    .filter((c) => all || (!c.hidden && c.status !== 'review'))
    .sort((a, b) => (b.publishedAt?.toMillis() ?? 0) - (a.publishedAt?.toMillis() ?? 0))
}

// ---------- Şikayətlər və moderasiya ----------
export type ReportReason = 'language' | 'sexual' | 'hate' | 'wrong' | 'spam' | 'other'
export interface QuizReport { id: string; uid: string; quizId: string; reason: ReportReason; note?: string; at?: Timestamp }
/** Tələbə şikayəti (bir quizə bir dəfə). 3 şikayətdən sonra server quizi avtomatik gizlədir. */
export async function reportQuiz(quizId: string, reason: ReportReason, note: string) {
  const uid = auth.currentUser?.uid ?? ''
  const ref = doc(db, 'reports', `${quizId}_${uid}`)
  try {
    await setDoc(ref, { uid, quizId, reason, note: note.trim().slice(0, 300), at: serverTimestamp() })
    return 'ok' as const
  } catch (e) {
    // şikayəti dəyişmək qadağandır — mövcud şikayət icazə xətası verir
    if ((e as { code?: string }).code === 'permission-denied') return 'already' as const
    throw e
  }
}
export async function listReports(): Promise<QuizReport[]> {
  const s = await getDocs(collection(db, 'reports'))
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<QuizReport, 'id'>) }))
}
/** Konsol: təsdiqlə/bərpa et (şikayətlər silinir). */
export async function approveCatalog(quizId: string, reports: QuizReport[]) {
  await updateDoc(doc(db, 'catalog', quizId), { status: 'live', hidden: false, hiddenReason: deleteField() })
  for (const r of reports.filter((x) => x.quizId === quizId)) await deleteDoc(doc(db, 'reports', r.id)).catch(() => {})
  void logAudit('quiz_approved', { target: quizId })
}
export async function hideCatalog(quizId: string) {
  await updateDoc(doc(db, 'catalog', quizId), { hidden: true, hiddenReason: 'admin' })
  void logAudit('quiz_hidden', { target: quizId })
}
export async function loadCatalogItem(id: string): Promise<CatalogItem | null> {
  const s = await getDoc(doc(db, 'catalog', id))
  return s.exists() ? ({ id: s.id, ...(s.data() as Omit<CatalogItem, 'id'>) }) : null
}

// ======================= Məşq nəticələri =======================

export interface Attempt { id: string; uid: string; quizId: string; quizTitle: string; correct: number; total: number; score: number; durationMs: number; at?: Timestamp }

export const saveAttempt = (a: Omit<Attempt, 'id' | 'at' | 'uid'>) => {
  void track('practice_complete', { quiz: a.quizId, pct: a.total ? Math.round((a.correct / a.total) * 100) : 0 })
  return addDoc(collection(db, 'attempts'), { ...a, uid: auth.currentUser?.uid ?? '', at: serverTimestamp() })
}

export async function myAttempts(uid: string): Promise<Attempt[]> {
  const s = await getDocs(query(collection(db, 'attempts'), where('uid', '==', uid)))
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Attempt, 'id'>) })).sort((a, b) => (b.at?.toMillis() ?? 0) - (a.at?.toMillis() ?? 0))
}

// ======================= Lisenziya müraciətləri və qiymətlər =======================

export const CONTACT = { phone: '+994997777009', phoneLabel: '+994 99 777 70 09', email: 'nt.nizamitahir@gmail.com', whatsapp: 'https://wa.me/994997777009' }

export type LeadStatus = 'new' | 'contacted' | 'won' | 'lost'
export interface LicenseRequest {
  id: string; uid: string; email: string; name: string; phone: string; organization?: string
  plan: 'trainer' | 'institution' | 'custom'; seats?: string; message?: string; status: LeadStatus; note?: string; createdAt?: Timestamp
}

export async function requestLicense(r: Omit<LicenseRequest, 'id' | 'uid' | 'status' | 'createdAt' | 'note'>) {
  void track('license_request', { plan: r.plan })
  await addDoc(collection(db, 'licenseRequests'), {
    ...JSON.parse(JSON.stringify(r)) as Record<string, unknown>, uid: auth.currentUser?.uid ?? '', status: 'new', createdAt: serverTimestamp(),
  })
}

export interface PricePlan { key: 'student' | 'trainer' | 'institution'; price: string; period: string }
export const DEFAULT_PRICES: PricePlan[] = [
  { key: 'student', price: '0 ₼', period: '' },
  { key: 'trainer', price: '', period: '' },
  { key: 'institution', price: '', period: '' },
]
export async function loadPricing(): Promise<PricePlan[]> {
  const s = await getDoc(doc(db, 'settings', 'pricing')).catch(() => null)
  const saved = (s?.exists() ? (s.get('plans') as PricePlan[]) : null) ?? []
  return DEFAULT_PRICES.map((p) => ({ ...p, ...(saved.find((x) => x.key === p.key) ?? {}) }))
}
export async function savePricing(plans: PricePlan[]) {
  await setDoc(doc(db, 'settings', 'pricing'), { plans, updatedAt: serverTimestamp() })
  void logAudit('pricing_saved')
}

// ======================= Konsol (super admin) =======================

export interface ConsoleData {
  users: (UserProfile & { uid: string })[]
  members: { uid: string; email: string; name?: string; role: string; source?: string; disabled?: boolean; createdAt?: Timestamp; trialEndsAt?: Timestamp; licenseUntil?: Timestamp; plan?: string; seats?: number; orgId?: string }[]
  licenses: LicenseRecord[]
  plays: { uid: string; gameId: string; score: number; at?: Timestamp }[]
  leads: LicenseRequest[]
  attempts: Attempt[]
  quizOwners: Record<string, number> // uid → quiz sayı
  gameHosts: Record<string, number> // uid → oyun sayı
  catalog: CatalogItem[]
}

export async function loadConsole(): Promise<ConsoleData> {
  const [u, m, l, a, q, g, c, li, pl] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'admins')),
    getDocs(query(collection(db, 'licenseRequests'), orderBy('createdAt', 'desc'))),
    getDocs(query(collection(db, 'attempts'), orderBy('at', 'desc'), limit(3000))),
    getDocs(collection(db, 'quizzes')),
    getDocs(query(collection(db, 'games'), orderBy('createdAt', 'desc'), limit(2000))),
    listCatalog(true).catch(() => [] as CatalogItem[]),
    getDocs(query(collection(db, 'licenses'), orderBy('at', 'desc'))).catch(() => null),
    getDocs(query(collection(db, 'plays'), limit(5000))).catch(() => null),
  ])
  const count = (docs: { get(k: string): unknown }[], key: string) => docs.reduce<Record<string, number>>((acc, d) => { const k = String(d.get(key) ?? ''); acc[k] = (acc[k] ?? 0) + 1; return acc }, {})
  return {
    users: u.docs.map((d) => ({ uid: d.id, ...(d.data() as UserProfile) })),
    members: m.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<ConsoleData['members'][number], 'uid'>) })),
    leads: l.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LicenseRequest, 'id'>) })),
    attempts: a.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Attempt, 'id'>) })),
    quizOwners: count(q.docs, 'ownerUid'),
    gameHosts: count(g.docs, 'hostUid'),
    catalog: c,
    licenses: li?.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LicenseRecord, 'id'>) })) ?? [],
    plays: pl?.docs.map((d) => d.data() as ConsoleData['plays'][number]) ?? [],
  }
}

export interface LicenseRecord { id: string; uid: string; email: string; plan: 'pro' | 'institution' | 'revoked'; seats: number; from?: Timestamp; until?: Timestamp; amount: number; currency: string; note?: string; by: string; at?: Timestamp }
export interface LicenseInput { plan: 'pro' | 'institution'; seats: number; until: Date; amount: number; note?: string }

/** Lisenziya ver/yenilə: üzvlük sənədi + tarixçə qeydi (məbləğ — gəlir hesabatı üçün). */
export async function grantLicense(uid: string, email: string, l: LicenseInput) {
  const until = Timestamp.fromDate(l.until)
  await updateDoc(doc(db, 'admins', uid), { licenseUntil: until, plan: l.plan, seats: Math.max(1, Math.round(l.seats)) })
  await addDoc(collection(db, 'licenses'), {
    uid, email, plan: l.plan, seats: Math.max(1, Math.round(l.seats)), from: serverTimestamp(), until, amount: Math.max(0, Number(l.amount) || 0),
    currency: 'AZN', note: (l.note ?? '').slice(0, 300), by: auth.currentUser?.uid ?? '', at: serverTimestamp(),
  })
  void logAudit('license_granted', { target: uid, targetEmail: email, details: { plan: l.plan, until: l.until.toISOString().slice(0, 10), amount: l.amount } })
}
export async function revokeLicense(uid: string, email: string) {
  await updateDoc(doc(db, 'admins', uid), { licenseUntil: deleteField(), plan: deleteField(), seats: deleteField() })
  await addDoc(collection(db, 'licenses'), { uid, email, plan: 'revoked', seats: 0, from: serverTimestamp(), until: serverTimestamp(), amount: 0, currency: 'AZN', note: '', by: auth.currentUser?.uid ?? '', at: serverTimestamp() })
  void logAudit('license_revoked', { target: uid, targetEmail: email })
}

/** Konsol: tələbəni təlimçiyə çevir — tip dəyişir, 3 günlük Pro sınaq başlayır. */
export async function convertToTrainer(uid: string, email: string, name: string) {
  await updateDoc(doc(db, 'users', uid), { type: 'trainer' })
  await setDoc(doc(db, 'admins', uid), { email, name, role: 'trainer', source: 'signup', createdAt: serverTimestamp(), disabled: false, mustChangePassword: false })
  void logAudit('member_converted', { target: uid, targetEmail: email })
}

/** Sınağı uzat (indidən etibarən N gün). */
export async function extendTrial(uid: string, email: string, days: number) {
  await updateDoc(doc(db, 'admins', uid), { trialEndsAt: Timestamp.fromMillis(Date.now() + days * 86_400_000) })
  void logAudit('trial_extended', { target: uid, targetEmail: email, details: { days } })
}

export async function setLeadStatus(id: string, status: LeadStatus, note?: string) {
  await updateDoc(doc(db, 'licenseRequests', id), { status, ...(note !== undefined ? { note } : {}), updatedAt: serverTimestamp() })
}

// ======================= Hesabım: redaktə, razılıqlar, ixrac, silmə =======================

export const updateMyProfile = (uid: string, patch: Partial<UserProfile>) =>
  updateDoc(doc(db, 'users', uid), JSON.parse(JSON.stringify(patch)) as Record<string, unknown>)

export async function setMarketing(uid: string, granted: boolean) {
  await updateDoc(doc(db, 'users', uid), { marketing: granted, marketingAt: serverTimestamp() })
  await logConsent('marketing', granted).catch(() => {})
  void track('marketing_consent', { granted: granted ? 1 : 0 })
}

const mine = async (col: string, uid: string) =>
  (await getDocs(query(collection(db, col), where('uid', '==', uid))).catch(() => null))?.docs ?? []

/** Bütün şəxsi məlumatların surəti (JSON). */
export async function exportMyData(uid: string) {
  const [profile, member, attempts, plays, consents, leads, quizzes] = await Promise.all([
    getDoc(doc(db, 'users', uid)).catch(() => null),
    getDoc(doc(db, 'admins', uid)).catch(() => null),
    mine('attempts', uid), mine('plays', uid), mine('consents', uid), mine('licenseRequests', uid),
    getDocs(query(collection(db, 'quizzes'), where('ownerUid', '==', uid))).then((s) => s.docs, () => []),
  ])
  const plain = (v: unknown): unknown => JSON.parse(JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && 'seconds' in x && 'nanoseconds' in x ? new Timestamp(x.seconds, x.nanoseconds).toDate().toISOString() : x)))
  void logAudit('data_exported')
  return plain({
    exportedAt: new Date().toISOString(), uid,
    profile: profile?.data() ?? null,
    plan: member?.exists() ? { role: member.get('role'), source: member.get('source'), createdAt: member.get('createdAt'), trialEndsAt: member.get('trialEndsAt') ?? null, licenseUntil: member.get('licenseUntil') ?? null } : null,
    quizzes: quizzes.map((d) => ({ id: d.id, title: d.get('title') })),
    practiceAttempts: attempts.map((d) => d.data()), liveGames: plays.map((d) => d.data()),
    consents: consents.map((d) => d.data()), licenseRequests: leads.map((d) => d.data()),
  })
}

/**
 * Hesabın tam silinməsi: quizlər, keçirdiyi oyunlar, məşq və oyun tarixçəsi, müraciətlər, profil, komanda qeydi və giriş hesabı.
 * Razılıq jurnalı (yalnız uid, tip, versiya, tarix) sübut kimi saxlanılır — məxfilik siyasətinin 7-ci bölməsi.
 */
export async function deleteMyAccount(user: User, onStep?: (s: string) => void) {
  const { reauthenticateWithPopup, deleteUser } = await import('firebase/auth')
  // təhlükəsizlik: son giriş təsdiqi (Firebase həssas əməliyyat üçün tələb edir)
  if (user.providerData.some((p) => p.providerId === 'google.com')) await reauthenticateWithPopup(user, new GoogleAuthProvider())
  const uid = user.uid
  const { deleteGame, deleteQuiz } = await import('../firebase/db')
  await logAudit('account_deleted', { target: uid, targetEmail: user.email ?? '' })
  onStep?.('games')
  const games = await getDocs(query(collection(db, 'games'), where('hostUid', '==', uid))).then((s) => s.docs, () => [])
  for (const g of games) await deleteGame(g.id, g.get('pin')).catch(() => {})
  onStep?.('quizzes')
  const quizzes = await getDocs(query(collection(db, 'quizzes'), where('ownerUid', '==', uid))).then((s) => s.docs, () => [])
  for (const q of quizzes) { await deleteDoc(doc(db, 'catalog', q.id)).catch(() => {}); await deleteQuiz(q.id).catch(() => {}) }
  onStep?.('history')
  for (const c of ['attempts', 'plays', 'licenseRequests']) for (const d of await mine(c, uid)) await deleteDoc(d.ref).catch(() => {})
  await deleteDoc(doc(db, 'profiles', uid)).catch(() => {})
  await deleteDoc(doc(db, 'settings', `play_${uid}`)).catch(() => {})
  await deleteDoc(doc(db, 'admins', uid)).catch(() => {})
  await deleteDoc(doc(db, 'users', uid))
  onStep?.('auth')
  void track('account_deleted')
  await deleteUser(user)
}

/** Qeydiyyatlı istifadəçinin canlı oyun nəticəsi (oyun bitəndə bir dəfə). */
export async function recordPlay(p: { gameId: string; title: string; rank: number; total: number; score: number; correct: number; questions: number }) {
  const u = auth.currentUser
  if (!u || u.isAnonymous) return
  await setDoc(doc(db, 'plays', `${u.uid}_${p.gameId}`), { ...p, title: p.title.slice(0, 120), uid: u.uid, at: serverTimestamp() }).catch(() => {})
}
export async function myPlays(uid: string) {
  return (await mine('plays', uid)).map((d) => ({ id: d.id, ...(d.data() as { gameId: string; title: string; rank: number; total: number; score: number; correct: number; questions: number; at?: Timestamp }) }))
    .sort((a, b) => (b.at?.toMillis() ?? 0) - (a.at?.toMillis() ?? 0))
}

/** Tələbə → təlimçi (və ya müəssisə): tip dəyişir və 3 günlük Pro sınaq başlayır. */
export async function upgradeToTrainer(user: User, profile: UserProfile, type: 'trainer' | 'institution', extra: Partial<UserProfile>) {
  await updateDoc(doc(db, 'users', user.uid), JSON.parse(JSON.stringify({ ...extra, type })) as Record<string, unknown>)
  const name = `${profile.firstName} ${profile.lastName}`.trim()
  await setDoc(doc(db, 'admins', user.uid), { email: user.email ?? '', name, role: 'trainer', source: 'signup', createdAt: serverTimestamp(), disabled: false, mustChangePassword: false })
  await saveProfile(user.uid, { name, title: extra.position ?? '', org: extra.organization ?? '', email: user.email ?? '' }).catch(() => {})
  void track('upgrade_to_trainer', { type })
}
