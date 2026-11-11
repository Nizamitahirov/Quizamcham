import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NewTypeReveal } from '../../components/NewTypeReveal'
import { parseBlanks } from '../../lib/scoring'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, Award, CheckCircle2, Clock, Flag, RotateCcw, Trophy, X, XCircle } from 'lucide-react'
import { loadCatalogItem, reportQuiz, saveAttempt, useAccount, type CatalogItem, type ReportReason } from '../../lib/account'
import { toPublic } from '../../lib/gameEngine'
import { evaluateAnswer, SCORED_TYPES } from '../../lib/scoring'
import { LOCALE, t } from '../../i18n/az'
import { FuturisticBg } from '../../components/FuturisticBg'
import { Logo } from '../../components/Brand'
import { Spinner } from '../../components/ui'
import { AnswerTile } from '../../components/AnswerTile'
import { QuestionInput } from '../player/QuestionInputs'
import { burst } from '../../components/Confetti'
import { audio } from '../../audio/AudioEngine'
import type { AnswerValue, Question } from '../../types'

const A = t.acct
interface Result { qi: number; correct: boolean; points: number; scored: boolean; timedOut: boolean }

/** İctimai quiz üzrə limitsiz məşq: hər sualdan sonra düzgün cavab və izah, sonda nəticə yadda saxlanılır. */
export default function Practice() {
  const { quizId } = useParams()
  const { loading, user } = useAccount()
  const [item, setItem] = useState<CatalogItem | null | undefined>(undefined)
  const [round, setRound] = useState(0) // "Yenidən keç" üçün
  useEffect(() => { if (user && quizId) void loadCatalogItem(quizId).then(setItem).catch(() => setItem(null)) }, [user, quizId])

  if (loading) return <Shell><div className="m-auto"><Spinner /></div></Shell>
  if (!user) return <Navigate to={`/start?next=/learn/${quizId}`} replace />
  if (item === undefined) return <Shell><div className="m-auto"><Spinner /></div></Shell>
  // gizlədilmiş / yoxlamadakı quiz yalnız müəllifinə açılır
  if (item && (item.hidden || item.status === 'review') && item.publishedBy !== user.uid) return <Shell><div className="glass m-auto max-w-md p-8 text-center"><p className="mb-4">{A.notFound}</p><Link to="/learn" className="btn btn-primary"><ArrowLeft />{A.toCatalog}</Link></div></Shell>
  if (item === null) return <Shell><div className="glass m-auto max-w-md p-8 text-center"><p className="mb-4">{A.notFound}</p><Link to="/learn" className="btn btn-primary"><ArrowLeft />{A.toCatalog}</Link></div></Shell>
  return <Shell title={item.title} report={<ReportButton quizId={item.id} />}><Run key={round} item={item} uid={user.uid} onRetry={() => setRound((r) => r + 1)} /></Shell>
}

function Shell({ children, title, report }: { children: React.ReactNode; title?: string; report?: React.ReactNode }) {
  return (
    <div className="noise relative flex min-h-dvh flex-col overflow-hidden bg-night text-white">
      <FuturisticBg floor={false} intensity={0.5} />
      <header className="relative z-10 mx-auto flex w-full max-w-3xl items-center gap-3 px-4 pt-5">
        <Link to="/learn" className="btn btn-ghost btn-icon" aria-label={A.toCatalog}><ArrowLeft className="h-4 w-4" /></Link>
        <Logo size={28} />
        {title && <span className="ml-2 truncate text-sm font-semibold text-white/65">{title}</span>}
        {report && <span className="ml-auto">{report}</span>}
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">{children}</main>
    </div>
  )
}

