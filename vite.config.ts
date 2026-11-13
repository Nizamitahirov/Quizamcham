/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { prerenderSeo } from './scripts/prerender-seo'

/**
 * VITE_BACKEND=jabr → "firebase/*" importları öz serverimizin klient SDK-sına (src/lib/jdb) yönləndirilir.
 * Tətbiq kodu dəyişmir; standart build hələ Firebase ilə işləyir (köçürmə tamamlanana qədər).
 */
const jabr = process.env.VITE_BACKEND === 'jabr'
const jdb = (f: string) => fileURLToPath(new URL(`./src/lib/jdb/${f}.ts`, import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss(), prerenderSeo()],
  resolve: jabr ? {
    alias: [
      { find: /^firebase\/app$/, replacement: jdb('app') },
      { find: /^firebase\/auth$/, replacement: jdb('auth') },
      { find: /^firebase\/firestore$/, replacement: jdb('firestore') },
      { find: /^firebase\/analytics$/, replacement: jdb('analytics') },
      { find: /^firebase\/app-check$/, replacement: jdb('app-check') },
    ],
  } : undefined,
  // yerli inkişaf: /api sorğuları (WebSocket daxil) yerli Jabr serverinə
  server: jabr ? { proxy: { '/api': { target: process.env.JABR_API ?? 'http://127.0.0.1:3100', ws: true } } } : undefined,
  preview: jabr ? { proxy: { '/api': { target: process.env.JABR_API ?? 'http://127.0.0.1:3100', ws: true } } } : undefined,
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // Analytics / App Check / Installations tənbəl yüklənir — əsas firebase chunk-ına qoşulmasın
          if (/@firebase\/(analytics|app-check|installations)|firebase\/(analytics|app-check)/.test(id)) return undefined
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) return 'firebase'
          if (id.includes('node_modules/@dicebear/core')) return 'dicebear-core'
        },
      },
    },
  },
  test: { include: ['src/**/*.test.ts'] },
})
