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

/** Kataloq üçün etibarlı məzmun (Jabr serveri dərcdə avtomatik moderasiya edir). img → şəkilli sual. */
const CQ = (img = false) => [1, 2, 3].map((i) => ({ id: `x${i}`, type: 'single', text: `Sual ${i}?`, options: [{ id: 'a', text: 'Bəli' }, { id: 'b', text: 'Xeyr' }], correct: ['a'], ...(img && i === 1 ? { imageUrl: 'data:image/png;base64,AAAA' } : {}) }))
const cat = (by: string, extra: Record<string, unknown> = {}, img = false) => ({ title: 'Sınaq quizi', questions: CQ(img), publishedBy: by, status: 'live', hasImages: img, ...extra })

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
  env = await initializeTestEnvironment({ projectId: 'demo-jabr', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } })
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
  it('əminlik rejimi: "conf" yalnız true/false ola bilər', async () => {
    await env.clearFirestore(); await seed({ phase: 'question', questionIndex: 0, questionStartedAt: Timestamp.fromMillis(Date.now() - 1000), questionEndsAt: Timestamp.fromMillis(Date.now() + 30000) })
    await setDoc(doc(as(P2), 'games', 'g1', 'starts', `${P2}_0`), { uid: P2, q: 0, startedAt: serverTimestamp() }).catch(() => {})
    await assertFails(setDoc(doc(as(P2), 'games', 'g1', 'answers', `${P2}_0`), { uid: P2, questionIndex: 0, value: ['a'], answeredAt: serverTimestamp(), conf: 'yes' }))
    await assertFails(setDoc(doc(as(P2), 'games', 'g1', 'answers', `${P2}_0`), { uid: P2, questionIndex: 0, value: ['a'], answeredAt: serverTimestamp(), extra: 1 }))
    await assertSucceeds(setDoc(doc(as(P2), 'games', 'g1', 'answers', `${P2}_0`), { uid: P2, questionIndex: 0, value: ['a'], answeredAt: serverTimestamp(), conf: true }))
  })
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

describe('tənzimlənən icazələr (rol standartları + fərdi istisnalar)', () => {
  const setAccess = (data: Record<string, unknown>) => env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'settings', 'access'), data) })
  const setPerms = (uid: string, perms: Record<string, boolean>) => env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), 'admins', uid), { perms }) })
  it('rol icazələrini yalnız super admin dəyişir', async () => {
    await assertFails(setDoc(doc(as(ADMIN), 'settings', 'access'), { admin: {}, trainer: { allContent: true } }))
    await assertFails(setDoc(doc(as(TRAINER), 'settings', 'access'), { admin: {}, trainer: { allContent: true } }))
    await assertSucceeds(setDoc(doc(as(SUPER), 'settings', 'access'), { admin: { logs: true }, trainer: { allContent: false } }))
    await assertFails(setDoc(doc(as(SUPER), 'settings', 'access'), { admin: { superPower: true }, trainer: {} }))
  })
  it('təlimçi roluna "bütün məzmun" verilsə, bütün quizləri görür', async () => {
    await assertFails(getDoc(doc(as(TRAINER), 'quizzes', 'q3')))
    await setAccess({ admin: {}, trainer: { allContent: true } })
    await assertSucceeds(getDoc(doc(as(TRAINER), 'quizzes', 'q3')))
    await assertSucceeds(getDocs(collection(as(TRAINER), 'quizzes')))
  })
  it('admin roluna "loglar" verilsə, audit jurnalını oxuyur', async () => {
    await assertFails(getDocs(collection(as(ADMIN), 'audit')))
    await setAccess({ admin: { logs: true }, trainer: {} })
    await assertSucceeds(getDocs(collection(as(ADMIN), 'audit')))
  })
  it('təlimçidən "quiz yaratmaq" və "kitabxana" alınarsa', async () => {
    await setAccess({ admin: {}, trainer: { createQuiz: false, library: false } })
    await assertFails(setDoc(doc(as(TRAINER), 'quizzes', 'qn'), { title: 'X', ownerUid: TRAINER }))
    await assertFails(getDoc(doc(as(TRAINER), 'quizzes', 'q2')))
    await assertSucceeds(getDoc(doc(as(TRAINER), 'quizzes', 'q1')))
  })
  it('fərdi istisna rol standartından üstündür', async () => {
    await setPerms(ADMIN, { settings: false })
    await assertFails(setDoc(doc(as(ADMIN), 'settings', 'app'), { bannedWords: [] }))
    await setPerms(TRAINER, { logs: true })
    await assertSucceeds(getDocs(collection(as(TRAINER), 'errors')))
    await assertFails(getDocs(collection(as(TRAINER2), 'errors')))
  })
  it('fərdi icazələri yalnız super admin təyin edir; admin təlimçiyə icazə verə bilməz', async () => {
    await assertFails(updateDoc(doc(as(ADMIN), 'admins', TRAINER), { perms: { allContent: true } }))
    await assertSucceeds(updateDoc(doc(as(SUPER), 'admins', TRAINER), { perms: { allContent: true } }))
    await assertFails(updateDoc(doc(as(SUPER), 'admins', TRAINER), { perms: { manageAdmins: true } }))
    await assertFails(setDoc(doc(as(ADMIN), 'admins', 'new9'), { email: 'n@x.az', role: 'trainer', perms: { logs: true } }))
  })
  it('"təlimçiləri idarə et" alınmış admin komandaya toxuna bilmir', async () => {
    await setPerms(ADMIN, { trainers: false })
    await assertFails(getDocs(collection(as(ADMIN), 'admins')))
    await assertFails(updateDoc(doc(as(ADMIN), 'admins', TRAINER), { disabled: true }))
  })
  it('"kitabxanaya paylaşmaq" olmadan quizi paylaşmaq olmur', async () => {
    await setAccess({ admin: {}, trainer: { share: false } })
    await assertFails(updateDoc(doc(as(TRAINER), 'quizzes', 'q1'), { shared: true }))
    await assertSucceeds(updateDoc(doc(as(TRAINER), 'quizzes', 'q1'), { title: 'Yeni ad' }))
  })
})