function Run({ item, uid, onRetry }: { item: CatalogItem; uid: string; onRetry: () => void }) {
  const [params] = useSearchParams()
  const { profile } = useAccount()
  const ctx = { classId: params.get('class'), taskId: params.get('task'), courseId: params.get('course'), name: profile ? `${profile.firstName} ${profile.lastName}`.trim() : '' }
  const qs = item.questions
  const [i, setI] = useState(0)
  const [results, setResults] = useState<Result[]>([])
  const [answered, setAnswered] = useState<Result | null>(null)
  const [left, setLeft] = useState(qs[0]?.timeLimit * 1000 || 30000)
  const started = useRef(Date.now())
  const qStart = useRef(Date.now())
  const savedRef = useRef(false)
  const [elapsed, setElapsed] = useState(0)
  const q: Question | undefined = qs[i]
  const pub = useMemo(() => (q ? toPublic(q, { shuffleOptions: true } as never) : null), [q])
  const finished = i >= qs.length

  const submit = useCallback((v: AnswerValue | null, timedOut = false) => {
    if (!q || answered) return
    const ev = evaluateAnswer(q, v, Date.now() - qStart.current, 'speed')
    const r = { qi: i, correct: ev.correct, points: ev.points, scored: ev.scored, timedOut }
    setAnswered(r)
    setResults((x) => [...x, r])
    if (ev.scored) { if (ev.correct) { audio.correct(); burst(0.6) } else audio.wrong() }
  }, [q, answered, i])

  // vaxt sayğacı
  useEffect(() => {
    if (!q || answered || q.type === 'slide') return
    qStart.current = Date.now()
    const total = q.timeLimit * 1000
    setLeft(total)
    const id = setInterval(() => {
      const l = total - (Date.now() - qStart.current)
      setLeft(l)
      if (l <= 0) { clearInterval(id); submit(null, true) }
    }, 200)
    return () => clearInterval(id)
  }, [q, answered, submit])

  const next = () => { setAnswered(null); setI((x) => x + 1) }

  const scoredRes = results.filter((r) => r.scored)
  const correct = scoredRes.filter((r) => r.correct).length
  const total = qs.filter((x) => SCORED_TYPES.has(x.type)).length
  const score = scoredRes.reduce((s, r) => s + r.points, 0)
  useEffect(() => {
    if (!finished || savedRef.current || total === 0) return
    savedRef.current = true
    const durationMs = Date.now() - started.current
    setElapsed(durationMs)
    void saveAttempt({ quizId: item.id, quizTitle: item.title.slice(0, 120), correct, total, score, durationMs }).catch(() => {})
    // sinif tapşırığı və ya kurs daxilində açılıbsa — nəticə müəllimə / irəliləyiş kursa
    void (async () => {
      const { saveClassResult, loadCourse, markCourseItem } = await import('../../lib/classes')
      const name = ctx.name || ''
      if (ctx.classId && ctx.taskId) await saveClassResult(ctx.classId, ctx.taskId, name, { score, correct, total }).catch(() => {})
      if (ctx.courseId && correct / total >= 0.5) { const c = await loadCourse(ctx.courseId).catch(() => null); if (c) await markCourseItem(c, item.id, name).catch(() => {}) }
    })()
    if (correct / total >= 0.7) burst(1.2)
  }, [finished, correct, total, score, item])

  if (finished) {
    const p = total ? Math.round((correct / total) * 100) : 0
    const secs = Math.round(elapsed / 1000)
    return (
      <div className="m-auto flex w-full max-w-lg flex-col items-center gap-5 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-3xl" style={{ background: 'var(--grad)', boxShadow: 'var(--glow)' }}><Trophy className="h-10 w-10" /></span>
        <h1 className="text-3xl font-black">{A.done}</h1>
        <div className="grid w-full grid-cols-3 gap-3">
          {[{ l: A.accuracy, v: `${p}%` }, { l: A.score, v: score.toLocaleString(LOCALE) }, { l: A.time, v: `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` }].map((s) => (
            <div key={s.l} className="glass p-4"><div className="font-display text-2xl font-black tabular-nums">{s.v}</div><div className="text-xs font-semibold text-white/55">{s.l}</div></div>
          ))}
        </div>
        <p className="text-white/65">{correct}/{total}</p>
        {p >= 70 && <CertButton item={item} score={score} correct={correct} total={total} />}
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <button className="btn btn-primary btn-lg flex-1" onClick={onRetry}><RotateCcw />{A.retry}</button>
          {ctx.courseId
            ? <Link to={`/learn/course/${ctx.courseId}`} className="btn btn-ghost btn-lg flex-1"><ArrowLeft />{t.course.back}</Link>
            : <Link to="/learn" className="btn btn-ghost btn-lg flex-1"><ArrowLeft />{A.toCatalog}</Link>}
        </div>
      </div>
    )
  }
  if (!q || !pub) return null

  const frac = q.type === 'slide' ? 1 : Math.max(0, left / (q.timeLimit * 1000))
  const correctOpts = (q.options ?? []).map((o, idx) => ({ o, idx })).filter(({ o }) => q.correct.includes(o.id))
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="chip chip-dark">{A.qOf(i + 1, qs.length)}</span>
        {q.type !== 'slide' && (
          <>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${(answered ? 0 : frac) * 100}%`, background: left < 5000 ? '#ef4444' : 'var(--grad)' }} /></div>
            <span className="flex w-12 items-center justify-end gap-1 text-sm font-black tabular-nums"><Clock className="h-3.5 w-3.5" />{answered ? '–' : Math.max(0, Math.ceil(left / 1000))}</span>
          </>
        )}
      </div>
      {q.type !== 'fill' && <h2 className="font-display text-center text-2xl font-black leading-snug">{q.text}</h2>}
      {q.imageUrl && q.type !== 'hotspot' && <img src={q.imageUrl} alt="" className="mx-auto max-h-48 rounded-2xl object-contain" />}

      {q.type === 'slide' ? (
        <div className="mt-auto flex flex-col gap-4 text-center">
          {q.explanation && <p className="text-lg text-white/80">{q.explanation}</p>}
          <button className="btn btn-primary btn-lg" onClick={next}>{A.nextQ}<ArrowRight /></button>
        </div>
      ) : !answered ? (
        <div className="mt-auto"><QuestionInput q={pub} uid={uid} disabled={false} onSubmit={(v) => submit(v)} /></div>
      ) : (
        <div className="mt-auto flex flex-col gap-3">
          <div className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xl font-black ${answered.correct ? 'bg-green-500/20 text-green-200' : 'bg-red-500/20 text-red-200'}`} role="status">
            {answered.correct ? <CheckCircle2 /> : <XCircle />}{answered.timedOut ? A.timeUp : answered.correct ? A.correct : A.wrong}
            {answered.points > 0 && <span className="ml-2 text-base">+{answered.points}</span>}
          </div>
          {!answered.correct && (
            <div className="glass p-3">
              <p className="label-dark">{A.rightAnswer}</p>
              {q.type === 'order' ? <ol className="list-decimal pl-6 font-bold">{q.correct.map((id) => <li key={id}>{q.options.find((o) => o.id === id)?.text}</li>)}</ol>
                : q.type === 'type' ? <p className="text-lg font-black">{(q.accepted ?? []).filter(Boolean).join(' · ')}</p>
                  : q.type === 'slider' ? <p className="font-display text-2xl font-black">{q.slider?.answer}</p>
                    : q.type === 'match' || q.type === 'fill' || q.type === 'hotspot' ? <NewTypeReveal type={q.type} rv={{ pairs: q.options.map((o) => ({ left: o.text, right: o.pair ?? '' })), blanks: parseBlanks(q.text).answers, hotspot: q.hotspot }} imageUrl={q.imageUrl} />
                    : <div className="flex flex-col gap-2">{correctOpts.map(({ o, idx }) => <AnswerTile key={o.id} index={idx} text={o.text} disabled />)}</div>}
            </div>
          )}
          {q.explanation && <div className="glass p-3 text-sm leading-relaxed"><b className="text-orange-300">💡 {A.explanation}:</b> {q.explanation}</div>}
          <button className="btn btn-primary btn-lg" onClick={next}>{i + 1 >= qs.length ? A.finishQ : A.nextQ}<ArrowRight /></button>
        </div>
      )}
    </div>
  )
}

