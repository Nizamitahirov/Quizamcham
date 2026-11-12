import { Link } from 'react-router-dom'
import { Compass, Home } from 'lucide-react'
import { t } from '../i18n/az'

export default function NotFound() {
  return (
    <main className="bg-app flex min-h-dvh flex-col items-center justify-center gap-5 p-6 text-center">
      <span className="icon-tile h-16 w-16"><Compass className="h-8 w-8" /></span>
      <p className="font-display text-7xl font-black tracking-tight text-grad">404</p>
      <h1 className="text-2xl font-bold">{t.app.notFound}</h1>
      <Link to="/" className="btn btn-primary"><Home />{t.app.home}</Link>
    </main>
  )
}
