import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { loadAppSettings, loadQuiz, quizToJson, saveQuizFull } from '../../firebase/db'
import { createGame, toPublic } from '../../lib/gameEngine'
import { validateQuestion } from '../../lib/validate'
import { download } from '../../lib/csv'
import { ALL_TYPES, TIME_OPTIONS, convertType, newQuestion, uid6 } from '../../lib/defaults'
import { Tabs } from '../../components/kit'
import { SettingsForm } from '../../components/QuizSettingsForm'
import { ListChecks } from 'lucide-react'
import { ArrowLeft, Copy, Download, Eye, GripVertical, Play, Plus, Save, Settings2, Trash2, Undo2, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { t } from '../../i18n/az'
import { Modal, Spinner, Toggle } from '../../components/ui'
import { TILE_COLORS, Shape } from '../../components/AnswerTile'
import { QuestionInput } from '../player/QuestionInputs'
import type { AdminState } from '../../firebase/auth'
import type { Question, QuestionType, Quiz, QuizSettings } from '../../types'

type Snapshot = { quiz: Quiz; questions: Question[] }
type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

const TYPE_ICON: Record<QuestionType, string> = { single: '◉', multi: '☑', truefalse: '⚖', type: '⌨', poll: '📊', order: '⇅', slider: '🎚', wordcloud: '☁', open: '💬', slide: '🖼' }

export default function QuizEditor() {
  const { quizId } = useParams()
  const { user } = useOutletContext<AdminState>()
  const nav = useNavigate()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [state, setState] = useState<SaveState>('saved')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [tab, setTab] = useState<'questions' | 'settings'>('questions')
  const [showPreview, setShowPreview] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [defaultTime, setDefaultTime] = useState<number | null>(null)
  const [undoCount, setUndoCount] = useState(0)
  const dirty = useRef<Set<string>>(new Set())
  const removed = useRef<string[]>([])
  const undoStack = useRef<Snapshot[]>([])
  const latest = useRef<Snapshot | null>(null)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (!quizId) return
    void loadQuiz(quizId).then((d) => {
      if (!d) return nav('/admin/quizzes')
      setQuiz(d.quiz)
      setQuestions(d.questions)
      setSel(d.questions[0]?.id ?? null)
      latest.current = d
    })
    void loadAppSettings().then((s) => setDefaultTime(s.defaultTime))
  }, [quizId, nav])

  const save = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    const snap = latest.current
    if (!snap) return
    const d = new Set(dirty.current)
    const r = [...removed.current]
    dirty.current.clear()
    removed.current = []
    setState('saving')
    try {
      await saveQuizFull(snap.quiz, snap.questions, d, r)
      setSavedAt(new Date())
      setState(dirty.current.size || removed.current.length ? 'dirty' : 'saved')
    } catch {
      d.forEach((x) => dirty.current.add(x))
      removed.current.push(...r)
      setState('error')
    }
  }, [])

  // Səhifədən çıxanda yadda saxlanılmamış dəyişiklikləri yaz
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (timer.current) { void save(); e.preventDefault() } }
    window.addEventListener('beforeunload', h)
    return () => { window.removeEventListener('beforeunload', h); if (timer.current) void save() }
  }, [save])

  const commit = useCallback((nextQuiz: Quiz, nextQs: Question[], dirtyIds: string[] = [], opts: { noUndo?: boolean } = {}) => {
    if (latest.current && !opts.noUndo) {
      undoStack.current.push(latest.current)
      if (undoStack.current.length > 20) undoStack.current.shift()
    }
    setUndoCount(undoStack.current.length)
    latest.current = { quiz: nextQuiz, questions: nextQs }
    setQuiz(nextQuiz)
    setQuestions(nextQs)
    dirtyIds.forEach((id) => dirty.current.add(id))
    setState('dirty')
    if (timer.current) clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void save(), 1500)
  }, [save])

  const undo = () => {
    const prev = undoStack.current.pop()
    setUndoCount(undoStack.current.length)
    if (!prev || !latest.current) return
    const curIds = new Set(latest.current.questions.map((q) => q.id))
    prev.questions.forEach((q) => dirty.current.add(q.id))
    curIds.forEach((id) => { if (!prev.questions.some((q) => q.id === id)) removed.current.push(id) })
    removed.current = removed.current.filter((id) => !prev.questions.some((q) => q.id === id))
    commit(prev.quiz, prev.questions, [], { noUndo: true })
    if (!prev.questions.some((q) => q.id === sel)) setSel(prev.questions[0]?.id ?? null)
  }

  const errors = useMemo(() => new Map(questions.map((q) => [q.id, validateQuestion(q)])), [questions])
  const errCount = [...errors.values()].filter((e) => e.length).length

  if (!quiz) return <div className="p-10 text-ink"><Spinner /></div>

  const setQuizField = (patch: Partial<Quiz>) => commit({ ...quiz, ...patch }, questions)
  const setSettings = (patch: Partial<QuizSettings>) => commit({ ...quiz, settings: { ...quiz.settings, ...patch } }, questions)
  const updateQ = (q: Question) => commit(quiz, questions.map((x) => (x.id === q.id ? q : x)), [q.id])
  const addQ = (type: QuestionType = 'single') => {
    const q = newQuestion(type)
    if (type === 'single' || type === 'multi') q.timeLimit = defaultTime ?? quiz.settings.defaultTime
    const i = questions.findIndex((x) => x.id === sel)
    const next = [...questions]
    next.splice(i >= 0 ? i + 1 : next.length, 0, q)
    commit(quiz, next, [q.id])
    setSel(q.id)
  }
  const dupQ = (q: Question) => {
    const c = { ...JSON.parse(JSON.stringify(q)), id: uid6() } as Question
    const i = questions.findIndex((x) => x.id === q.id)
    const next = [...questions]
    next.splice(i + 1, 0, c)
    commit(quiz, next, [c.id])
    setSel(c.id)
  }
  const delQ = (q: Question) => {
    if (!confirm(t.editor.deleteQ)) return
    removed.current.push(q.id)
    dirty.current.delete(q.id)
    const i = questions.findIndex((x) => x.id === q.id)
    const next = questions.filter((x) => x.id !== q.id)
    commit(quiz, next)
    setSel(next[Math.min(i, next.length - 1)]?.id ?? null)
  }
  const reorder = (from: number, to: number) => commit(quiz, arrayMove(questions, from, to))

  const launch = async () => {
    if (errCount || !questions.length) return
    setLaunching(true)
    try {
      await save()
      const gid = await createGame(quiz.id, user!.uid)
      nav(`/host/${gid}`)
    } finally {
      setLaunching(false)
    }
  }

  const current = questions.find((q) => q.id === sel) ?? null
  const status = state === 'saving' ? t.editor.saving : state === 'error' ? t.editor.saveError : state === 'dirty' ? t.editor.unsaved
    : savedAt ? t.editor.saved(savedAt.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })) : ''

  return (
    <div className="mx-auto max-w-[1600px] p-3 sm:p-6">
      {/* Yuxarı panel */}
      <div className="card mb-4 flex flex-wrap items-center gap-2 p-3">
        <Link to="/admin/quizzes" className="btn btn-ghost-dark btn-icon" aria-label={t.app.back}><ArrowLeft /></Link>
        <input className="input w-14 px-1 text-center text-2xl" aria-label={t.editor.coverEmoji} value={quiz.coverEmoji} maxLength={4} onChange={(e) => setQuizField({ coverEmoji: e.target.value })} />
        <input type="color" aria-label={t.editor.coverColor} className="h-[46px] w-12 cursor-pointer rounded-xl border border-line bg-white p-1" value={quiz.coverColor} onChange={(e) => setQuizField({ coverColor: e.target.value })} />
        <input className="input min-w-48 flex-1 text-base font-bold" aria-label={t.editor.title} placeholder={t.editor.title} value={quiz.title} maxLength={80} onChange={(e) => setQuizField({ title: e.target.value })} />
        <div className="flex flex-wrap items-center gap-1">
          <button className="btn btn-ghost-dark btn-icon" title={t.editor.preview} disabled={!current} onClick={() => setShowPreview(true)}><Eye /></button>
          <button className="btn btn-ghost-dark btn-icon" title={t.editor.exportJson} onClick={() => download(`${quiz.title || 'quiz'}.json`, JSON.stringify(quizToJson(quiz, questions), null, 2), 'application/json')}><Download /></button>
          <button className="btn btn-ghost-dark btn-icon" title={t.editor.undo} disabled={!undoCount} onClick={undo}><Undo2 /></button>
        </div>
        <span className={`flex items-center gap-1.5 text-xs font-semibold ${state === 'error' ? 'text-red-600' : state === 'saved' ? 'text-ok' : 'text-muted'}`} role="status">
          {state === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : state === 'saved' && savedAt ? <CheckCircle2 className="h-4 w-4" /> : state === 'error' ? <AlertTriangle className="h-4 w-4" /> : null}{status}
        </span>
        <button className="btn btn-secondary" onClick={() => void save()}><Save />{t.app.save}</button>
        <button className="btn btn-primary" disabled={launching || errCount > 0 || !questions.length} title={errCount ? t.admin.cannotLaunch : undefined} onClick={() => void launch()}>
          <Play className="fill-current" />{launching ? t.admin.launching : t.admin.launch}
        </button>
      </div>
      <textarea className="input mb-4 min-h-12" placeholder={t.editor.description} value={quiz.description} maxLength={300} rows={1} onChange={(e) => setQuizField({ description: e.target.value })} />
      {errCount > 0 && <p className="mb-3 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700"><AlertTriangle className="h-4 w-4" />{t.editor.issues(errCount)}</p>}

      <div className="mb-4"><Tabs value={tab} onChange={setTab} tabs={[{ value: 'questions', label: `${t.admin.editorTabs.questions} (${questions.length})`, icon: ListChecks, badge: errCount }, { value: 'settings', label: t.admin.editorTabs.settings, icon: Settings2 }]} /></div>

      {tab === 'settings' ? <SettingsForm s={quiz.settings} onChange={setSettings} /> : (
      <div className="grid gap-4 lg:grid-cols-[300px_1fr_280px]">
        <QuestionList questions={questions} sel={sel} errors={errors} onSelect={setSel} onReorder={reorder} onAdd={addQ} onDup={dupQ} onDel={delQ} />
        {current ? (
          <>
            <QuestionEditor q={current} errors={errors.get(current.id) ?? []} onChange={updateQ} />
            <QuestionSettings q={current} onChange={updateQ} />
          </>
        ) : (
          <div className="card col-span-2 p-10 text-center text-muted">{t.editor.noQuestion}</div>
        )}
      </div>
      )}

      <Modal open={showPreview && !!current} onClose={() => setShowPreview(false)} title={t.editor.preview}>
        {current && <PhonePreview q={current} shuffle={quiz.settings.shuffleOptions} />}
      </Modal>
    </div>
  )
}

