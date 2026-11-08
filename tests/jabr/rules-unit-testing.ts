/**
 * @firebase/rules-unit-testing əvəzi — eyni testlər Jabr serverinə qarşı işləyir.
 * Server ALLOW_TEST_AUTH=1 ilə işə salınmalıdır (x-test-auth başlığı yalnız onda qəbul olunur).
 */
import { _customFirestore, type Firestore } from '../../src/lib/jdb/firestore'

const BASE = process.env.JABR_TEST_URL ?? 'http://127.0.0.1:3100'
const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64')

export interface RulesTestContext { firestore(): Firestore }
export interface RulesTestEnvironment {
  authenticatedContext(uid: string, token?: Record<string, unknown>): RulesTestContext
  unauthenticatedContext(): RulesTestContext
  withSecurityRulesDisabled(fn: (ctx: RulesTestContext) => Promise<void>): Promise<void>
  clearFirestore(): Promise<void>
  cleanup(): Promise<void>
}

export async function initializeTestEnvironment(_cfg?: unknown): Promise<RulesTestEnvironment> {
  const made: Firestore[] = []
  const ctx = (header: string): RulesTestContext => ({ firestore: () => { const f = _customFirestore(BASE, { 'x-test-auth': header }); made.push(f); return f } })
  return {
    authenticatedContext: (uid, token = {}) => ctx(enc({ uid, token })),
    unauthenticatedContext: () => ctx('none'),
    withSecurityRulesDisabled: (fn) => fn(ctx('bypass')),
    async clearFirestore() {
      const r = await fetch(BASE + '/api/test/clear', { method: 'POST' })
      if (!r.ok) throw new Error('clear failed: ' + r.status)
    },
    async cleanup() { for (const f of made) f._terminate() },
  }
}

export async function assertFails(p: Promise<unknown>) {
  try { await p } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'permission-denied' || code === 'unauthenticated' || code === 'not-found') return e
    throw new Error(`Expected permission-denied, got ${code}: ${(e as Error).message}`, { cause: e })
  }
  throw new Error('Expected request to fail, but it succeeded.')
}
export async function assertSucceeds<T>(p: Promise<T>) { return p }
