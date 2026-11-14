/** Sertifikatlar: uyğunluq serverdə yoxlanılır, kod sabitdir, /verify ictimai təsdiq səhifəsidir. */
import { beforeAll, describe, expect, it } from 'vitest'
import { initializeTestEnvironment } from './rules-unit-testing'
import { doc, setDoc, Timestamp } from '../../src/lib/jdb/firestore'

const BASE = process.env.JABR_TEST_URL ?? 'http://127.0.0.1:3100'
const DAY = 86_400_000
const hdr = (uid: string) => ({ 'content-type': 'application/json', 'x-test-auth': Buffer.from(JSON.stringify({ uid })).toString('base64') })
const issue = async (uid: string, kind: string, ref: string) => {
  const r = await fetch(`${BASE}/api/certs`, { method: 'POST', headers: hdr(uid), body: JSON.stringify({ kind, ref }) })
  return { status: r.status, body: (await r.json()) as Record<string, unknown> }
}

beforeAll(async () => {
  const env = await initializeTestEnvironment()
  await env.clearFirestore()
  const now = Date.now(), t = (ms: number) => Timestamp.fromMillis(ms)
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    // təlimçi (Business) — dizayn və brend
    await setDoc(doc(d, 'admins', 'host'), { role: 'trainer', source: 'signup', plan: 'business', licenseUntil: t(now + 30 * DAY), createdAt: t(now - 9 * DAY) })
    await setDoc(doc(d, 'profiles', 'host'), { name: 'Host', brand: { on: true, name: 'Acme', color: '#2563EB', logo: '' }, cert: { on: true, template: 'modern', title: 'ACME CERT', signer: 'CEO <b>', signature: '/api/media/sign/host?v=1' } })
    // canlı oyun
    const game = { pin: '111111', quizId: 'q', hostUid: 'host', title: 'Final quiz', phase: 'finished', finishedAt: t(now - DAY), host: { name: 'Host', org: 'Acme' } }
    await setDoc(doc(d, 'games', 'g1'), game)
    await setDoc(doc(d, 'games', 'g2'), { ...game, phase: 'question' })
    for (const [uid, score] of [['p1', 900], ['p2', 1200], ['p3', 300]] as const) await setDoc(doc(d, 'games', 'g1', 'players', uid), { uid, firstName: uid.toUpperCase(), lastName: 'Test', score, correctCount: 3, kicked: false })
    await setDoc(doc(d, 'games', 'g2', 'players', 'p1'), { uid: 'p1', firstName: 'P1', lastName: 'Test', score: 10, kicked: false })
    // məşq
    await setDoc(doc(d, 'users', 's1'), { type: 'student', firstName: 'Aysel', lastName: 'M', email: 's1@x.az', onboarded: true })
    await setDoc(doc(d, 'catalog', 'c1'), { title: 'Tarix', publishedBy: 'host', author: 'Host', status: 'live', questions: [], questionCount: 10 })
    await setDoc(doc(d, 'attempts', 'a1'), { uid: 's1', quizId: 'c1', quizTitle: 'Tarix', correct: 5, total: 10, score: 500, at: t(now - 2 * DAY) })
    await setDoc(doc(d, 'attempts', 'a2'), { uid: 's1', quizId: 'c1', quizTitle: 'Tarix', correct: 8, total: 10, score: 800, at: t(now - DAY) })
    await setDoc(doc(d, 'users', 's2'), { type: 'student', firstName: 'Zaur', lastName: 'K', email: 's2@x.az', onboarded: true })
    await setDoc(doc(d, 'attempts', 'a3'), { uid: 's2', quizId: 'c1', quizTitle: 'Tarix', correct: 6, total: 10, score: 600, at: t(now - DAY) })
    // kurs
    await setDoc(doc(d, 'courses', 'k1'), { ownerUid: 'host', ownerName: 'Host', title: 'Kurs', items: [{ quizId: 'c1', title: 'Tarix' }, { quizId: 'c2', title: 'Coğ' }] })
    await setDoc(doc(d, 'courses', 'k1', 'progress', 's1'), { uid: 's1', name: 'Aysel', done: ['c1', 'c2'], completedAt: t(now), at: t(now) })
    await setDoc(doc(d, 'courses', 'k1', 'progress', 's2'), { uid: 's2', name: 'Zaur', done: ['c1'], at: t(now) })
  })
})

describe('sertifikat buraxılışı', () => {
  it('canlı oyun: yer serverdə hesablanır, kod sabitdir, dizayn təlimçidən gəlir', async () => {
    const a = await issue('p1', 'game', 'g1')
    expect(a.status).toBe(200)
    expect(a.body).toMatchObject({ kind: 'game', name: 'P1 Test', title: 'Final quiz', place: 2, total: 3, score: 900 })
    expect(String(a.body.id)).toMatch(/^[A-HJ-NP-Z2-9]{10}$/)
    expect(a.body.url).toBe(`https://jabr.az/verify/${a.body.id}`)
    expect(a.body.design).toMatchObject({ template: 'modern', title: 'ACME CERT', color: '#2563EB', org: 'Acme', signature: '/api/media/sign/host?v=1' })
    const b = await issue('p1', 'game', 'g1')
    expect(b.body.id).toBe(a.body.id)
  })
  it('oynamayan, bitməmiş oyun və naməlum oyun üçün verilmir', async () => {
    expect((await issue('stranger', 'game', 'g1')).status).toBe(403)
    expect((await issue('p1', 'game', 'g2')).status).toBe(409)
    expect((await issue('p1', 'game', 'nope')).status).toBe(403)
    expect((await issue('p1', 'game', '../x')).status).toBe(400)
  })
  it('məşq: ən yaxşı cəhd ≥ 70% olmalıdır', async () => {
    const ok = await issue('s1', 'practice', 'c1')
    expect(ok.status).toBe(200)
    expect(ok.body).toMatchObject({ name: 'Aysel M', correct: 8, questions: 10 })
    expect((await issue('s2', 'practice', 'c1')).status).toBe(403)
  })
  it('kurs: bütün addımlar keçilməlidir', async () => {
    expect((await issue('s1', 'course', 'k1')).status).toBe(200)
    expect((await issue('s2', 'course', 'k1')).status).toBe(403)
  })
  it('girişsiz sorğu rədd edilir', async () => {
    const r = await fetch(`${BASE}/api/certs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'game', ref: 'g1' }) })
    expect(r.status).toBe(401)
  })
})

describe('yoxlama səhifəsi', () => {
  it('düzgün kod: ad, başlıq, nəticə; HTML qaçırılır; noindex', async () => {
    const { body } = await issue('p2', 'game', 'g1')
    const r = await fetch(`${BASE}/verify/${String(body.id).toLowerCase()}`)
    expect(r.status).toBe(200)
    const h = await r.text()
    expect(h).toContain('Sertifikat təsdiqləndi')
    expect(h).toContain('P2 Test')
    expect(h).toContain('Final quiz')
    expect(h).toContain('1-ci yer (3 iştirakçıdan)')
    expect(h).toContain('Acme')
    expect(h).toContain('content="noindex"')
  })
  it('səhv kod: 404', async () => {
    const r = await fetch(`${BASE}/verify/ABCDEFGHJK`)
    expect(r.status).toBe(404)
    expect(await r.text()).toContain('Sertifikat tapılmadı')
    expect((await fetch(`${BASE}/verify/%3Cscript%3E`)).status).toBe(404)
  })
})
