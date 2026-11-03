import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { t } from '../i18n/az'
import { FullScreen, Page } from '../components/ui'
import { FloatingShapes } from '../components/FloatingShapes'
import { AboutButton } from '../components/About'

export default function Home() {
  return (
    <FullScreen>
      <FloatingShapes />
      <Page>
        <div className="m-auto flex w-full max-w-sm flex-col items-center gap-6 p-6 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1, rotate: [0, -8, 8, 0] }} transition={{ type: 'spring' }} className="text-8xl">🎯</motion.div>
          <h1 className="text-5xl tracking-tight">{t.app.name}</h1>
          <p className="text-lg opacity-90">{t.home.subtitle}</p>
          <Link to="/join" className="btn btn-primary w-full text-xl">{t.home.join}</Link>
          <Link to="/admin" className="btn btn-ghost w-full">{t.home.admin}</Link>
          <AboutButton />
        </div>
      </Page>
    </FullScreen>
  )
}
