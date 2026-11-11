import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { ArrowLeft, Archive, BookOpen, ClipboardList, Copy, Download, GraduationCap, Plus, Trash2, Users } from 'lucide-react'
import { t } from '../../i18n/az'
import { fmtDate } from '../../lib/format'
import { listCatalog, type CatalogItem } from '../../lib/account'
import { listGames } from '../../firebase/db'
import {
  addTask, archiveClass, courseProgressAll, createClass, deleteClass, deleteTask, listMembers, listMyClasses, listMyCourses, listResults, listTasks, loadClass, removeMember,
  type ClassResult, type ClassRow, type ClassTask, type Course, type Member, type TaskKind,
} from '../../lib/classes'
import { LockedCard, PremiumBadge, useFeature } from '../../components/Premium'
import { PageHeader, Spinner } from '../../components/ui'
import { Section } from '../../components/kit'
import type { AdminState } from '../../firebase/auth'
import { Timestamp } from 'firebase/firestore'

const C = t.cls
const joinUrl = (code: string) => `${location.origin}/learn?join=${code}`
const displayName = (a: AdminState) => a.user?.displayName || a.user?.email?.split('@')[0] || ''

/** Siniflər siyahısı + yaratmaq (Təlimçi planı və yuxarı). */
export default function Classes() {
  const admin = useOutletContext<AdminState>()
  const allowed = useFeature('classes')
  const nav = useNavigate()
  const [rows, setRows] = useState<ClassRow[] | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const reload = useCallback(() => { void listMyClasses().then(setRows).catch(() => setRows([])) }, [])
  useEffect(() => { if (allowed) reload() }, [allowed, reload])
  if (!allowed) return <div className="mx-auto max-w-3xl p-4 sm:p-8"><PageHeader title={C.title} sub={C.sub} /><LockedCard feature="classes" title={C.title} /></div>
  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 2) return
    setBusy(true)
    try { const id = await createClass(name, displayName(admin)); nav(`/admin/classes/${id}`) } finally { setBusy(false) }
  }
  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-8">
      <PageHeader title={C.title} sub={C.sub} />
      <form onSubmit={create} className="card mb-6 flex flex-wrap gap-2 p-4">
        <label className="sr-only" htmlFor="cname">{C.newName}</label>
        <input id="cname" className="input min-w-0 flex-1" placeholder={C.newName} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-primary" disabled={busy || name.trim().length < 2}><Plus />{C.create}</button>
      </form>
      {!rows ? <Spinner /> : rows.length === 0 ? <p className="card p-8 text-center text-muted">{C.empty}</p> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <Link key={c.id} to={`/admin/classes/${c.id}`} className={`card flex flex-col gap-2 p-5 transition hover:-translate-y-0.5 hover:shadow-lg ${c.archived ? 'opacity-60' : ''}`}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ background: 'var(--grad)' }}><GraduationCap className="h-5 w-5" /></span>
              <h3 className="break-words text-lg font-bold">{c.name}</h3>
              <p className="text-xs text-muted">{C.code}: <span className="font-mono text-base font-black tracking-widest text-ink">{c.code}</span></p>
              {c.archived && <span className="chip self-start bg-surface text-muted">{C.archived}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

/** Bir sinif: kod, tapşırıqlar, tələbələr, nəticələr. */
export function ClassDetail() {
  const { cid = '' } = useParams()
  const nav = useNavigate()
  const [cls, setCls] = useState<ClassRow | null | undefined>(undefined)
  const [tab, setTab] = useState<'tasks' | 'members' | 'results'>('tasks')
  const [members, setMembers] = useState<Member[]>([])
  const [tasks, setTasks] = useState<ClassTask[]>([])
  const [results, setResults] = useState<ClassResult[]>([])
  const [copied, setCopied] = useState(false)
  const reload = useCallback(() => {
    void loadClass(cid).then(setCls).catch(() => setCls(null))
    void listMembers(cid).then(setMembers).catch(() => setMembers([]))
    void listTasks(cid).then(setTasks).catch(() => setTasks([]))
    void listResults(cid).then(setResults).catch(() => setResults([]))
  }, [cid])
  useEffect(reload, [reload])
  if (cls === undefined) return <div className="p-10"><Spinner /></div>
  if (!cls) return <div className="mx-auto max-w-3xl p-8"><p className="card p-6 text-sm font-semibold text-amber-800">{t.admin.noAccess}</p></div>
  const copy = () => void navigator.clipboard.writeText(joinUrl(cls.code)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) }, () => {})
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link to="/admin/classes" className="btn btn-ghost-dark btn-icon" aria-label={t.app.back}><ArrowLeft /></Link>
        <h1 className="mr-auto break-words text-2xl font-bold sm:text-3xl">{cls.name}</h1>
        <button className="btn btn-ghost-dark btn-sm" onClick={() => void archiveClass(cls.id, !cls.archived).then(reload)}><Archive />{cls.archived ? C.unarchive : C.archive}</button>
        <button className="btn btn-ghost-dark btn-sm text-red-600" onClick={() => { if (confirm(C.delConfirm)) void deleteClass(cls).then(() => nav('/admin/classes')) }}><Trash2 />{C.delClass}</button>
      </div>
      <section className="card mb-6 flex flex-wrap items-center gap-4 p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">{C.code}</p>
          <p className="font-mono text-4xl font-black tracking-[.2em]">{cls.code}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">{C.joinHow}</p>
          <p className="mt-1 break-all font-mono text-sm">{joinUrl(cls.code)}</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={copy}><Copy />{copied ? C.copied : C.copy}</button>
        {cls.archived && <p className="w-full text-sm font-semibold text-amber-800">{C.archived}</p>}
      </section>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {([['tasks', ClipboardList, tasks.length], ['members', Users, members.length], ['results', BookOpen, results.length]] as const).map(([k, Icon, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${tab === k ? 'bg-ink text-white' : 'bg-surface text-[#4A4E69]'}`}>
            <Icon className="h-4 w-4" />{C.tabs[k]}<span className="rounded-full bg-white/20 px-1.5 text-xs">{n}</span>
          </button>
        ))}
      </div>
      {tab === 'tasks' && <TasksTab cid={cls.id} tasks={tasks} onChange={reload} />}
      {tab === 'members' && (
        <Section title={C.tabs.members} bodyClassName="p-0">
          {members.length === 0 ? <p className="p-5 text-sm text-muted">{C.noMembers}</p> : (
            <ul className="divide-y divide-line">
              {members.map((m) => (
                <li key={m.uid} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0 flex-1"><div className="font-semibold">{m.name}</div><div className="text-xs text-muted">{m.email} {m.joinedAt ? `· ${fmtDate(m.joinedAt.toDate())}` : ''}</div></div>
                  <button className="btn btn-ghost-dark btn-sm text-red-600" onClick={() => { if (confirm(`${C.remove}: ${m.name}?`)) void removeMember(cls.id, m.uid).then(reload) }}>{C.remove}</button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
      {tab === 'results' && <ResultsTab members={members} tasks={tasks} results={results} />}
    </div>
  )
}

function TasksTab({ cid, tasks, onChange }: { cid: string; tasks: ClassTask[]; onChange: () => void }) {
  const [kind, setKind] = useState<TaskKind>('practice')
  const [catalog, setCatalog] = useState<CatalogItem[] | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [games, setGames] = useState<{ id: string; title: string; pin: string }[]>([])
  const [pick, setPick] = useState('')
  const [due, setDue] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const admin = useOutletContext<AdminState>()
  useEffect(() => {
    const me = admin.user?.uid
    // kataloqdan görünən (yoxlamada/gizli olmayan) quizlər; "yalnız link ilə" olanlardan yalnız özününkülər
    void listCatalog(true).then((r) => setCatalog(r.filter((c) => !c.hidden && c.status !== 'review' && (!c.unlisted || c.publishedBy === me)))).catch(() => setCatalog([]))
    void listMyCourses().then(setCourses).catch(() => setCourses([]))
    void listGames(50, me).then((g) => setGames((g as { id: string; title: string; pin: string; phase?: string }[]).filter((x) => x.phase !== 'finished'))).catch(() => setGames([]))
  }, [admin.user?.uid])
  useEffect(() => setPick(''), [kind])
  const options = kind === 'practice' ? (catalog ?? []).map((c) => ({ id: c.id, label: c.title }))
    : kind === 'course' ? courses.map((c) => ({ id: c.id, label: c.title })) : games.map((g) => ({ id: g.id, label: `${g.title} · PIN ${g.pin}` }))
  const add = async () => {
    const opt = options.find((o) => o.id === pick)
    if (!opt) return
    setBusy(true)
    try {
      const game = games.find((g) => g.id === pick)
      await addTask(cid, {
        kind, title: kind === 'game' ? game!.title : opt.label,
        ...(kind === 'practice' ? { quizId: pick } : kind === 'course' ? { courseId: pick } : { gameId: pick, pin: game!.pin }),
        dueAt: due ? Timestamp.fromDate(new Date(`${due}T23:59:00`)) : null, note: note.trim(),
      })
      setPick(''); setNote(''); setDue(''); onChange()
    } finally { setBusy(false) }
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Section title={C.tabs.tasks} bodyClassName="p-0">
        {tasks.length === 0 ? <p className="p-5 text-sm text-muted">{C.noTasks}</p> : (
          <ul className="divide-y divide-line">
            {tasks.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="chip bg-surface text-[#4A4E69]">{C.kinds[x.kind]}</span>
                <div className="min-w-0 flex-1"><div className="break-words font-semibold">{x.title}</div>
                  <div className="text-xs text-muted">{x.dueAt ? C.dueAt(fmtDate(x.dueAt.toDate())) : ''}{x.note ? ` · ${x.note}` : ''}</div></div>
                {x.kind === 'game' && x.gameId && <Link className="btn btn-ghost-dark btn-sm" to={`/admin/games/${x.gameId}`}>{C.report}</Link>}
                <button className="btn btn-ghost-dark btn-icon btn-sm text-red-600" aria-label={C.del} onClick={() => void deleteTask(cid, x.id).then(onChange)}><Trash2 /></button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title={C.addTask}>
        <div className="flex flex-col gap-3">
          <label className="label" htmlFor="tk">{C.kind}</label>
          <select id="tk" className="input" value={kind} onChange={(e) => setKind(e.target.value as TaskKind)}>
            {(['practice', 'course', 'game'] as TaskKind[]).map((k) => <option key={k} value={k}>{C.kinds[k]}</option>)}
          </select>
          <label className="label" htmlFor="tp">{kind === 'practice' ? C.pickQuiz : kind === 'course' ? C.pickCourse : C.pickGame}</label>
          <select id="tp" className="input" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">—</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          {kind === 'practice' && catalog?.length === 0 && <p className="text-xs text-amber-800">{C.noQuizzes}</p>}
          <label className="label" htmlFor="td">{C.due}</label>
          <input id="td" type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
          <label className="label" htmlFor="tn">{C.note}</label>
          <input id="tn" className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn btn-primary" disabled={busy || !pick} onClick={() => void add()}><Plus />{C.add}</button>
        </div>
      </Section>
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
      const [{ loadCourse }, prog] = await Promise.all([import('../../lib/classes'), courseProgressAll(c.courseId!, ids)])
      const course = await loadCourse(c.courseId!)
      return [c.id, new Map([...prog].map(([u, p]) => [u, p.done.length])), course?.items.length ?? 0] as const
    })).then((rows) => {
      setCourseProg(new Map(rows.map(([id, m]) => [id, m])))
      setCourseLen(new Map(rows.map(([id, , n]) => [id, n])))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, tasks])
  const byKey = useMemo(() => new Map(results.map((r) => [`${r.uid}_${r.taskId}`, r])), [results])
  if (!members.length || !cols.length) return <p className="card p-6 text-sm text-muted">{!members.length ? C.noMembers : C.noTasks}</p>
  const cell = (m: Member, c: ClassTask) => c.kind === 'course' ? `${courseProg.get(c.id)?.get(m.uid) ?? 0}/${courseLen.get(c.id) ?? 0}` : byKey.get(`${m.uid}_${c.id}`)?.pct ?? ''
  const excel = () => void import('../../lib/xlsx').then((x) => x.downloadXlsx('jabr-class-results.xlsx', [{ name: C.tabs.results, rows: [[C.student, ...cols.map((c) => c.title)], ...members.map((m) => [m.name, ...cols.map((c) => cell(m, c))])] }]))
  return (
    <>
    <div className="mb-2 flex justify-end"><ExcelOrLock onClick={excel} /></div>
    <div className="card overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface text-[11px] uppercase tracking-wider text-muted">
          <tr><th className="p-3">{C.student}</th>{cols.map((c) => <th key={c.id} className="max-w-40 p-3" title={c.title}><span className="line-clamp-2">{c.title}</span></th>)}<th className="p-3">{C.avg}</th></tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const pcts = cols.filter((c) => c.kind === 'practice').map((c) => byKey.get(`${m.uid}_${c.id}`)?.pct).filter((x): x is number => x != null)
            return (
              <tr key={m.uid} className="border-t border-line">
                <td className="p-3 font-semibold">{m.name}</td>
                {cols.map((c) => {
                  if (c.kind === 'course') { const n = courseProg.get(c.id)?.get(m.uid) ?? 0, total = courseLen.get(c.id) ?? 0; return <td key={c.id} className="p-3 text-center">{total ? C.progress(n, total) : C.notDone}</td> }
                  const r = byKey.get(`${m.uid}_${c.id}`)
                  return <td key={c.id} className="p-3 text-center">{r ? <span className={`rounded-full px-2 py-0.5 font-bold ${r.pct >= 80 ? 'bg-green-100 text-green-700' : r.pct >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'}`}>{r.pct}%</span> : C.notDone}</td>
                })}
                <td className="p-3 font-bold">{pcts.length ? `${Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)}%` : C.notDone}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
    </>
  )
}

function ExcelOrLock({ onClick }: { onClick: () => void }) {
  const ok = useFeature('excel')
  return ok ? <button className="btn btn-secondary btn-sm" onClick={onClick}><Download />Excel</button> : <span className="flex items-center gap-1 text-xs text-muted">Excel <PremiumBadge feature="excel" /></span>
}
