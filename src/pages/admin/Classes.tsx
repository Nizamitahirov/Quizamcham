import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import {
  ArchiveRestore, Archive, ArrowLeft, BookOpen, CalendarClock, CheckCircle2, ClipboardList, Copy, Download, Gamepad2, GraduationCap,
  Pencil, Plus, QrCode, Share2, Target, Trash2, TrendingUp, UserMinus, Users,
} from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { t } from '../../i18n/az'
import { fmtDate } from '../../lib/format'
import { listGames } from '../../firebase/db'
import {
  addTask, archiveClass, classCounts, courseProgressAll, createClass, deleteClass, deleteTask, listMembers, listMyClasses, listMyCourses, listResults, listTasks, loadClass,
  loadCourse, removeMember, renameClass, updateTask, type ClassResult, type ClassRow, type ClassTask, type Course, type Member, type TaskKind,
} from '../../lib/classes'
import { LockedCard, PremiumBadge, useFeature } from '../../components/Premium'
import { Modal, PageHeader, Spinner } from '../../components/ui'
import { EmptyState, Field, PctBadge, Progress, Segmented, Stat, Tabs } from '../../components/kit'
import { confirmDialog, promptDialog, toast } from '../../components/dialogs'
import { QuizPicker, type PickedQuiz } from '../../components/QuizPicker'
import { QRBlock } from '../../components/QRBlock'
import type { AdminState } from '../../firebase/auth'

const C = t.cls
const C2 = t.cls2
const joinUrl = (code: string) => `${location.origin}/learn?join=${code}`
const displayName = (a: AdminState) => a.user?.displayName || a.user?.email?.split('@')[0] || ''
export const initials = (s: string) => {
  const w = s.trim().split(/\s+/)
  if (/\d/.test(w[0] ?? '')) return w[0].replace(/[^\p{L}\p{N}]/gu, '').slice(0, 3).toUpperCase() || '?'
  return w.slice(0, 2).map((x) => x[0]?.toUpperCase() ?? '').join('') || '?'
}
const HUES = ['#F0262F', '#FF7A1A', '#8B5CF6', '#0EA5E9', '#10B981', '#EC4899', '#F59E0B']
export const hue = (s: string) => HUES[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length]
const KIND_ICON = { practice: ClipboardList, course: BookOpen, game: Gamepad2 } as const
const DAY = 86_400_000

function dueState(d?: Timestamp | null): 'late' | 'soon' | 'ok' | 'none' {
  if (!d) return 'none'
  const left = d.toMillis() - Date.now()
  return left < 0 ? 'late' : left < 2 * DAY ? 'soon' : 'ok'
}
function DueChip({ d }: { d?: Timestamp | null }) {
  const s = dueState(d)
  if (s === 'none') return <span className="chip chip-muted"><CalendarClock className="h-3 w-3" />{C2.noDue}</span>
  return <span className={`chip ${s === 'late' ? 'chip-bad' : s === 'soon' ? 'chip-warn' : 'chip-muted'}`}><CalendarClock className="h-3 w-3" />{s === 'late' ? `${C2.overdue} · ` : ''}{fmtDate(d!.toDate())}</span>
}
const ClassAvatar = ({ name, size = 44 }: { name: string; size?: number }) => (
  <span className="flex shrink-0 items-center justify-center rounded-xl font-display font-extrabold text-[#fff]" style={{ width: size, height: size, fontSize: size * 0.34, background: `linear-gradient(135deg, ${hue(name)}, ${hue(name + 'x')})` }}>{initials(name)}</span>
)

