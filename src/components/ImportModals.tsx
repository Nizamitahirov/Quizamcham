import { useMemo, useRef, useState } from 'react'
import { Download, FilePlus2, FileSpreadsheet, Upload } from 'lucide-react'
import { t } from '../i18n/az'
import { Modal } from './ui'
import { toCsv, download } from '../lib/csv'
import { CSV_TEMPLATE, parseTable, rowsToQuestions } from '../lib/csvImport'
import type { Question } from '../types'
import aiPretest from '../../seed/ai-pretest.json'
import icebreaker from '../../seed/icebreaker.json'
import ethics from '../../seed/hr-ai-ethics.json'

const TEMPLATES = [aiPretest, icebreaker, ethics] as { title: string; description?: string; coverEmoji?: string; coverColor?: string; questions: unknown[] }[]

/** Şablon qalereyası. `null` → boş quiz. */
export function TemplateGallery({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (raw: unknown | null) => void }) {
  const T = t.templates
  return (
    <Modal open={open} onClose={onClose} title={T.title} wide>
      <p className="mb-4 text-sm text-muted">{T.sub}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => onPick(null)} className="flex items-center gap-4 rounded-2xl border border-dashed border-line p-4 text-left transition hover:border-brand">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-brand"><FilePlus2 /></span>
          <span><span className="block font-bold">{T.blank}</span><span className="text-xs text-muted">{T.blankDesc}</span></span>
        </button>
        {TEMPLATES.map((tp) => (
          <button key={tp.title} type="button" onClick={() => onPick(tp)} className="flex items-center gap-4 overflow-hidden rounded-2xl border border-line p-0 text-left transition hover:shadow-[0_0_0_2px_#E8202A]">
            <span className="flex h-full min-h-20 w-20 shrink-0 items-center justify-center text-4xl" style={{ background: `linear-gradient(135deg, ${tp.coverColor ?? '#E8202A'}, #FF8A1A)` }}>{tp.coverEmoji}</span>
            <span className="py-3 pr-3"><span className="block font-bold leading-snug">{tp.title}</span><span className="line-clamp-2 text-xs text-muted">{tp.description}</span><span className="chip chip-brand mt-1">{T.questions(tp.questions.length)}</span></span>
          </button>
        ))}
      </div>
    </Modal>
  )
}

/** Excel / CSV idxalı. */
export function CsvImport({ open, onClose, onImport }: { open: boolean; onClose: () => void; onImport: (title: string, questions: Question[]) => Promise<void> }) {
  const C = t.csv
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const parsed = useMemo(() => (text.trim() ? rowsToQuestions(parseTable(text)) : null), [text])
  const go = async () => {
    if (!parsed?.questions.length) return
    setBusy(true)
    try { await onImport(title.trim() || t.admin.untitled, parsed.questions) } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title={C.title} wide>
      <p className="mb-2 text-sm text-muted">{C.desc}</p>
      <p className="mb-3 text-xs font-semibold text-muted">{C.columns}</p>
      <div className="mb-3 flex flex-wrap gap-2">
        <button className="btn btn-soft btn-sm" onClick={() => download('quizamcham-sablon.csv', toCsv(CSV_TEMPLATE))}><Download />{C.template}</button>
        <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}><Upload />{C.file}</button>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); e.target.value = '' }} />
      </div>
      <label className="label">{C.title2}</label>
      <input className="input mb-3" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
      <label className="label">{C.paste}</label>
      <textarea className="input min-h-44 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={CSV_TEMPLATE.slice(0, 2).map((r) => r.join('\t')).join('\n')} />
      {parsed && (
        <div className="mt-3 rounded-xl bg-surface p-3 text-sm">
          <p className="flex items-center gap-2 font-bold"><FileSpreadsheet className="h-4 w-4 text-brand" />{C.parsed(parsed.questions.length, parsed.errors.length)}</p>
          {parsed.errors.slice(0, 6).map((e) => <p key={e.row} className="text-xs text-red-600">{C.errorRow(e.row, e.msg)}</p>)}
        </div>
      )}
      <div className="mt-4 flex justify-end"><button className="btn btn-primary" disabled={!parsed?.questions.length || busy} onClick={() => void go()}><Upload />{C.import}</button></div>
    </Modal>
  )
}
