/** Jabr SDK: realtime abunələr, sentinellər, batch və giriş axınları (server ALLOW_TEST_AUTH=1 ilə). */
import { beforeAll, describe, expect, it } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from './rules-unit-testing'
import {
  arrayUnion, collection, deleteField, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch,
  getFirestore, type QuerySnapshot,
} from '../../src/lib/jdb/firestore'
import {
  createUserWithEmailAndPassword, EmailAuthProvider, getAuth, onAuthStateChanged, reauthenticateWithCredential, signInAnonymously,
  signInWithEmailAndPassword, signOut, updatePassword,
} from '../../src/lib/jdb/auth'
import { initializeApp } from '../../src/lib/jdb/app'

const BASE = process.env.JABR_TEST_URL ?? 'http://127.0.0.1:3100'
let env: RulesTestEnvironment
beforeAll(async () => { env = await initializeTestEnvironment(); await env.clearFirestore() })
const until = async (fn: () => boolean | Promise<boolean>, ms = 3000) => { const t = Date.now(); while (!(await fn())) { if (Date.now() - t > ms) throw new Error('timeout'); await new Promise((r) => setTimeout(r, 20)) } }

describe('dəyərlər və yazılar', () => {
  it('serverTimestamp, arrayUnion, deleteField, nöqtəli yollar, batch', async () => {
    const db = env.unauthenticatedContext().firestore()
    const admin = (await initializeTestEnvironment()).withSecurityRulesDisabled
    await admin(async (ctx) => {
      const d = ctx.firestore()
      const ref = doc(d, 'games', 'x1')
      await setDoc(ref, { a: 1, tags: ['p'], nested: { b: 1, c: 2 }, at: serverTimestamp(), t: Timestamp.fromMillis(1000) })
      await updateDoc(ref, { tags: arrayUnion('q', 'p'), 'nested.b': 5, a: deleteField() })
      const s = await getDoc(ref)
      expect(s.get('tags')).toEqual(['p', 'q'])
      expect(s.get('nested')).toEqual({ b: 5, c: 2 })
      expect(s.data()!.a).toBeUndefined()
      expect(s.get('at')).toBeInstanceOf(Timestamp)
      expect(Math.abs(s.get('at').toMillis() - Date.now())).toBeLessThan(5000)
      expect(s.get('t').toMillis()).toBe(1000)
      const b = writeBatch(d)
      b.set(doc(d, 'games', 'x2'), { n: 2 }); b.set(doc(d, 'games', 'x1'), { extra: true }, { merge: true }); await b.commit()
      expect((await getDoc(doc(d, 'games', 'x1'))).get('extra')).toBe(true)
      expect((await getDoc(doc(d, 'games', 'x1'))).get('nested.c')).toBe(2)
    })
    void db
  })
})

describe('realtime', () => {
  it('sənəd və sorğu abunələri dəyişiklikləri alır; icazəsiz abunə xəta verir', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = ctx.firestore()
      await setDoc(doc(d, 'admins', 'h1'), { email: 'h@x.az', role: 'trainer' })
      await setDoc(doc(d, 'games', 'rt'), { hostUid: 'h1', phase: 'lobby', pin: '111111' })
      const seen: string[] = []
      const off = onSnapshot(doc(d, 'games', 'rt'), (s) => seen.push(s.get('phase')))
      let last: QuerySnapshot | null = null
      const offQ = onSnapshot(query(collection(d, 'games', 'rt', 'players'), orderBy('score', 'desc')), (s) => { last = s })
      await until(() => seen.length === 1 && last !== null)
      await updateDoc(doc(d, 'games', 'rt'), { phase: 'question' })
      await setDoc(doc(d, 'games', 'rt', 'players', 'p1'), { score: 5 })
      await setDoc(doc(d, 'games', 'rt', 'players', 'p2'), { score: 9 })
      await until(() => seen.includes('question') && last!.size === 2)
      expect(last!.docs.map((x) => x.id)).toEqual(['p2', 'p1'])
      expect(last!.docChanges().length).toBeGreaterThan(0)
      off(); offQ()
    })
    const stranger = env.authenticatedContext('nobody').firestore()
    let code = ''
    onSnapshot(query(collection(stranger, 'games'), where('hostUid', '==', 'h1')), () => {}, (e) => { code = e.code })
    await until(() => code !== '')
    expect(code).toBe('permission-denied')
  })
})

describe('giriş', () => {
  it('anonim, qeydiyyat, giriş, şifrə dəyişmə, çıxış', async () => {
    const app = initializeApp({ baseUrl: BASE }, 'auth-test')
    const auth = getAuth(app)
    await setPersistenceNone()
    const states: (string | null)[] = []
    onAuthStateChanged(auth, (u) => states.push(u?.uid ?? null))
    const anon = await signInAnonymously(auth)
    expect(anon.user.isAnonymous).toBe(true)
    expect(anon.user.uid).toHaveLength(28)
    const email = `t${Date.now()}@x.az`
    const c = await createUserWithEmailAndPassword(auth, email, 'secret12')
    expect(c.user.email).toBe(email)
    await expect(signInWithEmailAndPassword(auth, email, 'wrong')).rejects.toMatchObject({ code: 'auth/invalid-credential' })
    await reauthenticateWithCredential(c.user, EmailAuthProvider.credential(email, 'secret12'))
    await updatePassword(c.user, 'newsecret34')
    await signOut(auth)
    expect(auth.currentUser).toBeNull()
    const again = await signInWithEmailAndPassword(auth, email, 'newsecret34')
    expect(again.user.uid).toBe(c.user.uid)
    // istifadəçi öz users/profiles sənədinə yaza bilir (real token ilə qaydalar)
    const db = getFirestore(app)
    await setDoc(doc(db, 'errors', 'e-' + Date.now()), { message: 'x', at: serverTimestamp() })
    expect(states).toContain(c.user.uid)
  })
})
async function setPersistenceNone() { /* node mühitində localStorage yoxdur — yaddaşda qalır */ }

