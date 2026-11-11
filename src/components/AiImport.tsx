import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Check, ClipboardCopy, FileText, Loader2, Sparkles, Upload, Wand2 } from 'lucide-react'
import { currentLang, t } from '../i18n/az'
import { buildAiPrompt } from '../lib/aiPrompt'
import { aiGenerate, aiQuota, AiError, type AiLang, type AiQuota } from '../lib/ai'
import { fileToText, MAX_TEXT } from '../lib/fileText'
import { Modal } from './ui'

type Tab = 'material' | 'topic' | 'json'
const TYPES = ['single', 'multi', 'truefalse', 'type'] as const

/**
 * AI ilə quiz: materialdan (tövsiyə olunur — faktlar yalnız verilmiş mətndən), mövzudan və ya hazır JSON-dan.
 * onImport(raw, fromAi) — tətbiqin quiz JSON formatı.
 */
export function AiImport({ open, onClose, onImport }: { open: boolean; onClose: () => void; onImport: (raw: unknown, fromAi?: boolean) => Promise<void> }) {
  const A = t.ai
  const [tab, setTab] = useState<Tab>('material')
  const [topic, setTopic] = useState('')
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [count, setCount] = useState(10)
  const [level, setLevel] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [lang, setLang] = useState<AiLang>(currentLang() as AiLang)
  const [types, setTypes] = useState<string[]>(['single', 'truefalse'])
  const [quota, setQuota] = useState<AiQuota | null>(null)
  const [busy, setBusy] = useState(false)
  const [reading, setReading] = useState(false)
  const [err, setErr] = useState('')
  const [json, setJson] = useState('')
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (open) void aiQuota().then(setQuota).catch(() => setQuota(null)) }, [open])

  const errText = (code: string) => (A.errors as Record<string, string>)[code] ?? A.errors['ai-failed']
  const onFile = async (f: File | undefined) => {
    if (!f) return
    setErr(''); setReading(true)
    try {
      const s = await fileToText(f)
      if (s.length < 40) throw new Error('empty')
      setText(s); setFileName(f.name)
    } catch (e) { setErr((e as Error).message === 'unsupported' ? A.fileUnsupported : A.fileEmpty) } finally { setReading(false) }
  }
  const generate = async () => {
    setErr(''); setBusy(true)
    try {
      const r = await aiGenerate({ topic: tab === 'topic' ? topic : topic || undefined, text: tab === 'material' ? text : undefined, count, lang, level, types })
      await onImport(r.quiz, true)
    } catch (e) { setErr(errText(e instanceof AiError ? e.code : 'ai-failed')) } finally { setBusy(false); void aiQuota().then(setQuota).catch(() => {}) }
  }
  const doImport = async () => {
    setErr('')
    let raw: unknown
    try { raw = JSON.parse(json.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim()) } catch { setErr(t.admin.importBad); return }
    setBusy(true)
    try { await onImport(raw) } catch { setErr(t.admin.importBad) } finally { setBusy(false) }
  }
  const prompt = buildAiPrompt(topic, count, t.admin.aiLevels[level])
  const left = quota ? Math.max(0, quota.limit - quota.used) : null
  const canGen = !busy && !reading && (tab === 'material' ? text.trim().length >= 40 : topic.trim().length >= 3) && left !== 0 && types.length > 0

  return (
    <Modal open={open} onClose={onClose} title={t.admin.aiTitle} wide>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(['material', 'topic', 'json'] as Tab[]).map((k) => (
          <button key={k} type="button" aria-pressed={tab === k} onClick={() => { setTab(k); setErr('') }}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${tab === k ? 'bg-ink text-white' : 'bg-surface text-[#4A4E69] hover:bg-line'}`}>
            {A.tabs[k]}{k === 'material' && <span className="ml-1.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700">{A.recommended}</span>}
          </button>
        ))}
        {quota && tab !== 'json' && (
          <span className="ml-auto text-xs font-semibold text-muted">
            {A.quota(quota.used, quota.limit)} {left === 0 && <Link to="/pricing" className="ml-1 text-brand underline">{t.premium.upgrade}</Link>}
          </span>
        )}
      </div>

      {tab === 'json' ? (
        <>
          <p className="mb-3 text-sm text-muted">{t.admin.aiDesc}</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <div><label className="label">{t.admin.aiTopic}</label><input className="input" placeholder={t.admin.aiTopicPh} value={topic} onChange={(e) => setTopic(e.target.value)} /></div>
            <div><label className="label">{t.admin.aiCount}</label><input type="number" min={3} max={30} className="input" value={count} onChange={(e) => setCount(Math.max(3, Math.min(30, Number(e.target.value) || 10)))} /></div>
          </div>
          <pre className="scrollbar-thin mt-3 max-h-32 overflow-auto whitespace-pre-wrap rounded-xl bg-surface p-3 text-xs text-[#4A4E69]">{prompt}</pre>
          <button className="btn btn-soft mt-2" onClick={() => void navigator.clipboard.writeText(prompt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }, () => {})}>{copied ? <><Check />{t.admin.aiCopied}</> : <><ClipboardCopy />{t.admin.aiCopy}</>}</button>
          <label className="label mt-4">{t.admin.aiPaste}</label>
          <textarea className="input min-h-36 font-mono text-xs" value={json} onChange={(e) => setJson(e.target.value)} placeholder='{ "title": "…", "questions": [ … ] }' />
          {err && <p className="mt-2 text-sm font-semibold text-red-600" role="alert">{err}</p>}
          <div className="mt-4 flex justify-end"><button className="btn btn-primary" disabled={!json.trim() || busy} onClick={() => void doImport()}><Upload />{t.admin.aiImport}</button></div>
        </>
      ) : (
        <>
          {tab === 'material' ? (
            <>
              <p className="mb-3 text-sm text-muted">{A.materialHint}</p>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={reading}>
                  {reading ? <Loader2 className="animate-spin" /> : <FileText />}{A.upload}
                </button>
                <span className="text-xs text-muted">{fileName || A.formats}</span>
                <input ref={fileRef} type="file" hidden accept=".pdf,.docx,.pptx,.txt,.md" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
              </div>
              <textarea className="input min-h-36 text-sm" value={text} maxLength={MAX_TEXT} placeholder={A.pastePh} onChange={(e) => { setText(e.target.value); setFileName('') }} />
              <p className="mt-1 text-right text-[11px] text-muted">{text.length.toLocaleString()} / {MAX_TEXT.toLocaleString()}</p>
              <label className="label mt-1">{A.focus}</label>
              <input className="input" placeholder={A.focusPh} value={topic} maxLength={300} onChange={(e) => setTopic(e.target.value)} />
            </>
          ) : (
            <>
              <label className="label">{t.admin.aiTopic}</label>
              <input className="input" placeholder={t.admin.aiTopicPh} value={topic} maxLength={300} onChange={(e) => setTopic(e.target.value)} />
              <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{A.topicWarn}</p>
            </>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div><label className="label">{t.admin.aiCount}</label><input type="number" min={3} max={30} className="input" value={count} onChange={(e) => setCount(Math.max(3, Math.min(30, Number(e.target.value) || 10)))} /></div>
            <div><label className="label">{t.admin.aiLevel}</label>
              <select className="input" value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
                {(['easy', 'medium', 'hard'] as const).map((l) => <option key={l} value={l}>{t.admin.aiLevels[l]}</option>)}
              </select>
            </div>
            <div><label className="label">{A.lang}</label>
              <select className="input" value={lang} onChange={(e) => setLang(e.target.value as AiLang)}>
                {(['az', 'ru', 'en'] as AiLang[]).map((l) => <option key={l} value={l}>{A.langs[l]}</option>)}
              </select>
            </div>
          </div>
          <p className="label mt-3">{A.types}</p>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((k) => (
              <label key={k} className="flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm has-[:checked]:border-brand has-[:checked]:bg-red-50">
                <input type="checkbox" checked={types.includes(k)} onChange={(e) => setTypes((x) => (e.target.checked ? [...x, k] : x.filter((y) => y !== k)))} />{t.types[k]}
              </label>
            ))}
          </div>
          {err && <p className="mt-3 text-sm font-semibold text-red-600" role="alert">{err}{err === A.errors['ai-quota'] && <Link to="/pricing" className="ml-2 underline">{t.premium.upgrade}</Link>}</p>}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-xs text-muted"><Sparkles className="h-3.5 w-3.5" />{A.reviewNote}</p>
            <button className="btn btn-primary" disabled={!canGen} onClick={() => void generate()}>
              {busy ? <><Loader2 className="animate-spin" />{A.generating}</> : <><Wand2 />{A.generate}</>}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
