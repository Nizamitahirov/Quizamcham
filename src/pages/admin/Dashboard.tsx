import { useEffect, useMemo, useState } from 'react'
import { fmtDateTime } from '../../lib/format'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { Timestamp } from 'firebase/firestore'
import { ArrowRight, Bot, Gamepad2, ListChecks, Plus, QrCode, Target, Users, Sparkles } from 'lucide-react'
import { createQuiz, listGames, listQuizzes, parseQuizJson } from '../../firebase/db'
import { t } from '../../i18n/az'
import { Spinner } from '../../components/ui'
import { QRDownload } from '../../components/QRBlock'
import { AiImport } from '../../components/AiImport'
import { TemplateGallery } from '../../components/ImportModals'
import type { AdminState } from '../../firebase/auth'
import { orgGamesScope, orgScope, scopeUid, visibleGames } from '../../lib/access'
import { runMaintenance } from '../../lib/maintenance'
import type { GameStats, Phase } from '../../types'

type G = { id: string; hostUid?: string; title?: string; pin?: string; playerCount?: number; phase?: Phase; createdAt?: Timestamp; stats?: GameStats | null }

export default function Dashboard() {
  const admin = useOutletContext<AdminState>()
  const { user } = admin
  const nav = useNavigate()
  const [quizCount, setQuizCount] = useState<number | null>(null)
  const [games, setGames] = useState<G[] | null>(null)
  const [ai, setAi] = useState(false)
  const [maint, setMaint] = useState('')
  const [tpl, setTpl] = useState(false)
  useEffect(() => {
    void listQuizzes(scopeUid(admin), admin.perms.library, orgScope(admin)).then((q) => setQuizCount(q.length)).catch(() => setQuizCount(0))
    const load = () => void listGames(200, scopeUid(admin), orgGamesScope(admin)).then((g) => setGames(visibleGames(admin, g as G[]))).catch(() => setGames([]))
    load()
    // baxım: sessiyada bir dəfə
    try {
      if (user && !sessionStorage.getItem('qz.maint')) {
        sessionStorage.setItem('qz.maint', '1')
        void runMaintenance(user.uid).then((n) => { if (n) { setMaint(t.admin.maintained(n)); load() } })
      }
    } catch { /* noop */ }
  }, [admin, user])
  const kpi = useMemo(() => {
    const gs = games ?? []
    const players = gs.reduce((s, g) => s + (g.playerCount ?? 0), 0)
    const acc = gs.filter((g) => g.stats?.avgAccuracy != null)
    return { games: gs.length, players, accuracy: acc.length ? Math.round((acc.reduce((s, g) => s + (g.stats!.avgAccuracy ?? 0), 0) / acc.length) * 100) : 0 }
  }, [games])
  const importData = async (raw: unknown) => {
    const { quiz, questions } = parseQuizJson(raw)
    nav(`/admin/quiz/${await createQuiz(user!.uid, quiz, questions)}`)
  }
  const name = (user?.email ?? '').split('@')[0]
  const cards = [
    { icon: ListChecks, label: t.admin.kpiQuizzes, value: quizCount ?? '–' },
    { icon: Gamepad2, label: t.admin.kpiGames, value: games ? kpi.games : '–' },
    { icon: Users, label: t.admin.kpiPlayers, value: games ? kpi.players : '–' },
    { icon: Target, label: t.admin.kpiAccuracy, value: games ? `${kpi.accuracy}%` : '–' },
  ]
  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-8">
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="noise relative mb-6 overflow-hidden rounded-3xl bg-night p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full opacity-60 blur-3xl" style={{ background: '#FF7A1A' }} />
        <div className="pointer-events-none absolute -bottom-28 left-10 h-72 w-72 rounded-full opacity-50 blur-3xl" style={{ background: '#E8202A' }} />
        <div className="relative flex flex-wrap items-center gap-6">
          <div className="mr-auto min-w-0 max-w-full">
            <h1 className="break-words text-2xl font-black sm:text-3xl">{t.admin.welcome(name)}</h1>
            <p className="mt-1 text-white/65">{t.admin.welcomeSub}</p>
          </div>
          {admin.perms.createQuiz && (
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={async () => nav(`/admin/quiz/${await createQuiz(user!.uid, { title: t.admin.untitled })}`)}><Plus />{t.admin.newQuiz}</button>
              <button className="btn btn-ghost" onClick={() => setAi(true)}><Bot />AI</button>
            </div>
          )}
        </div>
      </motion.section>

      {maint && <p className="mb-4 rounded-xl bg-green-500/10 px-4 py-2 text-sm font-semibold text-green-300" role="status">{maint}</p>}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }} className="card p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-brand" style={{ background: 'var(--grad-soft)' }}><c.icon className="h-5 w-5" /></div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">{c.label}</div>
            <div className="mt-1 text-3xl font-black tracking-tight">{c.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">{t.admin.recentGames}</h2>
            <Link to="/admin/games" className="flex items-center gap-1 text-sm font-semibold text-brand">{t.admin.seeAll}<ArrowRight className="h-4 w-4" /></Link>
          </div>
          {!games ? <Spinner /> : games.length === 0 ? <p className="py-8 text-center text-sm text-muted">{t.games.empty}</p> : (
            <ul className="divide-y divide-line">
              {games.slice(0, 6).map((g) => (
                <li key={g.id}>
                  <Link to={g.phase === 'finished' ? `/admin/games/${g.id}` : `/host/${g.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: 'var(--grad)' }}><Gamepad2 className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{g.title}</span>
                      <span className="text-xs text-muted">{g.createdAt ? fmtDateTime(g.createdAt.toDate()) : ''} · PIN {g.pin}</span>
                    </span>
                    <span className="flex items-center gap-1 text-sm font-semibold text-muted"><Users className="h-4 w-4" />{g.playerCount ?? 0}</span>
                    {g.phase !== 'finished' ? <span className="chip bg-green-500/15 text-green-300">{t.admin.live}</span> : g.stats && <span className="chip bg-surface text-fg2">{Math.round((g.stats.avgAccuracy ?? 0) * 100)}%</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <div className="card p-5">
            <h2 className="mb-4 text-lg font-bold">{t.admin.quickActions}</h2>
            <div className="flex flex-col gap-2">
              {admin.perms.createQuiz && <button className="btn btn-secondary justify-start" onClick={() => setAi(true)}><Bot className="text-brand" />{t.admin.aiTitle}</button>}
              {admin.perms.createQuiz && <button className="btn btn-secondary justify-start" onClick={() => setTpl(true)}><Sparkles className="text-brand" />{t.templates.title}</button>}
              <Link className="btn btn-secondary justify-start" to="/admin/quizzes"><ListChecks className="text-brand" />{t.admin.quizzes}</Link>
            </div>
          </div>
          <div className="card p-5">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold"><QrCode className="h-5 w-5 text-brand" />{t.admin.permanentQr}</h2>
            <p className="mb-3 text-sm text-muted">{t.admin.permanentQrHint}</p>

            <code className="mb-3 block truncate rounded-lg bg-surface px-3 py-2 text-sm">{`${window.location.origin}/play?t=${user?.uid}`}</code>
            <QRDownload url={`${window.location.origin}/play?t=${user?.uid}`} filename="jabr-play-qr.png" label={t.admin.downloadQr} className="btn btn-primary w-full" />
          </div>
        </section>
      </div>
      <AiImport open={ai} onClose={() => setAi(false)} onImport={importData} />
      <TemplateGallery open={tpl} onClose={() => setTpl(false)} onPick={async (raw) => { if (raw) await importData(raw); else nav(`/admin/quiz/${await createQuiz(user!.uid, { title: t.admin.untitled })}`) }} />
    </div>
  )
}
