/** İctimai quiz səhifələri (SEO): yalnız açıq kataloq quizləri, düzgün cavablar heç vaxt göstərilmir. */
import { beforeAll, describe, expect, it } from 'vitest'
import { initializeTestEnvironment } from './rules-unit-testing'
import { doc, setDoc, Timestamp } from '../../src/lib/jdb/firestore'

const BASE = process.env.JABR_TEST_URL ?? 'http://127.0.0.1:3100'
const q = (text: string, correct: string) => ({ id: text, type: 'single', text, timeLimit: 20, points: 'standard', options: [{ id: 'a', text: `${text}-A` }, { id: 'b', text: `${text}-B` }], correct: [correct], explanation: 'GIZLI-IZAH' })

beforeAll(async () => {
  const env = await initializeTestEnvironment()
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    const base = { questionCount: 2, publishedBy: 'u1', author: 'Müəllim Əli', category: 'Tarix və mədəniyyət', level: 'easy', publishedAt: Timestamp.fromMillis(Date.UTC(2026, 9, 1)) }
    await setDoc(doc(d, 'catalog', 'pub1'), { ...base, title: 'Azərbaycan tarixi <b>', description: 'Qısa təsvir', status: 'live', questions: [q('Bakı nə vaxt?', 'b'), q('Şuşa harada?', 'a')] })
    await setDoc(doc(d, 'catalog', 'ru1'), { ...base, title: 'История мира', status: 'live', questions: [q('Когда?', 'a')] })
    await setDoc(doc(d, 'catalog', 'hid1'), { ...base, title: 'Gizli quiz', status: 'live', hidden: true, questions: [] })
    await setDoc(doc(d, 'catalog', 'rev1'), { ...base, title: 'Yoxlamada', status: 'review', questions: [] })
    await setDoc(doc(d, 'catalog', 'unl1'), { ...base, title: 'Yalnız link', status: 'live', unlisted: true, questions: [] })
  })
})

describe('ictimai quiz səhifələri', () => {
  it('quiz səhifəsi: başlıq, canonical, suallar; cavablar və izahlar yoxdur, HTML qaçırılır', async () => {
    const r = await fetch(`${BASE}/quiz/pub1`)
    expect(r.status).toBe(200)
    const h = await r.text()
    expect(h).toContain('<html lang="az">')
    expect(h).toContain('<link rel="canonical" href="https://jabr.az/quiz/pub1">')
    expect(h).toContain('Azərbaycan tarixi &lt;b&gt;')
    expect(h).not.toContain('tarixi <b>')
    expect(h).toContain('Bakı nə vaxt?')
    expect(h).toContain('Bakı nə vaxt?-A')
    expect(h).toContain('"@type":"Quiz"')
    expect(h).not.toContain('GIZLI-IZAH')
    expect(h).not.toContain('"correct"')
    expect(h).toContain('href="/learn/pub1"')
  })
  it('rus dilində quiz → lang="ru"', async () => {
    const h = await (await fetch(`${BASE}/quiz/ru1`)).text()
    expect(h).toContain('<html lang="ru">')
    expect(h).toContain('Тренироваться бесплатно')
  })
  it('gizli, yoxlamada, yalnız link ilə və mövcud olmayan → 404 + noindex', async () => {
    for (const id of ['hid1', 'rev1', 'unl1', 'yoxdur', '..%2Fx']) {
      const r = await fetch(`${BASE}/quiz/${id}`)
      expect(r.status, id).toBe(404)
      expect(await r.text()).toContain('content="noindex"')
    }
  })
  it('kataloq və sayt xəritəsi yalnız açıq quizləri göstərir', async () => {
    const c = await (await fetch(`${BASE}/quizzes`)).text()
    expect(c).toContain('href="/quiz/pub1"')
    expect(c).toContain('href="/quiz/ru1"')
    for (const id of ['hid1', 'rev1', 'unl1']) expect(c).not.toContain(`/quiz/${id}"`)
    const s = await fetch(`${BASE}/sitemap-quizzes.xml`)
    expect(s.headers.get('content-type')).toContain('xml')
    const x = await s.text()
    expect(x).toContain('<loc>https://jabr.az/quiz/pub1</loc><lastmod>2026-10-01</lastmod>')
    expect(x).not.toContain('hid1')
    expect(x).not.toContain('unl1')
  })
})
