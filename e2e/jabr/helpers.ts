/**
 * Jabr serveri ilə e2e testlər üçün köməkçilər.
 * Server ALLOW_TEST_AUTH=1 ilə işləməlidir (x-test-auth: bypass — qaydaları keçən birbaşa yazı, yalnız test üçün).
 * Super admin üçün DATABASE_URL lazımdır: qeydiyyatdan keçən istifadəçinin uid-i super uid-ə dəyişdirilir.
 */
import { createRequire } from 'node:module'
import { expect, type Page } from '@playwright/test'

export const API = process.env.JABR_API ?? 'http://127.0.0.1:3100'
export const SUPER_UID = 'ii98moHX58SDPcn9lA4SYHWanou1'
export const PASSWORD = 'E2e-Test-Pass1'
const require = createRequire(import.meta.url)

export const ts = (ms = Date.now()) => ({ __t: ms })
type Write = { op: 'set' | 'update' | 'delete'; path: string; data?: Record<string, unknown> }
/** Qaydaları keçən birbaşa yazı (yalnız testlər). */
export async function seed(writes: Write[]) {
  const r = await fetch(`${API}/api/db/commit`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-auth': 'bypass' }, body: JSON.stringify({ writes }) })
  if (!r.ok) throw new Error(`seed ${r.status}: ${await r.text()}`)
}
export async function getDoc(path: string) {
  const r = await fetch(`${API}/api/db/get`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-auth': 'bypass' }, body: JSON.stringify({ path }) })
  return ((await r.json()) as { data: Record<string, unknown> | null }).data
}

const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
export interface TestUser { uid: string; email: string; name: string }
/** Hesab yaradır (e-poçt + şifrə) və qeydiyyatı tamamlanmış profil yazır. */
export async function makeUser(kind: 'student' | 'trainer', first: string, opts: { super?: boolean } = {}): Promise<TestUser> {
  const email = `${first.toLowerCase()}-${uniq()}@e2e.jabr.test`
  const r = await fetch(`${API}/api/auth/signup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD, displayName: `${first} Test` }) })
  if (!r.ok) throw new Error(`signup ${r.status}: ${await r.text()}`)
  let uid = ((await r.json()) as { user: { uid: string } }).user.uid
  if (opts.super) uid = await promote(uid)
  const now = Date.now()
  const writes: Write[] = [{ op: 'set', path: `users/${uid}`, data: { type: kind, firstName: first, lastName: 'Test', email, phone: '+994501234567', onboarded: true, marketing: true, createdAt: ts(now), termsAt: ts(now) } }]
  if (kind === 'trainer') writes.push(
    { op: 'set', path: `admins/${uid}`, data: opts.super ? { role: 'super', email, name: `${first} Test`, disabled: false } : { role: 'trainer', source: 'signup', plan: 'business', licenseUntil: ts(now + 30 * 86_400_000), email, name: `${first} Test`, createdAt: ts(now), disabled: false, mustChangePassword: false } },
    { op: 'set', path: `profiles/${uid}`, data: { name: `${first} Test`, title: 'Təlimçi', org: 'E2E Academy', email } },
  )
  await seed(writes)
  return { uid, email, name: `${first} Test` }
}
/** Super admin uid-i koddadır — test bazasında yeni hesabın uid-i ona dəyişdirilir (əvvəlki super hesabı silinir). */
async function promote(uid: string) {
  const { Client } = require('../../server/node_modules/pg') as { Client: new (o: { connectionString: string }) => { connect(): Promise<void>; query(q: string, v?: unknown[]): Promise<unknown>; end(): Promise<void> } }
  const db = new Client({ connectionString: process.env.DATABASE_URL ?? 'postgres://postgres:test@localhost:5432/jabr_test' })
  await db.connect()
  try {
    await db.query('delete from sessions where uid = $1 or uid = $2', [uid, SUPER_UID])
    await db.query('delete from auth_users where uid = $1', [SUPER_UID])
    await db.query('update auth_users set uid = $2 where uid = $1', [uid, SUPER_UID])
  } finally { await db.end() }
  return SUPER_UID
}

/**
 * Giriş: sessiya API ilə açılır və brauzerə yazılır (klient SDK-nın saxladığı kimi).
 * Admin giriş səhifəsi admin olmayanları çıxarır, tələbələr isə Google ilə daxil olur — ona görə UI-dan keçmirik.
 */
export async function login(page: Page, u: TestUser) {
  const r = await fetch(`${API}/api/auth/signin`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: u.email, password: PASSWORD }) })
  expect(r.status).toBe(200)
  const s = (await r.json()) as { token: string; user: Record<string, unknown> }
  await page.goto('/privacy')
  await page.evaluate((v) => localStorage.setItem('jabr.auth.[DEFAULT]', v), JSON.stringify({ token: s.token, user: s.user }))
}

/** Kataloqa sadə quiz (2 sual: doğru cavab həmişə "a"/"t"). */
export async function catalogQuiz(owner: string, title = `E2E quiz ${uniq()}`) {
  const id = `e2e-${uniq()}`
  await seed([{ op: 'set', path: `catalog/${id}`, data: {
    title, description: 'E2E', status: 'live', publishedBy: owner, author: 'E2E', category: 'Digər', level: 'easy', questionCount: 2, hasImages: false, publishedAt: ts(),
    questions: [
      { id: 'q1', type: 'single', text: 'Azərbaycanın paytaxtı?', timeLimit: 30, points: 'standard', options: [{ id: 'a', text: 'Bakı' }, { id: 'b', text: 'Gəncə' }, { id: 'c', text: 'Şəki' }, { id: 'd', text: 'Quba' }], correct: ['a'] },
      { id: 'q2', type: 'truefalse', text: '2 + 2 = 4', timeLimit: 30, points: 'standard', options: [{ id: 't', text: 'Doğru' }, { id: 'f', text: 'Yanlış' }], correct: ['t'] },
    ],
  } }])
  return { id, title }
}