/** Siniflər siyahısı + yaratmaq (Təlimçi planı və yuxarı). */
export default function Classes() {
  const admin = useOutletContext<AdminState>()
  const allowed = useFeature('classes')
  const nav = useNavigate()
  const [rows, setRows] = useState<ClassRow[] | null>(null)
  const [counts, setCounts] = useState<Record<string, { members: number; tasks: number }>>({})
  const [view, setView] = useState<'active' | 'archived'>('active')
  const reload = useCallback(() => {
    void listMyClasses().then((r) => {
      setRows(r)
      void Promise.all(r.map(async (c) => [c.id, await classCounts(c.id)] as const)).then((x) => setCounts(Object.fromEntries(x)))
    }).catch(() => setRows([]))
  }, [])
  useEffect(() => { if (allowed) reload() }, [allowed, reload])
  if (!allowed) return <div className="mx-auto max-w-3xl p-4 sm:p-8"><PageHeader title={C.title} sub={C.sub} /><LockedCard feature="classes" title={C.title} /></div>
  const create = async () => {
    const name = await promptDialog({ title: C2.newClass, label: C2.renameTitle, placeholder: C.newName, maxLength: 80, ok: C.create })
    if (!name || name.trim().length < 2) return
    try { const id = await createClass(name, displayName(admin)); nav(`/admin/classes/${id}`) } catch { toast(t.app.error, 'error') }
  }
  const list = (rows ?? []).filter((c) => (view === 'archived') === !!c.archived)
  const hasArchived = (rows ?? []).some((c) => c.archived)
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <PageHeader title={C.title} sub={C.sub}>
        <button className="btn btn-primary" onClick={() => void create()}><Plus />{C2.newClass}</button>
      </PageHeader>
      {hasArchived && <div className="mb-4"><Segmented size="sm" value={view} onChange={setView} options={[{ value: 'active', label: C2.active }, { value: 'archived', label: C2.archivedTab }]} /></div>}
      {!rows ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-36" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState icon={GraduationCap} title={C.empty} text={C2.emptyText} action={<button className="btn btn-primary" onClick={() => void create()}><Plus />{C2.newClass}</button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => {
            const n = counts[c.id]
            return (
              <Link key={c.id} to={`/admin/classes/${c.id}`} className="card card-hover group flex flex-col gap-4 overflow-hidden p-5">
                <span className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full opacity-[.16] blur-2xl transition group-hover:opacity-30" style={{ background: hue(c.name) }} />
                <div className="flex items-center gap-3">
                  <ClassAvatar name={c.name} />
                  <div className="min-w-0">
                    <h3 className="truncate font-sans text-base font-semibold">{c.name}</h3>
                    <p className="font-mono text-xs tracking-[.2em] text-muted">{c.code}</p>
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-2">
                  <span className="chip chip-muted"><Users className="h-3 w-3" />{n ? C2.students(n.members) : '…'}</span>
                  <span className="chip chip-muted"><ClipboardList className="h-3 w-3" />{n ? C2.tasks(n.tasks) : '…'}</span>
                  {c.archived && <span className="chip chip-warn"><Archive className="h-3 w-3" />{C2.archivedTab}</span>}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Bir sinif: kod/QR, göstəricilər, tapşırıqlar, tələbələr, nəticələr. */
export function ClassDetail() {
  const { cid = '' } = useParams()
  const nav = useNavigate()
  const [cls, setCls] = useState<ClassRow | null | undefined>(undefined)
  const [tab, setTab] = useState<'tasks' | 'members' | 'results'>('tasks')
  const [members, setMembers] = useState<Member[]>([])
  const [tasks, setTasks] = useState<ClassTask[]>([])
  const [results, setResults] = useState<ClassResult[]>([])
  const [qr, setQr] = useState(false)
  const reload = useCallback(() => {
    void loadClass(cid).then(setCls).catch(() => setCls(null))
    void listMembers(cid).then(setMembers).catch(() => setMembers([]))
    void listTasks(cid).then(setTasks).catch(() => setTasks([]))
    void listResults(cid).then(setResults).catch(() => setResults([]))
  }, [cid])
  useEffect(reload, [reload])
  const stats = useMemo(() => {
    const practice = tasks.filter((x) => x.kind === 'practice')
    const ids = new Set(practice.map((x) => x.id))
    const uids = new Set(members.map((m) => m.uid))
    const rel = results.filter((r) => ids.has(r.taskId) && uids.has(r.uid))
    const possible = practice.length * members.length
    return { completion: possible ? Math.round((rel.length / possible) * 100) : 0, avg: rel.length ? Math.round(rel.reduce((a, r) => a + r.pct, 0) / rel.length) : null }
  }, [tasks, results, members])
  if (cls === undefined) return <div className="p-10"><Spinner /></div>
  if (!cls) return <div className="mx-auto max-w-3xl p-8"><p className="card p-6 text-sm font-semibold text-amber-300">{t.admin.noAccess}</p></div>
  const url = joinUrl(cls.code)
  const copy = () => void navigator.clipboard.writeText(url).then(() => toast(C2.copiedLink), () => {})
  const share = () => { if (navigator.share) void navigator.share({ title: cls.name, text: `${C.code}: ${cls.code}`, url }).catch(() => {}); else copy() }
  const rename = async () => {
    const name = await promptDialog({ title: C2.rename, label: C2.renameTitle, initial: cls.name, maxLength: 80 })
    if (name && name.trim().length >= 2 && name !== cls.name) { await renameClass(cls.id, name).then(() => toast(C2.saved)).catch(() => toast(t.app.error, 'error')); reload() }
  }
  const del = async () => {
    if (await confirmDialog({ title: `${C.delClass}?`, body: C2.delClassBody, danger: true })) void deleteClass(cls).then(() => nav('/admin/classes'))
  }
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Link to="/admin/classes" className="btn btn-ghost-dark btn-icon btn-sm" aria-label={t.app.back}><ArrowLeft /></Link>
        <ClassAvatar name={cls.name} size={40} />
        <h1 className="min-w-0 break-words text-2xl font-extrabold sm:text-3xl">{cls.name}</h1>
        <button className="btn btn-ghost-dark btn-icon btn-sm" onClick={() => void rename()} aria-label={C2.rename} title={C2.rename}><Pencil /></button>
        {cls.archived && <span className="chip chip-warn"><Archive className="h-3 w-3" />{C2.archivedTab}</span>}
        <div className="ml-auto flex gap-1">
          <button className="btn btn-ghost-dark btn-sm" onClick={() => void archiveClass(cls.id, !cls.archived).then(reload)}>{cls.archived ? <><ArchiveRestore />{C.unarchive}</> : <><Archive />{C.archive}</>}</button>
          <button className="btn btn-ghost-dark btn-sm hover:text-red-300" onClick={() => void del()}><Trash2 />{C.delClass}</button>
        </div>
      </div>

      <section className="card hairline-top mb-6 grid gap-5 p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-6">
        <div>
          <p className="label mb-1">{C.code}</p>
          <p className="font-mono text-4xl font-bold tracking-[.22em] sm:text-5xl"><span className="text-grad">{cls.code.slice(0, 3)}</span>{cls.code.slice(3)}</p>
        </div>
        <div className="min-w-0 sm:border-l sm:border-line sm:pl-5">
          <p className="text-sm text-fg2">{C.joinHow}</p>
          <p className="mt-1 truncate text-xs text-muted">{url}</p>
          {cls.archived && <p className="mt-2 text-xs font-semibold text-amber-300">{C.archived}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secondary btn-sm" onClick={copy}><Copy />{C.copy}</button>
          <button className="btn btn-secondary btn-sm" onClick={share}><Share2 />{C2.share}</button>
          <button className="btn btn-primary btn-sm" onClick={() => setQr(true)}><QrCode />{C2.showQr}</button>
        </div>
      </section>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Users} label={C2.stats.students} value={members.length} />
        <Stat icon={ClipboardList} label={C2.stats.tasks} value={tasks.length} tone="info" />
        <Stat icon={CheckCircle2} label={C2.stats.completion} value={`${stats.completion}%`} tone="ok" />
        <Stat icon={TrendingUp} label={C2.stats.avg} value={stats.avg == null ? '—' : `${stats.avg}%`} tone="warn" />
      </div>

      <div className="mb-4">
        <Tabs id="cls" value={tab} onChange={setTab} tabs={[
          { value: 'tasks', label: C.tabs.tasks, icon: ClipboardList, count: tasks.length },
          { value: 'members', label: C.tabs.members, icon: Users, count: members.length },
          { value: 'results', label: C.tabs.results, icon: Target, count: results.length },
        ]} />
      </div>
      {tab === 'tasks' && <TasksTab cid={cls.id} tasks={tasks} members={members} results={results} onChange={reload} />}
      {tab === 'members' && <MembersTab cls={cls} members={members} tasks={tasks} results={results} onChange={reload} onQr={() => setQr(true)} />}
      {tab === 'results' && <ResultsTab members={members} tasks={tasks} results={results} />}

      <Modal open={qr} onClose={() => setQr(false)} title={C2.qrTitle} sub={cls.name}>
        <div className="flex flex-col items-center gap-4 text-center">
          <QRBlock url={url} size={300} />
          <p className="font-mono text-4xl font-bold tracking-[.25em]">{cls.code}</p>
          <p className="max-w-xs text-sm text-muted">{C2.qrHint}</p>
        </div>
      </Modal>
    </div>
  )
}

function TaskForm({ cid, initial, onDone }: { cid: string; initial?: ClassTask; onDone: () => void }) {
  const admin = useOutletContext<AdminState>()
  const me = admin.user?.uid ?? ''
  const [kind, setKind] = useState<TaskKind>(initial?.kind ?? 'practice')
  const [picked, setPicked] = useState<{ id: string; title: string; pin?: string } | null>(initial ? { id: initial.quizId ?? initial.courseId ?? initial.gameId ?? '', title: initial.title, pin: initial.pin } : null)
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [games, setGames] = useState<{ id: string; title: string; pin: string }[] | null>(null)
  const [due, setDue] = useState(initial?.dueAt ? initial.dueAt.toDate().toISOString().slice(0, 10) : '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    void listMyCourses().then(setCourses).catch(() => setCourses([]))
    void listGames(50, me).then((g) => setGames((g as { id: string; title: string; pin: string; phase?: string }[]).filter((x) => x.phase !== 'finished'))).catch(() => setGames([]))
  }, [me])
  const editing = !!initial
  const save = async () => {
    if (!picked) return
    setBusy(true)
    try {
      const dueAt = due ? Timestamp.fromDate(new Date(`${due}T23:59:00`)) : null
      if (editing) await updateTask(cid, initial!.id, { dueAt, note: note.trim() })
      else await addTask(cid, { kind, title: picked.title, ...(kind === 'practice' ? { quizId: picked.id } : kind === 'course' ? { courseId: picked.id } : { gameId: picked.id, pin: picked.pin }), dueAt, note: note.trim() })
      toast(editing ? C2.saved : C2.added); onDone()
    } catch { toast(t.app.error, 'error') } finally { setBusy(false) }
  }
  const simple = (items: { id: string; title: string; sub?: string; pin?: string }[] | null, empty: string) => (
    <div className="max-h-64 overflow-y-auto rounded-xl border border-line scrollbar-thin" role="listbox">
      {!items ? <div className="p-3"><div className="skeleton h-11" /></div> : items.length === 0 ? <p className="p-6 text-center text-sm text-muted">{empty}</p> : items.map((x) => (
        <button key={x.id} type="button" role="option" aria-selected={picked?.id === x.id} onClick={() => setPicked({ id: x.id, title: x.title, pin: x.pin })}
          className={`flex w-full items-center gap-3 border-b border-line px-3 py-2.5 text-left text-sm last:border-b-0 ${picked?.id === x.id ? 'bg-orange-500/10' : 'hover:bg-white/[.04]'}`}>
          <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{x.title}</span>{x.sub && <span className="text-xs text-muted">{x.sub}</span>}</span>
          {picked?.id === x.id && <CheckCircle2 className="h-4 w-4 text-orange-300" />}
        </button>
      ))}
    </div>
  )
  const KindIcon = KIND_ICON[initial?.kind ?? kind]
  return (
    <div className="flex flex-col gap-5">
      {!editing ? (
        <>
          <Field label={C.kind}>
            <Segmented value={kind} onChange={(k) => { setKind(k); setPicked(null) }} options={(['practice', 'course', 'game'] as TaskKind[]).map((k) => ({ value: k, label: C.kinds[k] }))} />
          </Field>
          <Field label={kind === 'practice' ? C.pickQuiz : kind === 'course' ? C.pickCourse : C.pickGame}>
            {kind === 'practice' && <QuizPicker me={me} author={displayName(admin)} selected={picked?.id} onPick={(q: PickedQuiz) => setPicked({ id: q.quizId, title: q.title })} />}
            {kind === 'course' && simple(courses && courses.map((c) => ({ id: c.id, title: c.title, sub: t.course.count(c.items.length) })), t.course.empty)}
            {kind === 'game' && simple(games && games.map((g) => ({ id: g.id, title: g.title, sub: `PIN ${g.pin}`, pin: g.pin })), C2.nothing)}
          </Field>
        </>
      ) : (
        <div className="raised flex items-center gap-3 p-3">
          <span className="icon-tile h-9 w-9"><KindIcon className="h-4 w-4" /></span>
          <div className="min-w-0"><p className="truncate font-semibold">{initial!.title}</p><p className="text-xs text-muted">{C.kinds[initial!.kind]}</p></div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={C.due}><input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        <Field label={C.note}><input className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <button className="btn btn-secondary" onClick={onDone}>{t.dlg.cancel}</button>
        <button className="btn btn-primary" disabled={busy || !picked} onClick={() => void save()}>{editing ? t.dlg.save : <><Plus />{C.add}</>}</button>
      </div>
    </div>
  )
}

function TasksTab({ cid, tasks, members, results, onChange }: { cid: string; tasks: ClassTask[]; members: Member[]; results: ClassResult[]; onChange: () => void }) {
  const [form, setForm] = useState<{ edit?: ClassTask } | null>(null)
  const del = async (x: ClassTask) => { if (await confirmDialog({ title: C2.delTask, body: C2.delTaskBody, danger: true })) void deleteTask(cid, x.id).then(onChange) }
  const sorted = [...tasks].sort((a, b) => (a.dueAt?.toMillis() ?? Infinity) - (b.dueAt?.toMillis() ?? Infinity))
  const uids = new Set(members.map((m) => m.uid))
  return (
    <>
      {tasks.length > 0 && <div className="mb-3 flex justify-end"><button className="btn btn-primary btn-sm" onClick={() => setForm({})}><Plus />{C.addTask}</button></div>}
      {tasks.length === 0 ? (
        <EmptyState icon={ClipboardList} title={C.noTasks} action={<button className="btn btn-primary btn-sm" onClick={() => setForm({})}><Plus />{C.addTask}</button>} />
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((x) => {
            const Icon = KIND_ICON[x.kind]
            const done = results.filter((r) => r.taskId === x.id && uids.has(r.uid))
            const avg = done.length ? Math.round(done.reduce((a, r) => a + r.pct, 0) / done.length) : null
            return (
              <li key={x.id} className="card flex flex-wrap items-center gap-4 p-4">
                <span className="icon-tile"><Icon className="h-[18px] w-[18px]" /></span>
                <div className="min-w-[12rem] flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="break-words font-semibold">{x.title}</span><span className="chip chip-muted">{C.kinds[x.kind]}</span></div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted"><DueChip d={x.dueAt} />{x.note && <span className="truncate">{x.note}</span>}</div>
                </div>
                {x.kind === 'practice' && members.length > 0 && (
                  <div className="w-full sm:w-44">
                    <div className="mb-1 flex justify-between text-xs"><span className="text-muted">{C2.done(done.length, members.length)}</span>{avg != null && <span className="font-semibold tabular">{avg}%</span>}</div>
                    <Progress value={(done.length / members.length) * 100} />
                  </div>
                )}
                <div className="flex gap-1">
                  {x.kind === 'game' && x.gameId && <Link className="btn btn-ghost-dark btn-sm" to={`/admin/games/${x.gameId}`}>{C.report}</Link>}
                  <button className="btn btn-ghost-dark btn-icon btn-sm" aria-label={C2.editTask} title={C2.editTask} onClick={() => setForm({ edit: x })}><Pencil /></button>
                  <button className="btn btn-ghost-dark btn-icon btn-sm hover:text-red-300" aria-label={C.del} title={C.del} onClick={() => void del(x)}><Trash2 /></button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.edit ? C2.editTask : C.addTask} wide={!form?.edit}>
        {form && <TaskForm cid={cid} initial={form.edit} onDone={() => { setForm(null); onChange() }} />}
      </Modal>
    </>
  )
}

function MembersTab({ cls, members, tasks, results, onChange, onQr }: { cls: ClassRow; members: Member[]; tasks: ClassTask[]; results: ClassResult[]; onChange: () => void; onQr: () => void }) {
  const practice = tasks.filter((x) => x.kind === 'practice').length
  if (!members.length) return <EmptyState icon={Users} title={C.noMembers} text={C.joinHow} action={<button className="btn btn-primary btn-sm" onClick={onQr}><QrCode />{C2.showQr}</button>} />
  const remove = async (m: Member) => { if (await confirmDialog({ title: C2.removeTitle(m.name), danger: true, ok: C.remove })) void removeMember(cls.id, m.uid).then(onChange) }
  return (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead><tr><th>{C.student}</th><th>{C2.joined}</th><th>{C2.completed}</th><th>{C.avg}</th><th className="w-12" /></tr></thead>
        <tbody>
          {members.map((m) => {
            const mine = results.filter((r) => r.uid === m.uid)
            const avg = mine.length ? Math.round(mine.reduce((a, r) => a + r.pct, 0) / mine.length) : null
            return (
              <tr key={m.uid}>
                <td>
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-[#fff]" style={{ background: hue(m.name) }}>{initials(m.name)}</span>
                    <div className="min-w-0"><div className="truncate font-semibold">{m.name}</div>{m.email && <div className="truncate text-xs text-muted">{m.email}</div>}</div>
                  </div>
                </td>
                <td className="whitespace-nowrap text-muted">{m.joinedAt ? fmtDate(m.joinedAt.toDate()) : '—'}</td>
                <td className="tabular">{mine.length}/{practice}</td>
                <td>{avg == null ? <span className="text-muted">—</span> : <PctBadge pct={avg} />}</td>
                <td><button className="btn btn-ghost-dark btn-icon btn-sm hover:text-red-300" aria-label={`${C.remove}: ${m.name}`} title={C.remove} onClick={() => void remove(m)}><UserMinus /></button></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ResultsTab({ members, tasks, results }: { members: Member[]; tasks: ClassTask[]; results: ClassResult[] }) {
  const cols = tasks.filter((x) => x.kind !== 'game')
  const [courseProg, setCourseProg] = useState<Map<string, Map<string, number>>>(new Map())
  const [courseLen, setCourseLen] = useState<Map<string, number>>(new Map())
  useEffect(() => {
    const ids = members.map((m) => m.uid)
    void Promise.all(cols.filter((c) => c.kind === 'course' && c.courseId).map(async (c) => {
      const [prog, course] = await Promise.all([courseProgressAll(c.courseId!, ids), loadCourse(c.courseId!)])
      return [c.id, new Map([...prog].map(([u, p]) => [u, p.done.length])), course?.items.length ?? 0] as const
    })).then((rows) => {
      setCourseProg(new Map(rows.map(([id, m]) => [id, m])))
      setCourseLen(new Map(rows.map(([id, , n]) => [id, n])))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, tasks])
  const byKey = useMemo(() => new Map(results.map((r) => [`${r.uid}_${r.taskId}`, r])), [results])
  if (!members.length || !cols.length) return <EmptyState icon={Target} title={!members.length ? C.noMembers : C.noTasks} />
  const cell = (m: Member, c: ClassTask) => c.kind === 'course' ? `${courseProg.get(c.id)?.get(m.uid) ?? 0}/${courseLen.get(c.id) ?? 0}` : byKey.get(`${m.uid}_${c.id}`)?.pct ?? ''
  const excel = () => void import('../../lib/xlsx').then((x) => x.downloadXlsx('jabr-class-results.xlsx', [{ name: C.tabs.results, rows: [[C.student, ...cols.map((c) => c.title)], ...members.map((m) => [m.name, ...cols.map((c) => cell(m, c))])] }]))
  const uids = new Set(members.map((m) => m.uid))
  const colAvg = (c: ClassTask) => { const r = results.filter((x) => x.taskId === c.id && uids.has(x.uid)); return r.length ? Math.round(r.reduce((a, x) => a + x.pct, 0) / r.length) : null }
  return (
    <>
      <div className="mb-3 flex justify-end"><ExcelOrLock onClick={excel} /></div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th className="sticky left-0 z-10">{C.student}</th>{cols.map((c) => <th key={c.id} className="max-w-44 text-center" title={c.title}><span className="line-clamp-2 whitespace-normal">{c.title}</span></th>)}<th className="text-center">{C.avg}</th></tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const pcts = cols.filter((c) => c.kind === 'practice').map((c) => byKey.get(`${m.uid}_${c.id}`)?.pct).filter((x): x is number => x != null)
              return (
                <tr key={m.uid}>
                  <td className="sticky left-0 z-[1] bg-panel font-semibold">{m.name}</td>
                  {cols.map((c) => {
                    if (c.kind === 'course') { const n = courseProg.get(c.id)?.get(m.uid) ?? 0, total = courseLen.get(c.id) ?? 0; return <td key={c.id} className="text-center tabular">{total ? <span className={n === total ? 'font-semibold text-emerald-300' : 'text-fg2'}>{C.progress(n, total)}</span> : C.notDone}</td> }
                    const r = byKey.get(`${m.uid}_${c.id}`)
                    const late = !r && dueState(c.dueAt) === 'late'
                    return <td key={c.id} className="text-center">{r ? <PctBadge pct={r.pct} /> : late ? <span className="chip chip-bad">{C2.status.late}</span> : <span className="text-muted">{C.notDone}</span>}</td>
                  })}
                  <td className="text-center font-semibold tabular">{pcts.length ? `${Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)}%` : <span className="text-muted">{C.notDone}</span>}</td>
                </tr>
              )
            })}
            <tr className="bg-white/[.02]">
              <td className="sticky left-0 z-[1] bg-raised text-xs font-semibold uppercase tracking-wider text-muted">{C2.summary}</td>
              {cols.map((c) => { const a = colAvg(c); return <td key={c.id} className="text-center font-semibold tabular">{c.kind === 'practice' && a != null ? `${a}%` : '—'}</td> })}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </>
  )
}

function ExcelOrLock({ onClick }: { onClick: () => void }) {
  const ok = useFeature('excel')
  return ok ? <button className="btn btn-secondary btn-sm" onClick={onClick}><Download />Excel</button> : <span className="flex items-center gap-2 text-xs text-muted">Excel <PremiumBadge feature="excel" /></span>
}