describe('silmə', () => {
  it('host oyunu bütün alt kolleksiyaları ilə silə bilir; başqası yox', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'games', 'g1', 'answers', `${P2}_0`), { uid: P2, questionIndex: 0, value: 'a' })
      await setDoc(doc(db, 'games', 'g1', 'starts', `${P2}_0`), { uid: P2, q: 0 })
      await setDoc(doc(db, 'games', 'g1', 'reactions', `${P2}_1`), { uid: P2, emoji: '🔥' })
      await setDoc(doc(db, 'games', 'g1', 'feedback', P2), { rating: 5 })
    })
    for (const sub of [`answers/${P2}_0`, `starts/${P2}_0`, `reactions/${P2}_1`, `feedback/${P2}`]) {
      await assertFails(deleteDoc(doc(as(P2), `games/g1/${sub}`)))
      await assertFails(deleteDoc(doc(as(TRAINER2), `games/g1/${sub}`)))
      await assertSucceeds(deleteDoc(doc(as(TRAINER), `games/g1/${sub}`)))
    }
    await assertSucceeds(deleteDoc(doc(as(TRAINER), 'games', 'g1', 'players', P2)))
    await assertSucceeds(deleteDoc(doc(as(TRAINER), 'games', 'g1')))
  })
  it('quiz sahibi quizi sualları ilə silə bilir', async () => {
    await assertSucceeds(deleteDoc(doc(as(TRAINER), 'quizzes', 'q1', 'questions', 'a')))
    await assertSucceeds(deleteDoc(doc(as(TRAINER), 'quizzes', 'q1')))
    await assertFails(deleteDoc(doc(as(TRAINER), 'quizzes', 'q3')))
  })
})

