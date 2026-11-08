import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
/** Eyni Security Rules testləri — Firebase emulatoru əvəzinə Jabr serverinə qarşı (npm run test:jabr). */
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))
export default defineConfig({
  resolve: { alias: {
    '@firebase/rules-unit-testing': r('./tests/jabr/rules-unit-testing.ts'),
    'firebase/firestore': r('./src/lib/jdb/firestore.ts'),
  } },
  test: { include: ['tests/rules.test.ts', 'tests/jabr/*.test.ts'], testTimeout: 20000, hookTimeout: 60000, fileParallelism: false },
})
