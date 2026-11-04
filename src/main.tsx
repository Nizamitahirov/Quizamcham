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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
  </StrictMode>,
)