describe('qeydiyyat, sınaq, kataloq, lisenziya', () => {
  const G = 'guser1', S = 'student1'
  const google = (uid: string, email = `${uid}@gmail.com`) => env.authenticatedContext(uid, { email, firebase: { sign_in_provider: 'google.com' } }).firestore()
  const anon = (uid: string) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore()
  const profile = (type: string, email: string, extra = {}) => ({ email, type, firstName: 'Aysel', lastName: 'Məmmədova', phone: '+994501112233', onboarded: true, createdAt: serverTimestamp(), ...extra })
  const trial = (email: string) => ({ email, name: 'A', role: 'trainer', source: 'signup', createdAt: serverTimestamp(), disabled: false, mustChangePassword: false })

  it('Google istifadəçisi öz profilini yaradır; anonim və başqasının adına yox', async () => {
    await assertSucceeds(setDoc(doc(google(G), 'users', G), profile('trainer', `${G}@gmail.com`)))
    await assertFails(setDoc(doc(anon('a1'), 'users', 'a1'), profile('student', 'a1@x.az')))
    await assertFails(setDoc(doc(google('g2'), 'users', G), profile('student', 'g2@gmail.com')))
    await assertFails(setDoc(doc(google('g3'), 'users', 'g3'), profile('student', 'fake@x.az')))
  })
  it('tip yalnız tələbədən təlimçiyə dəyişə bilər (geri yox)', async () => {
    await setDoc(doc(google(S), 'users', S), profile('trainer', `${S}@gmail.com`))
    await assertSucceeds(updateDoc(doc(google(S), 'users', S), { city: 'Bakı' }))
    await assertFails(updateDoc(doc(google(S), 'users', S), { type: 'student' }))
    await assertFails(updateDoc(doc(google(S), 'users', S), { type: 'institution' }))
  })
  it('sınaq yalnız düz 3 gün, profildən sonra və yalnız Google ilə', async () => {
    await assertFails(setDoc(doc(google(G), 'admins', G), trial(`${G}@gmail.com`)))           // profil yoxdur
    await setDoc(doc(google(G), 'users', G), profile('trainer', `${G}@gmail.com`))
    await assertFails(setDoc(doc(google(G), 'admins', G), { ...trial(`${G}@gmail.com`), trialEndsAt: Timestamp.fromMillis(Date.now() + 30 * 86400000) }))  // özü uzada bilməz
    await assertFails(setDoc(doc(google(G), 'admins', G), { ...trial(`${G}@gmail.com`), role: 'admin' }))
    await assertFails(setDoc(doc(google(G), 'admins', G), { ...trial(`${G}@gmail.com`), licenseUntil: Timestamp.fromMillis(Date.now() + 9e10) }))
    await assertFails(setDoc(doc(google(G), 'admins', G), { ...trial(`${G}@gmail.com`), createdAt: Timestamp.fromMillis(Date.now() + 9e10) }))
    await assertFails(setDoc(doc(env.authenticatedContext(G, { email: `${G}@gmail.com`, firebase: { sign_in_provider: 'password' } }).firestore(), 'admins', G), trial(`${G}@gmail.com`)))
    await assertSucceeds(setDoc(doc(google(G), 'admins', G), trial(`${G}@gmail.com`)))
    await assertSucceeds(setDoc(doc(google(G), 'quizzes', 'qt'), { title: 'Sınaq', ownerUid: G }))  // sınaq aktivdir
    await setDoc(doc(google(S), 'users', S), profile('student', `${S}@gmail.com`))
    await assertFails(setDoc(doc(google(S), 'admins', S), trial(`${S}@gmail.com`)))
  })
  it('sınağı bitmiş təlimçi pulsuz plandadır: quiz yaradır, oyunda ən çox 10 iştirakçı; lisenziya ilə limit yoxdur', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'admins', G), { ...trial(`${G}@gmail.com`), createdAt: Timestamp.fromMillis(Date.now() - 4 * 86400000) })
    })
    await assertSucceeds(setDoc(doc(google(G), 'quizzes', 'qg'), { title: 'X', ownerUid: G }))
    await assertFails(setDoc(doc(google(G), 'games', 'gg'), { hostUid: G, phase: 'lobby', settings: { maxPlayers: 50 } }))
    await assertSucceeds(setDoc(doc(google(G), 'games', 'gg'), { hostUid: G, phase: 'lobby', settings: { maxPlayers: 10 } }))
    await assertFails(updateDoc(doc(google(G), 'games', 'gg'), { 'settings.maxPlayers': 100 }))
    await assertSucceeds(updateDoc(doc(google(G), 'games', 'gg'), { phase: 'countdown' }))
    // sınaqda başlamış böyük oyun sınaq bitəndə pozulmur
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'games', 'gbig'), { hostUid: G, phase: 'question', settings: { maxPlayers: 100 } }) })
    await assertSucceeds(updateDoc(doc(google(G), 'games', 'gbig'), { phase: 'reveal' }))
    await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), 'admins', G), { licenseUntil: Timestamp.fromMillis(Date.now() + 86400000) }) })
    await assertSucceeds(setDoc(doc(google(G), 'games', 'gg2'), { hostUid: G, phase: 'lobby', settings: { maxPlayers: 150 } }))
    // plan pillələri: Təlimçi 50, Pro 200 (köhnə lisenziya), Biznes 1000
    await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), 'admins', G), { plan: 'trainer' }) })
    await assertFails(setDoc(doc(google(G), 'games', 'gt1'), { hostUid: G, phase: 'lobby', settings: { maxPlayers: 51 } }))
    await assertSucceeds(setDoc(doc(google(G), 'games', 'gt2'), { hostUid: G, phase: 'lobby', settings: { maxPlayers: 50 } }))
    await assertFails(updateDoc(doc(google(G), 'games', 'gt2'), { 'settings.maxPlayers': 120 }))
    await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), 'admins', G), { plan: 'business' }) })
    await assertSucceeds(setDoc(doc(google(G), 'games', 'gt3'), { hostUid: G, phase: 'lobby', settings: { maxPlayers: 1000 } }))
    await assertFails(setDoc(doc(google(G), 'games', 'gt4'), { hostUid: G, phase: 'lobby', settings: { maxPlayers: 1001 } }))
    // planı istifadəçi özü dəyişə bilməz
    await assertFails(updateDoc(doc(google(G), 'admins', G), { plan: 'pro', licenseUntil: Timestamp.fromMillis(Date.now() + 9e10) }))
  })
  it('müştəri (özü qeydiyyatlı) kitabxanaya paylaşa, ümumi QR-ı dəyişə bilməz; öz quizini kataloqa dərc edə bilər', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'admins', G), trial(`${G}@gmail.com`)) })
    await assertSucceeds(setDoc(doc(google(G), 'quizzes', 'qs'), { title: 'X', ownerUid: G }))
    await assertFails(updateDoc(doc(google(G), 'quizzes', 'qs'), { shared: true }))
    await assertFails(setDoc(doc(google(G), 'catalog', 'qs'), cat(TRAINER)))   // başqasının adına yox
    await assertFails(setDoc(doc(google(G), 'catalog', 'q1'), cat(G)))         // başqasının quizi yox
    await assertSucceeds(setDoc(doc(google(G), 'catalog', 'qs'), cat(G)))
    await assertFails(setDoc(doc(google(G), 'settings', 'current'), { activeGameId: 'x' }))
    await assertSucceeds(setDoc(doc(google(G), 'settings', `play_${G}`), { activeGameId: 'x' }))
  })
  it('razılıq jurnalı: öz adına yazılır, dəyişdirilə/silinə bilməz', async () => {
    const c = { uid: S, type: 'marketing', granted: true, version: '2026-11-07', at: serverTimestamp() }
    await assertSucceeds(setDoc(doc(google(S), 'consents', 'c1'), c))
    await assertFails(setDoc(doc(google(S), 'consents', 'c2'), { ...c, uid: G }))
    await assertFails(setDoc(doc(anon('a9'), 'consents', 'c3'), { ...c, uid: 'a9' }))
    await assertFails(updateDoc(doc(google(S), 'consents', 'c1'), { granted: false }))
    await assertFails(deleteDoc(doc(google(S), 'consents', 'c1')))
    await assertSucceeds(getDoc(doc(google(S), 'consents', 'c1')))
    await assertFails(getDoc(doc(google(G), 'consents', 'c1')))
  })
  it('aktiv sınaqdakı təlimçi quiz yaradır; lisenziya sahələrini yalnız super dəyişir', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'admins', G), trial(`${G}@gmail.com`)) })
    await assertSucceeds(setDoc(doc(google(G), 'quizzes', 'qg2'), { title: 'X', ownerUid: G }))
    await assertFails(updateDoc(doc(as(ADMIN), 'admins', G), { licenseUntil: Timestamp.fromMillis(Date.now() + 9e10) }))
    await assertFails(updateDoc(doc(google(G), 'admins', G), { trialEndsAt: Timestamp.fromMillis(Date.now() + 9e10) }))
    await assertSucceeds(updateDoc(doc(as(SUPER), 'admins', G), { licenseUntil: Timestamp.fromMillis(Date.now() + 9e10), plan: 'pro' }))
  })
  it('kataloq: qeydiyyatlı oxuyur, anonim yox; dərc etmək icazə tələb edir', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'catalog', 'c1'), { title: 'K', questions: [] }) })
    await assertSucceeds(getDoc(doc(google(S), 'catalog', 'c1')))
    await assertFails(getDoc(doc(anon('a2'), 'catalog', 'c1')))
    await assertFails(setDoc(doc(as(TRAINER), 'catalog', 'c2'), cat(TRAINER)))
    await assertSucceeds(setDoc(doc(as(ADMIN), 'catalog', 'c2'), cat(ADMIN)))
  })
  it('məşq nəticəsi: öz adına, ağlabatan rəqəmlərlə; başqası oxuya bilmir', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'catalog', 'c1'), { title: 'K' }) })
    const att = (uid: string, extra = {}) => ({ uid, quizId: 'c1', quizTitle: 'K', correct: 3, total: 5, score: 3000, durationMs: 40000, at: serverTimestamp(), ...extra })
    await assertSucceeds(setDoc(doc(google(S), 'attempts', 'a1'), att(S)))
    await assertFails(setDoc(doc(google(S), 'attempts', 'a2'), att(S, { correct: 9 })))
    await assertFails(setDoc(doc(google(S), 'attempts', 'a3'), att(G)))
    await assertSucceeds(getDoc(doc(google(S), 'attempts', 'a1')))
    await assertFails(getDoc(doc(google(G), 'attempts', 'a1')))
    await assertSucceeds(getDocs(collection(as(SUPER), 'attempts')))
  })
  it('lisenziya müraciəti: qeydiyyatlı yazır, yalnız konsol oxuyur', async () => {
    const req = { uid: G, email: `${G}@gmail.com`, name: 'Aysel', phone: '+994501112233', plan: 'trainer', status: 'new', createdAt: serverTimestamp() }
    await assertSucceeds(setDoc(doc(google(G), 'licenseRequests', 'r1'), req))
    await assertFails(setDoc(doc(google(G), 'licenseRequests', 'r2'), { ...req, status: 'won' }))
    await assertFails(setDoc(doc(anon('a3'), 'licenseRequests', 'r3'), { ...req, uid: 'a3' }))
    await assertFails(getDocs(collection(as(ADMIN), 'licenseRequests')))
    await assertSucceeds(getDocs(collection(as(SUPER), 'licenseRequests')))
    await assertSucceeds(updateDoc(doc(as(SUPER), 'licenseRequests', 'r1'), { status: 'contacted', note: 'zəng edildi' }))
  })
  it('istifadəçi siyahısı və qiymətlər yalnız konsol icazəsi ilə', async () => {
    await assertFails(getDocs(collection(as(ADMIN), 'users')))
    await assertSucceeds(getDocs(collection(as(SUPER), 'users')))
    await assertFails(setDoc(doc(as(ADMIN), 'settings', 'pricing'), { plans: [] }))
    await assertSucceeds(setDoc(doc(as(SUPER), 'settings', 'pricing'), { plans: [] }))
  })
})

