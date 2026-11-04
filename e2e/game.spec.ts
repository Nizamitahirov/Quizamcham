import { expect, test, devices, type Page } from '@playwright/test'

/**
 * Tam oyun (avtomatik rejim): host + 2 oyunçu. Real Firebase layihəsinə yazır,
 * ona görə yalnız E2E_ADMIN_EMAIL və E2E_ADMIN_PASSWORD təyin olunanda işləyir.
 */
const EMAIL = process.env.E2E_ADMIN_EMAIL
const PASSWORD = process.env.E2E_ADMIN_PASSWORD
const QUIZ = {
  title: `E2E ${new Date().toISOString().slice(0, 16)}`, coverEmoji: '🧪', settings: { mode: 'auto', autoDelay: 4, readTime: 3 },
  questions: [
    { type: 'single', text: 'Paytaxt?', timeLimit: 15, options: [{ id: 'a', text: 'Bakı' }, { id: 'b', text: 'Gəncə' }, { id: 'c', text: 'Şəki' }, { id: 'd', text: 'Quba' }], correct: ['a'] },
    { type: 'truefalse', text: '2+2=4', timeLimit: 15, options: [{ id: 't', text: 'Doğru' }, { id: 'f', text: 'Yanlış' }], correct: ['t'] },
  ],
}

test.skip(!EMAIL || !PASSWORD, 'E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD təyin olunmayıb')

test('avtomatik rejimdə tam oyun: qoşulma → cavab → nəticə', async ({ browser }) => {
  const host = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage()
  await host.goto('/admin/login')
  await host.locator('#em').fill(EMAIL!)
  await host.locator('#pw').fill(PASSWORD!)
  await host.getByRole('button', { name: 'Daxil ol' }).click()
  await host.waitForURL('**/admin')
  await host.goto('/admin/quizzes')
  await host.getByRole('button', { name: 'AI' }).click()
  await host.locator('textarea.input').fill(JSON.stringify(QUIZ))
  await host.getByRole('button', { name: 'İdxal et' }).click()
  await host.waitForURL(/\/admin\/quiz\//)
  await host.waitForTimeout(2500)
  await host.getByRole('button', { name: 'Oyunu başlat' }).click()
  await host.waitForURL(/\/host\//)
  await host.getByText('Lobbini aç').click()
  const pin = (await host.locator('.text-grad.tracking-\\[\\.12em\\]').innerText()).trim()

  const players: Page[] = []
  for (const [f, l] of [['Aysel', 'Məmmədova'], ['Tural', 'Əliyev']]) {
    const p = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage()
    await p.goto(`/join?pin=${pin}`)
    await p.locator('#fn').fill(f)
    await p.locator('#ln').fill(l)
    await p.locator('form button.btn-primary').click()
    await expect(p.getByText('Siz oyundasınız')).toBeVisible({ timeout: 20_000 })
    players.push(p)
  }
  await host.locator('footer').getByRole('button', { name: /Başla/ }).click()
  for (const ans of [['Bakı', 'Gəncə'], ['Doğru', 'Yanlış']]) {
    for (const [i, p] of players.entries()) {
      const tile = p.locator('main button[aria-label]', { hasText: ans[i] }).first()
      await expect(tile).toBeEnabled({ timeout: 30_000 })
      await tile.click()
    }
  }
  await expect(host.getByText('Ümumi statistika')).toBeVisible({ timeout: 90_000 })
  await expect(players[0].locator('#result-card')).toContainText('1-ci yer', { timeout: 20_000 })
  await expect(players[1].locator('#result-card')).toContainText('2-ci yer')
})
