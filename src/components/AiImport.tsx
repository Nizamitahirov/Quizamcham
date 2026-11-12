import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Check, ClipboardCopy, FileText, Loader2, Minus, Plus, Sparkles, Upload, Wand2 } from 'lucide-react'
import { currentLang, t } from '../i18n/az'
import { buildAiPrompt } from '../lib/aiPrompt'
import { aiGenerate, aiQuota, AiError, type AiLang, type AiQuota } from '../lib/ai'
import { fileToText, MAX_TEXT } from '../lib/fileText'
import { Modal } from './ui'
import { Segmented } from './kit'

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
  const [mixed, setMixed] = useState(false)
  const [mix, setMix] = useState<Record<'easy' | 'medium' | 'hard', number>>({ easy: 5, medium: 3, hard: 2 })
  const [ordered, setOrdered] = useState(true)
  const [timeByLevel, setTimeByLevel] = useState(true)
  const mixTotal = mix.easy + mix.medium + mix.hard
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
      const r = await aiGenerate({ topic: tab === 'topic' ? topic : topic || undefined, text: tab === 'material' ? text : undefined, count: mixed ? mixTotal : count, lang, level, types, ...(mixed ? { mix, ordered, timeByLevel } : {}) })
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
  const canGen = !busy && !reading && (tab === 'material' ? text.trim().length >= 40 : topic.trim().length >= 3) && left !== 0 && types.length > 0 && (!mixed || (mixTotal >= 3 && mixTotal <= 30))

  return (
    <Modal open={open} onClose={onClose} title={t.admin.aiTitle} wide>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(['material', 'topic', 'json'] as Tab[]).map((k) => (
          <button key={k} type="button" aria-pressed={tab === k} onClick={() => { setTab(k); setErr('') }}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${tab === k ? 'bg-raised2 text-fg ring-1 ring-line-strong' : 'text-muted hover:bg-white/[.04] hover:text-fg'}`}>
            {A.tabs[k]}{k === 'material' && <span className="ml-1.5 rounded-full bg-green-500/15 px-1.5 py-0.5 text-[10px] font-bold text-green-300">{A.recommended}</span>}
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
          <pre className="scrollbar-thin mt-3 max-h-32 overflow-auto whitespace-pre-wrap rounded-xl bg-surface p-3 text-xs text-fg2">{prompt}</pre>
          <button className="btn btn-soft mt-2" onClick={() => void navigator.clipboard.writeText(prompt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }, () => {})}>{copied ? <><Check />{t.admin.aiCopied}</> : <><ClipboardCopy />{t.admin.aiCopy}</>}</button>
          <label className="label mt-4">{t.admin.aiPaste}</label>
          <textarea className="input min-h-36 font-mono text-xs" value={json} onChange={(e) => setJson(e.target.value)} placeholder='{ "title": "…", "questions": [ … ] }' />
          {err && <p className="mt-2 text-sm font-semibold text-red-300" role="alert">{err}</p>}
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
              <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{A.topicWarn}</p>
            </>
          )}
          <div className="mt-4 rounded-xl border border-line bg-white/[.02] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="label mb-0 mr-auto">{A.mix.title}</span>
              <Segmented size="sm" value={mixed ? 'mix' : 'one'} onChange={(v) => setMixed(v === 'mix')} options={[{ value: 'one', label: A.mix.one }, { value: 'mix', label: A.mix.mixed }]} />
            </div>
            {mixed ? (
              <>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(['easy', 'medium', 'hard'] as const).map((l) => (
                    <div key={l} className="rounded-xl border border-line bg-panel p-2 text-center">
                      <div className={`mb-1.5 text-xs font-bold ${l === 'easy' ? 'text-emerald-300' : l === 'medium' ? 'text-amber-300' : 'text-red-300'}`}>{t.admin.aiLevels[l]}</div>
                      <div className="flex items-center justify-center gap-1">
                        <button type="button" className="btn btn-ghost-dark btn-icon btn-sm" aria-label="−" onClick={() => setMix((m) => ({ ...m, [l]: Math.max(0, m[l] - 1) }))}><Minus /></button>
                        <input type="number" min={0} max={30} aria-label={t.admin.aiLevels[l]} className="input h-9 min-h-9 w-14 px-1 text-center font-bold tabular" value={mix[l]} onChange={(e) => setMix((m) => ({ ...m, [l]: Math.max(0, Math.min(30, Number(e.target.value) || 0)) }))} />
                        <button type="button" className="btn btn-ghost-dark btn-icon btn-sm" aria-label="+" onClick={() => setMix((m) => ({ ...m, [l]: Math.min(30, m[l] + 1) }))}><Plus /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-white/[.06]" aria-hidden>
                  <span className="bg-emerald-400" style={{ width: `${(mix.easy / Math.max(1, mixTotal)) * 100}%` }} />
                  <span className="bg-amber-400" style={{ width: `${(mix.medium / Math.max(1, mixTotal)) * 100}%` }} />
                  <span className="bg-red-400" style={{ width: `${(mix.hard / Math.max(1, mixTotal)) * 100}%` }} />
                </div>
                <p className={`mt-1.5 text-xs font-semibold ${mixTotal < 3 || mixTotal > 30 ? 'text-red-300' : 'text-muted'}`}>{A.mix.total(mixTotal)}{(mixTotal < 3 || mixTotal > 30) && ` — ${A.mix.range}`}</p>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                  <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={ordered} onChange={(e) => setOrdered(e.target.checked)} />{A.mix.ordered}</label>
                  <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={timeByLevel} onChange={(e) => setTimeByLevel(e.target.checked)} />{A.mix.time}</label>
                </div>
              </>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div><label className="label">{t.admin.aiCount}</label><input type="number" min={3} max={30} className="input" value={count} onChange={(e) => setCount(Math.max(3, Math.min(30, Number(e.target.value) || 10)))} /></div>
                <div><label className="label">{t.admin.aiLevel}</label>
                  <select className="input" value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
                    {(['easy', 'medium', 'hard'] as const).map((l) => <option key={l} value={l}>{t.admin.aiLevels[l]}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div><label className="label">{A.lang}</label>
              <select className="input" value={lang} onChange={(e) => setLang(e.target.value as AiLang)}>
                {(['az', 'ru', 'en'] as AiLang[]).map((l) => <option key={l} value={l}>{A.langs[l]}</option>)}
              </select>
            </div>
          </div>
          <p className="label mt-3">{A.types}</p>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((k) => (
              <label key={k} className="flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm has-[:checked]:border-brand has-[:checked]:bg-red-500/10">
                <input type="checkbox" checked={types.includes(k)} onChange={(e) => setTypes((x) => (e.target.checked ? [...x, k] : x.filter((y) => y !== k)))} />{t.types[k]}
              </label>
            ))}
          </div>
          {err && <p className="mt-3 text-sm font-semibold text-red-300" role="alert">{err}{err === A.errors['ai-quota'] && <Link to="/pricing" className="ml-2 underline">{t.premium.upgrade}</Link>}</p>}
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