describe('hesabım, lisenziya qeydləri, çevirmə', () => {
  const G = 'guser9', S = 'student9'
  const google = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@gmail.com`, firebase: { sign_in_provider: 'google.com' } }).firestore()
  const prof = (type: string, uid: string) => ({ email: `${uid}@gmail.com`, type, firstName: 'A', lastName: 'B', phone: '+994501112233', onboarded: true, createdAt: serverTimestamp() })
  it('müştəri öz hesabını (profil + üzvlük) silə bilir; komanda üzvü öz üzvlüyünü silə bilməz', async () => {
    await setDoc(doc(google(G), 'users', G), prof('trainer', G))
    await setDoc(doc(google(G), 'admins', G), { email: `${G}@gmail.com`, name: 'A', role: 'trainer', source: 'signup', createdAt: serverTimestamp(), disabled: false, mustChangePassword: false })
    await assertSucceeds(deleteDoc(doc(google(G), 'admins', G)))
    await assertSucceeds(deleteDoc(doc(google(G), 'users', G)))
    await assertFails(deleteDoc(doc(as(TRAINER), 'admins', TRAINER)))
  })
  it('tələbə özünü təlimçiyə çevirə bilir, əksinə yox', async () => {
    await setDoc(doc(google(S), 'users', S), prof('student', S))
    await assertSucceeds(updateDoc(doc(google(S), 'users', S), { type: 'trainer' }))
    await assertFails(updateDoc(doc(google(S), 'users', S), { type: 'student' }))
  })
  it('konsol tələbənin yalnız tipini dəyişə bilər; admin (konsolsuz) yox', async () => {
    await setDoc(doc(google(S), 'users', S), prof('student', S))
    await assertFails(updateDoc(doc(as(ADMIN), 'users', S), { type: 'trainer' }))
    await assertFails(updateDoc(doc(as(SUPER), 'users', S), { type: 'trainer', phone: '+1' }))
    await assertSucceeds(updateDoc(doc(as(SUPER), 'users', S), { type: 'trainer' }))
  })
  it('lisenziya qeydləri: konsol yazır/oxuyur, təlimçi yox; dəyişdirmək yalnız super', async () => {
    const lic = { uid: G, email: 'g@x.az', plan: 'pro', seats: 1, from: serverTimestamp(), until: Timestamp.fromMillis(Date.now() + 9e9), amount: 49, currency: 'AZN', by: SUPER, at: serverTimestamp() }
    await assertSucceeds(setDoc(doc(as(SUPER), 'licenses', 'l1'), lic))
    await assertFails(setDoc(doc(as(TRAINER), 'licenses', 'l2'), { ...lic, by: TRAINER }))
    await assertFails(getDocs(collection(as(TRAINER), 'licenses')))
    await assertFails(setDoc(doc(as(SUPER), 'licenses', 'l3'), { ...lic, amount: -5 }))
  })
  it('oyun tarixçəsi: yalnız iştirak etdiyi oyun üçün, öz adına', async () => {
    const play = (uid: string, gameId = 'g1') => ({ uid, gameId, title: 'T', rank: 1, total: 2, score: 900, correct: 3, questions: 3, at: serverTimestamp() })
    await assertSucceeds(setDoc(doc(as(P2), 'plays', `${P2}_g1`), play(P2)))   // P2 g1-in iştirakçısıdır
    await assertFails(setDoc(doc(as(P1), 'plays', `${P1}_g1`), play(P1)))      // P1 iştirakçı deyil
    await assertFails(setDoc(doc(as(P2), 'plays', `x_g1`), play(P2)))
  })
  it('istifadəçi öz müraciətini oxuya və silə bilir', async () => {
    const req = { uid: G, email: `${G}@gmail.com`, name: 'A', phone: '+994501112233', plan: 'trainer', status: 'new', createdAt: serverTimestamp() }
    await setDoc(doc(google(G), 'licenseRequests', 'rq'), req)
    await assertSucceeds(getDoc(doc(google(G), 'licenseRequests', 'rq')))
    await assertFails(getDoc(doc(google(S), 'licenseRequests', 'rq')))
    await assertSucceeds(deleteDoc(doc(google(G), 'licenseRequests', 'rq')))
  })
})

describe('müəssisə (təşkilat)', () => {
  const OWN = 'org-owner', OWN2 = 'org-owner2', M1 = 'org-m1', M2 = 'org-m2'
  const google = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@gmail.com`, firebase: { sign_in_provider: 'google.com' } }).firestore()
  const owner = (uid: string, extra = {}) => ({ email: `${uid}@x.az`, name: 'O', role: 'trainer', source: 'signup', createdAt: Timestamp.fromMillis(Date.now() - 10 * 86400000), plan: 'institution', seats: 3, licenseUntil: Timestamp.fromMillis(Date.now() + 30 * 86400000), disabled: false, ...extra })
  const member = (uid: string, org: string) => ({ email: `${uid}@x.az`, name: 'M', role: 'trainer', source: 'org', orgId: org, createdAt: serverTimestamp(), createdBy: org, disabled: false, mustChangePassword: true })
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'admins', OWN), owner(OWN))
      await setDoc(doc(db, 'admins', OWN2), owner(OWN2))
      await setDoc(doc(db, 'admins', M2), { ...member(M2, OWN2), createdAt: Timestamp.now() })
      await setDoc(doc(db, 'quizzes', 'oq2'), { title: 'Org2', ownerUid: M2, orgId: OWN2 })
      await setDoc(doc(db, 'games', 'og2'), { hostUid: M2, orgId: OWN2, phase: 'finished', settings: { maxPlayers: 50 } })
    })
  })
  it('lisenziyalı müəssisə sahibi öz təlimçisini əlavə edir; başqa təşkilata və ya şifrəsiz yox', async () => {
    await assertSucceeds(setDoc(doc(google(OWN), 'admins', M1), member(M1, OWN)))
    await assertFails(setDoc(doc(google(OWN), 'admins', 'x1'), member('x1', OWN2)))
    await assertFails(setDoc(doc(google(OWN), 'admins', 'x2'), { ...member('x2', OWN), mustChangePassword: false }))
    await assertFails(setDoc(doc(google(OWN), 'admins', 'x3'), { ...member('x3', OWN), role: 'admin' }))
    await assertFails(setDoc(doc(as(TRAINER), 'admins', 'x4'), member('x4', TRAINER)))
  })
  it('lisenziyası bitmiş müəssisə sahibi təlimçi əlavə edə bilməz', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), 'admins', OWN), { licenseUntil: Timestamp.fromMillis(Date.now() - 1000) }) })
    await assertFails(setDoc(doc(google(OWN), 'admins', M1), member(M1, OWN)))
  })
  it('təlimçi müəssisənin lisenziyasını alır: 10-dan çox iştirakçı; lisenziya bitəndə pulsuz limit', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'admins', M1), { ...member(M1, OWN), createdAt: Timestamp.now(), mustChangePassword: false }) })
    await assertSucceeds(setDoc(doc(as(M1), 'games', 'm1g'), { hostUid: M1, orgId: OWN, phase: 'lobby', settings: { maxPlayers: 100 } }))
    await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), 'admins', OWN), { licenseUntil: Timestamp.fromMillis(Date.now() - 1000) }) })
    await assertFails(setDoc(doc(as(M1), 'games', 'm1g2'), { hostUid: M1, orgId: OWN, phase: 'lobby', settings: { maxPlayers: 100 } }))
    await assertSucceeds(setDoc(doc(as(M1), 'games', 'm1g3'), { hostUid: M1, orgId: OWN, phase: 'lobby', settings: { maxPlayers: 10 } }))
  })
  it('təşkilat daxilində quiz ortaqdır, başqa təşkilat görmür; sahib üzvlərin oyunlarını görür', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'admins', M1), { ...member(M1, OWN), createdAt: Timestamp.now(), mustChangePassword: false }) })
    await assertSucceeds(setDoc(doc(as(M1), 'quizzes', 'oq1'), { title: 'Org1', ownerUid: M1, orgId: OWN }))
    await assertFails(setDoc(doc(as(M1), 'quizzes', 'oqx'), { title: 'X', ownerUid: M1, orgId: OWN2 }))
    await assertSucceeds(getDoc(doc(google(OWN), 'quizzes', 'oq1')))
    await assertFails(getDoc(doc(google(OWN), 'quizzes', 'oq2')))
    await assertFails(getDoc(doc(as(M1), 'quizzes', 'oq2')))
    await assertSucceeds(getDocs(query(collection(google(OWN2), 'games'), where('orgId', '==', OWN2))))
    await assertFails(getDocs(query(collection(google(OWN), 'games'), where('orgId', '==', OWN2))))
    await assertSucceeds(getDocs(query(collection(google(OWN2), 'admins'), where('orgId', '==', OWN2))))
    await assertFails(getDocs(query(collection(google(OWN), 'admins'), where('orgId', '==', OWN2))))
  })
  it('müəssisə təlimçisi kitabxanaya paylaşa və ümumi QR-ı dəyişə bilməz', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'admins', M1), { ...member(M1, OWN), createdAt: Timestamp.now(), mustChangePassword: false }) })
    await assertSucceeds(setDoc(doc(as(M1), 'quizzes', 'oq3'), { title: 'T', ownerUid: M1, orgId: OWN }))
    await assertFails(updateDoc(doc(as(M1), 'quizzes', 'oq3'), { shared: true }))
    await assertFails(setDoc(doc(as(M1), 'settings', 'current'), { activeGameId: 'x' }))
  })
  it('sahib öz təlimçisini məhdudlaşdırır və silir; başqasınınkını yox', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'admins', M1), { ...member(M1, OWN), createdAt: Timestamp.now() }) })
    await assertSucceeds(updateDoc(doc(google(OWN), 'admins', M1), { disabled: true }))
    await assertFails(updateDoc(doc(google(OWN), 'admins', M1), { orgId: OWN2 }))
    await assertFails(updateDoc(doc(google(OWN), 'admins', M2), { disabled: true }))
    await assertFails(deleteDoc(doc(google(OWN), 'admins', M2)))
    await assertSucceeds(deleteDoc(doc(google(OWN), 'admins', M1)))
  })
})

