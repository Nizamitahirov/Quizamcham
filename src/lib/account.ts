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
    onboarded: true, createdAt: serverTimestamp(), termsAt: serverTimestamp(), lastLoginAt: serverTimestamp(),
  })
  if (p.type !== 'student') {
    const name = `${p.firstName} ${p.lastName}`.trim()
    await setDoc(doc(db, 'admins', user.uid), {
      email: user.email ?? '', name, role: 'trainer', source: 'signup', createdAt: serverTimestamp(), disabled: false, mustChangePassword: false,
    })
    // təlimçi profili (oyunçulara görünən ad/vəzifə) avtomatik doldurulur
    await saveProfile(user.uid, { name, title: p.position ?? '', org: p.organization ?? '', email: user.email ?? '' }).catch(() => {})
  }
}

export const touchLogin = (uid: string) => updateDoc(doc(db, 'users', uid), { lastLoginAt: serverTimestamp() }).catch(() => {})

/** Hazırkı hesab: Firebase istifadəçisi + qeydiyyat profili (canlı). */
export function useAccount() {
  const [state, setState] = useState<{ loading: boolean; user: User | null; profile: UserProfile | null }>({ loading: true, user: null, profile: null })
  useEffect(() => {
    let unsubDoc: (() => void) | null = null
    const unsub = onAuthStateChanged(auth, (u) => {
      unsubDoc?.(); unsubDoc = null
      if (!u || u.isAnonymous) return setState({ loading: false, user: null, profile: null })
      unsubDoc = onSnapshot(doc(db, 'users', u.uid),
        (s) => setState({ loading: false, user: u, profile: s.exists() ? (s.data() as UserProfile) : null }),
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
}

/** Quizi kataloqa dərc edir (yalnız qiymətləndirilən suallar + slaydlar; tələbə limitsiz məşq edə bilir). */
export async function publishToCatalog(quizId: string, author: string) {
  const data = await loadQuiz(quizId)
  if (!data) throw new Error('quiz-not-found')
  const questions = data.questions.filter((q) => SCORED_TYPES.has(q.type) || q.type === 'slide')
  if (!questions.some((q) => SCORED_TYPES.has(q.type))) throw new Error('no-scored')
  await setDoc(doc(db, 'catalog', quizId), JSON.parse(JSON.stringify({
    title: data.quiz.title, description: data.quiz.description ?? '', coverEmoji: data.quiz.coverEmoji, coverColor: data.quiz.coverColor,
    tags: data.quiz.tags ?? [], questions, questionCount: questions.filter((q) => SCORED_TYPES.has(q.type)).length,
    publishedBy: auth.currentUser?.uid ?? '', author,
  })) as Record<string, unknown>)
  await updateDoc(doc(db, 'catalog', quizId), { publishedAt: serverTimestamp() })
  void logAudit('quiz_published', { target: quizId, details: { title: data.quiz.title } })
}
export async function unpublish(quizId: string) {
  await deleteDoc(doc(db, 'catalog', quizId))
  void logAudit('quiz_unpublished', { target: quizId })
}
export async function isPublished(quizId: string) {
  return (await getDoc(doc(db, 'catalog', quizId)).catch(() => null))?.exists() ?? false
}
export async function listCatalog(): Promise<CatalogItem[]> {
  const s = await getDocs(collection(db, 'catalog'))
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CatalogItem, 'id'>) }))
    .sort((a, b) => (b.publishedAt?.toMillis() ?? 0) - (a.publishedAt?.toMillis() ?? 0))
}
export async function loadCatalogItem(id: string): Promise<CatalogItem | null> {
  const s = await getDoc(doc(db, 'catalog', id))
  return s.exists() ? ({ id: s.id, ...(s.data() as Omit<CatalogItem, 'id'>) }) : null
}

// ======================= Məşq nəticələri =======================

export interface Attempt { id: string; uid: string; quizId: string; quizTitle: string; correct: number; total: number; score: number; durationMs: number; at?: Timestamp }

export const saveAttempt = (a: Omit<Attempt, 'id' | 'at' | 'uid'>) =>
  addDoc(collection(db, 'attempts'), { ...a, uid: auth.currentUser?.uid ?? '', at: serverTimestamp() })

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
  members: { uid: string; email: string; role: string; source?: string; disabled?: boolean; createdAt?: Timestamp; trialEndsAt?: Timestamp; licenseUntil?: Timestamp; plan?: string }[]
  leads: LicenseRequest[]
  attempts: Attempt[]
  quizOwners: Record<string, number> // uid → quiz sayı
  gameHosts: Record<string, number> // uid → oyun sayı
  catalog: CatalogItem[]
}

export async function loadConsole(): Promise<ConsoleData> {
  const [u, m, l, a, q, g, c] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'admins')),
    getDocs(query(collection(db, 'licenseRequests'), orderBy('createdAt', 'desc'))),
    getDocs(query(collection(db, 'attempts'), orderBy('at', 'desc'), limit(3000))),
    getDocs(collection(db, 'quizzes')),
    getDocs(query(collection(db, 'games'), orderBy('createdAt', 'desc'), limit(2000))),
    listCatalog().catch(() => [] as CatalogItem[]),
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
  }
}

/** Lisenziya ver (gün sayı) və ya ləğv et (days = 0). */
export async function grantLicense(uid: string, email: string, days: number) {
  if (days <= 0) {
    await updateDoc(doc(db, 'admins', uid), { licenseUntil: deleteField(), plan: deleteField() })
    void logAudit('license_revoked', { target: uid, targetEmail: email })
    return
  }
  const until = Timestamp.fromMillis(Date.now() + days * 86_400_000)
  await updateDoc(doc(db, 'admins', uid), { licenseUntil: until, plan: 'pro' })
  void logAudit('license_granted', { target: uid, targetEmail: email, details: { days } })
}

/** Sınağı uzat (indidən etibarən N gün). */
export async function extendTrial(uid: string, email: string, days: number) {
  await updateDoc(doc(db, 'admins', uid), { trialEndsAt: Timestamp.fromMillis(Date.now() + days * 86_400_000) })
  void logAudit('trial_extended', { target: uid, targetEmail: email, details: { days } })
}

export async function setLeadStatus(id: string, status: LeadStatus, note?: string) {
  await updateDoc(doc(db, 'licenseRequests', id), { status, ...(note !== undefined ? { note } : {}), updatedAt: serverTimestamp() })
}
