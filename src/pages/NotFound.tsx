import { Link } from 'react-router-dom'
import { t } from '../i18n/az'
import { FullScreen } from '../components/ui'

export default function NotFound() {
  return (
    <FullScreen>
      <div className="m-auto flex flex-col items-center gap-4 p-6 text-center">
        <div className="text-7xl">🧭</div>
        <h1 className="text-3xl">{t.app.notFound}</h1>
        <Link to="/" className="btn btn-secondary">{t.app.home}</Link>
      </div>
    </FullScreen>
  )
}