describe('ictimai kataloq: moderasiya və şikayətlər', () => {
  const STU = 'stu1'
  const stu = () => env.authenticatedContext(STU, { email: 's@gmail.com', firebase: { sign_in_provider: 'google.com' } }).firestore()
  const item = (extra: Record<string, unknown> = {}, img = false) => cat(TRAINER, extra, img)
  const anon = () => env.authenticatedContext(P1, { firebase: { sign_in_provider: 'anonymous' } }).firestore()
  it('təlimçi öz quizini dərc edir; şəkilli quiz yalnız "review" statusunda; gizlətmə sahəsini yaza bilmir', async () => {
    await assertSucceeds(setDoc(doc(as(TRAINER), 'catalog', 'q1'), item()))
    await assertFails(setDoc(doc(as(TRAINER), 'catalog', 'q1'), item({}, true)))
    await assertSucceeds(setDoc(doc(as(TRAINER), 'catalog', 'q1'), item({ status: 'review' }, true)))
    await assertFails(setDoc(doc(as(TRAINER), 'catalog', 'q1'), item({ hidden: true })))
    await assertFails(setDoc(doc(as(TRAINER), 'catalog', 'q1'), item({ status: 'approved' })))
    await assertFails(setDoc(doc(as(TRAINER2), 'catalog', 'q1'), item({ publishedBy: TRAINER2 })))  // başqasının quizi
    await assertSucceeds(deleteDoc(doc(as(TRAINER), 'catalog', 'q1')))
  })
  it('gizlədilmiş quizi müəllif özü bərpa edə bilmir, super admin bərpa edir', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'catalog', 'q1'), item({ hidden: true, hiddenReason: 'reports' })) })
    await assertFails(setDoc(doc(as(TRAINER), 'catalog', 'q1'), item()))
    await assertFails(updateDoc(doc(as(TRAINER), 'catalog', 'q1'), { hidden: false }))
    await assertSucceeds(updateDoc(doc(as(SUPER), 'catalog', 'q1'), { hidden: false, status: 'live' }))
    await assertSucceeds(updateDoc(doc(as(SUPER), 'catalog', 'q1'), { hidden: true }))
  })
  it('tələbə bir dəfə şikayət edir; şikayətləri yalnız konsol görür', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'catalog', 'q1'), item()) })
    const r = (extra = {}) => ({ uid: STU, quizId: 'q1', reason: 'language', note: 'qaba söz', at: serverTimestamp(), ...extra })
    await assertFails(setDoc(doc(stu(), 'reports', 'q1_other'), r()))                  // id formatı
    await assertFails(setDoc(doc(stu(), 'reports', `q1_${STU}`), r({ reason: 'x' })))   // naməlum səbəb
    await assertFails(setDoc(doc(stu(), 'reports', `nope_${STU}`), r({ quizId: 'nope' }))) // kataloqda olmayan
    await assertFails(setDoc(doc(anon(), 'reports', `q1_${P1}`), r({ uid: P1 })))        // anonim yox
    await assertSucceeds(setDoc(doc(stu(), 'reports', `q1_${STU}`), r()))
    await assertFails(setDoc(doc(stu(), 'reports', `q1_${STU}`), r({ reason: 'spam' }))) // təkrar/dəyişmə yox
    await assertFails(getDocs(collection(stu(), 'reports')))
    await assertFails(getDocs(collection(as(TRAINER), 'reports')))
    await assertSucceeds(getDocs(collection(as(SUPER), 'reports')))
  })
})

