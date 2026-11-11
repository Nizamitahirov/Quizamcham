import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import { Check, Lightbulb, Play, Repeat, RotateCcw, Shuffle, Trophy } from 'lucide-react'
import { t } from '../../i18n/az'
import { loadCatalogItem, useAccount, type CatalogItem } from '../../lib/account'
import { parseBlanks, SCORED_TYPES } from '../../lib/scoring'
import { shuffle } from '../../lib/shuffle'
import { Spinner } from '../../components/ui'
import { EmptyState, Progress } from '../../components/kit'
import { StudentShell } from '../../components/StudentShell'
import type { Question } from '../../types'

const F = t.cards
const F2 = t.cards2

/** Kartın arxa üzü: düzgün cavab mətni (bütün növlər üçün). */
function answerOf(q: Question): string {
  switch (q.type) {
    case 'type': return (q.accepted ?? []).filter(Boolean).join(' / ')
    case 'slider': return String(q.slider?.answer ?? '')
    case 'order': return q.correct.map((id) => q.options.find((o) => o.id === id)?.text).filter(Boolean).join(' → ')
    case 'match': return q.options.map((o) => `${o.text} ⇄ ${o.pair ?? ''}`).join('\n')
    case 'fill': return parseBlanks(q.text).answers.map((a) => a.join(' / ')).join(' · ')
    default: return q.correct.map((id) => q.options.find((o) => o.id === id)?.text).filter(Boolean).join(' · ')
  }
}
const SWIPE = {
  enter: (d: number) => ({ x: d * 60, opacity: 0, scale: 0.96 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (d: number) => ({ x: d * 260, opacity: 0, rotate: d * 8, transition: { duration: 0.22 } }),
}
const key = (id: string) => `jabr.cards.${id}`
const readKnown = (id: string): string[] => { try { return JSON.parse(localStorage.getItem(key(id)) ?? '[]') as string[] } catch { return [] } }
const writeKnown = (id: string, ids: string[]) => { try { localStorage.setItem(key(id), JSON.stringify(ids)) } catch { /* noop */ } }

/** Flashcard: sual → çevir → "bilirəm" (çıxır) / "təkrarla" (sona keçir). Bilinənlər cihazda yadda qalır. */
export default function Flashcards() {
  const { quizId = '' } = useParams()
  const { loading, user } = useAccount()
  const [item, setItem] = useState<CatalogItem | null | undefined>(undefined)
  const [queue, setQueue] = useState<string[]>([])
  const [known, setKnown] = useState<string[]>([])
  const [repeats, setRepeats] = useState(0)
  const [flip, setFlip] = useState(false)
  const [dir, setDir] = useState<1 | -1>(1)
  useEffect(() => { if (user) void loadCatalogItem(quizId).then(setItem).catch(() => setItem(null)) }, [user, quizId])
  const cards = useMemo(() => (item?.questions ?? []).filter((q) => SCORED_TYPES.has(q.type) && q.type !== 'hotspot'), [item])
  useEffect(() => {
    if (!cards.length) return
    const k = readKnown(quizId).filter((id) => cards.some((c) => c.id === id))
    const rest = cards.map((c) => c.id).filter((id) => !k.includes(id))
    setKnown(rest.length ? k : [])
    setQueue(rest.length ? rest : cards.map((c) => c.id))
  }, [cards, quizId])
  const cur = cards.find((c) => c.id === queue[0])
  const know = useCallback(() => {
    if (!cur) return
    const next = [...new Set([...known, cur.id])]
    setKnown(next); writeKnown(quizId, next)
    setDir(1); setFlip(false); setQueue((q) => q.slice(1))
  }, [cur, known, quizId])
  const again = useCallback(() => { if (!cur) return; setRepeats((r) => r + 1); setDir(-1); setFlip(false); setQueue((q) => (q.length > 1 ? [...q.slice(1), q[0]] : q)) }, [cur])
  const restart = () => { writeKnown(quizId, []); setKnown([]); setRepeats(0); setQueue(cards.map((c) => c.id)); setFlip(false) }
  const mix = () => { setQueue((q) => shuffle(q)); setFlip(false) }
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,select')) return
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlip((f) => !f) } else if (e.key === 'ArrowRight') know(); else if (e.key === 'ArrowLeft') again()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [know, again])
  if (loading) return <div className="bg-app flex min-h-dvh items-center justify-center"><Spinner /></div>
  if (!user) return <Navigate to={`/start?next=/learn/${quizId}/cards`} replace />
  const onDragEnd = (_: unknown, info: PanInfo) => { if (info.offset.x > 110) know(); else if (info.offset.x < -110) again() }
  return (
    <StudentShell back="/learn" title={item?.title} width="max-w-2xl">
      {item === undefined ? <Spinner /> : !item || !cards.length ? <EmptyState icon={RotateCcw} title={t.acct.notFound} /> : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Progress value={(known.length / cards.length) * 100} className="flex-1" />
            <span className="text-xs font-semibold text-muted tabular">{F2.progress(known.length, cards.length)}</span>
            {cur && <button className="btn btn-ghost-dark btn-sm" onClick={mix} title={F2.shuffle}><Shuffle />{F2.shuffle}</button>}
          </div>
          {!cur ? (
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card hairline-top flex flex-col items-center gap-4 px-6 py-12 text-center">
              <span className="icon-tile-solid h-14 w-14"><Trophy className="h-7 w-7" /></span>
              <h1 className="text-2xl font-extrabold">{F2.summary}</h1>
              <p className="max-w-sm text-fg2">{F2.summaryText(cards.length, repeats)}</p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                <Link to={`/learn/${quizId}`} className="btn btn-primary"><Play className="fill-current" />{F2.practice}</Link>
                <button className="btn btn-secondary" onClick={restart}><RotateCcw />{F.restart}</button>
              </div>
            </motion.div>
          ) : (
            <>
              <p className="text-center text-xs text-muted">{F.left(queue.length)}</p>
              <div className="perspective relative h-[22rem] sm:h-[24rem]">
                <AnimatePresence mode="popLayout" custom={dir}>
                  <motion.div key={cur.id + queue.length} className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
                    custom={dir} variants={SWIPE} initial="enter" animate="center" exit="exit"
                    drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.6} onDragEnd={onDragEnd}>
                    <motion.button type="button" onClick={() => setFlip((f) => !f)} aria-label={F.flip} aria-pressed={flip}
                      className="preserve-3d relative h-full w-full" animate={{ rotateY: flip ? 180 : 0 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
                      <div className="backface-hidden card absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-hidden p-6 text-center sm:p-8">
                        <span className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-3xl" style={{ background: 'var(--grad)' }} />
                        <span className="chip chip-muted">{t.types[cur.type]}</span>
                        <p className="text-xl font-bold leading-snug sm:text-2xl">{cur.type === 'fill' ? parseBlanks(cur.text).display : cur.text}</p>
                        {cur.imageUrl && <img src={cur.imageUrl} alt="" className="max-h-28 rounded-xl" />}
                        {['single', 'multi', 'order'].includes(cur.type) && (
                          <ul className="flex flex-wrap justify-center gap-1.5">{cur.options.map((o) => <li key={o.id} className="chip chip-muted py-1 text-xs">{o.text}</li>)}</ul>
                        )}
                        <span className="mt-auto text-xs text-muted">{F.flip}</span>
                      </div>
                      <div className="backface-hidden absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-hidden rounded-[var(--radius)] border border-emerald-500/25 p-6 text-center sm:p-8"
                        style={{ transform: 'rotateY(180deg)', background: 'linear-gradient(180deg, rgba(52,211,153,.10), rgba(16,18,42,.96) 55%), var(--panel)' }}>
                        <span className="chip chip-ok"><Check className="h-3 w-3" />{F.answer}</span>
                        <p className="whitespace-pre-line text-2xl font-extrabold leading-snug text-emerald-200">{answerOf(cur)}</p>
                        {cur.explanation && <p className="flex max-w-md items-start gap-2 text-left text-sm text-fg2"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />{cur.explanation}</p>}
                      </div>
                    </motion.button>
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button className="btn btn-secondary btn-lg" onClick={again}><Repeat />{F.again}</button>
                <button className="btn btn-primary btn-lg" onClick={know}><Check />{F.know}</button>
              </div>
              <p className="text-center text-xs text-muted"><span className="hidden sm:inline">{F2.keys}</span><span className="sm:hidden">{F2.swipe}</span></p>
              {known.length > 0 && <button className="mx-auto text-xs text-muted underline-offset-4 hover:text-fg hover:underline" onClick={restart}>{F2.reset}</button>}
            </>
          )}
        </div>
      )}
    </StudentShell>
  )
}