function SortRow({ q, i, active, hasErr, onSelect, onDup, onDel }: { q: Question; i: number; active: boolean; hasErr: boolean; onSelect: () => void; onDup: () => void; onDel: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id })
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
      className={`group flex items-center gap-2 rounded-xl border bg-white p-2 transition ${active ? 'border-brand shadow-[0_0_0_3px_rgba(232,32,42,.12)]' : 'border-line hover:border-[#d5d8e6]'} ${isDragging ? 'shadow-xl' : ''}`}>
      <button className="cursor-grab touch-none text-muted" {...attributes} {...listeners} aria-label="↕"><GripVertical className="h-4 w-4" /></button>
      <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={onSelect}>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${active ? 'text-white' : 'bg-surface text-muted'}`} style={active ? { background: 'var(--grad)' } : undefined}>{i + 1}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{q.text || '—'}</span>
          <span className="text-[11px] text-muted">{TYPE_ICON[q.type]} {t.types[q.type]}{q.type !== 'slide' ? ` · ${q.timeLimit}s` : ''}</span>
        </span>
        {hasErr && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" aria-label="!" />}
      </button>
      <div className="hidden gap-1 group-hover:flex">
        <button className="rounded-lg p-1.5 text-muted hover:bg-surface" onClick={onDup} title={t.editor.duplicate}><Copy className="h-4 w-4" /></button>
        <button className="rounded-lg p-1.5 text-red-600 hover:bg-red-50" onClick={onDel} title={t.editor.delete}><Trash2 className="h-4 w-4" /></button>
      </div>
    </li>
  )
}

function QuestionList({ questions, sel, errors, onSelect, onReorder, onAdd, onDup, onDel }: {
  questions: Question[]; sel: string | null; errors: Map<string, string[]>; onSelect: (id: string) => void; onReorder: (a: number, b: number) => void
  onAdd: (t?: QuestionType) => void; onDup: (q: Question) => void; onDel: (q: Question) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const [type, setType] = useState<QuestionType>('single')
  const onEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    onReorder(questions.findIndex((q) => q.id === e.active.id), questions.findIndex((q) => q.id === e.over!.id))
  }
  return (
    <aside className="card flex max-h-[75dvh] flex-col gap-2 overflow-hidden p-3 lg:sticky lg:top-20">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onEnd}>
        <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
          <ol className="scrollbar-thin flex flex-col gap-1.5 overflow-auto p-0.5">
            {questions.map((q, i) => (
              <SortRow key={q.id} q={q} i={i} active={q.id === sel} hasErr={(errors.get(q.id) ?? []).length > 0} onSelect={() => onSelect(q.id)} onDup={() => onDup(q)} onDel={() => onDel(q)} />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <div className="flex gap-2">
        <select className="input min-h-11 flex-1 py-1 text-sm" value={type} onChange={(e) => setType(e.target.value as QuestionType)} aria-label={t.editor.type}>
          {ALL_TYPES.map((x) => <option key={x} value={x}>{TYPE_ICON[x]} {t.types[x]}</option>)}
        </select>
        <button className="btn btn-primary btn-icon min-h-11 w-11" title={t.editor.addQuestion} onClick={() => onAdd(type)}><Plus /></button>
      </div>
    </aside>
  )
}

function QuestionEditor({ q, errors, onChange }: { q: Question; errors: string[]; onChange: (q: Question) => void }) {
  const [imgErr, setImgErr] = useState(false)
  const set = (patch: Partial<Question>) => onChange({ ...q, ...patch })
  const hasOptions = ['single', 'multi', 'truefalse', 'poll', 'order'].includes(q.type)
  const maxOpts = q.type === 'order' ? 5 : 6
  const setOpt = (id: string, text: string) => set({ options: q.options.map((o) => (o.id === id ? { ...o, text } : o)), ...(q.type === 'order' ? { correct: q.options.map((o) => o.id) } : {}) })
  const toggleCorrect = (id: string) => {
    if (q.type === 'single' || q.type === 'truefalse') set({ correct: [id] })
    else if (q.type === 'multi') set({ correct: q.correct.includes(id) ? q.correct.filter((c) => c !== id) : [...q.correct, id] })
  }
  const addOpt = () => {
    const o = { id: uid6(), text: '' }
    const options = [...q.options, o]
    set({ options, ...(q.type === 'order' ? { correct: options.map((x) => x.id) } : {}) })
  }
  const delOpt = (id: string) => {
    const options = q.options.filter((o) => o.id !== id)
    set({ options, correct: q.type === 'order' ? options.map((x) => x.id) : q.correct.filter((c) => c !== id) })
  }
  return (
    <section className="card flex flex-col gap-4 p-4 sm:p-5">
      <div>
        <label className="label" htmlFor="qtext">{q.type === 'slide' ? t.editor.title : t.editor.questionText}</label>
        <textarea id="qtext" className="input text-lg" rows={2} maxLength={200} value={q.text} onChange={(e) => set({ text: e.target.value })} />
        <div className="text-right text-xs text-slate-400">{q.text.length} / 200</div>
      </div>
      <div>
        <label className="label" htmlFor="qimg">{t.editor.imageUrl}</label>
        <input id="qimg" className="input" placeholder="https://…" value={q.imageUrl ?? ''} onChange={(e) => { setImgErr(false); set({ imageUrl: e.target.value || undefined }) }} />
        {q.imageUrl && /^https:\/\//.test(q.imageUrl) && (
          imgErr ? <p className="mt-1 text-sm text-red-600">{t.editor.imageBad}</p>
            : <img src={q.imageUrl} alt="" onError={() => setImgErr(true)} className="mt-2 max-h-40 rounded-xl object-contain" />
        )}
      </div>

      {hasOptions && (
        <div>
          <span className="label">{t.editor.options}</span>
          {q.type === 'order' && <p className="mb-2 text-sm text-slate-500">{t.editor.orderHint}</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            {q.options.map((o, i) => {
              const ok = q.correct.includes(o.id)
              const canMark = q.type === 'single' || q.type === 'multi' || q.type === 'truefalse'
              return (
                <div key={o.id} className="flex items-center gap-2 rounded-2xl p-2 shadow-sm" style={{ background: TILE_COLORS[i % 6] }}>
                  <Shape i={i} size={22} />
                  {q.type === 'order' && <span className="font-display text-white">{i + 1}.</span>}
                  <input className="input min-h-10 flex-1 py-1" aria-label={t.editor.option(i + 1)} placeholder={t.editor.option(i + 1)} value={o.text} maxLength={90} disabled={q.type === 'truefalse'} onChange={(e) => setOpt(o.id, e.target.value)} />
                  {canMark && (
                    <button type="button" onClick={() => toggleCorrect(o.id)} aria-pressed={ok} title={t.editor.markCorrect}
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white text-lg font-black ${ok ? 'bg-white text-green-700' : 'text-white/70'}`}>✓</button>
                  )}
                  {q.type !== 'truefalse' && q.options.length > 2 && (
                    <button type="button" onClick={() => delOpt(o.id)} className="shrink-0 px-1 text-white/80 hover:text-white" aria-label={t.app.delete}>✕</button>
                  )}
                </div>
              )
            })}
          </div>
          {q.type !== 'truefalse' && q.options.length < maxOpts && <button type="button" className="btn btn-ghost-dark mt-2 min-h-10" onClick={addOpt}>{t.editor.addOption}</button>}
        </div>
      )}

      {q.type === 'type' && (
        <div>
          <span className="label">{t.editor.accepted}</span>
          <div className="flex flex-col gap-2">
            {(q.accepted ?? ['']).map((a, i) => (
              <div key={i} className="flex gap-2">
                <input className="input" value={a} maxLength={60} onChange={(e) => set({ accepted: (q.accepted ?? []).map((x, k) => (k === i ? e.target.value : x)) })} />
                {(q.accepted ?? []).length > 1 && <button type="button" className="btn btn-danger min-h-10 px-3" onClick={() => set({ accepted: (q.accepted ?? []).filter((_, k) => k !== i) })}>✕</button>}
              </div>
            ))}
          </div>
          {(q.accepted ?? []).length < 4 && <button type="button" className="btn btn-ghost-dark mt-2 min-h-10" onClick={() => set({ accepted: [...(q.accepted ?? []), ''] })}>{t.editor.addAccepted}</button>}
          <div className="mt-2"><Toggle checked={!!q.softMatch} onChange={(v) => set({ softMatch: v })} label={t.editor.softMatch} /></div>
        </div>
      )}

      {q.type === 'slider' && q.slider && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(['min', 'max', 'step', 'answer', 'tolerance'] as const).map((k) => (
            <div key={k}>
              <label className="label">{{ min: t.editor.sliderMin, max: t.editor.sliderMax, step: t.editor.sliderStep, answer: t.editor.sliderAnswer, tolerance: t.editor.sliderTolerance }[k]}</label>
              <input type="number" className="input" value={q.slider![k]} onChange={(e) => set({ slider: { ...q.slider!, [k]: Number(e.target.value) } })} />
            </div>
          ))}
        </div>
      )}

      {q.type === 'slide' && <p className="text-sm text-slate-500">{t.editor.slideHint}</p>}

      <div>
        <label className="label" htmlFor="qexp">{t.editor.explanation}</label>
        <textarea id="qexp" className="input" rows={2} maxLength={300} value={q.explanation ?? ''} onChange={(e) => set({ explanation: e.target.value || undefined })} />
        <div className="text-right text-xs text-slate-400">{(q.explanation ?? '').length} / 300</div>
      </div>

      {errors.length > 0 && (
        <ul className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{errors.map((e) => <li key={e}>⚠ {e}</li>)}</ul>
      )}
    </section>
  )
}