describe('siniflər və kurslar', () => {
  const S1 = 'stuA', S2 = 'stuB'
  const stu = (u: string) => env.authenticatedContext(u, { email: `${u}@gmail.com`, firebase: { sign_in_provider: 'google.com' } }).firestore()
  const mkClass = () => setDoc(doc(as(TRAINER), 'classes', 'c1'), { ownerUid: TRAINER, name: '10-A', code: 'ABC123', createdAt: serverTimestamp() })
  it('təlimçi sinif yaradır; başqasının adına və ya qısa kodla yox', async () => {
    await assertFails(setDoc(doc(as(TRAINER), 'classes', 'cx'), { ownerUid: TRAINER2, name: '10-A', code: 'ABC123', createdAt: serverTimestamp() }))
    await assertFails(setDoc(doc(as(TRAINER), 'classes', 'cx'), { ownerUid: TRAINER, name: '10-A', code: 'AB', createdAt: serverTimestamp() }))
    await assertFails(setDoc(doc(stu(S1), 'classes', 'cx'), { ownerUid: S1, name: '10-A', code: 'ABC123', createdAt: serverTimestamp() }))
    await assertSucceeds(mkClass())
    await assertSucceeds(setDoc(doc(as(TRAINER), 'classCodes', 'ABC123'), { classId: 'c1' }))
    await assertFails(setDoc(doc(as(TRAINER2), 'classCodes', 'ZZZ999'), { classId: 'c1' }))
    await assertFails(updateDoc(doc(as(TRAINER), 'classes', 'c1'), { code: 'NEW123' }))
  })
  it('tələbə yalnız düzgün kodla qoşulur; üzv olmayan sinfi və tapşırıqları görmür', async () => {
    await mkClass()
    await setDoc(doc(as(TRAINER), 'classes', 'c1', 'tasks', 't1'), { kind: 'practice', title: 'Ev tapşırığı', quizId: 'q1', createdAt: serverTimestamp() })
    await assertSucceeds(getDoc(doc(stu(S1), 'classCodes', 'ABC123')).catch(() => null))
    await assertFails(getDoc(doc(stu(S1), 'classes', 'c1')))
    await assertFails(getDoc(doc(stu(S1), 'classes', 'c1', 'tasks', 't1')))
    const m = (code: string) => setDoc(doc(stu(S1), 'classes', 'c1', 'members', S1), { uid: S1, name: 'Aysel', code, joinedAt: serverTimestamp() })
    await assertFails(m('WRONG1'))
    await assertSucceeds(m('ABC123'))
    await assertFails(setDoc(doc(stu(S2), 'classes', 'c1', 'members', S1), { uid: S1, name: 'X', code: 'ABC123', joinedAt: serverTimestamp() }))
    await assertSucceeds(getDoc(doc(stu(S1), 'classes', 'c1')))
    await assertSucceeds(getDoc(doc(stu(S1), 'classes', 'c1', 'tasks', 't1')))
    await assertSucceeds(setDoc(doc(stu(S1), 'memberships', `${S1}_c1`), { uid: S1, classId: 'c1', className: '10-A', joinedAt: serverTimestamp() }))
    await assertFails(setDoc(doc(stu(S2), 'memberships', `${S2}_c1`), { uid: S2, classId: 'c1', className: '10-A', joinedAt: serverTimestamp() }))
    await assertFails(setDoc(doc(stu(S1), 'classes', 'c1', 'tasks', 't2'), { kind: 'practice', title: 'X', createdAt: serverTimestamp() }))
  })
  it('nəticə: üzv öz adına yazır, digər üzvlərin nəticəsini görmür; təlimçi hamısını görür', async () => {
    await mkClass()
    await setDoc(doc(as(TRAINER), 'classes', 'c1', 'tasks', 't1'), { kind: 'practice', title: 'Ev tapşırığı', quizId: 'q1', createdAt: serverTimestamp() })
    for (const u of [S1, S2]) await setDoc(doc(stu(u), 'classes', 'c1', 'members', u), { uid: u, name: u, code: 'ABC123', joinedAt: serverTimestamp() })
    const r = (u: string, extra = {}) => setDoc(doc(stu(u), 'classes', 'c1', 'results', `${u}_t1`), { uid: u, name: u, taskId: 't1', score: 800, correct: 4, total: 5, pct: 80, at: serverTimestamp(), ...extra })
    await assertFails(r(S1, { correct: 9 }))
    await assertSucceeds(r(S1))
    await assertSucceeds(r(S2))
    await assertFails(getDoc(doc(stu(S1), 'classes', 'c1', 'results', `${S2}_t1`)))
    await assertSucceeds(getDocs(collection(as(TRAINER), 'classes', 'c1', 'results')))
    await assertFails(getDocs(collection(as(TRAINER2), 'classes', 'c1', 'results')))
  })
  it('kurs: təlimçi öz adına yaradır; tələbə yalnız öz irəliləyişini yazır', async () => {
    const items = [{ quizId: 'q1', title: 'A' }]
    await assertFails(setDoc(doc(stu(S1), 'courses', 'k1'), { ownerUid: S1, title: 'Kurs', items, createdAt: serverTimestamp() }))
    await assertSucceeds(setDoc(doc(as(TRAINER), 'courses', 'k1'), { ownerUid: TRAINER, title: 'Kurs', items, createdAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(as(TRAINER2), 'courses', 'k1'), { title: 'Oğurlanmış', ownerUid: TRAINER2 }))
    await assertSucceeds(getDoc(doc(stu(S1), 'courses', 'k1')))
    await assertSucceeds(setDoc(doc(stu(S1), 'courses', 'k1', 'progress', S1), { uid: S1, name: 'A', done: ['q1'], at: serverTimestamp() }))
    await assertFails(setDoc(doc(stu(S2), 'courses', 'k1', 'progress', S1), { uid: S1, name: 'A', done: ['q1'], at: serverTimestamp() }))
    await assertSucceeds(getDoc(doc(as(TRAINER), 'courses', 'k1', 'progress', S1)))
    await assertFails(getDoc(doc(stu(S2), 'courses', 'k1', 'progress', S1)))
  })
})

describe('birgə redaktə (həmmüəllif)', () => {
  const t2 = () => env.authenticatedContext(TRAINER2, { email: 'T2@x.az', firebase: { sign_in_provider: 'password' } }).firestore()
  const t3 = () => env.authenticatedContext('trainerX', { email: 'x@x.az', firebase: { sign_in_provider: 'password' } }).firestore()
  it('sahib həmmüəllif əlavə edir; həmmüəllif oxuyur və redaktə edir, amma siyahını, sahibi dəyişə və silə bilmir', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'admins', 'trainerX'), { email: 'x@x.az', role: 'trainer' }) })
    await assertFails(getDoc(doc(t2(), 'quizzes', 'q1')))
    await assertSucceeds(updateDoc(doc(as(TRAINER), 'quizzes', 'q1'), { editors: ['t2@x.az'] }))
    await assertSucceeds(getDoc(doc(t2(), 'quizzes', 'q1')))
    await assertSucceeds(getDoc(doc(t2(), 'quizzes', 'q1', 'questions', 'a')))
    await assertSucceeds(updateDoc(doc(t2(), 'quizzes', 'q1'), { title: 'Birgə' }))
    await assertSucceeds(setDoc(doc(t2(), 'quizzes', 'q1', 'questions', 'b'), { text: 'Yeni', correct: [] }))
    await assertFails(updateDoc(doc(t2(), 'quizzes', 'q1'), { editors: ['t2@x.az', 'x@x.az'] }))
    await assertFails(updateDoc(doc(t2(), 'quizzes', 'q1'), { ownerUid: TRAINER2 }))
    await assertFails(deleteDoc(doc(t2(), 'quizzes', 'q1')))
    await assertFails(getDoc(doc(t3(), 'quizzes', 'q1')))
    await assertFails(setDoc(doc(t3(), 'quizzes', 'q1', 'questions', 'c'), { text: 'X', correct: [] }))
    await assertSucceeds(getDocs(query(collection(t2(), 'quizzes'), where('editors', 'array-contains', 't2@x.az'))))
  })
})

