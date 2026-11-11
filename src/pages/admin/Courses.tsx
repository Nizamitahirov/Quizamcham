import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { ArrowDown, ArrowUp, BookOpen, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react'
import { t } from '../../i18n/az'
import { listCatalog, type CatalogItem } from '../../lib/account'
import { deleteCourse, listMyCourses, saveCourse, type Course, type CourseItem } from '../../lib/classes'
import { LockedCard, useFeature } from '../../components/Premium'
import { Modal, PageHeader, Spinner } from '../../components/ui'
import type { AdminState } from '../../firebase/auth'

const K = t.course

/** Kurslar: kataloq quizlərindən ardıcıl proqram (Pro planı). */
export default function Courses() {
  const admin = useOutletContext<AdminState>()
  const allowed = useFeature('courses')
  const [rows, setRows] = useState<Course[] | null>(null)
  const [editing, setEditing] = useState<Partial<Course> | null>(null)
  const reload = useCallback(() => { void listMyCourses().then(setRows).catch(() => setRows([])) }, [])
  useEffect(() => { if (allowed) reload() }, [allowed, reload])
  if (!allowed) return <div className="mx-auto max-w-3xl p-4 sm:p-8"><PageHeader title={K.title} sub={K.sub} /><LockedCard feature="courses" title={K.title} /></div>
  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-8">
      <PageHeader title={K.title} sub={K.sub}><button className="btn btn-primary" onClick={() => setEditing({ title: '', description: '', items: [] })}><Plus />{K.create}</button></PageHeader>
      {!rows ? <Spinner /> : rows.length === 0 ? <p className="card p-8 text-center text-muted">{K.empty}</p> : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((c) => (
            <div key={c.id} className="card flex flex-col gap-2 p-5">
              <div className="flex items-start gap-3">
                <span className="text-3xl">{c.coverEmoji ?? '📚'}</span>
                <div className="min-w-0 flex-1"><h3 className="break-words text-lg font-bold">{c.title}</h3><p className="text-xs text-muted">{K.count(c.items.length)}</p></div>
              </div>
              {c.description && <p className="text-sm text-muted">{c.description}</p>}
              <ol className="list-decimal pl-5 text-sm">{c.items.slice(0, 5).map((i) => <li key={i.quizId} className="truncate">{i.title}</li>)}</ol>
              <div className="mt-auto flex gap-2 pt-2">
                <button className="btn btn-secondary btn-sm" onClick={() => setEditing(c)}><Pencil />{K.edit}</button>
                <button className="btn btn-ghost-dark btn-sm text-red-600" onClick={() => { if (confirm(K.delConfirm)) void deleteCourse(c.id).then(reload) }}><Trash2 />{K.del}</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && <CourseEditor initial={editing} ownerName={admin.user?.displayName || admin.user?.email?.split('@')[0] || ''} me={admin.user?.uid ?? ''} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
    </div>
  )
}

function CourseEditor({ initial, ownerName, me, onClose, onSaved }: { initial: Partial<Course>; ownerName: string; me: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(initial.title ?? '')
  const [desc, setDesc] = useState(initial.description ?? '')
  const [items, setItems] = useState<CourseItem[]>(initial.items ?? [])
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { void listCatalog(true).then((r) => setCatalog(r.filter((c) => !c.hidden && c.status !== 'review' && (!c.unlisted || c.publishedBy === me)))).catch(() => {}) }, [me])
  const found = useMemo(() => catalog.filter((c) => !items.some((i) => i.quizId === c.id) && c.title.toLowerCase().includes(q.toLowerCase())).slice(0, 8), [catalog, items, q])
  const move = (i: number, d: -1 | 1) => setItems((s) => { const n = [...s]; const j = i + d; if (j < 0 || j >= n.length) return s; [n[i], n[j]] = [n[j], n[i]]; return n })
  const save = async () => {
    setBusy(true)
    try { await saveCourse({ id: initial.id, title, description: desc, items, ownerName, coverEmoji: '📚' }); onSaved() } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={initial.id ? K.edit : K.create} wide>
      <div className="flex flex-col gap-3">
        <label className="label" htmlFor="ct">{K.name}</label>
        <input id="ct" className="input" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        <label className="label" htmlFor="cd">{K.desc}</label>
        <textarea id="cd" className="input min-h-16" maxLength={500} value={desc} onChange={(e) => setDesc(e.target.value)} />
        <p className="label">{K.items}</p>
        <ol className="flex flex-col gap-1.5">
          {items.map((it, i) => (
            <li key={it.quizId} className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm">
              <span className="w-5 font-bold text-muted">{i + 1}</span><BookOpen className="h-4 w-4 text-muted" />
              <span className="min-w-0 flex-1 truncate font-semibold">{it.title}</span>
              <button className="btn btn-ghost-dark btn-icon btn-sm" aria-label="↑" onClick={() => move(i, -1)}><ArrowUp /></button>
              <button className="btn btn-ghost-dark btn-icon btn-sm" aria-label="↓" onClick={() => move(i, 1)}><ArrowDown /></button>
              <button className="btn btn-ghost-dark btn-icon btn-sm text-red-600" aria-label={K.del} onClick={() => setItems((s) => s.filter((x) => x.quizId !== it.quizId))}><X /></button>
            </li>
          ))}
        </ol>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder={K.search} value={q} onChange={(e) => setQ(e.target.value)} aria-label={K.addItem} />
        </div>
        <ul className="flex flex-col gap-1">
          {found.map((c) => (
            <li key={c.id}><button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-surface" onClick={() => setItems((s) => [...s, { quizId: c.id, title: c.title }])}>
              <Plus className="h-4 w-4 text-brand" /><span className="min-w-0 flex-1 truncate">{c.coverEmoji} {c.title}</span><span className="text-xs text-muted">{c.questionCount}</span>
            </button></li>
          ))}
        </ul>
        <div className="flex justify-end"><button className="btn btn-primary" disabled={busy || title.trim().length < 3 || items.length === 0} onClick={() => void save()}><Save />{K.save}</button></div>
      </div>
    </Modal>
  )
}
