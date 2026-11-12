import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fmtDateTime } from '../../lib/format'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Bot, ChevronDown, Copy, Eye, FileJson, FileSpreadsheet, Folder, FolderInput, FolderOpen, Inbox, LayoutTemplate, Library, ListChecks, Lock, MoreHorizontal,
  FolderPlus, Pencil, Play, Plus, Search, Sparkles, Trash2, UserRound, Users, X,
} from 'lucide-react'
import { createQuiz, deleteQuiz, duplicateQuiz, listQuizzes, loadFolderList, loadQuiz, normFolder, parseQuizJson, saveFolderList, setQuizFolder } from '../../firebase/db'
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
const OTHERS = '\u0000others'
const same = (a: string, b: string) => a.toLocaleLowerCase('az-AZ') === b.toLocaleLowerCase('az-AZ')

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

  const [saved, setSaved] = useState<string[]>([])
  const [dragOver, setDragOver] = useState<string | null>(null)
  const uid = user?.uid ?? ''
  const reload = useCallback(() => { void listQuizzes(scopeUid(admin), admin.perms.library, orgScope(admin)).then(setItems).catch(() => setItems([])) }, [admin])
  useEffect(reload, [reload])
  useEffect(() => { if (uid) void loadFolderList(uid).then(setSaved) }, [uid])
  // Qovluqlar şəxsidir: yalnız öz quizlərim + saxlanmış (boş) qovluqlar; başqalarının quizləri ayrıca bölmədə
  const mine = useCallback((x: Item) => x.ownerUid === uid, [uid])
  const needle = q.toLocaleLowerCase('az-AZ')
  const inFolder = useCallback((x: Item, f: string | null) => !f || (f === OTHERS ? !mine(x) : f === NO_FOLDER ? mine(x) && !x.folder : mine(x) && !!x.folder && same(x.folder, f)), [mine])
  const filtered = useMemo(() => (items ?? []).filter((x) => `${x.title} ${x.description} ${(x.tags ?? []).join(' ')}`.toLocaleLowerCase('az-AZ').includes(needle)
    && (!tag || (x.tags ?? []).includes(tag)) && inFolder(x, folder)), [items, needle, tag, folder, inFolder])
  const allTags = useMemo(() => [...new Set((items ?? []).flatMap((x) => x.tags ?? []))].sort(), [items])
  const folders = useMemo(() => {
    const m = new Map<string, number>()
    for (const n of saved) if (![...m.keys()].some((k) => same(k, n))) m.set(n, 0)
    for (const x of items ?? []) {
      if (!mine(x) || !x.folder) continue
      const k = [...m.keys()].find((n) => same(n, x.folder!)) ?? x.folder
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return [...m].sort((a, b) => a[0].localeCompare(b[0], 'az'))
  }, [items, saved, mine])
  const othersCount = (items ?? []).filter((x) => !mine(x)).length
  const looseCount = (items ?? []).filter((x) => mine(x) && !x.folder).length
  // seçilmiş qovluq silinibsə / adı dəyişibsə — "Hamısı"na qayıt
  useEffect(() => {
    if (folder && folder !== NO_FOLDER && folder !== OTHERS && items && !folders.some(([n]) => same(n, folder))) setFolder(null)
  }, [folder, folders, items])
  const owned = (x: Item) => isQuizOwner(admin, x.ownerUid, x.orgId)
  const canonical = (name: string) => { const n = normFolder(name); return folders.find(([f]) => same(f, n))?.[0] ?? n }
  const remember = async (names: string[]) => { setSaved(names); await saveFolderList(uid, names).catch(() => {}) }

  const importData = async (raw: unknown, fromAi = false) => {
    const { quiz, questions } = parseQuizJson(raw)
    const id = await createQuiz(user!.uid, folder && folder !== NO_FOLDER && folder !== OTHERS ? { ...quiz, folder } : quiz, questions)
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
  const newBlank = async () => nav(`/admin/quiz/${await createQuiz(user!.uid, { title: t.admin.untitled, ...(folder && folder !== NO_FOLDER && folder !== OTHERS ? { folder } : {}) })}`)
  const putIn = async (x: Item, name: string) => {
    const f = name ? canonical(name) : ''
    if ((x.folder ?? '') === f) return
    setItems((list) => list?.map((y) => (y.id === x.id ? { ...y, folder: f || undefined } : y)) ?? list) // dərhal görünsün
    try {
      await setQuizFolder(x.id, f)
      if (f && !saved.some((n) => same(n, f))) await remember([...saved, f])
      toast(L.moved)
    } catch { toast(t.app.error, 'error') }
    reload()
  }
  const move = async (x: Item) => {
    const f = await promptDialog({ title: t.folders.move, body: L.moveHint, label: L.folderName, initial: x.folder ?? '', suggestions: folders.map(([n]) => n), maxLength: 40, allowEmpty: true })
    if (f === null) return
    await putIn(x, f)
  }
  const newFolder = async () => {
    const raw = await promptDialog({ title: L.newFolder, label: L.folderName, maxLength: 40 })
    const f = raw ? normFolder(raw) : ''
    if (!f) return
    if (folders.some(([n]) => same(n, f))) { toast(L.folderExists, 'error'); setFolder(canonical(f)); return }
    await remember([...saved, f]); setFolder(f); toast(L.created)
  }
  const renameFolder = async (name: string) => {
    const raw = await promptDialog({ title: L.renameFolder, label: L.folderName, initial: name, maxLength: 40 })
    const f = raw ? normFolder(raw) : ''
    if (!f || f === name) return
    const target = folders.find(([n]) => same(n, f) && n !== name)?.[0] ?? f // mövcud qovluqla eyni addırsa — birləşdirilir
    try {
      await Promise.all((items ?? []).filter((x) => mine(x) && x.folder && same(x.folder, name)).map((x) => setQuizFolder(x.id, target)))
      await remember([...saved.filter((n) => !same(n, name) && !same(n, target)), target])
    } catch { toast(t.app.error, 'error') }
    setFolder(target); reload()
  }
  const deleteFolder = async (name: string) => {
    if (!(await confirmDialog({ title: `${L.deleteFolder}: ${name}?`, body: L.deleteFolderBody, danger: true }))) return
    try {
      await Promise.all((items ?? []).filter((x) => mine(x) && x.folder && same(x.folder, name)).map((x) => setQuizFolder(x.id, '')))
      await remember(saved.filter((n) => !same(n, name)))
    } catch { toast(t.app.error, 'error') }
    setFolder(null); reload()
  }
  const folderMenu = (name: string, btnClass?: string) => (
    <DropMenu label={L.folderActions} btnClass={btnClass} items={[
      { label: L.renameFolder, icon: Pencil, onClick: () => void renameFolder(name) },
      { label: L.deleteFolder, icon: Trash2, danger: true, onClick: () => void deleteFolder(name) },
    ]}><MoreHorizontal /></DropMenu>
  )
  const dropProps = (key: string | null) => (key === OTHERS || key === null ? {} : {
    onDragOver: (e: React.DragEvent) => { if (e.dataTransfer.types.includes('text/jabr-quiz')) { e.preventDefault(); setDragOver(key) } },
    onDragLeave: () => setDragOver((d) => (d === key ? null : d)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault(); setDragOver(null)
      const x = (items ?? []).find((y) => y.id === e.dataTransfer.getData('text/jabr-quiz'))
      if (x && mine(x)) void putIn(x, key === NO_FOLDER ? '' : key)
    },
  })
  const del = async (x: Item) => {
    if (!(await confirmDialog({ title: t.admin.deleteConfirm(x.title), danger: true }))) return
    try { await deleteQuiz(x.id); void logAudit('quiz_deleted', { target: x.id, details: { title: x.title } }); toast(L.deleted) } catch { toast(t.admin.deleteFailed, 'error') }
    reload()
  }
  const fmt = (x: Quiz) => (x.updatedAt ? fmtDateTime(x.updatedAt.toDate()) : '')
  const filtering = !!(q || tag || folder)

  type Entry = readonly [string | null, string, number, typeof Folder]
  const entries: Entry[] = [
    [null, t.folders.all, items?.length ?? 0, ListChecks],
    ...folders.map(([n, c]) => [n, n, c, Folder] as const),
    ...(folders.length || looseCount !== (items?.length ?? 0) ? [[NO_FOLDER, L.noFolder, looseCount, Inbox] as const] : []),
    ...(othersCount ? [[OTHERS, L.others, othersCount, UserRound] as const] : []),
  ]
  const isReal = (k: string | null): k is string => !!k && k !== NO_FOLDER && k !== OTHERS
  const folderNav = (
    <nav className="flex flex-col gap-0.5" aria-label={L.folders}>
      {entries.map(([key, label, n, Icon]) => {
        const on = folder === key || (isReal(key) && !!folder && same(folder, key))
        return (
          <div key={key ?? '_all'} {...dropProps(key)} className={`group flex items-center rounded-lg transition ${dragOver !== null && dragOver === key ? 'bg-orange-500/15 ring-1 ring-orange-400/50' : on ? 'bg-white/[.07] text-fg' : 'text-muted hover:bg-white/[.04] hover:text-fg'}`}>
            <button className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left text-[13.5px] font-medium" onClick={() => setFolder(key)}>
              {on && isReal(key) ? <FolderOpen className="h-4 w-4 shrink-0 text-orange-300" /> : <Icon className={`h-4 w-4 shrink-0 ${on ? 'text-orange-300' : ''}`} />}
              <span className="truncate">{label}</span>
              <span className="ml-auto text-xs tabular text-muted">{n}</span>
            </button>
            {isReal(key) && folderMenu(key, 'btn btn-ghost-dark btn-icon btn-sm mr-0.5 opacity-0 transition group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100')}
          </div>
        )
      })}
      {admin.perms.createQuiz && <button className="mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] font-medium text-muted transition hover:bg-white/[.04] hover:text-fg" onClick={() => void newFolder()}><FolderPlus className="h-4 w-4" />{L.newFolder}</button>}
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
            <div className="-mx-1 mb-3 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 lg:hidden scrollbar-thin">
              {entries.map(([k, label, n]) => {
                const on = folder === k || (isReal(k) && !!folder && same(folder, k))
                return <button key={k ?? '_all'} className={`chip shrink-0 ${on ? 'chip-brand' : 'chip-muted'}`} onClick={() => setFolder(k)}><Folder className="h-3 w-3" />{label}<span className="opacity-60">{n}</span></button>
              })}
              {admin.perms.createQuiz && <button className="chip chip-muted shrink-0" onClick={() => void newFolder()}><FolderPlus className="h-3 w-3" />{L.newFolder}</button>}
              {isReal(folder) && <span className="shrink-0">{folderMenu(folder, 'btn btn-ghost-dark btn-icon btn-sm')}</span>}
            </div>
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
                    <motion.article key={x.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.025 }} className="card card-hover group flex flex-col overflow-hidden"
                      draggable={mine(x)} onDragStartCapture={(e: React.DragEvent) => { e.dataTransfer.setData('text/jabr-quiz', x.id); e.dataTransfer.effectAllowed = 'move' }}>
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
                          {x.folder && mine(x) && <span className="chip chip-muted"><Folder className="h-3 w-3" />{x.folder}</span>}
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
                          { label: t.folders.move, icon: FolderInput, hidden: !mine(x), onClick: () => void move(x) },
                          { label: t.admin.duplicate, icon: Copy, hidden: !admin.perms.createQuiz, onClick: () => void duplicateQuiz(x.id, user!.uid, t.admin.copySuffix).then(() => { toast(L.duplicated); reload() }, () => toast(t.app.error, 'error')) },
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
