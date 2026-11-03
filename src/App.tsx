import { Outlet } from 'react-router-dom'
import { firebaseConfigured } from './firebase/config'
import { OfflineBanner } from './components/ui'
import { t } from './i18n/az'

export default function App() {
  if (!firebaseConfigured) {
    return <div className="flex min-h-dvh items-center justify-center p-6 text-center text-lg">{t.app.notConfigured}</div>
  }
  return (
    <>
      <OfflineBanner />
      <Outlet />
    </>
  )
}
