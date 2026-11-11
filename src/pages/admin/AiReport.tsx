import { useState } from 'react'
import { Loader2, Sparkles, Wand2 } from 'lucide-react'
import { currentLang, t } from '../../i18n/az'
import { aiGrade, aiInsights, AiError, type AiLang, type Insights } from '../../lib/ai'
import { PremiumBadge, useFeature } from '../../components/Premium'
import type { GameReportData } from '../../lib/report'

const lang = () => currentLang() as AiLang
const errText = (e: unknown) => (t.ai.errors as Record<string, string>)[e instanceof AiError ? e.code : 'ai-failed'] ?? t.ai.errors['ai-failed']

/** Oyundan sonra AI təhlili: zəif mövzular və təlimçi üçün növbəti addımlar (Pro+). */
export function AiInsightsPanel({ title, r }: { title: string; r: GameReportData }) {
  const allowed = useFeature('aiInsights')
  const [data, setData] = useState<Insights | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const run = async () => {
    setBusy(true); setErr('')
    try {
      setData(await aiInsights({
        lang: lang(), title, players: r.players.length,
        questions: r.qstats.filter((s) => s.answered > 0).map((s) => ({ text: s.q.text, correctPct: s.accuracy * 100, avgTimeS: s.avgTimeMs / 1000, topWrong: s.mostWrong ? [s.mostWrong] : [] })),
      }))
    } catch (e) { setErr(errText(e)) } finally { setBusy(false) }
  }
  const L = t.aiReport
  return (
    <section className="card mb-8 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ background: 'var(--grad)' }}><Sparkles className="h-5 w-5" /></span>
        <div className="mr-auto"><h2 className="text-lg font-bold">{L.title}</h2><p className="text-sm text-muted">{L.sub}</p></div>
        {allowed
          ? <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void run()}>{busy ? <Loader2 className="animate-spin" /> : <Wand2 />}{data ? L.again : L.run}</button>
          : <PremiumBadge feature="aiInsights" />}
      </div>
      {err && <p className="mt-3 text-sm font-semibold text-red-600" role="alert">{err}</p>}
      {data && (
        <div className="mt-4 grid gap-4 text-sm md:grid-cols-3">
          <p className="md:col-span-3">{data.summary}</p>
          {([['strengths', 'text-green-700'], ['gaps', 'text-amber-700'], ['actions', 'text-brand']] as const).map(([k, c]) => (
            <div key={k} className="rounded-xl bg-surface p-4">
              <h3 className={`mb-2 font-bold ${c}`}>{L[k]}</h3>
              <ul className="list-disc space-y-1 pl-4">{data[k].map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/** Açıq cavabların AI qiymətləndirməsi — təklifdir, yekun qərar təlimçinindir (Pro+). */
export function AiGradeOpen({ question, answers }: { question: string; answers: string[] }) {
  const allowed = useFeature('aiGrading')
  const [rubric, setRubric] = useState('')
  const [open, setOpen] = useState(false)
  const [res, setRes] = useState<{ id: string; score: number; feedback: string }[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const L = t.aiReport
  if (!answers.length) return null
  if (!allowed) return <p className="mt-3 flex items-center gap-2 text-sm text-muted">{L.grade} <PremiumBadge feature="aiGrading" /></p>
  const run = async () => {
    setBusy(true); setErr('')
    try { setRes((await aiGrade({ lang: lang(), question, rubric, answers: answers.slice(0, 200).map((a, i) => ({ id: String(i), text: a })) })).grades) }
    catch (e) { setErr(errText(e)) } finally { setBusy(false) }
  }
  return (
    <div className="mt-3">
      {!open ? <button className="btn btn-soft btn-sm" onClick={() => setOpen(true)}><Wand2 />{L.grade}</button> : (
        <div className="rounded-xl border border-line p-3">
          <label className="label" htmlFor={`rb-${question.length}`}>{L.rubric}</label>
          <textarea id={`rb-${question.length}`} className="input min-h-16 text-sm" maxLength={1000} placeholder={L.rubricPh} value={rubric} onChange={(e) => setRubric(e.target.value)} />
          <button className="btn btn-primary btn-sm mt-2" disabled={busy} onClick={() => void run()}>{busy ? <Loader2 className="animate-spin" /> : <Wand2 />}{L.gradeRun}</button>
          {err && <p className="mt-2 text-sm font-semibold text-red-600" role="alert">{err}</p>}
          {res && (
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {res.sort((a, b) => b.score - a.score).map((g) => (
                <li key={g.id} className="rounded-lg bg-surface p-2">
                  <div className="flex items-start justify-between gap-3"><span className="font-semibold">{answers[Number(g.id)]}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${g.score >= 70 ? 'bg-green-100 text-green-700' : g.score >= 40 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'}`}>{g.score}</span></div>
                  {g.feedback && <p className="mt-1 text-xs text-muted">{g.feedback}</p>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-muted">{L.gradeNote}</p>
        </div>
      )}
    </div>
  )
}
