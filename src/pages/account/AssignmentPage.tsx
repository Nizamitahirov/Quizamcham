import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { getDoc, doc } from 'firebase/firestore'
import { AlertTriangle, CalendarClock, CheckCircle2, FileText, MessageSquareText, Paperclip, Save, Send, Undo2 } from 'lucide-react'
import { db } from '../../firebase/config'
import { t } from '../../i18n/az'
import { fmtDateTime } from '../../lib/format'
import { useAccount } from '../../lib/account'
import { loadClass, mySubmission, saveSubmission, type ClassRow, type ClassTask, type FileRef, type Submission } from '../../lib/classes'
import { StudentShell } from '../../components/StudentShell'
import { EmptyState } from '../../components/kit'
import { Spinner } from '../../components/ui'
import { FileDrop, FileList } from '../../components/Files'
import { confirmDialog, toast } from '../../components/dialogs'

const A = t.asg
/** Mətndəki keçidləri kliklənən edir (təhlükəsiz: yalnız http/https). */
function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>"]+)/g)
  return <>{parts.map((p, i) => (/^https?:\/\//.test(p) ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="break-all text-orange-300 underline">{p}</a> : <span key={i}>{p}</span>))}</>
}

/** Tələbə: sinif tapşırığı — təlimat, materiallar, öz işi (mətn + fayllar), təhvil / geri götürmə, qiymət və rəy. */
export default function AssignmentPage() {
  const { cid = '', tid = '' } = useParams()
  const { loading, user, profile } = useAccount()
  const [cls, setCls] = useState<ClassRow | null>(null)
  const [task, setTask] = useState<ClassTask | null | undefined>(undefined)
  const [sub, setSub] = useState<Submission | null>(null)
  const [text, setText] = useState('')
  const [files, setFiles] = useState<FileRef[]>([])
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    if (!user || user.isAnonymous) return
    void (async () => {
      const [c, tk, s] = await Promise.all([
        loadClass(cid).catch(() => null),
        getDoc(doc(db, 'classes', cid, 'tasks', tid)).then((d) => (d.exists() ? ({ id: d.id, ...(d.data() as Omit<ClassTask, 'id'>) }) : null)).catch(() => null),
        mySubmission(cid, tid).catch(() => null),
      ])
      setCls(c); setTask(tk && tk.kind === 'assignment' ? tk : null); setSub(s)
      setText(s?.text ?? ''); setFiles(s?.files ?? [])
    })()
  }, [user, cid, tid])
  // saxlanmamış dəyişiklik varsa səhifədən çıxarkən xəbərdarlıq
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])
  if (loading) return <div className="bg-app flex min-h-dvh items-center justify-center"><Spinner /></div>
  if (!user || user.isAnonymous) return <Navigate to={`/start?next=${encodeURIComponent(`/learn/class/${cid}/task/${tid}`)}`} replace />
  const name = profile ? `${profile.firstName} ${profile.lastName}`.trim() : user.displayName ?? ''

  const points = task?.points ?? 100
  const due = task?.dueAt?.toDate() ?? null
  const pastDue = !!due && Date.now() > due.getTime()
  const closed = pastDue && task?.allowLate === false
  const status = sub?.status ?? 'draft'
  const turned = status === 'submitted' || status === 'returned'
  const editable = !turned && !closed

  const persist = async (next: 'draft' | 'submitted') => {
    if (!task) return
    if (next === 'submitted') {
      if (!text.trim() && !files.length) { toast(A.empty, 'error'); return }
      if (!(await confirmDialog({ title: A.confirmTurnIn, body: A.confirmTurnInBody, ok: A.turnIn }))) return
    }
    setBusy(true)
    try {
      await saveSubmission(cid, task, name, { text, files }, next)
      const s = await mySubmission(cid, tid)
      setSub(s); setDirty(false)
      toast(next === 'submitted' ? A.turnedInOk : A.saved)
    } catch { toast(closed ? A.closed : t.app.error, 'error') } finally { setBusy(false) }
  }
  const unsubmit = async () => {
    if (!task) return
    setBusy(true)
    try { await saveSubmission(cid, task, name, { text, files }, 'draft'); setSub(await mySubmission(cid, tid)) } catch { toast(t.app.error, 'error') } finally { setBusy(false) }
  }

  return (
    <StudentShell back="/learn" title={cls?.name} width="max-w-5xl">
      {task === undefined ? <Spinner /> : !task ? <EmptyState icon={FileText} title={A.notFound} /> : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <article className="card hairline-top min-w-0 p-6 sm:p-7">
            <div className="flex items-start gap-4">
              <span className="icon-tile h-12 w-12"><FileText className="h-5 w-5" /></span>
              <div className="min-w-0">
                <h1 className="break-words text-2xl font-extrabold">{task.title}</h1>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  {cls?.ownerName && <span className="chip chip-muted">{A.teacher}: {cls.ownerName}</span>}
                  <span className="chip chip-muted">{A.pts(points)}</span>
                  <span className={`chip ${pastDue ? 'chip-bad' : 'chip-muted'}`}><CalendarClock className="h-3 w-3" />{due ? A.due(fmtDateTime(due)) : A.noDue}</span>
                </div>
              </div>
            </div>
            {task.description && <div className="mt-6 whitespace-pre-wrap break-words leading-relaxed text-fg2"><Linkify text={task.description} /></div>}
            {!!task.attachments?.length && (
              <div className="mt-6">
                <p className="label flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5" />{A.materials}</p>
                <FileList files={task.attachments} />
              </div>
            )}
          </article>

          <aside className="flex min-w-0 flex-col gap-4">
            <section className="card p-5">
              <div className="mb-3 flex items-center gap-2">
                <h2 className="mr-auto text-base font-bold">{A.yourWork}</h2>
                {status === 'returned' && sub?.grade != null ? <span className="chip chip-ok text-sm">{A.gradeShow(sub.grade, points)}</span>
                  : turned ? <span className="chip chip-info"><CheckCircle2 className="h-3 w-3" />{A.status[sub?.late ? 'late' : 'submitted']}</span>
                  : pastDue ? <span className="chip chip-bad">{A.status.none}</span> : null}
              </div>
              {turned && sub?.submittedAt && <p className="mb-3 text-xs text-muted">{A.submittedAt(fmtDateTime(sub.submittedAt.toDate()))}</p>}
              {editable ? (
                <div className="flex flex-col gap-3">
                  <textarea className="input min-h-36 text-sm" maxLength={20000} placeholder={A.answerPh} value={text} onChange={(e) => { setText(e.target.value); setDirty(true) }} />
                  <FileList files={files} compact onRemove={(f) => { setFiles((x) => x.filter((y) => y.id !== f.id)); setDirty(true) }} />
                  <FileDrop classId={cid} kind="submission" taskId={tid} count={files.length} onUploaded={(f) => { setFiles((x) => [...x, f]); setDirty(true) }} />
                  {pastDue && <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-300"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{A.lateWarn}</p>}
                  <button className="btn btn-primary w-full" disabled={busy} onClick={() => void persist('submitted')}><Send />{A.turnIn}</button>
                  <button className="btn btn-ghost-dark w-full" disabled={busy || !dirty} onClick={() => void persist('draft')}><Save />{A.saveDraft}</button>
                </div>
              ) : closed && !turned ? (
                <p className="flex items-start gap-2 rounded-xl bg-red-500/10 px-3 py-3 text-sm text-red-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{A.closed}</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {sub?.text && <div className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-line bg-panel p-3 text-sm scrollbar-thin">{sub.text}</div>}
                  <FileList files={sub?.files ?? []} compact />
                  {(!closed || status === 'returned') && <button className="btn btn-secondary w-full" disabled={busy} onClick={() => void unsubmit()}><Undo2 />{A.unsubmit}</button>}
                  {status === 'returned' && <p className="text-center text-xs text-muted">{A.resubmitHint}</p>}
                </div>
              )}
            </section>
            {status === 'returned' && sub?.feedback && (
              <section className="card p-5">
                <h2 className="mb-2 flex items-center gap-2 text-base font-bold"><MessageSquareText className="h-4 w-4 text-orange-300" />{A.teacherFeedback}</h2>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-fg2">{sub.feedback}</p>
              </section>
            )}
          </aside>
        </div>
      )}
    </StudentShell>
  )
}