/** Məşqi ≥70% ilə bitirənə sertifikat (PNG). */
function CertButton({ item, score, correct, total }: { item: CatalogItem; score: number; correct: number; total: number }) {
  const { profile } = useAccount()
  const [busy, setBusy] = useState(false)
  const name = profile ? `${profile.firstName} ${profile.lastName}` : ''
  const make = async () => {
    setBusy(true)
    try {
      const { renderCertificate } = await import('../../lib/shareCard')
      const blob = await renderCertificate(
        { name, quiz: item.title, place: 0, total: 0, score, trainer: item.author, date: new Date() },
        { title: t.cert.title, given: t.cert.given, completed: `${A.certFor} · ${correct}/${total}`, place: '', score: t.cert.score(score.toLocaleString(LOCALE)), trainer: t.cert.trainer, date: t.cert.date },
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `jabr-certificate-${item.id}.png`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } finally { setBusy(false) }
  }
  return <button className="btn btn-ghost w-full" disabled={busy || !name} onClick={() => void make()}><Award />{A.certificate}</button>
}

/** Tələbə şikayəti: səbəb + qeyd. 3 şikayətdən sonra quiz avtomatik gizlədilir və moderatora düşür. */
function ReportButton({ quizId }: { quizId: string }) {
  const M = t.mod
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason>('language')
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'already' | 'error'>('idle')
  const send = async () => {
    setState('busy')
    try { setState(await reportQuiz(quizId, reason, note)) } catch { setState('error') }
  }
  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => { setOpen(true); setState('idle') }}><Flag className="h-4 w-4" />{M.report}</button>
      {open && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="rep-title" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-3xl bg-white p-5 text-ink shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <h2 id="rep-title" className="text-lg font-bold">{M.reportTitle}</h2>
              <button className="btn btn-ghost-dark btn-icon -m-1" aria-label={t.app.close} onClick={() => setOpen(false)}><X /></button>
            </div>
            {state === 'ok' || state === 'already' ? (
              <p className="py-4 text-center font-semibold text-green-700">{state === 'ok' ? M.thanks : M.already}</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  {(Object.keys(M.reasons) as ReportReason[]).map((r) => (
                    <label key={r} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2.5 has-[:checked]:border-brand has-[:checked]:bg-red-50">
                      <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
                      <span>{M.reasons[r]}</span>
                    </label>
                  ))}
                </div>
                <label className="mt-3 block text-sm font-semibold" htmlFor="rep-note">{M.note}</label>
                <textarea id="rep-note" className="input mt-1 h-20 w-full" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
                {state === 'error' && <p role="alert" className="mt-2 text-sm text-red-700">{t.app.error}</p>}
                <button className="btn btn-primary mt-4 w-full" disabled={state === 'busy'} onClick={() => void send()}>{M.send}</button>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
