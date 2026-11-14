import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { firebaseConfigured } from './firebase/config'
import { OfflineBanner, Spinner } from './components/ui'
import { DialogHost } from './components/dialogs'
import { t } from './i18n/az'
import { useSeo } from './lib/seo'

export default function App() {
  useSeo()
  if (!firebaseConfigured) {
    return <div className="flex min-h-dvh items-center justify-center p-6 text-center text-lg">{t.app.notConfigured}</div>
  }
  return (
    <>
      <OfflineBanner />
      {/* yeganə Suspense sərhədi: yalnız ilk açılışda görünür; keçidlərdə köhnə səhifə yenisi hazır olana qədər qalır */}
      <Suspense fallback={<div className="bg-app flex min-h-dvh items-center justify-center"><Spinner /></div>}>
        <Outlet />
      </Suspense>
      <DialogHost />
    </>
  )
}
