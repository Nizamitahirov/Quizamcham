/** Kampaniyalar: lisenziya filtri (bitib / yaxında bitir / sınaq bitib) və {tarix} dəyişəni. */
import { beforeAll, describe, expect, it } from 'vitest'
import { initializeTestEnvironment } from './rules-unit-testing'
import { doc, setDoc, Timestamp } from '../../src/lib/jdb/firestore'

const BASE = process.env.JABR_TEST_URL ?? 'http://127.0.0.1:3100'
const SUPER = 'camp-super'
const DAY = 86_400_000
const hdr = (uid: string) => ({ 'content-type': 'application/json', 'x-test-auth': Buffer.from(JSON.stringify({ uid })).toString('base64') })
const post = async (path: string, body: unknown, uid = SUPER) => {
  const r = await fetch(BASE + path, { method: 'POST', headers: hdr(uid), body: JSON.stringify(body) })
  return { status: r.status, body: (await r.json()) as Record<string, unknown> }
}
const filter = (p: Record<string, unknown>) => ({ audience: 'trainers', tiers: [], langs: [], joinedDays: 0, emails: [], kind: 'service', license: 'any', licenseDays: 0, ...p })
const emails = (b: Record<string, unknown>) => ((b.sample as { email: string }[]) ?? []).map((x) => x.email).sort()

beforeAll(async () => {
  const env = await initializeTestEnvironment()
  await env.clearFirestore()
  const now = Date.now()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    const t = (ms: number) => Timestamp.fromMillis(ms)
    await setDoc(doc(d, 'admins', SUPER), { role: 'super' })
    const trainer = async (uid: string, admin: Record<string, unknown>) => {
      await setDoc(doc(d, 'users', uid), { type: 'trainer', firstName: uid, email: `${uid}@x.az`, onboarded: true, createdAt: t(now - 100 * DAY) })
      await setDoc(doc(d, 'admins', uid), { role: 'trainer', source: 'signup', createdAt: t(now - 100 * DAY), ...admin })
    }
    await trainer('exp5', { licenseUntil: t(now - 5 * DAY), plan: 'pro' })         // 5 gün əvvəl bitib
    await trainer('exp60', { licenseUntil: t(now - 60 * DAY), plan: 'pro' })       // 60 gün əvvəl bitib
    await trainer('soon3', { licenseUntil: t(now + 3 * DAY), plan: 'pro' })        // 3 günə bitir
    await trainer('soon20', { licenseUntil: t(now + 20 * DAY), plan: 'trainer' })  // 20 günə bitir
    await trainer('trialOver', { trialEndsAt: t(now - 2 * DAY) })                  // sınaq bitib
    await trainer('trialOn', { trialEndsAt: t(now + 2 * DAY) })                    // sınaqdadır
    await trainer('member', { source: 'org', orgId: 'exp5' })                      // komanda üzvü — sayılmır
    await setDoc(doc(d, 'users', 'stud'), { type: 'student', firstName: 'S', email: 'stud@x.az', onboarded: true })
  })
})

describe('kampaniya: lisenziya filtri', () => {
  it('bitib: istənilən vaxt və son 30 gün', async () => {
    expect(emails((await post('/api/campaigns/audience', { filter: filter({ license: 'expired' }) })).body)).toEqual(['exp5@x.az', 'exp60@x.az'])
    expect(emails((await post('/api/campaigns/audience', { filter: filter({ license: 'expired', licenseDays: 30 }) })).body)).toEqual(['exp5@x.az'])
  })
  it('yaxında bitir: 7 və 30 gün ərzində', async () => {
    expect(emails((await post('/api/campaigns/audience', { filter: filter({ license: 'expiring', licenseDays: 7 }) })).body)).toEqual(['soon3@x.az'])
    expect(emails((await post('/api/campaigns/audience', { filter: filter({ license: 'expiring', licenseDays: 30 }) })).body)).toEqual(['soon20@x.az', 'soon3@x.az'])
  })
  it('sınaq bitib; tələbələr və komanda üzvləri daxil deyil; bitmə tarixi nümunədə', async () => {
    const r = await post('/api/campaigns/audience', { filter: filter({ license: 'trialEnded' }) })
    expect(emails(r.body)).toEqual(['trialover@x.az'])
    expect(typeof (r.body.sample as { until: number }[])[0].until).toBe('number')
  })
  it('{tarix} önizləmədə bitmə tarixi ilə əvəz olunur', async () => {
    const content = { subject: '{ad}, lisenziya {tarix} bitib', title: 'Bitmə: {tarix}', body: 'Salam', preheader: '', hero: '', features: [], ctaLabel: '', ctaUrl: '', lang: 'az' }
    const r = await post('/api/campaigns/preview', { content, filter: filter({ license: 'expired' }) })
    expect(r.status).toBe(200)
    expect(String(r.body.subject)).not.toContain('{tarix}')
    expect(String(r.body.subject)).toMatch(/\d{1,2} (yanvar|fevral|mart|aprel|may|iyun|iyul|avqust|sentyabr|oktyabr|noyabr|dekabr) \d{4}/)
  })
  it('super admin olmayan auditoriyanı görə bilmir', async () => {
    expect((await post('/api/campaigns/audience', { filter: filter({ license: 'expired' }) }, 'exp5')).status).toBe(403)
  })
})
