import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Clock, FileText, RotateCcw, Save, Send } from 'lucide-react'
import { t } from '../../i18n/az'
import { fmtDateTime } from '../../lib/format'
import { gradeSubmission, type ClassTask, type Member, type Submission } from '../../lib/classes'
import { FileList } from '../../components/Files'
import { toast } from '../../components/dialogs'
import { Field } from '../../components/kit'

const A = t.asg
type Row = { m: Member; sub: Submission | null; state: 'none' | 'draft' | 'submitted' | 'late' | 'returned' }
const STATE_CHIP: Record<Row['state'], string> = { none: 'chip-muted', draft: 'chip-muted', submitted: 'chip-info', late: 'chip-warn', returned: 'chip-ok' }

/** Müəllim: tapşırıq təhvillərini yoxlamaq — siyahı + iş + qiymət/rəy, "qiymətləndir və qaytar". */
export function AssignmentReview({ cid, task, members, subs, onChanged }: { cid: string; task: ClassTask; members: Member[]; subs: Submission[]; onChanged: () => void }) {
  const points = task.points ?? 100
  const [local, setLocal] = useState<Record<string, Submission>>({})
  const rows = useMemo<Row[]>(() => members.map((m) => {
    const sub = local[m.uid] ?? subs.find((s) => s.uid === m.uid) ?? null
    const state: Row['state'] = !sub ? 'none' : sub.status === 'returned' ? 'returned' : sub.status === 'draft' ? 'draft' : sub.late ? 'late' : 'submitted'
    return { m, sub, state }
  }).sort((a, b) => ['submitted', 'late', 'returned', 'draft', 'none'].indexOf(a.state) - ['submitted', 'late', 'returned', 'draft', 'none'].indexOf(b.state) || a.m.name.localeCompare(b.m.name)), [members, subs, local])
  const [sel, setSel] = useState(rows[0]?.m.uid ?? '')
  const i = Math.max(0, rows.findIndex((r) => r.m.uid === sel))
  const row = rows[i]
  const [grade, setGrade] = useState('')
  const [fb, setFb] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { setGrade(row?.sub?.grade != null ? String(row.sub.grade) : ''); setFb(row?.sub?.feedback ?? '') }, [row?.m.uid, row?.sub?.grade, row?.sub?.feedback])
  const graded = rows.filter((r) => r.sub?.grade != null)
  const avg = graded.length ? Math.round(graded.reduce((a, r) => a + (r.sub!.grade ?? 0), 0) / graded.length) : null

  const save = async (status: Submission['status']) => {
    if (!row?.sub) return
    const g = grade.trim() === '' ? null : Math.max(0, Math.min(points, Math.round(Number(grade))))
    setBusy(true)
    try {
      await gradeSubmission(cid, row.sub, g, fb.trim(), status)
      setLocal((l) => ({ ...l, [row.m.uid]: { ...row.sub!, grade: g, feedback: fb.trim(), status } }))
      toast(status === 'returned' ? A.returnedOk : C2saved()); onChanged()
      if (status === 'returned' && i < rows.length - 1) setSel(rows[i + 1].m.uid)
    } catch { toast(t.app.error, 'error') } finally { setBusy(false) }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>{A.turnedIn(rows.filter((r) => r.state !== 'none' && r.state !== 'draft').length, rows.length)}</span>
          {avg != null && <span className="chip chip-muted">{A.avg(avg, points)}</span>}
        </div>
        <ul className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto scrollbar-thin">
          {rows.map((r) => (
            <li key={r.m.uid}>
              <button type="button" onClick={() => setSel(r.m.uid)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${r.m.uid === row?.m.uid ? 'bg-white/[.08]' : 'hover:bg-white/[.04]'}`}>
                <span className="min-w-0 flex-1 truncate font-medium">{r.m.name}</span>
                {r.sub?.grade != null ? <span className="chip chip-ok tabular">{r.sub.grade}/{points}</span> : <span className={`chip ${STATE_CHIP[r.state]}`}>{A.status[r.state]}</span>}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      {row && (
        <section className="min-w-0 rounded-2xl border border-line bg-white/[.02] p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="mr-auto min-w-0 truncate text-lg font-bold">{row.m.name}</h3>
            <span className={`chip ${STATE_CHIP[row.state]}`}>{A.status[row.state]}</span>
            <button className="btn btn-ghost-dark btn-icon btn-sm" disabled={i === 0} aria-label={A.prev} onClick={() => setSel(rows[i - 1].m.uid)}><ChevronLeft /></button>
            <button className="btn btn-ghost-dark btn-icon btn-sm" disabled={i >= rows.length - 1} aria-label={A.next} onClick={() => setSel(rows[i + 1].m.uid)}><ChevronRight /></button>
          </div>
          {!row.sub || row.sub.status === 'draft' ? <p className="rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">{A.noWork}</p> : (
            <div className="flex flex-col gap-4">
              {row.sub.submittedAt && <p className="flex items-center gap-1.5 text-xs text-muted"><Clock className="h-3.5 w-3.5" />{A.submittedAt(fmtDateTime(row.sub.submittedAt.toDate()))}{row.sub.late && <span className="chip chip-warn ml-1">{A.status.late}</span>}</p>}
              {row.sub.text && (
                <div>
                  <p className="label flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />{A.answer}</p>
                  <div className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-line bg-panel p-3 text-sm leading-relaxed scrollbar-thin">{row.sub.text}</div>
                </div>
              )}
              {!!row.sub.files?.length && <div><p className="label">{A.files}</p><FileList files={row.sub.files} /></div>}
              <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-[160px_minmax(0,1fr)]">
                <Field label={A.grade}>
                  <div className="flex items-center gap-2"><input type="number" min={0} max={points} className="input w-24 text-center font-bold tabular" value={grade} onChange={(e) => setGrade(e.target.value)} /><span className="text-sm text-muted">/ {points}</span></div>
                </Field>
                <Field label={A.feedback}><textarea className="input min-h-20" maxLength={5000} placeholder={A.feedbackPh} value={fb} onChange={(e) => setFb(e.target.value)} /></Field>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {row.sub.status === 'returned' && <button className="btn btn-ghost-dark" disabled={busy} onClick={() => void save('submitted')}><RotateCcw />{A.reopen}</button>}
                <button className="btn btn-secondary" disabled={busy} onClick={() => void save(row.sub!.status)}><Save />{A.saveGrade}</button>
                <button className="btn btn-primary" disabled={busy || grade.trim() === ''} onClick={() => void save('returned')}><Send />{A.returnBtn}</button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
const C2saved = () => t.cls2.saved
