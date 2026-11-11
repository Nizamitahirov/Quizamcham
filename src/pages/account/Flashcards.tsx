import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Check, RotateCcw, Repeat } from 'lucide-react'
import { t } from '../../i18n/az'
import { loadCatalogItem, useAccount, type CatalogItem } from '../../lib/account'
import { parseBlanks, SCORED_TYPES } from '../../lib/scoring'
import { FuturisticBg } from '../../components/FuturisticBg'
import { Logo } from '../../components/Brand'
import { Spinner } from '../../components/ui'
import type { Question } from '../../types'

const F = t.cards

/** Kartın arxa üzü: düzgün cavab mətni (bütün növlər üçün). */
function answerOf(q: Question): string {
  switch (q.type) {
    case 'type': return (q.accepted ?? []).filter(Boolean).join(' / ')
    case 'slider': return String(q.slider?.answer ?? '')
    case 'order': return q.correct.map((id) => q.options.find((o) => o.id === id)?.text).filter(Boolean).join(' → ')
    case 'match': return q.options.map((o) => `${o.text} ⇄ ${o.pair ?? ''}`).join('\n')
    case 'fill': return parseBlanks(q.text).answers.map((a) => a.join(' / ')).join(' · ')
    case 'hotspot': return '◎'
    default: return q.correct.map((id) => q.options.find((o) => o.id === id)?.text).filter(Boolean).join(' · ')
  }
}
const key = (id: string) => `jabr.cards.${id}`

/** Flashcard: sual → çevir → "bilirəm" (çıxır) / "təkrarla" (sona keçir). Bilinənlər cihazda yadda qalır. */
export default function Flashcards() {
  const { quizId = '' } = useParams()
  const { loading, user } = useAccount()
  const [item, setItem] = useState<CatalogItem | null | undefined>(undefined)
  const [queue, setQueue] = useState<string[]>([])
  const [flip, setFlip] = useState(false)
  useEffect(() => { if (user) void loadCatalogItem(quizId).then(setItem).catch(() => setItem(null)) }, [user, quizId])
  const cards = useMemo(() => (item?.questions ?? []).filter((q) => SCORED_TYPES.has(q.type) && q.type !== 'hotspot'), [item])
  useEffect(() => {
    if (!cards.length) return
    let known: string[] = []
    try { known = JSON.parse(localStorage.getItem(key(quizId)) ?? '[]') } catch { /* noop */ }
    const rest = cards.map((c) => c.id).filter((id) => !known.includes(id))
    setQueue(rest.length ? rest : cards.map((c) => c.id))
  }, [cards, quizId])
  if (loading) return <div className="flex min-h-dvh items-center justify-center bg-night"><Spinner /></div>
  if (!user) return <Navigate to={`/start?next=/learn/${quizId}/cards`} replace />
  const cur = cards.find((c) => c.id === queue[0])
  const save = (ids: string[]) => { try { localStorage.setItem(key(quizId), JSON.stringify(ids)) } catch { /* noop */ } }
  const know = () => {
    if (!cur) return
    let known: string[] = []
    try { known = JSON.parse(localStorage.getItem(key(quizId)) ?? '[]') } catch { /* noop */ }
    save([...new Set([...known, cur.id])])
    setFlip(false); setQueue((q) => q.slice(1))
  }
  const again = () => { setFlip(false); setQueue((q) => (q.length > 1 ? [...q.slice(1), q[0]] : q)) }
  const restart = () => { save([]); setQueue(cards.map((c) => c.id)); setFlip(false) }
  return (
    <div className="noise relative flex min-h-dvh flex-col overflow-hidden bg-night text-white">
      <FuturisticBg floor={false} intensity={0.45} />
      <header className="relative z-10 mx-auto flex w-full max-w-2xl items-center gap-3 px-4 pt-5">
        <Link to={`/learn/${quizId}`} className="btn btn-ghost btn-icon" aria-label={t.app.back}><ArrowLeft className="h-4 w-4" /></Link>
        <Logo size={28} />
        <span className="ml-2 truncate text-sm font-semibold text-white/65">{item?.title}</span>
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
        {item === undefined ? <Spinner /> : !item || !cards.length ? <p className="glass p-6 text-center">{t.acct.notFound}</p> : !cur ? (
          <div className="glass m-auto flex flex-col items-center gap-4 p-8 text-center">
            <p className="text-2xl font-black">{F.done}</p>
            <div className="flex gap-2"><button className="btn btn-primary" onClick={restart}><RotateCcw />{F.restart}</button><Link to={`/learn/${quizId}`} className="btn btn-ghost">{t.acct.toCatalog}</Link></div>
          </div>
        ) : (
          <>
            <p className="text-center text-sm text-white/60">{F.left(queue.length)}</p>
            <motion.button key={cur.id + String(flip)} initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ duration: 0.25 }}
              onClick={() => setFlip((f) => !f)} className={`flex min-h-72 flex-col items-center justify-center gap-4 rounded-3xl p-8 text-center shadow-2xl ${flip ? 'bg-white text-ink' : 'glass-strong'}`} aria-label={F.flip}>
              {!flip ? (
                <>
                  <span className="text-xs font-bold uppercase tracking-widest text-white/50">{t.types[cur.type]}</span>
                  <p className="text-2xl font-black leading-snug">{cur.type === 'fill' ? parseBlanks(cur.text).display : cur.text}</p>
                  {cur.imageUrl && <img src={cur.imageUrl} alt="" className="max-h-40 rounded-xl" />}
                  {['single', 'multi'].includes(cur.type) && <ul className="text-sm text-white/70">{cur.options.map((o) => <li key={o.id}>• {o.text}</li>)}</ul>}
                  <span className="text-xs text-white/45">{F.flip}</span>
                </>
              ) : (
                <>
                  <span className="text-xs font-bold uppercase tracking-widest text-muted">{F.answer}</span>
                  <p className="whitespace-pre-line text-2xl font-black text-green-700">{answerOf(cur)}</p>
                  {cur.explanation && <p className="text-sm text-[#4A4E69]">💡 {cur.explanation}</p>}
                </>
              )}
            </motion.button>
            <div className="grid grid-cols-2 gap-3">
              <button className="btn btn-ghost btn-lg" onClick={again}><Repeat />{F.again}</button>
              <button className="btn btn-primary btn-lg" onClick={know}><Check />{F.know}</button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
