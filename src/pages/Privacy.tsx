import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { t } from '../i18n/az'
import { Logo } from '../components/Brand'
import { FuturisticBg } from '../components/FuturisticBg'

export default function Privacy() {
  return (
    <div className="noise relative min-h-dvh overflow-hidden bg-night">
      <FuturisticBg floor={false} intensity={0.6} />
      <div className="relative mx-auto max-w-2xl px-4 py-8">
        <Link to="/" aria-label={t.app.home}><Logo size={34} /></Link>
        <div className="glass-strong mt-8 p-6 sm:p-8">
          <h1 className="mb-5 flex items-center gap-3 text-3xl font-black"><ShieldCheck className="h-8 w-8 text-orange-400" />{t.privacy.title}</h1>
          <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-white/80">
            {t.privacy.body.map((p) => <p key={p}>{p}</p>)}
          </div>
        </div>
      </div>
    </div>
  )
}
