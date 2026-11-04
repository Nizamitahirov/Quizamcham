/**
 * Firestore Security Rules testləri (emulator).
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc, deleteDoc } from 'firebase/firestore'

let env: RulesTestEnvironment
const OWNER = 'owner1', TRAINER = 'trainer1', TRAINER2 = 'trainer2', P1 = 'player1', P2 = 'player2'

const player = (extra = {}) => ({
  firstName: 'Aysel', lastName: 'Məmmədova', avatar: { style: 'fun-emoji', seed: 'x' }, joinedAt: serverTimestamp(), lastSeen: serverTimestamp(),
  kicked: false, score: 0, correctCount: 0, streak: 0, bestStreak: 0, totalCorrectTimeMs: 0, lastResult: null, history: [], ...extra,
})

async function seed(gameExtra: Record<string, unknown> = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'admins', OWNER), { email: 'o@x.az', role: 'owner' })
    await setDoc(doc(db, 'admins', TRAINER), { email: 't@x.az', role: 'trainer' })
    await setDoc(doc(db, 'admins', TRAINER2), { email: 't2@x.az', role: 'trainer' })
    await setDoc(doc(db, 'quizzes', 'q1'), { title: 'T', ownerUid: TRAINER })
    await setDoc(doc(db, 'quizzes', 'q1', 'questions', 'a'), { text: 'S', correct: ['a'] })
    await setDoc(doc(db, 'games', 'g1'), {
      hostUid: TRAINER, pin: '123456', phase: 'lobby', locked: false, questionIndex: -1, totalQuestions: 3,
      settings: { lateJoin: true }, questionEndsAt: null, ...gameExtra,
    })
    await setDoc(doc(db, 'games', 'g1', 'secret', 'key'), { questions: [{ correct: ['a'] }] })
    await setDoc(doc(db, 'games', 'g1', 'players', P2), player())
  })
}

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-quizamcham', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } })
})
afterAll(async () => { await env?.cleanup() })
beforeEach(async () => { await env.clearFirestore(); await seed() })

const as = (uid: string) => env.authenticatedContext(uid).firestore()

describe('rollar və sahiblik', () => {
  it('anonim istifadəçi admin siyahısını oxuya bilmir', async () => {
    await assertFails(getDoc(doc(as(P1), 'admins', TRAINER)))
  })
  it('təlimçi özünü sahib edə bilmir', async () => {
    await assertFails(updateDoc(doc(as(TRAINER), 'admins', TRAINER), { role: 'owner' }))
  })
  it('sahib yeni təlimçi əlavə edə bilir', async () => {
    await assertSucceeds(setDoc(doc(as(OWNER), 'admins', 'new1'), { email: 'n@x.az', role: 'trainer', name: 'N' }))
  })
  it('başqasının quizini təlimçi dəyişə bilmir, sahib dəyişə bilir', async () => {
    await assertFails(updateDoc(doc(as(TRAINER2), 'quizzes', 'q1'), { title: 'X', ownerUid: TRAINER }))
    await assertSucceeds(updateDoc(doc(as(TRAINER), 'quizzes', 'q1'), { title: 'Y', ownerUid: TRAINER }))
    await assertSucceeds(updateDoc(doc(as(OWNER), 'quizzes', 'q1'), { title: 'Z', ownerUid: TRAINER }))
  })
  it('quiz sahibliyi başqasına keçirilə bilmir', async () => {
    await assertFails(updateDoc(doc(as(TRAINER), 'quizzes', 'q1'), { ownerUid: TRAINER2 }))
  })
  it('oyunçu quiz suallarını (düzgün cavabları) oxuya bilmir', async () => {
    await assertFails(getDoc(doc(as(P1), 'quizzes', 'q1', 'questions', 'a')))
    await assertFails(getDoc(doc(as(P1), 'games', 'g1', 'secret', 'key')))
  })
  it('başqa təlimçinin oyununu idarə etmək olmur', async () => {
    await assertFails(updateDoc(doc(as(TRAINER2), 'games', 'g1'), { phase: 'countdown' }))
    await assertSucceeds(updateDoc(doc(as(TRAINER), 'games', 'g1'), { phase: 'countdown' }))
  })
})

describe('oyunçu qoşulması', () => {
  it('düzgün profil ilə qoşulur', async () => {
    await assertSucceeds(setDoc(doc(as(P1), 'games', 'g1', 'players', P1), player()))
  })
  it('xalı 0-dan fərqli göndərmək olmur', async () => {
    await assertFails(setDoc(doc(as(P1), 'games', 'g1', 'players', P1), player({ score: 5000 })))
  })
  it('başqasının adı ilə qoşulmaq olmur', async () => {
    await assertFails(setDoc(doc(as(P1), 'games', 'g1', 'players', 'someoneElse'), player()))
  })
  it('kilidli lobbiyə qoşulmaq olmur', async () => {
    await env.clearFirestore(); await seed({ locked: true })
    await assertFails(setDoc(doc(as(P1), 'games', 'g1', 'players', P1), player()))
  })
  it('oyunçu öz xalını dəyişə bilmir', async () => {
    await assertFails(updateDoc(doc(as(P2), 'games', 'g1', 'players', P2), { score: 99999 }))
  })
  it('adı yalnız lobbidə dəyişmək olur', async () => {
    await assertSucceeds(updateDoc(doc(as(P2), 'games', 'g1', 'players', P2), { firstName: 'Leyla' }))
    await env.clearFirestore(); await seed({ phase: 'question', questionIndex: 0 })
    await assertFails(updateDoc(doc(as(P2), 'games', 'g1', 'players', P2), { firstName: 'Leyla' }))
  })
  it('başqa oyunçunun sənədini oxumaq olmur', async () => {
    await assertFails(getDoc(doc(as(P1), 'games', 'g1', 'players', P2)))
  })
})

describe('cavablar', () => {
  const ans = (uid: string, qi: number, value: unknown) => setDoc(doc(as(uid), 'games', 'g1', 'answers', `${uid}_${qi}`), { uid, questionIndex: qi, value, answeredAt: serverTimestamp() })
  it('sual fazasında vaxtında cavab qəbul olunur, təkrar cavab olmur', async () => {
    await env.clearFirestore(); await seed({ phase: 'question', questionIndex: 0, questionEndsAt: Timestamp.fromMillis(Date.now() + 30000) })
    await assertSucceeds(ans(P2, 0, ['a']))
    await assertFails(ans(P2, 0, ['b']))
  })
  it('vaxt bitəndən sonra cavab rədd edilir', async () => {
    await env.clearFirestore(); await seed({ phase: 'question', questionIndex: 0, questionEndsAt: Timestamp.fromMillis(Date.now() - 10000) })
    await assertFails(ans(P2, 0, ['a']))
  })
  it('başqa sualın indeksi ilə cavab olmur', async () => {
    await env.clearFirestore(); await seed({ phase: 'question', questionIndex: 0, questionEndsAt: Timestamp.fromMillis(Date.now() + 30000) })
    await assertFails(ans(P2, 1, ['a']))
  })
  it('çox uzun cavab rədd edilir', async () => {
    await env.clearFirestore(); await seed({ phase: 'question', questionIndex: 0, questionEndsAt: Timestamp.fromMillis(Date.now() + 30000) })
    await assertFails(ans(P2, 0, 'x'.repeat(500)))
  })
  it('oyunçu cavabları oxuya bilmir', async () => {
    await assertFails(getDoc(doc(as(P2), 'games', 'g1', 'answers', `${P2}_0`)))
  })
  it('öz tempində rejimdə başlama sənədi olmadan cavab olmur', async () => {
    await env.clearFirestore(); await seed({ phase: 'self', selfEndsAt: Timestamp.fromMillis(Date.now() + 600000) })
    await assertFails(ans(P2, 1, ['a']))
    await assertSucceeds(setDoc(doc(as(P2), 'games', 'g1', 'starts', `${P2}_1`), { uid: P2, q: 1, startedAt: serverTimestamp() }))
    await assertSucceeds(ans(P2, 1, ['a']))
  })
})

describe('reaksiya və rəy', () => {
  it('reaksiya: eyni 2 saniyəlik pəncərədə ikinci sənəd yaradılmır', async () => {
    const b = Math.floor(Date.now() / 2000)
    const r = (id: string) => setDoc(doc(as(P2), 'games', 'g1', 'reactions', id), { uid: P2, emoji: '🔥', createdAt: serverTimestamp() })
    await assertSucceeds(r(`${P2}_${b}`))
    await assertFails(r(`${P2}_${b}`))
    await assertFails(r(`${P2}_${b + 50}`))
  })
  it('rəy 1–5 aralığında olmalıdır', async () => {
    const f = (rating: number) => setDoc(doc(as(P2), 'games', 'g1', 'feedback', P2), { rating, comment: 'Əla', name: 'A', at: serverTimestamp() })
    await assertFails(f(9))
    await assertSucceeds(f(5))
  })
  it('Q&A: yalnız öz səsini əlavə etmək olur', async () => {
    await assertSucceeds(setDoc(doc(as(P2), 'games', 'g1', 'qa', 'x1'), { uid: P2, name: 'A', text: 'Sualım var', createdAt: serverTimestamp(), votes: [], answered: false, hidden: false }))
    await assertSucceeds(updateDoc(doc(as(P1), 'games', 'g1', 'qa', 'x1'), { votes: [P1] }))
    await assertFails(updateDoc(doc(as(P1), 'games', 'g1', 'qa', 'x1'), { votes: [P1, 'fake1', 'fake2'] }))
    await assertFails(updateDoc(doc(as(P1), 'games', 'g1', 'qa', 'x1'), { answered: true }))
  })
  it('xəta jurnalı: yazmaq olur, oyunçu oxuya bilmir', async () => {
    await assertSucceeds(setDoc(doc(as(P2), 'errors', 'e1'), { message: 'x', at: serverTimestamp() }))
    await assertFails(getDoc(doc(as(P2), 'errors', 'e1')))
    await assertFails(deleteDoc(doc(as(P2), 'errors', 'e1')))
  })
})
