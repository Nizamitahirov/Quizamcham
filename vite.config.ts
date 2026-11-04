/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