describe('kataloq reytinqi', () => {
  const S1 = 'stuR', S2 = 'stuR2'
  const stu = (u: string) => env.authenticatedContext(u, { email: `${u}@gmail.com`, firebase: { sign_in_provider: 'google.com' } }).firestore()
  const anon = () => env.authenticatedContext(P1, { firebase: { sign_in_provider: 'anonymous' } }).firestore()
  const rate = (db: ReturnType<typeof stu>, u: string, stars: unknown, id = `q1_${u}`, extra = {}) => setDoc(doc(db, 'ratings', id), { uid: u, quizId: 'q1', stars, at: serverTimestamp(), ...extra })
  it('qeydiyyatlı tələbə 1–5 ulduz verir, dəyişə bilir; saxta id/ulduz/anonim yox; statistikanı yalnız server yazır', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'catalog', 'q1'), cat(TRAINER)) })
    await assertFails(rate(stu(S1), S1, 6))
    await assertFails(rate(stu(S1), S1, 0))
    await assertFails(rate(stu(S1), S1, 4.5))
    await assertFails(rate(stu(S1), S1, 5, `q1_${S2}`))
    await assertFails(rate(stu(S1), S1, 5, 'q1_x', { extra: 1 }))
    await assertFails(rate(anon(), P1, 5))
    await assertFails(setDoc(doc(stu(S1), 'ratings', `nope_${S1}`), { uid: S1, quizId: 'nope', stars: 5, at: serverTimestamp() }))
    await assertSucceeds(rate(stu(S1), S1, 5))
    await assertSucceeds(rate(stu(S1), S1, 3))
    await assertSucceeds(getDoc(doc(stu(S1), 'ratings', `q1_${S1}`)))
    await assertFails(getDoc(doc(stu(S2), 'ratings', `q1_${S1}`)))
    await assertFails(deleteDoc(doc(stu(S1), 'ratings', `q1_${S1}`)))
    await assertFails(setDoc(doc(stu(S1), 'ratingStats', 'q1'), { count: 100, sum: 500, avg: 5 }))
    await assertSucceeds(getDoc(doc(stu(S2), 'ratingStats', 'q1')))
  })
})

