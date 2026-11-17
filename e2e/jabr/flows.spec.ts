/**
 * Jabr serveri ilə əsas axınlar (brauzerdə, real API və Postgres ilə):
 *  - məşq → sertifikat → /verify səhifəsində təsdiq
 *  - sinif tapşırığı: tələbə təhvil verir → müəllim qiymətləndirir → tələbə qiyməti görür
 *  - sertifikat dizayneri: önizləmə çəkilir
 *  - kampaniya: alıcını siyahıdan çıxarmaq
 *  - oyunçu əlçatanlığı: şrift və böyük mətn tətbiq olunur
 */
import { expect, test } from '@playwright/test'
import { API, catalogQuiz, getDoc, login, makeUser, seed, ts } from './helpers'

test('məşq → sertifikat (QR kodlu) → ictimai yoxlama səhifəsi', async ({ page }) => {
  const author = await makeUser('trainer', 'Author')
  const student = await makeUser('student', 'Aysel')
  const quiz = await catalogQuiz(author.uid)
  await login(page, student)
  await page.goto(`/learn/${quiz.id}`)
  const next = page.getByRole('button', { name: /Növbəti|Nəticəyə bax/ })
  await page.getByRole('button', { name: /Bakı/ }).click()
  await next.click()
  await page.getByRole('button', { name: /Doğru/ }).click()
  await next.click()
  // nəticə ekranı: sertifikat düyməsi (≥ 70%)
  const cert = page.getByRole('button', { name: 'Sertifikat' })
  await expect(cert).toBeVisible({ timeout: 30_000 })
  const [download] = await Promise.all([page.waitForEvent('download'), cert.click()])
  expect(download.suggestedFilename()).toMatch(/\.png$/)
  // server sertifikatı qeydə alıb — kod ilə yoxlama səhifəsi
  const r = await fetch(`${API}/api/certs`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-auth': Buffer.from(JSON.stringify({ uid: student.uid })).toString('base64') }, body: JSON.stringify({ kind: 'practice', ref: quiz.id }) })
  const c = (await r.json()) as { id: string }
  expect(c.id).toMatch(/^[A-HJ-NP-Z2-9]{10}$/)
  await page.goto(`${API}/verify/${c.id}`)
  await expect(page.getByText('Sertifikat təsdiqləndi')).toBeVisible()
  await expect(page.getByText('Aysel Test')).toBeVisible()
  await expect(page.getByText(quiz.title)).toBeVisible()
})

test('tapşırıq: tələbə təhvil verir → müəllim qiymətləndirir → tələbə qiyməti görür', async ({ browser }) => {
  const teacher = await makeUser('trainer', 'Teacher')
  const student = await makeUser('student', 'Murad')
  const cid = `c${Date.now().toString(36)}`, tid = 't1'
  await seed([
    { op: 'set', path: `classes/${cid}`, data: { ownerUid: teacher.uid, ownerName: teacher.name, name: 'E2E sinif', code: 'E2E123', archived: false, createdAt: ts() } },
    { op: 'set', path: `classes/${cid}/members/${student.uid}`, data: { uid: student.uid, name: student.name, email: student.email, code: 'E2E123', joinedAt: ts() } },
    { op: 'set', path: `classes/${cid}/tasks/${tid}`, data: { kind: 'assignment', title: 'Esse: iqlim', description: 'Qısa esse yazın.', points: 10, allowLate: true, dueAt: null, createdAt: ts() } },
  ])
  // tələbə
  const sp = await (await browser.newContext()).newPage()
  await login(sp, student)
  await sp.goto(`/learn/class/${cid}/task/${tid}`)
  await expect(sp.getByRole('heading', { name: 'Esse: iqlim' })).toBeVisible()
  await sp.getByPlaceholder('Cavabınızı bura yazın…').fill('İqlim dəyişikliyi qlobal problemdir.')
  await sp.getByRole('button', { name: 'Təhvil ver' }).click()
  await sp.getByRole('dialog').getByRole('button', { name: 'Təhvil ver' }).click()
  await expect(sp.getByText('Təhvil verildi ✓')).toBeVisible()
  // müəllim
  const tp = await (await browser.newContext({ viewport: { width: 1400, height: 950 } })).newPage()
  await login(tp, teacher)
  await tp.goto(`/admin/classes/${cid}`)
  await tp.getByRole('button', { name: 'Yoxla' }).click()
  await expect(tp.getByText('İqlim dəyişikliyi qlobal problemdir.')).toBeVisible()
  await tp.locator('input[type=number]').fill('8')
  await tp.getByPlaceholder('Tələbəyə şərh…').fill('Yaxşı iş!')
  await tp.getByRole('button', { name: 'Qiymətləndir və qaytar' }).click()
  await expect(tp.getByText('Qiymət qaytarıldı')).toBeVisible()
  const sub = await getDoc(`classes/${cid}/submissions/${student.uid}_${tid}`)
  expect(sub).toMatchObject({ grade: 8, status: 'returned' })
  // tələbə qiyməti görür
  await sp.reload()
  await expect(sp.getByText('8 / 10')).toBeVisible()
  await expect(sp.getByText('Yaxşı iş!')).toBeVisible()
})

test('sertifikat dizayneri: aktivləşdirmək və önizləmə', async ({ page }) => {
  const trainer = await makeUser('trainer', 'Designer')
  await login(page, trainer)
  await page.goto('/admin/profile')
  const sec = page.locator('section', { hasText: 'Sertifikat dizaynı' }).first()
  await sec.getByRole('switch').click()
  await sec.getByText('Müasir', { exact: true }).click()
  const img = sec.locator('img[alt="Sertifikatın önizləməsi"]')
  await expect(img).toBeVisible({ timeout: 20_000 })
  await expect.poll(async () => (await getDoc(`profiles/${trainer.uid}`))?.cert).toMatchObject({ on: true, template: 'modern' })
})

test('kampaniya: seçilmiş şəxslərdən birini çıxarmaq', async ({ page }) => {
  const admin = await makeUser('trainer', 'Super', { super: true })
  const a = await makeUser('student', 'Leyla'), b = await makeUser('student', 'Rauf')
  await login(page, admin)
  await page.goto('/admin/campaigns')
  await page.getByText('Seçilmiş şəxslər', { exact: true }).click()
  await page.locator('textarea.font-mono').fill(`${a.email}\n${b.email}`)
  await page.getByText('Xidməti elan', { exact: true }).first().click()
  const count = page.locator('span.text-2xl.font-black').first()
  await expect(count).toHaveText('2', { timeout: 15_000 })
  await page.getByRole('button', { name: `Çıxar: ${b.email}` }).click()
  await expect(count).toHaveText('1')
  await expect(page.getByText(/Çıxarılanlar \(1\)/)).toBeVisible()
})

test('əlçatanlıq: disleksiya rejimi və böyük mətn tətbiq olunur, yadda qalır', async ({ page }) => {
  const author = await makeUser('trainer', 'Author2')
  const student = await makeUser('student', 'Nigar')
  const quiz = await catalogQuiz(author.uid)
  await login(page, student)
  await page.goto(`/learn/${quiz.id}`)
  await page.getByRole('button', { name: 'Əlçatanlıq' }).click()
  await page.getByRole('menu').getByRole('radio', { name: 'Disleksiya' }).click()
  await page.getByRole('menuitemcheckbox', { name: /Böyük mətn/ }).click()
  const attrs = () => page.evaluate(() => [document.documentElement.dataset.a11yFont, document.documentElement.hasAttribute('data-a11y-large')])
  expect(await attrs()).toEqual(['dyslexic', true])
  // yenidən açılanda ilk rəsmdən əvvəl tətbiq olunur (theme-init.js)
  await page.reload()
  await expect.poll(attrs).toEqual(['dyslexic', true])
})
