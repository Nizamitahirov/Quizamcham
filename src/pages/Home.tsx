import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Radio, Shield, Trophy, Zap, QrCode } from 'lucide-react'
import { t } from '../i18n/az'
import { Logo } from '../components/Brand'
import { LangSwitch } from '../components/LangSwitch'
import { FuturisticBg } from '../components/FuturisticBg'
import { TILE_HEX, Shape } from '../components/AnswerTile'

const FEATURES = [
  { icon: Radio, title: t.home.f1, desc: t.home.f1d },
  { icon: Shield, title: t.home.f2, desc: t.home.f2d },
  { icon: Trophy, title: t.home.f3, desc: t.home.f3d },
]

export default function Home() {
  const nav = useNavigate()
  const [pin, setPin] = useState('')
  const go = (e: React.FormEvent) => { e.preventDefault(); nav(pin.length === 6 ? `/join?pin=${pin}` : '/join') }
  return (
    <div className="noise relative flex min-h-dvh flex-col overflow-hidden bg-night">
      <FuturisticBg />
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo size={38} />
        <div className="flex items-center gap-2"><LangSwitch /><Link to="/admin" className="btn btn-ghost btn-sm hidden sm:inline-flex">{t.home.organizer}<ArrowRight /></Link></div>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-4 pb-10 sm:px-6 lg:grid-cols-[1.1fr_.9fr]">
        <section className="text-center lg:text-left">
          <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="chip chip-dark mb-5">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" /></span>
            {t.home.badge}
          </motion.span>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="font-display text-[44px] font-black leading-[1.02] sm:text-6xl lg:text-7xl">
            {t.home.title1} <span className="text-grad">{t.home.title2}</span><br />{t.home.title3}
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="mx-auto mt-5 max-w-md text-base text-white/70 sm:text-lg lg:mx-0">
            {t.home.lead}
          </motion.p>
          <div className="mt-8 hidden gap-3 sm:grid sm:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + i * 0.08 }} className="glass p-4 text-left">
                <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--grad)' }}><f.icon className="h-4.5 w-4.5" /></span>
                <div className="text-sm font-bold">{f.title}</div>
                <div className="mt-1 text-xs leading-relaxed text-white/55">{f.desc}</div>
              </motion.div>
            ))}
          </div>
        </section>

        <motion.section initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15, type: 'spring', stiffness: 160, damping: 18 }} className="relative">
          <div className="pointer-events-none absolute -inset-6 rounded-[36px] opacity-60 blur-2xl" style={{ background: 'var(--grad)' }} />
          <form onSubmit={go} className="glass-strong gradient-border relative overflow-hidden p-6 sm:p-8">
            <div className="scan" />
            <div className="mb-6 flex items-center justify-between">
              <span className="label-dark mb-0">{t.home.pinLabel}</span>
              <span className="flex gap-1.5">{[0, 1, 2, 3].map((i) => <span key={i} className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: TILE_HEX[i] }}><Shape i={i} size={12} /></span>)}</span>
            </div>
            <input aria-label={t.home.pinLabel} className="input-dark font-display h-20 px-2 pl-[calc(.5rem+.22em)] text-center text-4xl font-black tracking-[.22em] sm:text-5xl" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code"
              maxLength={6} placeholder="••••••" value={pin} autoFocus onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            <div className="mt-3 flex justify-center gap-2" aria-hidden>
              {Array.from({ length: 6 }, (_, i) => <span key={i} className="h-1.5 w-8 rounded-full transition" style={{ background: i < pin.length ? 'var(--grad)' : 'rgba(255,255,255,.12)' }} />)}
            </div>
            <button className="btn btn-primary btn-lg mt-6 w-full" disabled={pin.length !== 6}><Zap className="fill-current" />{t.home.go}</button>
            <p className="mt-5 flex items-center justify-center gap-2 text-sm text-white/50"><QrCode className="h-4 w-4" />{t.home.scan}</p>
            <p className="mt-3 flex justify-center gap-3 text-center text-xs text-white/35"><Link to="/privacy" className="underline">{t.privacy.title}</Link><Link to="/admin" className="underline sm:hidden">{t.home.organizer}</Link></p>
          </form>
        </motion.section>
      </main>
    </div>
  )
}
