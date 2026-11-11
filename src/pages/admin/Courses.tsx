import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { BookOpen, GripVertical, Link2, Loader2, Pencil, Plus, Save, Trash2, TrendingUp, Users, X } from 'lucide-react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { t } from '../../i18n/az'
import { fmtDate } from '../../lib/format'
import { deleteCourse, listCourseProgress, listMyCourses, saveCourse, type Course, type CourseItem, type CourseProgress } from '../../lib/classes'
import { LockedCard, useFeature } from '../../components/Premium'
import { Modal, PageHeader } from '../../components/ui'
import { EmptyState, Field, Progress } from '../../components/kit'
import { confirmDialog, toast } from '../../components/dialogs'
import { QuizPicker } from '../../components/QuizPicker'
import type { AdminState } from '../../firebase/auth'

const K = t.course
const K2 = t.course2
const EMOJIS = ['📚', '🚀', '🧠', '🎯', '🧪', '🌍', '💡', '🏛️', '🧮', '💻', '🎨', '📈', '🩺', '⚖️', '🎵', '🏆']
const courseUrl = (id: string) => `${location.origin}/learn/course/${id}`

/** Kurslar: quizlərdən ardıcıl proqram (Pro planı). */
export default function Courses() {
  const admin = useOutletContext<AdminState>()
  const allowed = useFeature('courses')
  const [rows, setRows] = useState<Course[] | null>(null)
  const [prog, setProg] = useState<Record<string, CourseProgress[]>>({})
  const [editing, setEditing] = useState<Partial<Course> | null>(null)
  const [viewing, setViewing] = useState<Course | null>(null)
  const reload = useCallback(() => {
    void listMyCourses().then((r) => {
      setRows(r)
      void Promise.all(r.map(async (c) => [c.id, await listCourseProgress(c.id).catch(() => [])] as const)).then((x) => setProg(Object.fromEntries(x)))
    }).catch(() => setRows([]))
  }, [])
  useEffect(() => { if (allowed) reload() }, [allowed, reload])
  if (!allowed) return <div className="mx-auto max-w-3xl p-4 sm:p-8"><PageHeader title={K.title} sub={K.sub} /><LockedCard feature="courses" title={K.title} /></div>
  const newCourse = () => setEditing({ title: '', description: '', items: [], coverEmoji: '📚' })
  const del = async (c: Course) => { if (await confirmDialog({ title: K.delConfirm, body: K2.delBody, danger: true })) void deleteCourse(c.id).then(reload) }
  const copy = (c: Course) => void navigator.clipboard.writeText(courseUrl(c.id)).then(() => toast(K2.linkCopied), () => {})
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <PageHeader title={K.title} sub={K.sub}>{rows && rows.length > 0 && <button className="btn btn-primary" onClick={newCourse}><Plus />{K.create}</button>}</PageHeader>
      {!rows ? <div className="grid gap-4 md:grid-cols-2">{[0, 1].map((i) => <div key={i} className="skeleton h-56" />)}</div>
        : rows.length === 0 ? <EmptyState icon={BookOpen} title={K.empty} text={K2.emptyText} action={<button className="btn btn-primary" onClick={newCourse}><Plus />{K.create}</button>} />
        : (
          <div className="grid gap-4 md:grid-cols-2">
            {rows.map((c) => {
              const p = prog[c.id] ?? []
              const finished = p.filter((x) => x.completedAt).length
              return (
                <article key={c.id} className="card card-hover flex flex-col overflow-hidden">
                  <div className="relative flex items-start gap-4 border-b border-line p-5">
                    <span className="pointer-events-none absolute -left-8 -top-10 h-32 w-32 rounded-full opacity-25 blur-2xl" style={{ background: 'var(--grad)' }} />
                    <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-line-strong bg-white/[.05] text-3xl">{c.coverEmoji ?? '📚'}</span>
                    <div className="relative min-w-0 flex-1">
                      <h3 className="break-words font-sans text-lg font-semibold">{c.title}</h3>
                      {c.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{c.description}</p>}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="chip chip-muted"><BookOpen className="h-3 w-3" />{K.count(c.items.length)}</span>
                        <span className="chip chip-muted"><Users className="h-3 w-3" />{K2.started(p.length)}</span>
                        {finished > 0 && <span className="chip chip-ok">{K2.finished(finished)}</span>}
                      </div>
                    </div>
                  </div>
                  <ol className="flex flex-1 flex-col gap-1.5 p-5">
                    {c.items.slice(0, 4).map((i, n) => (
                      <li key={i.quizId} className="flex items-center gap-3 text-sm">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line-strong text-[11px] font-bold text-fg2 tabular">{n + 1}</span>
                        <span className="truncate text-fg2">{i.title}</span>
                      </li>
                    ))}
                    {c.items.length > 4 && <li className="pl-9 text-xs text-muted">+{c.items.length - 4}</li>}
                  </ol>
                  <div className="flex flex-wrap gap-1 border-t border-line px-3 py-2.5">
                    <button className="btn btn-ghost-dark btn-sm" onClick={() => setEditing(c)}><Pencil />{K.edit}</button>
                    <button className="btn btn-ghost-dark btn-sm" onClick={() => setViewing(c)}><TrendingUp />{K2.progressBtn}</button>
                    <button className="btn btn-ghost-dark btn-sm" onClick={() => copy(c)}><Link2 />{K2.copyLink}</button>
                    <button className="btn btn-ghost-dark btn-icon btn-sm ml-auto hover:text-red-300" aria-label={K.del} title={K.del} onClick={() => void del(c)}><Trash2 /></button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      {editing && <CourseEditor initial={editing} ownerName={admin.user?.displayName || admin.user?.email?.split('@')[0] || ''} me={admin.user?.uid ?? ''} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); toast(K2.saved); reload() }} />}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={K2.progressTitle} sub={viewing?.title} wide>
        {viewing && <ProgressTable course={viewing} rows={prog[viewing.id] ?? []} />}
      </Modal>
    </div>
  )
}

function ProgressTable({ course, rows }: { course: Course; rows: CourseProgress[] }) {
  if (!rows.length) return <p className="py-8 text-center text-sm text-muted">{K2.noProgress}</p>
  const total = course.items.length
  const sorted = [...rows].sort((a, b) => b.done.length - a.done.length)
  return (
    <div className="-mx-6 overflow-x-auto">
      <table className="table">
        <thead><tr><th>{K2.student}</th><th>{K2.steps}</th><th>{K2.completedAt}</th></tr></thead>
        <tbody>
          {sorted.map((r) => {
            const n = r.done.filter((q) => course.items.some((i) => i.quizId === q)).length
            return (
              <tr key={r.uid}>
                <td className="font-semibold">{r.name || '—'}</td>
                <td><div className="flex items-center gap-3"><Progress value={(n / total) * 100} className="w-32" /><span className="text-xs tabular text-muted">{n}/{total}</span></div></td>
                <td>{r.completedAt ? <span className="chip chip-ok">{fmtDate(r.completedAt.toDate())}</span> : <span className="chip chip-muted">{K2.inProgress}</span>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SortableItem({ it, i, onRemove }: { it: CourseItem; i: number; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: it.quizId })
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-xl border bg-raised px-2 py-2 text-sm ${isDragging ? 'relative z-10 border-orange-400/50 shadow-lg' : 'border-line'}`}>
      <button type="button" className="cursor-grab touch-none rounded-md p-1 text-muted hover:text-fg active:cursor-grabbing" aria-label={K2.dragHint} {...attributes} {...listeners}><GripVertical className="h-4 w-4" /></button>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white tabular" style={{ background: 'var(--grad)' }}>{i + 1}</span>
      <span className="min-w-0 flex-1 truncate font-semibold">{it.title}</span>
      <button type="button" className="btn btn-ghost-dark btn-icon btn-sm hover:text-red-300" aria-label={K.del} onClick={onRemove}><X /></button>
    </li>
  )
}

function CourseEditor({ initial, ownerName, me, onClose, onSaved }: { initial: Partial<Course>; ownerName: string; me: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(initial.title ?? '')
  const [desc, setDesc] = useState(initial.description ?? '')
  const [emoji, setEmoji] = useState(initial.coverEmoji ?? '📚')
  const [items, setItems] = useState<CourseItem[]>(initial.items ?? [])
  const [busy, setBusy] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const onEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    setItems((s) => arrayMove(s, s.findIndex((x) => x.quizId === e.active.id), s.findIndex((x) => x.quizId === e.over!.id)))
  }
  const save = async () => {
    setBusy(true)
    try { await saveCourse({ id: initial.id, title, description: desc, items, ownerName, coverEmoji: emoji }); onSaved() }
    catch { toast(t.app.error, 'error') } finally { setBusy(false) }
  }
  const problem = title.trim().length < 3 ? K2.titleMin : items.length === 0 ? K2.noItems : ''
  return (
    <Modal open onClose={onClose} title={initial.id ? K.edit : K.create} wide>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Field label={K2.cover}>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button key={e} type="button" onClick={() => setEmoji(e)} aria-pressed={emoji === e} aria-label={e}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border text-xl transition ${emoji === e ? 'border-orange-400/60 bg-orange-500/10 shadow-[0_0_0_3px_rgba(255,90,31,.15)]' : 'border-line bg-white/[.03] hover:border-line-strong'}`}>{e}</button>
              ))}
            </div>
          </Field>
          <Field label={K.name}><input className="input" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label={K.desc}><textarea className="input min-h-20" maxLength={500} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
          <Field label={`${K.items} · ${items.length}`} hint={items.length > 1 ? K2.dragHint : undefined}>
            {items.length === 0 ? <p className="rounded-xl border border-dashed border-line-strong p-4 text-center text-sm text-muted">{K2.noItems}</p> : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onEnd}>
                <SortableContext items={items.map((x) => x.quizId)} strategy={verticalListSortingStrategy}>
                  <ol className="flex flex-col gap-1.5">{items.map((it, i) => <SortableItem key={it.quizId} it={it} i={i} onRemove={() => setItems((s) => s.filter((x) => x.quizId !== it.quizId))} />)}</ol>
                </SortableContext>
              </DndContext>
            )}
          </Field>
        </div>
        <Field label={K.addItem}>
          <QuizPicker me={me} author={ownerName} exclude={items.map((i) => i.quizId)} onPick={(q) => setItems((s) => [...s, { quizId: q.quizId, title: q.title }])} />
        </Field>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
        {problem && <p className="mr-auto text-xs text-muted">{problem}</p>}
        <button className="btn btn-secondary" onClick={onClose}>{t.dlg.cancel}</button>
        <button className="btn btn-primary" disabled={busy || !!problem} onClick={() => void save()}>{busy ? <Loader2 className="animate-spin" /> : <Save />}{K.save}</button>
      </div>
    </Modal>
  )
}
