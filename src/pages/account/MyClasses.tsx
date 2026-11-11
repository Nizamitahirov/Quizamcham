import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BookOpen, ClipboardList, Gamepad2, GraduationCap, LogIn, Play } from 'lucide-react'
import { t } from '../../i18n/az'
import { fmtDate } from '../../lib/format'
import { joinClass, leaveClass, listTasks, myMemberships, myResults, normCode, type ClassResult, type ClassTask, type Membership } from '../../lib/classes'

const C = t.cls

/** Tələbə: siniflərim — kodla qoşulma (və ya ?join=KOD linki), tapşırıqlar və öz nəticələri. */
export function MyClasses({ name, email }: { name: string; email: string }) {
  const [params, setParams] = useSearchParams()
  const [rows, setRows] = useState<Membership[] | null>(null)
  const [tasks, setTasks] = useState<Record<string, ClassTask[]>>({})
  const [res, setRes] = useState<Record<string, ClassResult[]>>({})
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const reload = useCallback(async () => {
    const m = await myMemberships().catch(() => [] as Membership[])
    setRows(m)
    const tk: Record<string, ClassTask[]> = {}, rs: Record<string, ClassResult[]> = {}
    await Promise.all(m.map(async (x) => {
      tk[x.classId] = await listTasks(x.classId).catch(() => [])
      rs[x.classId] = await myResults(x.classId).catch(() => [])
    }))
    setTasks(tk); setRes(rs)
  }, [])
  const join = useCallback(async (raw: string) => {
    const c = normCode(raw)
    if (c.length !== 6) return
    setBusy(true); setMsg(null)
    try { const r = await joinClass(c, name, email); setMsg({ ok: true, text: C.joined(r.name) }); setCode(''); await reload() }
    catch { setMsg({ ok: false, text: C.notFound }) } finally { setBusy(false) }
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

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-xl font-black"><GraduationCap className="h-5 w-5 text-orange-300" />{C.mine}</h2>
      <form className="glass mb-4 flex flex-wrap items-center gap-2 p-4" onSubmit={(e) => { e.preventDefault(); void join(code) }}>
        <label className="text-sm font-bold" htmlFor="jc">{C.joinTitle}</label>
        <input id="jc" className="input-dark h-11 w-40 font-mono uppercase tracking-widest" placeholder={C.joinPh} value={code} maxLength={8} onChange={(e) => setCode(normCode(e.target.value))} />
        <button className="btn btn-primary" disabled={busy || code.length !== 6}><LogIn />{C.join}</button>
        {msg && <p role="status" className={`w-full text-sm font-semibold ${msg.ok ? 'text-green-300' : 'text-red-300'}`}>{msg.text}</p>}
      </form>
      {rows && rows.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((m) => (
            <div key={m.classId} className="glass flex flex-col gap-3 p-5">
              <div className="flex items-center gap-2">
                <h3 className="min-w-0 flex-1 break-words text-lg font-black">{m.className}</h3>
                <button className="text-xs text-white/50 underline hover:text-white" onClick={() => { if (confirm(`${C.leave}?`)) void leaveClass(m.classId).then(reload) }}>{C.leave}</button>
              </div>
              {(tasks[m.classId] ?? []).length === 0 ? <p className="text-sm text-white/55">{C.noTasks}</p> : (
                <ul className="flex flex-col gap-2">
                  {(tasks[m.classId] ?? []).map((x) => {
                    const r = (res[m.classId] ?? []).find((y) => y.taskId === x.id)
                    const Icon = x.kind === 'course' ? BookOpen : x.kind === 'game' ? Gamepad2 : ClipboardList
                    const href = x.kind === 'practice' ? `/learn/${x.quizId}?class=${m.classId}&task=${x.id}`
                      : x.kind === 'course' ? `/learn/course/${x.courseId}` : `/join?pin=${x.pin}`
                    return (
                      <li key={x.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                        <Icon className="h-5 w-5 shrink-0 text-orange-300" />
                        <div className="min-w-0 flex-1">
                          <div className="break-words text-sm font-bold">{x.title}</div>
                          <div className="text-xs text-white/55">{C.kinds[x.kind]}{x.dueAt ? ` · ${C.dueAt(fmtDate(x.dueAt.toDate()))}` : ''}{r ? ` · ${C.yourScore(r.pct)}` : ''}</div>
                          {x.note && <div className="text-xs text-white/55">{x.note}</div>}
                        </div>
                        <Link to={href} className="btn btn-primary btn-sm"><Play />{x.kind === 'course' ? C.openCourse : x.kind === 'game' ? C.openGame : C.start}</Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
