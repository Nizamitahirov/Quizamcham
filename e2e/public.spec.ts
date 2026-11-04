import { expect, test } from '@playwright/test'

test('ana səhifə: PIN sahəsi və qoşul düyməsi', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Bilik')
  const btn = page.locator('form button.btn-primary')
  await expect(btn).toBeDisabled()
  await page.getByLabel('Oyun PIN-i').fill('12ab34')
  await expect(page.getByLabel('Oyun PIN-i')).toHaveValue('1234')
})

test('yanlış PIN xəta göstərir', async ({ page }) => {
  await page.goto('/join')
  await page.locator('#pin').fill('000001')
  await page.locator('form button.btn-primary').click()
  await expect(page.getByRole('alert')).toContainText('tapılmadı', { timeout: 20_000 })
})

test('məxfilik səhifəsi açılır', async ({ page }) => {
  await page.goto('/privacy')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Məxfilik')
})

test('PWA manifest və service worker faylları mövcuddur', async ({ request }) => {
  expect((await request.get('/manifest.webmanifest')).ok()).toBeTruthy()
  expect((await request.get('/sw.js')).ok()).toBeTruthy()
})
