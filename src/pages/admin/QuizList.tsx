import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fmtDateTime } from '../../lib/format'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Bot, ChevronDown, Copy, Eye, FileJson, FileSpreadsheet, Folder, FolderInput, FolderOpen, Inbox, LayoutTemplate, Library, ListChecks, Lock, MoreHorizontal,
  Pencil, Play, Plus, Search, Sparkles, Trash2, Users, X,
} from 'lucide-react'
import { createQuiz, deleteQuiz, duplicateQuiz, listQuizzes, loadQuiz, parseQuizJson, setQuizFolder } from '../../firebase/db'
import { launchQuiz } from '../../lib/gameEngine'
import { validateQuestion } from '../../lib/validate'
import { t } from '../../i18n/az'
import { PageHeader } from '../../components/ui'
import { DropMenu, EmptyState } from '../../components/kit'
import { confirmDialog, promptDialog, toast } from '../../components/dialogs'
import { AiImport } from '../../components/AiImport'
import { CsvImport, TemplateGallery } from '../../components/ImportModals'
import type { AdminState } from '../../firebase/auth'
import { canManage, isQuizOwner, orgScope, scopeUid } from '../../lib/access'
import { logAudit } from '../../lib/audit'
import type { Quiz } from '../../types'
import seed from '../../../seed/ai-pretest.json'

const L = t.ql
type Item = Quiz & { count: number }
const NO_FOLDER = '\u0000none'

