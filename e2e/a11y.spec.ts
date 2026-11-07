import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/** Ciddi (serious/critical) əlçatanlıq pozuntusu olmamalıdır. */
for (const path of ['/', '/join', '/admin/login', '/privacy', '/start', '/pricing']) {
  test(`əlçatanlıq: ${path}`, async ({ page }) => {
    await page.goto(path)
    await page.waitForTimeout(1200)
    const res = await new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]['page'] }).withTags(['wcag2a', 'wcag2aa']).analyze()
    const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(bad.map((v) => `${v.id}: ${v.nodes.length} → ${v.nodes[0]?.target.join(' ')}`)).toEqual([])
  })
}
