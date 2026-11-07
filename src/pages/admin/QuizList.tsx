import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fmtDateTime } from '../../lib/format'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, Lock, Bot, Copy, FileJson, FileSpreadsheet, LayoutTemplate, Pencil, Play, Plus, Search, Sparkles, Trash2, Library } from 'lucide-react'
import { createQuiz, deleteQuiz, duplicateQuiz, listQuizzes, loadQuiz, parseQuizJson } from '../../firebase/db'
import { launchQuiz } from '../../lib/gameEngine'
import { validateQuestion } from '../../lib/validate'
import { t } from '../../i18n/az'
import { PageHeader, Spinner } from '../../components/ui'
import { AiImport } from '../../components/AiImport'
import { CsvImport, TemplateGallery } from '../../components/ImportModals'
import type { AdminState } from '../../firebase/auth'
import { canManage, scopeUid } from '../../lib/access'
import { logAudit } from '../../lib/audit'
import type { Quiz } from '../../types'
import seed from '../../../seed/ai-pretest.json'

export default function QuizList() {
  const admin = useOutletContext<AdminState>()
  const { user } = admin
  const nav = useNavigate()
  const [items, setItems] = useState<(Quiz & { count: number })[] | null>(null)
  const [msg, setMsg] = useState('')
  const [q, setQ] = useState('')
  const [ai, setAi] = useState(false)
  const [tpl, setTpl] = useState(false)
  const [csv, setCsv] = useState(false)
  const [tag, setTag] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(() => { void listQuizzes(scopeUid(admin)).then(setItems).catch(() => setItems([])) }, [admin])
  useEffect(reload, [reload])
  const filtered = useMemo(() => (items ?? []).filter((x) => `${x.title} ${x.description} ${(x.tags ?? []).join(' ')}`.toLocaleLowerCase('az-AZ').includes(q.toLocaleLowerCase('az-AZ')) && (!tag || (x.tags ?? []).includes(tag))), [items, q, tag])
  const allTags = useMemo(() => [...new Set((items ?? []).flatMap((x) => x.tags ?? []))].sort(), [items])

  const importData = async (raw: unknown) => {
    const { quiz, questions } = parseQuizJson(raw)
    const id = await createQuiz(user!.uid, quiz, questions)
    nav(`/admin/quiz/${id}`)
  }
  const onFile = async (f: File | undefined) => {
    if (!f) return
    try { await importData(JSON.parse(await f.text())) } catch { setMsg(t.admin.importBad) }
  }
  const launch = async (id: string) => {
    setBusyId(id)
    setMsg('')
    try {
      const data = await loadQuiz(id)
      if (!data?.questions.length) { setMsg(t.admin.noQuestions); return }
      if (data.questions.some((x) => validateQuestion(x).length)) { setMsg(t.admin.cannotLaunch); return }
      nav(await launchQuiz(id, user!.uid))
    } catch {
      setMsg(t.app.error)
    } finally {
      setBusyId(null)
    }
  }
  const fmt = (x: Quiz) => (x.updatedAt ? fmtDateTime(x.updatedAt.toDate()) : '')

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-8">
      <PageHeader title={t.admin.quizzes} sub={items ? t.admin.questionsCount(items.length).replace('sual', 'quiz') : undefined}>
        <button className="btn btn-secondary" onClick={() => setTpl(true)}><LayoutTemplate className="text-brand" />{t.templates.button}</button>
        <button className="btn btn-secondary" onClick={() => setCsv(true)}><FileSpreadsheet className="text-brand" />{t.csv.button}</button>
        <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}><FileJson />{t.admin.importJson}</button>
        <button className="btn btn-secondary" onClick={() => setAi(true)}><Bot className="text-brand" />AI</button>
        <button className="btn btn-primary" onClick={async () => nav(`/admin/quiz/${await createQuiz(user!.uid, { title: t.admin.untitled })}`)}><Plus />{t.admin.newQuiz}</button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
      </PageHeader>
      <div className="relative mb-6 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input className="input pl-9" placeholder={t.admin.search} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {allTags.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {[null, ...allTags].map((tg) => (
            <button key={tg ?? '_all'} className={`chip ${tag === tg ? 'text-white' : 'bg-white text-[#4A4E69] ring-1 ring-line'}`} style={tag === tg ? { background: 'var(--grad)' } : undefined} onClick={() => setTag(tg)}>{tg ?? t.tags.all}</button>
          ))}
        </div>
      )}
      {msg && <p className="mb-4 rounded-xl bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800" role="status">{msg}</p>}
      {!items ? <Spinner /> : items.length === 0 ? (
        <div className="card flex flex-col items-center gap-4 p-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-white" style={{ background: 'var(--grad)' }}><Sparkles /></span>
          <p className="max-w-sm text-muted">{t.admin.empty}</p>
          <button className="btn btn-primary" onClick={() => void importData(seed)}><Sparkles />{t.admin.importSeed}</button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((x, i) => (
            <motion.div key={x.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5" style={{ boxShadow: 'var(--shadow)' }}>
              <div className="relative flex h-28 items-end gap-3 overflow-hidden p-4 text-white" style={{ background: `linear-gradient(135deg, ${x.coverColor} 0%, #FF8A1A 130%)` }}>
                <span className="pointer-events-none absolute -right-6 -top-6 text-[110px] leading-none opacity-20">{x.coverEmoji}</span>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-3xl backdrop-blur">{x.coverEmoji}</span>
                <span className="chip relative ml-auto bg-black/25 text-white">{t.admin.questionsCount(x.count)}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <h2 className="line-clamp-1 text-base font-bold">{x.title || t.admin.untitled}</h2>
                {x.description && <p className="line-clamp-2 text-sm text-muted">{x.description}</p>}
                {(x.tags ?? []).length > 0 && <div className="flex flex-wrap gap-1">{x.tags!.map((tg) => <span key={tg} className="chip chip-brand">{tg}</span>)}</div>}
                <p className="text-xs text-muted">{t.admin.lastEdit}: {fmt(x)}</p>
                {!canManage(admin, x.ownerUid) && <span className="chip self-start bg-surface text-[#4A4E69]"><Lock className="h-3 w-3" />{t.admin.locked}</span>}
                {x.shared && <span className="chip self-start bg-green-50 text-green-800" title={t.admin.shareHint}><Library className="h-3 w-3" />{t.admin.shared}</span>}
                <div className="mt-auto flex items-center gap-1 pt-2">
                  <button className="btn btn-primary btn-sm flex-1" disabled={busyId === x.id || x.count === 0} onClick={() => void launch(x.id)}><Play className="fill-current" />{busyId === x.id ? t.admin.launching : t.admin.launch}</button>
                  <button className="btn btn-ghost-dark btn-sm btn-icon" title={canManage(admin, x.ownerUid) ? t.admin.edit : t.admin.view} onClick={() => nav(`/admin/quiz/${x.id}`)}>{canManage(admin, x.ownerUid) ? <Pencil /> : <Eye />}</button>
                  <button className="btn btn-ghost-dark btn-sm btn-icon" title={t.admin.duplicate} onClick={async () => { await duplicateQuiz(x.id, user!.uid, t.admin.copySuffix); reload() }}><Copy /></button>
                  {canManage(admin, x.ownerUid) && <button className="btn btn-ghost-dark btn-sm btn-icon text-red-600" title={t.app.delete} onClick={async () => { if (confirm(t.admin.deleteConfirm(x.title))) { try { await deleteQuiz(x.id); void logAudit('quiz_deleted', { target: x.id, details: { title: x.title } }) } catch { setMsg(t.admin.deleteFailed) } reload() } }}><Trash2 /></button>}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      <AiImport open={ai} onClose={() => setAi(false)} onImport={importData} />
      <TemplateGallery open={tpl} onClose={() => setTpl(false)} onPick={async (raw) => { if (raw) await importData(raw); else nav(`/admin/quiz/${await createQuiz(user!.uid, { title: t.admin.untitled })}`) }} />
      <CsvImport open={csv} onClose={() => setCsv(false)} onImport={async (title, qs) => nav(`/admin/quiz/${await createQuiz(user!.uid, { title }, qs)}`)} />
    </div>
  )
}
