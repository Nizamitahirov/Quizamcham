/** Server vəziyyəti: yalnız super admin görür; baza yoxlaması qayıdır. */
import { describe, expect, it } from 'vitest'

const BASE = process.env.JABR_TEST_URL ?? 'http://127.0.0.1:3100'
const SUPER = 'ii98moHX58SDPcn9lA4SYHWanou1'
const hdr = (uid: string) => ({ 'x-test-auth': Buffer.from(JSON.stringify({ uid })).toString('base64') })

describe('monitorinq', () => {
  it('super admin yoxlamaları görür', async () => {
    const r = await fetch(`${BASE}/api/monitor`, { headers: hdr(SUPER) })
    expect(r.status).toBe(200)
    const j = (await r.json()) as { checks: { id: string; ok: boolean }[] }
    expect(j.checks.find((c) => c.id === 'db')?.ok).toBe(true)
  })
  it('başqaları və girişsiz — 403', async () => {
    expect((await fetch(`${BASE}/api/monitor`, { headers: hdr('someone') })).status).toBe(403)
    expect((await fetch(`${BASE}/api/monitor`)).status).toBe(403)
  })
})