describe('moderasiya (yalnız Jabr serveri)', () => {
  const q3 = (text = 'Sual?') => [1, 2, 3].map((i) => ({ id: `m${i}`, type: 'single', text: `${text} ${i}`, options: [{ id: 'a', text: 'Bəli' }, { id: 'b', text: 'Xeyr' }], correct: ['a'] }))
  beforeAll(async () => {
    await env.clearFirestore()
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = ctx.firestore()
      await setDoc(doc(d, 'admins', 'mt1'), { email: 'm@x.az', role: 'trainer' })
      await setDoc(doc(d, 'quizzes', 'mq'), { title: 'M', ownerUid: 'mt1' })
    })
  })
  const tr = () => env.authenticatedContext('mt1', { email: 'm@x.az', firebase: { sign_in_provider: 'password' } }).firestore()
  it('söyüş, əlaqə məlumatı və keyfiyyət problemi olan quiz dərc olunmur; təmiz quiz dərc olunur', async () => {
    const bad = [
      { title: 'Yaxşı başlıq', questions: q3('siktir') },
      { title: 'Zəng edin +994 50 123 45 67', questions: q3() },
      { title: 'Ok', questions: q3() },
      { title: 'Yaxşı başlıq', questions: q3().slice(0, 2) },
    ]
    for (const b of bad) {
      await expect(setDoc(doc(tr(), 'catalog', 'mq'), { ...b, publishedBy: 'mt1', status: 'live' })).rejects.toMatchObject({ code: 'failed-precondition' })
    }
    await setDoc(doc(tr(), 'catalog', 'mq'), { title: 'Yaxşı başlıq', questions: q3(), publishedBy: 'mt1', status: 'live' })
    // server "hasImages" sahəsini özü hesablayır (klient yalan deyə bilməz)
    await expect(setDoc(doc(tr(), 'catalog', 'mq'), { title: 'Yaxşı başlıq', questions: [{ ...q3()[0], imageUrl: 'data:image/png;base64,AA' }, ...q3().slice(1)], publishedBy: 'mt1', status: 'live', hasImages: false }))
      .rejects.toMatchObject({ code: 'permission-denied' })
  })
  it('3 şikayətdən sonra quiz avtomatik gizlədilir', async () => {
    for (const u of ['s1', 's2', 's3']) {
      const db = env.authenticatedContext(u, { email: `${u}@gmail.com`, firebase: { sign_in_provider: 'google.com' } }).firestore()
      await setDoc(doc(db, 'reports', `mq_${u}`), { uid: u, quizId: 'mq', reason: 'language', note: '', at: serverTimestamp() })
    }
    let hidden = false
    await env.withSecurityRulesDisabled(async (ctx) => {
      await until(async () => { hidden = (await getDoc(doc(ctx.firestore(), 'catalog', 'mq'))).get('hidden') === true; return hidden }, 3000)
    })
    expect(hidden).toBe(true)
  })
})

describe('giriş + dərhal abunə (qeydiyyatın təkrarlanması xətası)', () => {
  it('girişdən dərhal sonra açılan profil abunəsi yeni sessiya ilə yoxlanılır', async () => {
    const app = initializeApp({ baseUrl: BASE }, 'race-test')
    const auth = getAuth(app)
    const db = getFirestore(app)
    // anonim sessiya ilə realtime bağlantısı artıq açıqdır (sayta giriş səhifəsi kimi)
    await signInAnonymously(auth)
    let warm = false
    const off0 = onSnapshot(doc(db, 'settings', 'app'), () => { warm = true }, () => { warm = true })
    await until(() => warm)
    const email = `race${Date.now()}@x.az`
    const c = await createUserWithEmailAndPassword(auth, email, 'secret12')
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', c.user.uid), { email, type: 'student', onboarded: true })
    })
    // tətbiqdəki useAccount kimi: abunə giriş bildirişinin İÇİNDƏ, dərhal açılır
    let result: string | null = null
    let off: (() => void) | null = null
    const offAuth = onAuthStateChanged(auth, (u) => {
      off?.(); off = null
      if (!u || u.isAnonymous) return
      off = onSnapshot(doc(db, 'users', u.uid), (s) => { result = s.get('onboarded') === true ? 'ok' : 'missing' }, (e) => { result = e.code })
    })
    for (let round = 0; round < 3; round++) {
      await signOut(auth)
      await signInAnonymously(auth)
      result = null
      await signInWithEmailAndPassword(auth, email, 'secret12')
      await until(() => result !== null)
      expect(result).toBe('ok')
    }
    offAuth(); (off as (() => void) | null)?.()
    off0()
  })
})
