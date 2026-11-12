import { useMemo, useState } from 'react'
import { DndContext, PointerSensor, TouchSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AnswerTile, TILE_COLORS, Shape } from '../../components/AnswerTile'
import { seededShuffle } from '../../lib/shuffle'
import { LOCALE, t } from '../../i18n/az'
import type { AnswerValue, Option, PublicQuestion } from '../../types'

interface Props { q: PublicQuestion; uid: string; disabled: boolean; onSubmit: (v: AnswerValue) => void; hide?: string[] }

/** Variantları oyunçuya görə qarışdırır; rəng/forma variantın öz indeksinə bağlı qalır (host ekranı ilə uyğun). */
function useArranged(q: PublicQuestion, uid: string) {
  return useMemo(() => {
    const indexed = q.options.map((o, i) => ({ o, i }))
    return q.shuffle ? seededShuffle(indexed, uid + q.id) : indexed
  }, [q, uid])
}

export function ChoiceInput({ q, uid, disabled, onSubmit, hide = [] }: Props) {
  const items = useArranged(q, uid)
  const [picked, setPicked] = useState<string | null>(null)
  const long = q.options.some((o) => o.text.length > 18)
  const cols = q.options.length <= 2 || long ? 'grid-cols-1' : 'grid-cols-2'
  return (
    <div className={`grid ${cols} gap-3`}>
      {items.map(({ o, i }) => (
        <AnswerTile key={o.id} index={i} text={o.text} hidden={hide.includes(o.id)} disabled={disabled || picked !== null} selected={picked === o.id} dimmed={picked !== null && picked !== o.id}
          onClick={() => { setPicked(o.id); onSubmit([o.id]) }} />
      ))}
    </div>
  )
}