describe('PIN sahibliyi (təhlükəsizlik auditi)', () => {
  it('başqa təlimçi aktiv PIN-i öz oyununa yönləndirə, söndürə və ya silə bilmir; host bacarır', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'games', 'g2'), { hostUid: TRAINER2, phase: 'lobby', pin: '654321', createdAt: serverTimestamp() }) })
    await assertFails(setDoc(doc(as(TRAINER2), 'pins', '123456'), { gameId: 'g2', active: true, createdAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(as(TRAINER2), 'pins', '123456'), { active: false }))
    await assertFails(deleteDoc(doc(as(TRAINER2), 'pins', '123456')))
    await assertFails(setDoc(doc(as(TRAINER2), 'pins', '777777'), { gameId: 'g1', active: true, createdAt: serverTimestamp() }))
    await assertSucceeds(setDoc(doc(as(TRAINER2), 'pins', '654321'), { gameId: 'g2', active: true, createdAt: serverTimestamp() }))
    await assertFails(updateDoc(doc(as(TRAINER), 'pins', '123456'), { gameId: 'g2' }))
    await assertSucceeds(updateDoc(doc(as(TRAINER), 'pins', '123456'), { active: false }))
    await assertSucceeds(deleteDoc(doc(as(TRAINER), 'pins', '123456')))
  })
})

describe('3D avatar', () => {
  const stu = (u: string) => env.authenticatedContext(u, { email: `${u}@gmail.com`, firebase: { sign_in_provider: 'google.com' } }).firestore()
  const anon = () => env.authenticatedContext(P1, { firebase: { sign_in_provider: 'anonymous' } }).firestore()
  const av = (extra = {}) => ({ config: { v: 1, hair: 'short' }, thumb: 'data:image/webp;base64,UklGRg==', updatedAt: serverTimestamp(), ...extra })
  it('sahibi saxlayır; başqası, anonim, saxta şəkil və artıq sahə olmur; daxil olmuş hər kəs baxır, siyahı yox', async () => {
    await assertSucceeds(setDoc(doc(stu('avA'), 'avatars', 'avA'), av()))
    await assertFails(setDoc(doc(stu('avB'), 'avatars', 'avA'), av()))
    await assertFails(setDoc(doc(anon(), 'avatars', P1), av()))
    await assertFails(setDoc(doc(stu('avA'), 'avatars', 'avA'), av({ thumb: 'javascript:alert(1)' })))
    await assertFails(setDoc(doc(stu('avA'), 'avatars', 'avA'), av({ thumb: 'data:image/svg+xml;base64,PHN2Zz4=' })))
    await assertFails(setDoc(doc(stu('avA'), 'avatars', 'avA'), av({ extra: 1 })))
    await assertFails(setDoc(doc(stu('avA'), 'avatars', 'avA'), av({ thumb: 'data:image/webp;base64,' + 'A'.repeat(130000) })))
    await assertSucceeds(getDoc(doc(anon(), 'avatars', 'avA')))
    await assertFails(getDocs(collection(stu('avB'), 'avatars')))
    await assertFails(deleteDoc(doc(stu('avB'), 'avatars', 'avA')))
    await assertSucceeds(deleteDoc(doc(stu('avA'), 'avatars', 'avA')))
  })
})

describe('oyunda 3D avatar', () => {
  const anonP = () => env.authenticatedContext('anonX', { firebase: { sign_in_provider: 'anonymous' } }).firestore()
  it('oyunçu yalnız öz 3D avatarı ilə qoşulur; başqasınınkı və anonim yox; lobbidə başqasınınkına dəyişmək olmur', async () => {
    await assertFails(setDoc(doc(as(P1), 'games', 'g1', 'players', P1), player({ avatar: { style: '3d', seed: 'someoneElse' } })))
    await assertFails(setDoc(doc(anonP(), 'games', 'g1', 'players', 'anonX'), player({ avatar: { style: '3d', seed: 'anonX' } })))
    await assertSucceeds(setDoc(doc(as(P1), 'games', 'g1', 'players', P1), player({ avatar: { style: '3d', seed: P1 } })))
    await assertFails(updateDoc(doc(as(P1), 'games', 'g1', 'players', P1), { avatar: { style: '3d', seed: 'someoneElse' } }))
    await assertSucceeds(updateDoc(doc(as(P1), 'games', 'g1', 'players', P1), { avatar: { style: 'fun-emoji', seed: 'y' } }))
  })
})
