import { Link, useLocation } from 'react-router-dom'
import { FileText, Megaphone, Printer, ScrollText, ShieldCheck, UserCheck } from 'lucide-react'
import { currentLang, t } from '../i18n/az'
import { LEGAL, LEGAL_VERSION, type LegalId } from '../content/legal'
import { Logo } from '../components/Brand'
import { FuturisticBg } from '../components/FuturisticBg'
import { LangSwitch } from '../components/LangSwitch'

const ICON: Record<LegalId, typeof ShieldCheck> = { privacy: ShieldCheck, terms: ScrollText, consent: UserCheck, marketing: Megaphone }
const PATH: Record<LegalId, string> = { privacy: '/privacy', terms: '/terms', consent: '/consent', marketing: '/marketing-consent' }

/** Hüquqi sənədlər: məxfilik siyasəti, istifadə şərtləri, fərdi məlumatların emalına razılıq, marketinq razılığı. */
export default function Privacy() {
  const { pathname } = useLocation()
  const docs = LEGAL[currentLang()]
  const id = (Object.keys(PATH) as LegalId[]).find((k) => PATH[k] === pathname) ?? 'privacy'
  const doc = docs.find((d) => d.id === id)!
  const Icon = ICON[id]
  return (
    <div className="noise relative min-h-dvh overflow-hidden bg-night text-white print:bg-panel print:text-black">
      <FuturisticBg floor={false} intensity={0.5} />
      <header className="relative z-30 mx-auto flex w-full max-w-5xl items-center justify-between px-4 pt-6 print:hidden">
        <Link to="/" aria-label={t.app.home}><Logo size={32} /></Link>
        <LangSwitch />
      </header>
      <div className="relative z-10 mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[240px_1fr]">
        <nav className="flex flex-row gap-2 overflow-x-auto lg:sticky lg:top-6 lg:flex-col lg:self-start print:hidden" aria-label={t.legal.docs}>
          {docs.map((d) => {
            const I = ICON[d.id]
            return (
              <Link key={d.id} to={PATH[d.id]} aria-current={d.id === id ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${d.id === id ? 'text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}
                style={d.id === id ? { background: 'var(--grad)' } : undefined}><I className="h-4 w-4" />{d.title}</Link>
            )
          })}
        </nav>
        <article className="glass-strong p-5 sm:p-10 print:border-0 print:bg-panel print:shadow-none">
          <div className="mb-6 flex flex-wrap items-start gap-3">
            <Icon className="h-8 w-8 shrink-0 text-orange-400 sm:h-9 sm:w-9" />
            <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
              <h1 className="break-words text-2xl font-black sm:text-3xl">{doc.title}</h1>
              <p className="mt-1 text-sm text-white/60 print:text-black/60">{doc.summary}</p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-white/45 print:text-black/50"><FileText className="h-3.5 w-3.5" />{t.legal.version}: {LEGAL_VERSION}</p>
              {t.legal.translationNote && <p className="mt-1 text-xs italic text-white/45 print:text-black/50">{t.legal.translationNote}</p>}
            </div>
            <button className="btn btn-ghost btn-sm print:hidden" onClick={() => window.print()}><Printer />{t.legal.print}</button>
          </div>
          {id === 'privacy' && (
            <div className="mb-8 rounded-2xl border border-orange-400/30 bg-orange-500/10 p-5 print:border-black/20 print:bg-transparent">
              <h2 className="mb-2 font-bold">{t.legal.forPlayers}</h2>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-white/80 print:text-black/80">{t.privacy.body.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
          )}
          <div className="flex flex-col gap-7 text-[15px] leading-relaxed text-white/80 print:text-black/85">
            {doc.sections.map((s) => (
              <section key={s.h}>
                <h2 className="mb-2 text-lg font-bold text-white print:text-black">{s.h}</h2>
                {s.p?.map((p) => <p key={p} className="mb-2">{p}</p>)}
                {s.list && <ul className="list-disc space-y-1.5 pl-5">{s.list.map((x) => <li key={x}>{x}</li>)}</ul>}
              </section>
            ))}
          </div>
        </article>
      </div>
    </div>
  )
}
