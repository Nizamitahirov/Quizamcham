import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import { createQuiz, deleteQuiz, duplicateQuiz, listQuizzes, loadQuiz, parseQuizJson } from '../../firebase/db'
import { createGame } from '../../lib/gameEngine'
import { validateQuestion } from '../../lib/validate'
import { t } from '../../i18n/az'
import { Spinner } from '../../components/ui'
import { QRDownload } from '../../components/QRBlock'
import type { AdminState } from '../../firebase/auth'
import type { Quiz } from '../../types'
import seed from '../../../seed/ai-pretest.json'

export default function QuizList() {
  const { user } = useOutletContext<AdminState>()
  const nav = useNavigate()
  const [items, setItems] = useState<(Quiz & { count: number })[] | null>(null)
  const [msg, setMsg] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(() => { void listQuizzes().then(setItems).catch(() => setItems([])) }, [])
  useEffect(reload, [reload])

  const importData = async (raw: unknown) => {
    try {
      const { quiz, questions } = parseQuizJson(raw)
      const id = await createQuiz(user!.uid, quiz, questions)
      setMsg(t.admin.importOk)
      nav(`/admin/quiz/${id}`)
    } catch {
      setMsg(t.admin.importBad)
    }
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
      if (data.questions.some((q) => validateQuestion(q).length)) { setMsg(t.admin.cannotLaunch); return }
      const gid = await createGame(id, user!.uid)
      nav(`/host/${gid}`)
    } catch {
      setMsg(t.app.error)
    } finally {
      setBusyId(null)
    }
  }

  const fmt = (q: Quiz) => q.updatedAt?.toDate().toLocaleString('az-AZ', { dateStyle: 'medium', timeStyle: 'short' }) ?? ''

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-3xl">{t.admin.quizzes}</h1>
        <button className="btn btn-primary" onClick={async () => nav(`/admin/quiz/${await createQuiz(user!.uid, { title: t.admin.untitled })}`)}>{t.admin.newQuiz}</button>
        <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>{t.admin.importJson}</button>
        <button className="btn btn-secondary" onClick={() => void importData(seed)}>{t.admin.importSeed}</button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <span className="font-extrabold">📌 {t.admin.permanentQr}:</span>
        <code className="rounded bg-slate-100 px-2 py-1">{window.location.origin}/play</code>
        <QRDownload url={`${window.location.origin}/play`} filename="quizamcham-play-qr.png" label={t.admin.downloadQr} />
        <span className="text-sm text-slate-500">{t.admin.permanentQrHint}</span>
      </div>
      {msg && <p className="mb-4 rounded-xl bg-amber-100 px-4 py-2 font-bold text-amber-900" role="status">{msg}</p>}
      {!items ? <div className="text-ink"><Spinner /></div> : items.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-lg text-slate-500">{t.admin.empty}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((q, i) => (
            <motion.div key={q.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="card flex flex-col overflow-hidden">
              <div className="flex items-center gap-3 p-4 text-white" style={{ background: q.coverColor }}>
                <span className="text-4xl">{q.coverEmoji}</span>
                <div className="min-w-0">
                  <h2 className="truncate text-lg">{q.title || t.admin.untitled}</h2>
                  <p className="text-sm opacity-90">{t.admin.questionsCount(q.count)}</p>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4">
                {q.description && <p className="line-clamp-2 text-sm text-slate-600">{q.description}</p>}
                <p className="text-xs text-slate-400">{t.admin.lastEdit}: {fmt(q)}</p>
                <div className="mt-auto flex flex-wrap gap-2">
                  <button className="btn btn-ok flex-1" disabled={busyId === q.id || q.count === 0} onClick={() => void launch(q.id)}>{busyId === q.id ? t.admin.launching : t.admin.launch}</button>
                  <button className="btn btn-ghost-dark" onClick={() => nav(`/admin/quiz/${q.id}`)}>{t.admin.edit}</button>
                  <button className="btn btn-ghost-dark" onClick={async () => { await duplicateQuiz(q.id, user!.uid, t.admin.copySuffix); reload() }}>{t.admin.duplicate}</button>
                  <button className="btn btn-danger" onClick={async () => { if (confirm(t.admin.deleteConfirm(q.title))) { await deleteQuiz(q.id); reload() } }}>{t.app.delete}</button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
