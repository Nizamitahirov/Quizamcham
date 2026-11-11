import { expect, test, devices } from '@playwright/test'

/**
 * Yeni sual növləri + əminlik rejimi: host + 1 oyunçu (telefon).
 * E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD təyin olunanda işləyir.
 */
const EMAIL = process.env.E2E_ADMIN_EMAIL
const PASSWORD = process.env.E2E_ADMIN_PASSWORD
const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAAB4CAIAAAA48Cq8AAAClElEQVR4nO3SQQ0AMQCEwAo7/1JORy10X4SEsQDny7M/zw4dy4SOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmjTWgY5k01oCOZdJYAzqWSWMN6FgmF86KVpLmTBGaAAAAAElFTkSuQmCC'
const QUIZ = {
  title: `E2E yeni növlər ${new Date().toISOString().slice(0, 16)}`, coverEmoji: '🧪',
  settings: { mode: 'auto', autoDelay: 4, readTime: 3, confidence: true, powerUps: false },
  questions: [
    { type: 'match', text: 'Paytaxtları uyğunlaşdırın', timeLimit: 60, options: [{ id: 'a', text: 'Bakı', pair: 'Azərbaycan' }, { id: 'b', text: 'Tbilisi', pair: 'Gürcüstan' }, { id: 'c', text: 'Ankara', pair: 'Türkiyə' }], correct: [] },
    { type: 'fill', text: 'Azərbaycanın paytaxtı [Bakı/Baku], ən uzun çayı [Kür]', timeLimit: 60, options: [], correct: [] },
    { type: 'hotspot', text: 'Tünd hissəyə toxunun', timeLimit: 30, imageUrl: IMG, hotspot: { x: 25, y: 50, r: 20 }, options: [], correct: [] },
  ],
}

test.skip(!EMAIL || !PASSWORD, 'E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD təyin olunmayıb')

test('uyğunlaşdırma, boşluq doldurma, şəkildə nöqtə və əminlik rejimi', async ({ browser }) => {
  const host = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage()
  await host.goto('/admin/login')
  await host.locator('#em').fill(EMAIL!)
  await host.locator('#pw').fill(PASSWORD!)
  await host.getByRole('button', { name: 'Daxil ol' }).click()
  await host.waitForURL('**/admin')
  await host.goto('/admin/quizzes')
  await host.getByRole('button', { name: 'AI', exact: true }).click()
  await host.getByRole('button', { name: 'JSON', exact: true }).click()
  await host.locator('textarea.input').fill(JSON.stringify(QUIZ))
  await host.getByRole('button', { name: 'İdxal et' }).click()
  await host.waitForURL(/\/admin\/quiz\//)
  await host.waitForTimeout(2500)
  await host.getByRole('button', { name: 'Oyunu başlat' }).click()
  await host.waitForURL(/\/host\//)
  await host.getByText('Lobbini aç').click()
  const pin = (await host.getByTestId('lobby-pin').innerText()).trim()

  const p = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage()
  await p.goto(`/join?pin=${pin}`)
  await p.locator('#fn').fill('Aysel')
  await p.locator('#ln').fill('Məmmədova')
  await p.locator('form button.btn-primary').click()
  await expect(p.getByText('Siz oyundasınız')).toBeVisible({ timeout: 20_000 })
  await host.locator('footer').getByRole('button', { name: /Başla/ }).click()

  // 1) uyğunlaşdırma
  await expect(p.getByLabel('Bakı')).toBeEnabled({ timeout: 30_000 })
  await p.getByLabel('Bakı').selectOption({ label: 'Azərbaycan' })
  await p.getByLabel('Tbilisi').selectOption({ label: 'Gürcüstan' })
  await p.getByLabel('Ankara').selectOption({ label: 'Türkiyə' })
  await p.getByRole('button', { name: 'Göndər' }).click()
  await p.getByRole('button', { name: /Əminəm/ }).click()
  await expect(host.getByText('1 / 1 düzgün')).toBeVisible({ timeout: 70_000 })
  await expect(host.getByText('Bakı').first()).toBeVisible()

  // 2) boşluq doldurma (alternativ cavab + böyük hərf)
  await expect(p.getByLabel('1-ci boşluq')).toBeEnabled({ timeout: 30_000 })
  await p.getByLabel('1-ci boşluq').fill('baku')
  await p.getByLabel('2-ci boşluq').fill('KÜR')
  await p.getByRole('button', { name: 'Göndər' }).click()
  await p.getByRole('button', { name: /Əminəm/ }).click()
  await expect(host.getByText('1 / 1 düzgün')).toBeVisible({ timeout: 70_000 })

  // 3) şəkildə nöqtə — tünd (sol) hissəyə
  await expect(p.getByText('Şəkildə düzgün yerə toxunun')).toBeVisible({ timeout: 30_000 })
  const img = p.locator('.cursor-crosshair img')
  await expect(img).toBeVisible()
  const box = (await img.boundingBox())!
  await p.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.5)
  await p.getByRole('button', { name: 'Göndər' }).click()
  await p.getByRole('button', { name: /Əmin deyiləm/ }).click()

  // nəticə: 3 sualın hamısı düz → 1-ci yer
  await expect(p.locator('#result-card')).toContainText('1-ci yer', { timeout: 90_000 })
})
