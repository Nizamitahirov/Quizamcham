import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BookOpen, CalendarClock, CheckCircle2, ClipboardList, FileText, Gamepad2, GraduationCap, LogIn, LogOut, Play } from 'lucide-react'
import { t } from '../../i18n/az'
import { fmtDate } from '../../lib/format'
import { joinClass, leaveClass, listTasks, loadClass, myMemberships, myResults, mySubmissions, normCode, type ClassResult, type ClassTask, type Membership, type Submission } from '../../lib/classes'
import { confirmDialog, toast } from '../../components/dialogs'
import { Progress } from '../../components/kit'
import { SectionTitle } from '../../components/StudentShell'

const C = t.cls
const C2 = t.cls2
const KIND_ICON = { practice: ClipboardList, course: BookOpen, game: Gamepad2, assignment: FileText } as const

/** Tələbə: siniflərim — kodla qoşulma (və ya ?join=KOD linki), tapşırıqlar və öz nəticələri. */
export function MyClasses({ name, email }: { name: string; email: string }) {
  const [params, setParams] = useSearchParams()
  const [rows, setRows] = useState<Membership[] | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const [tasks, setTasks] = useState<Record<string, ClassTask[]>>({})
  const [res, setRes] = useState<Record<string, ClassResult[]>>({})
  const [subs, setSubs] = useState<Record<string, Submission[]>>({})
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const reload = useCallback(async () => {
    const m = await myMemberships().catch(() => [] as Membership[])
    setRows(m)
    const tk: Record<string, ClassTask[]> = {}, rs: Record<string, ClassResult[]> = {}, nm: Record<string, string> = {}
    await Promise.all(m.map(async (x) => {
      tk[x.classId] = await listTasks(x.classId).catch(() => [])
      const sb = tk[x.classId].some((y) => y.kind === 'assignment') ? await mySubmissions(x.classId) : []
      setSubs((p) => ({ ...p, [x.classId]: sb }))
      rs[x.classId] = await myResults(x.classId).catch(() => [])
      nm[x.classId] = (await loadClass(x.classId).catch(() => null))?.name ?? x.className
    }))
    setTasks(tk); setRes(rs); setNames(nm)
  }, [])
  const join = useCallback(async (raw: string) => {
    const c = normCode(raw)
    if (c.length !== 6) return
    setBusy(true); setErr('')
    try { const r = await joinClass(c, name, email); toast(C.joined(r.name)); setCode(''); await reload() }
    catch { setErr(C.notFound) } finally { setBusy(false) }
  }, [name, email, reload])
  useEffect(() => { void reload() }, [reload])
  // ?join=KOD — müəllimin paylaşdığı link
  useEffect(() => {
    let j = params.get('join')
    try { j = j ?? sessionStorage.getItem('jabr.join'); sessionStorage.removeItem('jabr.join') } catch { /* noop */ }
    if (!j) return
    if (params.has('join')) { params.delete('join'); setParams(params, { replace: true }) }
    void join(j)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const leave = async (m: Membership) => { if (await confirmDialog({ title: `${C.leave}: ${names[m.classId] ?? m.className}?`, danger: true, ok: C.leave })) void leaveClass(m.classId).then(reload) }

  const joinForm = (
    <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void join(code) }}>
      <label className="sr-only" htmlFor="jc">{C.joinTitle}</label>
      <input id="jc" className="input h-10 min-h-10 w-36 text-center font-mono uppercase tracking-[.3em] placeholder:tracking-normal" placeholder="ABC123" value={code} maxLength={8}
        onChange={(e) => { setCode(normCode(e.target.value)); setErr('') }} aria-invalid={!!err} aria-describedby={err ? 'jc-err' : undefined} />
      <button className="btn btn-primary btn-sm h-10" disabled={busy || code.length !== 6}><LogIn />{C.join}</button>
    </form>
  )
  return (
    <section>
      <SectionTitle icon={GraduationCap} aside={joinForm}>{C.mine}</SectionTitle>
      {err && <p id="jc-err" role="alert" className="-mt-2 mb-3 text-right text-sm font-medium text-red-300">{err}</p>}
      {rows && rows.length === 0 && (
        <div className="card flex flex-col items-center gap-2 border-dashed px-6 py-8 text-center">
          <GraduationCap className="h-6 w-6 text-muted" />
          <p className="text-sm text-muted">{C.joinTitle}: {C.joinPh}</p>
        </div>
      )}
      {rows && rows.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((m) => {
            const list = tasks[m.classId] ?? []
            const mine = res[m.classId] ?? []
            const practice = list.filter((x) => x.kind === 'practice')
            const doneN = practice.filter((x) => mine.some((r) => r.taskId === x.id)).length
            return (
              <div key={m.classId} className="card flex flex-col overflow-hidden">
                <div className="flex items-center gap-3 border-b border-line px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-sans text-base font-semibold">{names[m.classId] ?? m.className}</h3>
                    {practice.length > 0 && (
                      <div className="mt-2 flex items-center gap-3"><Progress value={(doneN / practice.length) * 100} className="max-w-48 flex-1" /><span className="text-xs text-muted tabular">{C2.done(doneN, practice.length)}</span></div>
                    )}
                  </div>
                  <button className="btn btn-ghost-dark btn-icon btn-sm hover:text-red-300" title={C.leave} aria-label={C.leave} onClick={() => void leave(m)}><LogOut /></button>
                </div>
                {list.length === 0 ? <p className="px-5 py-6 text-sm text-muted">{C.noTasks}</p> : (
                  <ul className="divide-y divide-line">
                    {list.map((x) => {
                      const sub = x.kind === 'assignment' ? (subs[m.classId] ?? []).find((y) => y.taskId === x.id) : undefined
                      const turned = !!sub && sub.status !== 'draft'
                      const r = mine.find((y) => y.taskId === x.id)
                      const Icon = KIND_ICON[x.kind]
                      const late = !r && !turned && x.dueAt && x.dueAt.toMillis() < Date.now()
                      const href = x.kind === 'assignment' ? `/learn/class/${m.classId}/task/${x.id}` : x.kind === 'practice' ? `/learn/${x.quizId}?class=${m.classId}&task=${x.id}` : x.kind === 'course' ? `/learn/course/${x.courseId}` : `/join?pin=${x.pin}`
                      return (
                        <li key={x.id} className="flex items-center gap-3 px-5 py-3">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${r || turned ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-line bg-white/[.03] text-orange-300'}`}>{r || turned ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</span>
                          <div className="min-w-0 flex-1">
                            <div className="break-words text-sm font-semibold">{x.title}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                              {sub?.status === 'returned' && sub.grade != null ? <span className="chip chip-ok">{t.asg.gradeShow(sub.grade, x.points ?? 100)}</span>
                                : turned ? <span className="chip chip-info">{t.asg.status[sub!.late ? 'late' : 'submitted']}</span>
                                : r ? <span className="chip chip-ok">{C.yourScore(r.pct)}</span>
                                : late ? <span className="chip chip-bad"><CalendarClock className="h-3 w-3" />{C2.overdue}</span>
                                : x.dueAt ? <span className="chip chip-muted"><CalendarClock className="h-3 w-3" />{fmtDate(x.dueAt.toDate())}</span> : null}
                              {x.note && <span className="truncate text-muted">{x.note}</span>}
                            </div>
                          </div>
                          <Link to={href} className={`btn btn-sm ${r || turned ? 'btn-secondary' : 'btn-primary'}`}>{x.kind === 'assignment' ? <><FileText />{t.asg.open}</> : <><Play className="fill-current" />{x.kind === 'course' ? C.openCourse : x.kind === 'game' ? C.openGame : r ? t.acct.again : C.start}</>}</Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