export function MultiInput({ q, uid, disabled, onSubmit, hide = [] }: Props) {
  const items = useArranged(q, uid)
  const [sel, setSel] = useState<string[]>([])
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  return (
    <div className="flex flex-col gap-3">
      <p className="text-center text-sm font-bold opacity-90">{t.game.selectMany}{q.multiCount ? ` (${q.multiCount})` : ''}</p>
      <div className={`grid gap-3 ${q.options.some((o) => o.text.length > 18) ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {items.map(({ o, i }) => (
          <AnswerTile key={o.id} index={i} text={o.text} hidden={hide.includes(o.id)} disabled={disabled} checked={sel.includes(o.id)} onClick={() => toggle(o.id)} />
        ))}
      </div>
      <button type="button" className="btn btn-primary btn-lg" disabled={disabled || sel.length === 0} onClick={() => onSubmit(sel)}>{t.game.submit}</button>
    </div>
  )
}

export function TextInput({ disabled, onSubmit, max = 60 }: Props & { max?: number }) {
  const [v, setV] = useState('')
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (v.trim()) onSubmit(v.trim()) }}>
      <input className="input-dark text-xl" value={v} maxLength={max} placeholder={t.game.typeHere} autoFocus disabled={disabled} onChange={(e) => setV(e.target.value)} enterKeyHint="send" />
      <div className="text-right text-xs text-white/50">{v.length} / {max}</div>
      <button className="btn btn-primary btn-lg" disabled={disabled || !v.trim()}>{t.game.submit}</button>
    </form>
  )
}

export function SliderInput({ q, disabled, onSubmit }: Props) {
  const s = q.slider ?? { min: 0, max: 100, step: 1 }
  const [v, setV] = useState(Math.round((s.min + s.max) / 2 / s.step) * s.step)
  return (
    <div className="glass flex flex-col gap-5 p-6">
      <div className="text-center"><span className="label-dark">{t.game.sliderValue}</span><div className="font-display text-grad text-7xl font-black">{v.toLocaleString(LOCALE)}</div></div>
      <input type="range" min={s.min} max={s.max} step={s.step} value={v} disabled={disabled} onChange={(e) => setV(Number(e.target.value))} className="h-10 w-full accent-[#FF5A1F]" aria-label={t.game.sliderValue} />
      <div className="flex justify-between text-sm font-bold text-white/50"><span>{s.min}</span><span>{s.max}</span></div>
      <button type="button" className="btn btn-primary btn-lg" disabled={disabled} onClick={() => onSubmit(v)}>{t.game.submit}</button>
    </div>
  )
}

function SortItem({ o, i, idx }: { o: Option; i: number; idx: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: o.id })
  return (
    <li ref={setNodeRef} {...attributes} {...listeners}
      style={{ transform: CSS.Transform.toString(transform), transition, background: TILE_COLORS[i % 6], zIndex: isDragging ? 10 : undefined }}
      className={`flex min-h-16 touch-none items-center gap-3 rounded-2xl p-4 text-lg font-extrabold text-[#fff] shadow-[0_5px_0_rgba(0,0,0,.25)] ${isDragging ? 'scale-105 ring-4 ring-[#fff]' : ''}`}>
      <span className="font-display w-6 text-center">{idx + 1}</span>
      <Shape i={i} size={22} />
      <span className="flex-1">{o.text}</span>
      <span aria-hidden className="text-2xl opacity-80">⠿</span>
    </li>
  )
}

export function OrderInput({ q, disabled, onSubmit }: Props) {
  const [items, setItems] = useState(() => q.options.map((o, i) => ({ o, i })))
  const sensors = useSensors(useSensor(PointerSensor), useSensor(TouchSensor, { activationConstraint: { delay: 80, tolerance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const onEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    setItems((s) => arrayMove(s, s.findIndex((x) => x.o.id === e.active.id), s.findIndex((x) => x.o.id === e.over!.id)))
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-center text-sm font-bold opacity-90">{t.game.dragToOrder}</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onEnd}>
        <SortableContext items={items.map((x) => x.o.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-2">{items.map((x, idx) => <SortItem key={x.o.id} o={x.o} i={x.i} idx={idx} />)}</ul>
        </SortableContext>
      </DndContext>
      <button type="button" className="btn btn-primary btn-lg" disabled={disabled} onClick={() => onSubmit(items.map((x) => x.o.id))}>{t.game.submit}</button>
    </div>
  )
}

/** Uyğunlaşdırma: hər sol element üçün sağ tərəfdən seçim (telefonda yerli seçici). */
export function MatchInput({ q, disabled, onSubmit }: Props) {
  const right = q.right ?? []
  const [sel, setSel] = useState<string[]>(() => q.options.map(() => ''))
  const used = new Set(sel.filter(Boolean))
  return (
    <div className="flex flex-col gap-3">
      <p className="text-center text-sm font-bold opacity-90">{t.game.matchHint}</p>
      {q.options.map((o, i) => (
        <div key={o.id} className="flex items-center gap-2 rounded-2xl p-2 text-[#fff] shadow-[0_4px_0_rgba(0,0,0,.25)]" style={{ background: TILE_COLORS[i % 6] }}>
          <span className="min-w-0 flex-1 px-2 text-base font-extrabold">{o.text}</span>
          <select className="input-dark min-h-12 w-[52%] text-base" value={sel[i]} disabled={disabled} aria-label={o.text}
            onChange={(e) => setSel((s) => s.map((x, k) => (k === i ? e.target.value : x)))}>
            <option value="">—</option>
            {right.map((r) => <option key={r.id} value={r.id} disabled={used.has(r.id) && sel[i] !== r.id}>{r.text}</option>)}
          </select>
        </div>
      ))}
      <button type="button" className="btn btn-primary btn-lg" disabled={disabled || sel.some((x) => !x)} onClick={() => onSubmit(sel)}>{t.game.submit}</button>
    </div>
  )
}

/** Boşluq doldurma: mətnin içində sahələr. */
export function FillInput({ q, disabled, onSubmit }: Props) {
  const parts = q.text.split('___')
  const n = Math.max(0, parts.length - 1)
  const [v, setV] = useState<string[]>(() => Array.from({ length: n }, () => ''))
  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (v.every((x) => x.trim())) onSubmit(v.map((x) => x.trim())) }}>
      <p className="glass p-4 text-lg font-bold leading-[2.6rem]">
        {parts.map((p, i) => (
          <span key={i}>{p}{i < n && (
            <input className="mx-1 inline-block w-36 rounded-lg border-2 border-white/40 bg-white/10 px-2 py-1 align-middle text-base text-[#fff] outline-none focus:border-orange-400"
              value={v[i]} maxLength={40} disabled={disabled} aria-label={t.game.blank(i + 1)} placeholder={`${i + 1}`}
              onChange={(e) => setV((s) => s.map((x, k) => (k === i ? e.target.value : x)))} />
          )}</span>
        ))}
      </p>
      <button className="btn btn-primary btn-lg" disabled={disabled || v.some((x) => !x.trim())}>{t.game.submit}</button>
    </form>
  )
}

/** Şəkil üzərində nöqtə: toxun → işarə, sonra təsdiq. */
export function HotspotInput({ q, disabled, onSubmit }: Props) {
  const [pt, setPt] = useState<{ x: number; y: number } | null>(null)
  if (!q.imageUrl) return null
  return (
    <div className="flex flex-col gap-3">
      <p className="text-center text-sm font-bold opacity-90">{t.game.hotspotHint}</p>
      <div className="relative mx-auto max-w-full cursor-crosshair select-none overflow-hidden rounded-2xl"
        onClick={(e) => { if (disabled) return; const r = e.currentTarget.getBoundingClientRect(); setPt({ x: Math.round(((e.clientX - r.left) / r.width) * 1000) / 10, y: Math.round(((e.clientY - r.top) / r.height) * 1000) / 10 }) }}>
        <img src={q.imageUrl} alt="" className="block max-h-[55vh] max-w-full" draggable={false} />
        {pt && <span className="pointer-events-none absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-[#fff] bg-orange-500 shadow-lg" style={{ left: `${pt.x}%`, top: `${pt.y}%` }} />}
      </div>
      <button type="button" className="btn btn-primary btn-lg" disabled={disabled || !pt} onClick={() => pt && onSubmit(`${pt.x},${pt.y}`)}>{t.game.submit}</button>
    </div>
  )
}

/**
 * Əminlik rejimi: cavab seçiləndən sonra "əminəm / əmin deyiləm".
 * Əmin + düz → ×1.5, əmin + səhv → cərimə; "əmin deyiləm" → adi bal.
 */
export function ConfidenceGate({ enabled, children, onSubmit }: { enabled: boolean; children: (submit: (v: AnswerValue) => void) => React.ReactNode; onSubmit: (v: AnswerValue, conf?: boolean) => void }) {
  const [pending, setPending] = useState<AnswerValue | null>(null)
  if (!enabled) return <>{children((v) => onSubmit(v))}</>
  if (pending !== null) return (
    <div className="glass flex flex-col gap-3 p-5 text-center">
      <p className="text-lg font-black">{t.game.confTitle}</p>
      <p className="text-sm text-white/70">{t.game.confHint}</p>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" className="btn btn-primary btn-lg" onClick={() => onSubmit(pending, true)}>💪 {t.game.confSure}</button>
        <button type="button" className="btn btn-ghost btn-lg" onClick={() => onSubmit(pending, false)}>🤔 {t.game.confUnsure}</button>
      </div>
    </div>
  )
  return <>{children((v) => setPending(v))}</>
}

export function QuestionInput(props: Props) {
  switch (props.q.type) {
    case 'match': return <MatchInput {...props} />
    case 'fill': return <FillInput {...props} />
    case 'hotspot': return <HotspotInput {...props} />
    case 'single': case 'truefalse': case 'poll': return <ChoiceInput {...props} />
    case 'multi': return <MultiInput {...props} />
    case 'type': return <TextInput {...props} max={60} />
    case 'wordcloud': return <TextInput {...props} max={30} />
    case 'open': return <TextInput {...props} max={140} />
    case 'slider': return <SliderInput {...props} />
    case 'order': return <OrderInput {...props} />
    default: return null
  }
}
