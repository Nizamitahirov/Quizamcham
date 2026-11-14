/** Profil şəkli / loqo yükləmə və şirkət brendi (plan və təşkilat üzvlüyü serverdə yoxlanılır). */
import { beforeAll, describe, expect, it } from 'vitest'
import { initializeTestEnvironment } from './rules-unit-testing'
import { doc, setDoc, Timestamp } from '../../src/lib/jdb/firestore'

const BASE = process.env.JABR_TEST_URL ?? 'http://127.0.0.1:3100'
const DAY = 86_400_000
const auth = (uid: string, anon = false) => ({ 'x-test-auth': Buffer.from(JSON.stringify({ uid, token: anon ? { firebase: { sign_in_provider: 'anonymous' } } : {} })).toString('base64') })
// 1×1 şəffaf PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const up = (kind: string, uid: string | null, body: Buffer, anon = false) =>
  fetch(`${BASE}/api/media/${kind}`, { method: 'POST', headers: { 'content-type': 'application/octet-stream', ...(uid ? auth(uid, anon) : {}) }, body })
const brand = async (uid: string) => ((await (await fetch(`${BASE}/api/brand`, { headers: auth(uid) })).json()) as { brand: unknown }).brand

beforeAll(async () => {
  const env = await initializeTestEnvironment()
  await env.clearFirestore()
  const now = Date.now(), t = (ms: number) => Timestamp.fromMillis(ms)
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    await setDoc(doc(d, 'admins', 'biz'), { role: 'trainer', source: 'signup', plan: 'institution', licenseUntil: t(now + 30 * DAY), createdAt: t(now - 9 * DAY) })
    await setDoc(doc(d, 'admins', 'member'), { role: 'trainer', source: 'org', orgId: 'biz' })
    await setDoc(doc(d, 'admins', 'freebie'), { role: 'trainer', source: 'signup', createdAt: t(now - 30 * DAY) })
    await setDoc(doc(d, 'profiles', 'biz'), { name: 'Biz', brand: { on: true, name: 'Acme', color: '#2563EB', logo: '/api/media/logo/biz?v=1' } })
    await setDoc(doc(d, 'profiles', 'freebie'), { name: 'Free', brand: { on: true, name: 'Nope', color: '#2563EB', logo: '' } })
  })
})

describe('profil şəkli və loqo', () => {
  it('şəkil yüklənir və girişsiz oxunur; düzgün növ və təhlükəsizlik başlıqları', async () => {
    const r = await up('photo', 'u1', PNG)
    expect(r.status).toBe(200)
    const { url } = (await r.json()) as { url: string }
    expect(url).toMatch(/^\/api\/media\/photo\/u1\?v=/)
    const g = await fetch(BASE + url)
    expect(g.status).toBe(200)
    expect(g.headers.get('content-type')).toBe('image/png')
    expect(g.headers.get('x-content-type-options')).toBe('nosniff')
    expect(Buffer.from(await g.arrayBuffer()).equals(PNG)).toBe(true)
  })
  it('şəkil olmayan məzmun (HTML/SVG), girişsiz və anonim yükləmə rədd edilir', async () => {
    expect((await up('photo', 'u1', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).status).toBe(400)
    expect((await up('photo', 'u1', Buffer.from('<html><script>1</script></html>'))).status).toBe(400)
    expect((await up('photo', null, PNG)).status).toBe(401)
    expect((await up('photo', 'anon1', PNG, true)).status).toBe(401)
  })
  it('loqo yalnız təlimçi hesabları üçündür; silmək olur', async () => {
    expect((await up('logo', 'u1', PNG)).status).toBe(403)
    expect((await up('logo', 'biz', PNG)).status).toBe(200)
    expect((await fetch(`${BASE}/api/media/logo/biz`)).status).toBe(200)
    await fetch(`${BASE}/api/media/photo`, { method: 'DELETE', headers: auth('u1') })
    expect((await fetch(`${BASE}/api/media/photo/u1`)).status).toBe(404)
    expect((await fetch(`${BASE}/api/media/photo/..%2F..%2Fetc`)).status).toBe(404)
  })
})

describe('şirkət brendi', () => {
  it('Business planında sahib və onun təşkilat üzvü brendi alır', async () => {
    const want = { name: 'Acme', color: '#2563EB', logo: '/api/media/logo/biz?v=1' }
    expect(await brand('biz')).toEqual(want)
    expect(await brand('member')).toEqual(want)
  })
  it('plan icazə vermirsə brend yoxdur', async () => {
    expect(await brand('freebie')).toBeNull()
  })
})
