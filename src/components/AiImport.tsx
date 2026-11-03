import { useState } from 'react'
import { Check, ClipboardCopy, Upload } from 'lucide-react'
import { t } from '../i18n/az'
import { buildAiPrompt } from '../lib/aiPrompt'
import { Modal } from './ui'

/** AI ilə sual yaratma: prompt qurucu + JSON yapışdırma. */
export function AiImport({ open, onClose, onImport }: { open: boolean; onClose: () => void; onImport: (raw: unknown) => Promise<void> }) {
  const [topic, setTopic] = useState('')
  const [count, setCount] = useState(10)
  const [level, setLevel] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [copied, setCopied] = useState(false)
  const [json, setJson] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const prompt = buildAiPrompt(topic, count, t.admin.aiLevels[level])
  const copy = async () => { try { await navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* noop */ } }
  const doImport = async () => {
    setErr('')
    let raw: unknown
    try {
      const txt = json.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim()
      raw = JSON.parse(txt)
    } catch { setErr(t.admin.importBad); return }
    setBusy(true)
    try { await onImport(raw) } catch { setErr(t.admin.importBad) } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title={t.admin.aiTitle} wide>
      <p className="mb-4 text-sm text-muted">{t.admin.aiDesc}</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_120px_140px]">
        <div><label className="label">{t.admin.aiTopic}</label><input className="input" placeholder={t.admin.aiTopicPh} value={topic} onChange={(e) => setTopic(e.target.value)} /></div>
        <div><label className="label">{t.admin.aiCount}</label><input type="number" min={3} max={30} className="input" value={count} onChange={(e) => setCount(Math.max(3, Math.min(30, Number(e.target.value) || 10)))} /></div>
        <div><label className="label">{t.admin.aiLevel}</label>
          <select className="input" value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
            {(['easy', 'medium', 'hard'] as const).map((l) => <option key={l} value={l}>{t.admin.aiLevels[l]}</option>)}
          </select>
        </div>
      </div>
      <pre className="scrollbar-thin mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-surface p-3 text-xs text-[#4A4E69]">{prompt}</pre>
      <button className="btn btn-soft mt-2" onClick={() => void copy()}>{copied ? <><Check />{t.admin.aiCopied}</> : <><ClipboardCopy />{t.admin.aiCopy}</>}</button>
      <label className="label mt-5">{t.admin.aiPaste}</label>
      <textarea className="input min-h-40 font-mono text-xs" value={json} onChange={(e) => setJson(e.target.value)} placeholder='{ "title": "…", "questions": [ … ] }' />
      {err && <p className="mt-2 text-sm font-semibold text-red-600">{err}</p>}
      <div className="mt-4 flex justify-end"><button className="btn btn-primary" disabled={!json.trim() || busy} onClick={() => void doImport()}><Upload />{t.admin.aiImport}</button></div>
    </Modal>
  )
}