function QuestionSettings({ q, onChange }: { q: Question; onChange: (q: Question) => void }) {
  return (
    <aside className="card flex h-fit flex-col gap-4 p-4 lg:sticky lg:top-20">
      <h3 className="text-lg">{t.editor.questionSettings}</h3>
      <div>
        <label className="label" htmlFor="qtype">{t.editor.type}</label>
        <select id="qtype" className="input" value={q.type} onChange={(e) => onChange(convertType(q, e.target.value as QuestionType))}>
          {ALL_TYPES.map((x) => <option key={x} value={x}>{TYPE_ICON[x]} {t.types[x]}</option>)}
        </select>
      </div>
      {q.type !== 'slide' && (
        <>
          <div>
            <label className="label" htmlFor="qtime">{t.editor.time}</label>
            <select id="qtime" className="input" value={q.timeLimit} onChange={(e) => onChange({ ...q, timeLimit: Number(e.target.value) })}>
              {TIME_OPTIONS.map((s) => <option key={s} value={s}>{t.editor.sec(s)}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="qpts">{t.editor.points}</label>
            <select id="qpts" className="input" value={q.points} onChange={(e) => onChange({ ...q, points: e.target.value as Question['points'] })}>
              {(['standard', 'double', 'none'] as const).map((p) => <option key={p} value={p}>{t.pointsModes[p]}</option>)}
            </select>
          </div>
        </>
      )}
      {['single', 'multi', 'poll'].includes(q.type) && (
        <div>
          <label className="label" htmlFor="qsh">{t.editor.shuffle}</label>
          <select id="qsh" className="input" value={q.shuffleOptions === undefined ? 'inherit' : q.shuffleOptions ? 'on' : 'off'}
            onChange={(e) => onChange({ ...q, shuffleOptions: e.target.value === 'inherit' ? undefined : e.target.value === 'on' })}>
            <option value="inherit">{t.editor.shuffleInherit}</option>
            <option value="on">{t.settings.on}</option>
            <option value="off">{t.settings.off}</option>
          </select>
        </div>
      )}
    </aside>
  )
}

function PhonePreview({ q, shuffle }: { q: Question; shuffle: boolean }) {
  const pub = useMemo(() => toPublic(q, { shuffleOptions: shuffle } as QuizSettings), [q, shuffle])
  return (
    <div className="mx-auto w-[300px] rounded-[2.5rem] border-[10px] border-slate-900 bg-night p-3 text-white shadow-2xl" style={{ backgroundImage: 'radial-gradient(20rem 16rem at 110% -10%, rgba(255,122,26,.3), transparent 60%), radial-gradient(20rem 16rem at -10% 110%, rgba(232,32,42,.3), transparent 60%)' }}>
      <div className="flex min-h-[520px] flex-col gap-3">
        <div className="text-center text-xs opacity-70">{t.types[q.type]} · {t.editor.sec(q.timeLimit)}</div>
        <h3 className="text-center text-lg leading-snug">{q.text || '—'}</h3>
        {q.imageUrl && <img src={q.imageUrl} alt="" className="mx-auto max-h-28 rounded-xl object-contain" />}
        {q.type === 'slide' ? <p className="text-center text-sm opacity-90">{q.explanation}</p> : (
          <div className="mt-auto"><QuestionInput q={pub} uid="preview" disabled={false} onSubmit={() => {}} /></div>
        )}
      </div>
    </div>
  )
}
