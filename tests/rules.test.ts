/**
 * Firestore Security Rules testləri (emulator).
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, deleteDoc, where } from 'firebase/firestore'

let env: RulesTestEnvironment
const OWNER = 'owner1', TRAINER = 'trainer1', TRAINER2 = 'trainer2', P1 = 'player1', P2 = 'player2'
const SUPER = 'ii98moHX58SDPcn9lA4SYHWanou1', ADMIN = 'admin1', BANNED = 'trainer3'

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
    await setDoc(doc(db, 'admins', SUPER), { email: 'nt.nizamitahir@gmail.com', role: 'super' })
    await setDoc(doc(db, 'admins', ADMIN), { email: 'a@x.az', role: 'admin' })
    await setDoc(doc(db, 'admins', BANNED), { email: 'b@x.az', role: 'trainer', disabled: true })
    await setDoc(doc(db, 'quizzes', 'q2'), { title: 'Paylaşılan', ownerUid: TRAINER2, shared: true })
    await setDoc(doc(db, 'quizzes', 'q2', 'questions', 'a'), { text: 'S', correct: ['a'] })
    await setDoc(doc(db, 'quizzes', 'q3'), { title: 'Şəxsi', ownerUid: TRAINER2 })
    await setDoc(doc(db, 'audit', 'x1'), { actor: ADMIN, action: 'login', at: serverTimestamp() })
    await setDoc(doc(db, 'quizzes', 'q1'), { title: 'T', ownerUid: TRAINER })
    await setDoc(doc(db, 'quizzes', 'q1', 'questions', 'a'), { text: 'S', correct: ['a'] })
    await setDoc(doc(db, 'games', 'g1'), {
      hostUid: TRAINER, pin: '123456', phase: 'lobby', locked: false, questionIndex: -1, totalQuestions: 3,
      settings: { lateJoin: true, maxPlayers: 100, nameFilter: true }, playerCount: 1, questionEndsAt: null, ...gameExtra,
    })
    await setDoc(doc(db, 'pins', '123456'), { gameId: 'g1', active: true })
    await setDoc(doc(db, 'profiles', OWNER), { name: 'O', email: 'o@x.az' })
    await setDoc(doc(db, 'settings', 'app'), { bannedWords: ['pisad'] })
    await setDoc(doc(db, 'games', 'g1', 'results', 'review'), { items: [{ correct: ['a'] }] })
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
    await env.clearFirestore(); await seed({ phase: 'question', questionIndex: 0, questionStartedAt: Timestamp.fromMillis(Date.now() - 1000), questionEndsAt: Timestamp.fromMillis(Date.now() + 30000) })
    await assertSucceeds(ans(P2, 0, ['a']))
    await assertFails(ans(P2, 0, ['b']))
  })
  it('vaxt bitəndən sonra cavab rədd edilir', async () => {
    await env.clearFirestore(); await seed({ phase: 'question', questionIndex: 0, questionStartedAt: Timestamp.fromMillis(Date.now() - 40000), questionEndsAt: Timestamp.fromMillis(Date.now() - 10000) })
    await assertFails(ans(P2, 0, ['a']))
  })
  it('başqa sualın indeksi ilə cavab olmur', async () => {
    await env.clearFirestore(); await seed({ phase: 'question', questionIndex: 0, questionStartedAt: Timestamp.fromMillis(Date.now() - 1000), questionEndsAt: Timestamp.fromMillis(Date.now() + 30000) })
    await assertFails(ans(P2, 1, ['a']))
  })
  it('çox uzun cavab rədd edilir', async () => {
    await env.clearFirestore(); await seed({ phase: 'question', questionIndex: 0, questionStartedAt: Timestamp.fromMillis(Date.now() - 1000), questionEndsAt: Timestamp.fromMillis(Date.now() + 30000) })
    await assertFails(ans(P2, 0, 'x'.repeat(500)))
  })
  it('oyunçu cavabları oxuya bilmir', async () => {
    await assertFails(getDoc(doc(as(P2), 'games', 'g1', 'answers', `${P2}_0`)))
  })
  it('oxuma mərhələsində planlaşdırılmış sual: başlamadan əvvəl rədd, başlayandan sonra qəbul (host fazanı hələ dəyişməsə də)', async () => {
    await env.clearFirestore(); await seed({ phase: 'countdown', questionIndex: 0, questionStartedAt: Timestamp.fromMillis(Date.now() + 10000), questionEndsAt: Timestamp.fromMillis(Date.now() + 40000) })
    await assertFails(ans(P2, 0, ['a']))
    await env.clearFirestore(); await seed({ phase: 'countdown', questionIndex: 0, questionStartedAt: Timestamp.fromMillis(Date.now() - 500), questionEndsAt: Timestamp.fromMillis(Date.now() + 30000) })
    await assertSucceeds(ans(P2, 0, ['a']))
  })
  it('başlama vaxtı yazılmayıbsa cavab olmur', async () => {
    await env.clearFirestore(); await seed({ phase: 'countdown', questionIndex: 0, questionStartedAt: null, questionEndsAt: null })
    await assertFails(ans(P2, 0, ['a']))
  })
  it('canlı rejimdə sualı gec görən iştirakçı qeyd yaza bilir, kənar şəxs və başqa sual üçün yox', async () => {
    await env.clearFirestore(); await seed({ phase: 'question', questionIndex: 1, questionStartedAt: Timestamp.fromMillis(Date.now() - 3000), questionEndsAt: Timestamp.fromMillis(Date.now() + 30000) })
    await assertFails(setDoc(doc(as(P1), 'games', 'g1', 'starts', `${P1}_1`), { uid: P1, q: 1, startedAt: serverTimestamp() }))
    await assertFails(setDoc(doc(as(P2), 'games', 'g1', 'starts', `${P2}_2`), { uid: P2, q: 2, startedAt: serverTimestamp() }))
    await assertSucceeds(setDoc(doc(as(P2), 'games', 'g1', 'starts', `${P2}_1`), { uid: P2, q: 1, startedAt: serverTimestamp() }))
    await assertFails(setDoc(doc(as(P2), 'games', 'g1', 'starts', `${P2}_1`), { uid: P2, q: 1, startedAt: serverTimestamp() }))
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
    const id = `${P2}_${Math.floor(Date.now() / 10000)}`
    await assertSucceeds(setDoc(doc(as(P2), 'games', 'g1', 'qa', id), { uid: P2, name: 'A', text: 'Sualım var', createdAt: serverTimestamp(), votes: [], answered: false, hidden: false }))
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'games', 'g1', 'players', P1), player()) })
    await assertSucceeds(updateDoc(doc(as(P1), 'games', 'g1', 'qa', id), { votes: [P1] }))
    await assertFails(updateDoc(doc(as(P1), 'games', 'g1', 'qa', id), { votes: [P1, 'fake1', 'fake2'] }))
    await assertFails(updateDoc(doc(as(P1), 'games', 'g1', 'qa', id), { answered: true }))
  })
  it('xəta jurnalı: yazmaq olur, oyunçu oxuya bilmir', async () => {
    await assertSucceeds(setDoc(doc(as(P2), 'errors', 'e1'), { message: 'x', at: serverTimestamp() }))
    await assertFails(getDoc(doc(as(P2), 'errors', 'e1')))
    await assertFails(deleteDoc(doc(as(P2), 'errors', 'e1')))
  })
})

describe('məxfilik (audit düzəlişləri)', () => {
  const qa = (uid: string, id: string) => setDoc(doc(as(uid), 'games', 'g1', 'qa', id), { uid, name: 'A', text: 'Sual mətni', createdAt: serverTimestamp(), votes: [], answered: false, hidden: false })
  it('anonim istifadəçi oyunları və PIN-ləri siyahılaya bilmir, konkret PIN-i oxuya bilir', async () => {
    await assertFails(getDocs(collection(as(P1), 'games')))
    await assertFails(getDocs(collection(as(P1), 'pins')))
    await assertSucceeds(getDoc(doc(as(P1), 'pins', '123456')))
    await assertSucceeds(getDocs(query(collection(as(TRAINER), 'games'), where('hostUid', '==', TRAINER))))
  })
  it('aktiv oyunu hər kəs, bitmiş oyunu yalnız iştirakçı oxuyur', async () => {
    await assertSucceeds(getDoc(doc(as(P1), 'games', 'g1')))
    await env.clearFirestore(); await seed({ phase: 'finished' })
    await assertFails(getDoc(doc(as(P1), 'games', 'g1')))
    await assertSucceeds(getDoc(doc(as(P2), 'games', 'g1')))
  })
  it('sual icmalı (düzgün cavablar) yalnız iştirakçı və host üçün', async () => {
    await assertFails(getDoc(doc(as(P1), 'games', 'g1', 'results', 'review')))
    await assertSucceeds(getDoc(doc(as(P2), 'games', 'g1', 'results', 'review')))
    await assertSucceeds(getDoc(doc(as(TRAINER), 'games', 'g1', 'results', 'review')))
  })
  it('profillər (e-poçt): özü və admin oxuyur, başqa təlimçi yox', async () => {
    await assertFails(getDoc(doc(as(P1), 'profiles', OWNER)))
    await assertFails(getDoc(doc(as(TRAINER), 'profiles', OWNER)))
    await assertSucceeds(getDoc(doc(as(OWNER), 'profiles', OWNER)))
    await assertSucceeds(getDoc(doc(as(ADMIN), 'profiles', OWNER)))
  })
  it('qlobal ayarları və səsləri yalnız sahib dəyişir; təlimçi öz daimi QR-ını', async () => {
    await assertFails(setDoc(doc(as(TRAINER), 'settings', 'app'), { bannedWords: [] }))
    await assertFails(setDoc(doc(as(TRAINER), 'sounds', 'meta'), { enabled: false }))
    await assertSucceeds(setDoc(doc(as(OWNER), 'settings', 'app'), { bannedWords: [] }))
    await assertSucceeds(setDoc(doc(as(TRAINER), 'settings', `play_${TRAINER}`), { activeGameId: 'g1' }))
    await assertFails(setDoc(doc(as(TRAINER), 'settings', `play_${OWNER}`), { activeGameId: 'g1' }))
  })
  it('Q&A: iştirakçı olmayan yaza bilmir; 10 s-də bir sual', async () => {
    const b = Math.floor(Date.now() / 10000)
    await assertFails(qa(P1, `${P1}_${b}`))
    await assertFails(qa(P2, 'istənilən-id'))
    await assertSucceeds(qa(P2, `${P2}_${b}`))
    await assertFails(qa(P2, `${P2}_${b}`))
    await assertFails(getDocs(collection(as(P1), 'games', 'g1', 'qa')))
  })
  it('reaksiya: iştirakçı olmayan göndərə bilmir', async () => {
    await assertFails(setDoc(doc(as(P1), 'games', 'g1', 'reactions', `${P1}_${Math.floor(Date.now() / 2000)}`), { uid: P1, emoji: '🔥', createdAt: serverTimestamp() }))
  })
  it('maks. oyunçu dolubsa qoşulmaq olmur', async () => {
    await env.clearFirestore(); await seed({ playerCount: 100 })
    await assertFails(setDoc(doc(as(P1), 'games', 'g1', 'players', P1), player()))
  })
  it('qadağan ad qəbul olunmur (filtr açıqdırsa)', async () => {
    await assertFails(setDoc(doc(as(P1), 'games', 'g1', 'players', P1), player({ firstName: 'Pisad' })))
    await env.clearFirestore(); await seed({ settings: { lateJoin: true, maxPlayers: 100, nameFilter: false } })
    await assertSucceeds(setDoc(doc(as(P1), 'games', 'g1', 'players', P1), player({ firstName: 'Pisad' })))
  })
})

describe('giriş idarəetməsi (super admin / admin / təlimçi)', () => {
  it('heç kim super admini silə, məhdudlaşdıra və rolunu dəyişə bilməz', async () => {
    await assertFails(deleteDoc(doc(as(ADMIN), 'admins', SUPER)))
    await assertFails(updateDoc(doc(as(ADMIN), 'admins', SUPER), { disabled: true }))
    await assertFails(updateDoc(doc(as(OWNER), 'admins', SUPER), { role: 'trainer' }))
    await assertFails(updateDoc(doc(as(SUPER), 'admins', SUPER), { disabled: true }))
    await assertSucceeds(updateDoc(doc(as(SUPER), 'admins', SUPER), { name: 'Nizami' }))
  })
  it('super rolunu heç kim başqasına verə bilməz', async () => {
    await assertFails(setDoc(doc(as(SUPER), 'admins', 'new2'), { email: 'n@x.az', role: 'super' }))
    await assertFails(updateDoc(doc(as(SUPER), 'admins', TRAINER), { role: 'super' }))
  })
  it('admin yalnız təlimçi əlavə edir; admini isə yalnız super admin', async () => {
    await assertSucceeds(setDoc(doc(as(ADMIN), 'admins', 'new3'), { email: 'n@x.az', role: 'trainer', mustChangePassword: true }))
    await assertFails(setDoc(doc(as(ADMIN), 'admins', 'new4'), { email: 'n@x.az', role: 'admin' }))
    await assertSucceeds(setDoc(doc(as(SUPER), 'admins', 'new5'), { email: 'n@x.az', role: 'admin' }))
  })
  it('admin təlimçini məhdudlaşdırır/silir, amma başqa admini yox; özünü yüksəldə bilməz', async () => {
    await assertSucceeds(updateDoc(doc(as(ADMIN), 'admins', TRAINER), { disabled: true }))
    await assertFails(updateDoc(doc(as(ADMIN), 'admins', TRAINER2), { role: 'admin' }))
    await assertFails(updateDoc(doc(as(ADMIN), 'admins', OWNER), { disabled: true }))
    await assertFails(deleteDoc(doc(as(ADMIN), 'admins', OWNER)))
    await assertFails(updateDoc(doc(as(ADMIN), 'admins', ADMIN), { role: 'super' }))
    await assertSucceeds(deleteDoc(doc(as(ADMIN), 'admins', TRAINER2)))
    await assertSucceeds(updateDoc(doc(as(SUPER), 'admins', OWNER), { role: 'admin', disabled: true }))
  })
  it('təlimçi komanda siyahısını görə bilmir, yalnız öz sənədini', async () => {
    await assertFails(getDocs(collection(as(TRAINER), 'admins')))
    await assertFails(getDoc(doc(as(TRAINER), 'admins', TRAINER2)))
    await assertSucceeds(getDoc(doc(as(TRAINER), 'admins', TRAINER)))
    await assertSucceeds(getDocs(collection(as(ADMIN), 'admins')))
  })
  it('ilk girişdə yalnız "şifrə dəyişdi" bayrağını özü sıfırlaya bilir', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), 'admins', TRAINER), { mustChangePassword: true }) })
    await assertSucceeds(updateDoc(doc(as(TRAINER), 'admins', TRAINER), { mustChangePassword: false, passwordChangedAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(as(TRAINER), 'admins', TRAINER), { mustChangePassword: false, disabled: false }))
    await assertFails(updateDoc(doc(as(TRAINER), 'admins', TRAINER), { mustChangePassword: true }))
  })
  it('məhdudlaşdırılmış hesab heç nə edə bilmir', async () => {
    await assertFails(setDoc(doc(as(BANNED), 'quizzes', 'qb'), { title: 'X', ownerUid: BANNED }))
    await assertFails(getDoc(doc(as(BANNED), 'quizzes', 'q2')))
    await assertFails(getDocs(query(collection(as(BANNED), 'games'), where('hostUid', '==', BANNED))))
  })
  it('təlimçi yalnız öz və kitabxanaya paylaşılan quizləri görür', async () => {
    await assertSucceeds(getDoc(doc(as(TRAINER), 'quizzes', 'q1')))
    await assertSucceeds(getDoc(doc(as(TRAINER), 'quizzes', 'q2')))
    await assertSucceeds(getDoc(doc(as(TRAINER), 'quizzes', 'q2', 'questions', 'a')))
    await assertFails(getDoc(doc(as(TRAINER), 'quizzes', 'q3')))
    await assertFails(getDocs(collection(as(TRAINER), 'quizzes')))
    await assertSucceeds(getDocs(query(collection(as(TRAINER), 'quizzes'), where('ownerUid', '==', TRAINER))))
    await assertSucceeds(getDocs(query(collection(as(TRAINER), 'quizzes'), where('shared', '==', true))))
    await assertSucceeds(getDocs(collection(as(ADMIN), 'quizzes')))
  })
  it('təlimçi başqasının oyunlarını siyahılaya bilmir', async () => {
    await assertFails(getDocs(collection(as(TRAINER2), 'games')))
    await assertSucceeds(getDocs(query(collection(as(TRAINER2), 'games'), where('hostUid', '==', TRAINER2))))
    await assertSucceeds(getDocs(collection(as(ADMIN), 'games')))
  })
  it('loglar (audit + xəta) yalnız super admin üçün; audit dəyişdirilə bilməz', async () => {
    await assertFails(getDocs(collection(as(ADMIN), 'audit')))
    await assertFails(getDocs(collection(as(ADMIN), 'errors')))
    await assertSucceeds(getDocs(collection(as(SUPER), 'audit')))
    await assertSucceeds(getDocs(collection(as(SUPER), 'errors')))
    await assertSucceeds(setDoc(doc(as(TRAINER), 'audit', 'y1'), { actor: TRAINER, action: 'login', at: serverTimestamp() }))
    await assertFails(setDoc(doc(as(TRAINER), 'audit', 'y2'), { actor: ADMIN, action: 'login', at: serverTimestamp() }))
    await assertFails(updateDoc(doc(as(SUPER), 'audit', 'x1'), { action: 'x' }))
    await assertFails(deleteDoc(doc(as(SUPER), 'audit', 'x1')))
    await assertFails(setDoc(doc(as(P1), 'audit', 'y3'), { actor: P1, action: 'login', at: serverTimestamp() }))
  })
})
