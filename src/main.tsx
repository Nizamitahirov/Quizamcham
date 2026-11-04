import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import './styles/tokens.css'
import { router } from './router'
import { installGlobalErrorHandlers } from './lib/errorLog'
import { initExtras } from './firebase/extras'

installGlobalErrorHandlers()
void initExtras()

// PWA: yalnız production-da (dev zamanı keş problemlərinin qarşısını almaq üçün)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(() => {}) })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
  </StrictMode>,
)