export default function QuizList() {
  const admin = useOutletContext<AdminState>()
  const { user } = admin
  const nav = useNavigate()
  const [items, setItems] = useState<Item[] | null>(null)
  const [q, setQ] = useState('')
  const [ai, setAi] = useState(false)
  const [tpl, setTpl] = useState(false)
  const [csv, setCsv] = useState(false)
  const [tag, setTag] = useState<string | null>(null)
  const [folder, setFolder] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(() => { void listQuizzes(scopeUid(admin), admin.perms.library, orgScope(admin)).then(setItems).catch(() => setItems([])) }, [admin])
  useEffect(reload, [reload])
  const needle = q.toLocaleLowerCase('az-AZ')
  const filtered = useMemo(() => (items ?? []).filter((x) => `${x.title} ${x.description} ${(x.tags ?? []).join(' ')}`.toLocaleLowerCase('az-AZ').includes(needle)
    && (!tag || (x.tags ?? []).includes(tag)) && (!folder || (folder === NO_FOLDER ? !x.folder : x.folder === folder))), [items, needle, tag, folder])
  const allTags = useMemo(() => [...new Set((items ?? []).flatMap((x) => x.tags ?? []))].sort(), [items])
  const folders = useMemo(() => {
    const m = new Map<string, number>()
    for (const x of items ?? []) if (x.folder) m.set(x.folder, (m.get(x.folder) ?? 0) + 1)
    return [...m].sort((a, b) => a[0].localeCompare(b[0]))
  }, [items])
  const owned = (x: Item) => isQuizOwner(admin, x.ownerUid, x.orgId)

  const importData = async (raw: unknown, fromAi = false) => {
    const { quiz, questions } = parseQuizJson(raw)
    const id = await createQuiz(user!.uid, quiz, questions)
    nav(`/admin/quiz/${id}`, fromAi ? { state: { ai: true } } : undefined)
  }
  const onFile = async (f: File | undefined) => {
    if (!f) return
    try { await importData(JSON.parse(await f.text())) } catch { toast(t.admin.importBad, 'error') }
  }
  const launch = async (id: string) => {
    setBusyId(id)
    try {
      const data = await loadQuiz(id)
      if (!data?.questions.length) { toast(t.admin.noQuestions, 'error'); return }
      if (data.questions.some((x) => validateQuestion(x).length)) { toast(t.admin.cannotLaunch, 'error'); return }
      nav(await launchQuiz(id, user!.uid))
    } catch { toast(t.app.error, 'error') } finally { setBusyId(null) }
  }
  const newBlank = async () => nav(`/admin/quiz/${await createQuiz(user!.uid, { title: t.admin.untitled })}`)
  const move = async (x: Item) => {
    const f = await promptDialog({ title: t.folders.move, body: L.moveHint, label: L.folderName, initial: x.folder ?? '', suggestions: folders.map(([n]) => n), maxLength: 40, allowEmpty: true })
    if (f === null) return
    await setQuizFolder(x.id, f).then(() => toast(L.moved)).catch(() => toast(t.app.error, 'error')); reload()
  }
  const renameFolder = async (name: string) => {
    const f = await promptDialog({ title: L.renameFolder, label: L.folderName, initial: name, maxLength: 40 })
    if (!f || f === name) return
    await Promise.all((items ?? []).filter((x) => x.folder === name && owned(x)).map((x) => setQuizFolder(x.id, f))).catch(() => toast(t.app.error, 'error'))
    setFolder(f); reload()
  }
  const deleteFolder = async (name: string) => {
    if (!(await confirmDialog({ title: `${L.deleteFolder}: ${name}?`, body: L.deleteFolderBody, danger: true }))) return
    await Promise.all((items ?? []).filter((x) => x.folder === name && owned(x)).map((x) => setQuizFolder(x.id, ''))).catch(() => toast(t.app.error, 'error'))
    setFolder(null); reload()
  }
  const del = async (x: Item) => {
    if (!(await confirmDialog({ title: t.admin.deleteConfirm(x.title), danger: true }))) return
    try { await deleteQuiz(x.id); void logAudit('quiz_deleted', { target: x.id, details: { title: x.title } }); toast(L.deleted) } catch { toast(t.admin.deleteFailed, 'error') }
    reload()
  }
  const fmt = (x: Quiz) => (x.updatedAt ? fmtDateTime(x.updatedAt.toDate()) : '')
  const filtering = !!(q || tag || folder)

  const folderNav = (
    <nav className="flex flex-col gap-0.5" aria-label={L.folders}>
      {([[null, t.folders.all, items?.length ?? 0, ListChecks], ...folders.map(([n, c]) => [n, n, c, Folder] as const), ...(folders.length ? [[NO_FOLDER, L.noFolder, (items ?? []).filter((x) => !x.folder).length, Inbox] as const] : [])] as const).map(([key, label, n, Icon]) => {
        const on = folder === key
        const real = key && key !== NO_FOLDER
        return (
          <div key={key ?? '_all'} className={`group flex items-center rounded-lg transition ${on ? 'bg-white/[.07] text-fg' : 'text-muted hover:bg-white/[.04] hover:text-fg'}`}>
            <button className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left text-[13.5px] font-medium" onClick={() => setFolder(key)}>
              {on && real ? <FolderOpen className="h-4 w-4 shrink-0 text-orange-300" /> : <Icon className={`h-4 w-4 shrink-0 ${on ? 'text-orange-300' : ''}`} />}
              <span className="truncate">{label}</span>
              <span className="ml-auto text-xs tabular text-muted">{n}</span>
            </button>
            {real && (
              <DropMenu label={L.more} btnClass="btn btn-ghost-dark btn-icon btn-sm mr-0.5 opacity-0 transition group-hover:opacity-100 focus:opacity-100" items={[
                { label: L.renameFolder, icon: Pencil, onClick: () => void renameFolder(key) },
                { label: L.deleteFolder, icon: Trash2, danger: true, onClick: () => void deleteFolder(key) },
              ]}><MoreHorizontal /></DropMenu>
            )}
          </div>
        )
      })}
    </nav>
  )

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-8">
      <PageHeader title={t.admin.quizzes} sub={items ? L.count(items.length) : undefined}>
        {admin.perms.createQuiz && <>
          <button className="btn btn-soft" onClick={() => setAi(true)}><Bot />{t.admin.aiTitle}</button>
          <DropMenu label={L.import} btnClass="btn btn-secondary" items={[
            { label: t.templates.button, icon: LayoutTemplate, onClick: () => setTpl(true) },
            { label: t.csv.button, icon: FileSpreadsheet, onClick: () => setCsv(true) },
            { label: t.admin.importJson, icon: FileJson, onClick: () => fileRef.current?.click() },
          ]}>{L.import}<ChevronDown className="opacity-60" /></DropMenu>
          <button className="btn btn-primary" onClick={() => void newBlank()}><Plus />{t.admin.newQuiz}</button>
        </>}
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
      </PageHeader>

      {!items ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-64" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Sparkles} title={t.admin.quizzes} text={t.admin.empty} action={
          <div className="flex flex-wrap justify-center gap-2">
            {admin.perms.createQuiz && <button className="btn btn-primary" onClick={() => setAi(true)}><Bot />{t.admin.aiTitle}</button>}
            <button className="btn btn-secondary" onClick={() => void importData(seed)}><Sparkles />{t.admin.importSeed}</button>
          </div>
        } />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <aside className="hidden lg:block">
            <p className="mb-2 px-3 text-[10.5px] font-semibold uppercase tracking-[.12em] text-muted/70">{L.folders}</p>
            {folderNav}
          </aside>
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="relative min-w-52 flex-1 sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input className="input pl-9" placeholder={t.admin.search} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t.admin.search} />
              </div>
              {filtering && <button className="btn btn-ghost-dark btn-sm" onClick={() => { setQ(''); setTag(null); setFolder(null) }}><X />{L.clear}</button>}
            </div>
            {folders.length > 0 && (
              <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:hidden scrollbar-thin">
                {[[null, t.folders.all] as const, ...folders.map(([n]) => [n, n] as const)].map(([k, label]) => (
                  <button key={k ?? '_all'} className={`chip shrink-0 ${folder === k ? 'chip-brand' : 'chip-muted'}`} onClick={() => setFolder(k)}><Folder className="h-3 w-3" />{label}</button>
                ))}
              </div>
            )}
            {allTags.length > 0 && (
              <div className="mb-5 flex flex-wrap gap-1.5">
                {[null, ...allTags].map((tg) => (
                  <button key={tg ?? '_all'} className={`chip ${tag === tg ? 'chip-brand' : 'chip-muted hover:text-fg'}`} onClick={() => setTag(tg)}>{tg ? `#${tg}` : t.tags.all}</button>
                ))}
              </div>
            )}
            {filtered.length === 0 ? (
              <EmptyState icon={Search} title={L.nothing} action={<button className="btn btn-secondary btn-sm" onClick={() => { setQ(''); setTag(null); setFolder(null) }}>{L.clear}</button>} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((x, i) => {
                  const manage = canManage(admin, x.ownerUid, x.orgId, x.editors)
                  const coEd = x.ownerUid !== user?.uid && (x.editors ?? []).includes((user?.email ?? '').toLowerCase())
                  return (
                    <motion.article key={x.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.025 }} className="card card-hover group flex flex-col overflow-hidden">
                      <button className="relative flex h-24 items-center gap-3 overflow-hidden px-4 text-left" onClick={() => nav(`/admin/quiz/${x.id}`)} aria-label={x.title}
                        style={{ background: `radial-gradient(120% 140% at 0% 0%, ${x.coverColor}55, transparent 60%), linear-gradient(180deg, rgba(255,255,255,.03), transparent)` }}>
                        <span className="pointer-events-none absolute -right-3 -top-5 select-none text-[96px] leading-none opacity-[.13] transition group-hover:scale-110 group-hover:opacity-20">{x.coverEmoji}</span>
                        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 text-2xl shadow-lg" style={{ background: `${x.coverColor}33` }}>{x.coverEmoji}</span>
                        <span className="relative ml-auto flex flex-col items-end gap-1">
                          <span className="chip chip-muted bg-black/30 tabular">{t.admin.questionsCount(x.count)}</span>
                        </span>
                      </button>
                      <div className="flex flex-1 flex-col gap-2 border-t border-line p-4">
                        <h2 className="line-clamp-1 font-sans text-[15px] font-semibold">{x.title || t.admin.untitled}</h2>
                        {x.description && <p className="line-clamp-2 text-sm text-muted">{x.description}</p>}
                        <div className="flex flex-wrap gap-1">
                          {x.folder && <span className="chip chip-muted"><Folder className="h-3 w-3" />{x.folder}</span>}
                          {coEd && <span className="chip chip-info"><Users className="h-3 w-3" />{t.folders.coEdited}</span>}
                          {x.shared && <span className="chip chip-ok" title={t.admin.shareHint}><Library className="h-3 w-3" />{t.admin.shared}</span>}
                          {!manage && <span className="chip chip-muted"><Lock className="h-3 w-3" />{t.admin.locked}</span>}
                          {(x.tags ?? []).slice(0, 3).map((tg) => <span key={tg} className="chip chip-brand">#{tg}</span>)}
                        </div>
                        <p className="mt-auto pt-1 text-xs text-muted">{t.admin.lastEdit}: {fmt(x)}</p>
                      </div>
                      <div className="flex items-center gap-1 border-t border-line p-2.5">
                        <button className="btn btn-primary btn-sm flex-1" disabled={busyId === x.id || x.count === 0 || !admin.perms.runGames} onClick={() => void launch(x.id)}><Play className="fill-current" />{busyId === x.id ? t.admin.launching : t.admin.launch}</button>
                        <button className="btn btn-ghost-dark btn-icon btn-sm" title={manage ? t.admin.edit : t.admin.view} aria-label={manage ? t.admin.edit : t.admin.view} onClick={() => nav(`/admin/quiz/${x.id}`)}>{manage ? <Pencil /> : <Eye />}</button>
                        <DropMenu label={L.more} items={[
                          { label: t.folders.move, icon: FolderInput, hidden: !owned(x), onClick: () => void move(x) },
                          { label: t.admin.duplicate, icon: Copy, onClick: () => void duplicateQuiz(x.id, user!.uid, t.admin.copySuffix).then(() => { toast(L.duplicated); reload() }) },
                          { label: t.app.delete, icon: Trash2, danger: true, hidden: !owned(x), onClick: () => void del(x) },
                        ]}><MoreHorizontal /></DropMenu>
                      </div>
                    </motion.article>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
      <AiImport open={ai} onClose={() => setAi(false)} onImport={importData} />
      <TemplateGallery open={tpl} onClose={() => setTpl(false)} onPick={async (raw) => { if (raw) await importData(raw); else await newBlank() }} />
      <CsvImport open={csv} onClose={() => setCsv(false)} onImport={async (title, qs) => nav(`/admin/quiz/${await createQuiz(user!.uid, { title }, qs)}`)} />
    </div>
  )
}
