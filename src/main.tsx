import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import '@fontsource-variable/inter/wght.css'
import '@fontsource/montserrat/700.css'
import '@fontsource/montserrat/800.css'
import '@fontsource/montserrat/900.css'
import '@fontsource/figtree/800.css'
import './styles/tokens.css'
import { router } from './router'
import { installGlobalErrorHandlers } from './lib/errorLog'
import { initExtras } from './firebase/extras'

// Google girişindən qayıdış (yalnız öz serverimizlə): popup/yönləndirmə cavabı emal olunur, tətbiq render olunmur
const googleCallback = import.meta.env.VITE_BACKEND === 'jabr' && location.pathname === '/auth/google'
if (googleCallback) void import('./lib/jdb/auth').then((m) => m.handleGoogleCallback())

installGlobalErrorHandlers()
if (!googleCallback) void initExtras()

// PWA: yalnız production-da (dev zamanı keş problemlərinin qarşısını almaq üçün)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(() => {}) })
}

if (!googleCallback) createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
  </StrictMode>,
)
