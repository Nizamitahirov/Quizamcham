import { useEffect, useMemo, useState } from 'react'
import { arrayRemove, arrayUnion, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { serverNow } from '../lib/timeSync'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, EyeOff, MessageCircleQuestion, Send, ThumbsUp, X } from 'lucide-react'
import { db } from '../firebase/config'
import { t } from '../i18n/az'

export interface QAItem { id: string; uid: string; name: string; text: string; votes: string[]; answered: boolean; hidden: boolean }

export function useQA(gameId: string, enabled = true) {
  const [items, setItems] = useState<QAItem[]>([])
  useEffect(() => {
    if (!enabled) return
    return onSnapshot(query(collection(db, 'games', gameId, 'qa'), orderBy('createdAt', 'asc')), (s) => setItems(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<QAItem, 'id'>) }))), () => {})
  }, [gameId, enabled])
  return useMemo(() => [...items].sort((a, b) => Number(a.answered) - Number(b.answered) || b.votes.length - a.votes.length), [items])
}

/** Oyunçu: üzən "Sual ver" düyməsi + panel. */
export function PlayerQA({ gameId, uid, name }: { gameId: string; uid: string; name: string }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)
  const [tooFast, setTooFast] = useState(false)
  const items = useQA(gameId, open).filter((i) => !i.hidden)
  const send = async () => {
    const v = text.trim()
    if (v.length < 3) return
    // id = uid_<10 s pəncərə>: Rules 10 saniyədə ən çox 1 suala icazə verir
    const ok = await setDoc(doc(db, 'games', gameId, 'qa', `${uid}_${Math.floor(serverNow() / 10000)}`), { uid, name, text: v.slice(0, 200), createdAt: serverTimestamp(), votes: [], answered: false, hidden: false })
      .then(() => true).catch(() => false)
    if (!ok) { setTooFast(true); setTimeout(() => setTooFast(false), 3000); return }
    setText(''); setSent(true); setTimeout(() => setSent(false), 2500)
  }
  const vote = (q: QAItem) => updateDoc(doc(db, 'games', gameId, 'qa', q.id), { votes: q.votes.includes(uid) ? arrayRemove(uid) : arrayUnion(uid) }).catch(() => {})
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="fixed bottom-4 right-4 z-30 flex h-12 items-center gap-2 rounded-full px-4 text-sm font-bold text-[#fff] shadow-[var(--glow)]" style={{ background: 'var(--grad)' }} aria-label={t.qa.button}>
        <MessageCircleQuestion className="h-5 w-5" />{t.qa.button}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.div className="glass-strong mx-auto flex max-h-[85dvh] w-full max-w-md flex-col gap-3 rounded-b-none p-4" initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t.qa.title}>
              <div className="flex items-center justify-between"><h2 className="text-lg font-black">{t.qa.title}</h2><button className="btn btn-ghost btn-icon" onClick={() => setOpen(false)} aria-label={t.app.close}><X /></button></div>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void send() }}>
                <input className="input-dark min-h-12 flex-1 text-sm" maxLength={200} placeholder={t.qa.placeholder} value={text} onChange={(e) => setText(e.target.value)} />
                <button className="btn btn-primary btn-icon min-h-12 w-12" disabled={text.trim().length < 3} aria-label={t.qa.send}><Send /></button>
              </form>
              {sent && <p className="text-xs font-bold text-green-300">{t.qa.sent}</p>}
              {tooFast && <p className="text-xs font-bold text-amber-300">{t.qa.tooFast}</p>}
              <ul className="scrollbar-thin flex flex-col gap-2 overflow-auto">
                {items.length === 0 && <li className="py-6 text-center text-sm text-white/50">{t.qa.empty}</li>}
                {items.map((q) => (
                  <li key={q.id} className={`flex items-start gap-3 rounded-2xl bg-white/[.06] p-3 ${q.answered ? 'opacity-50' : ''}`}>
                    <button type="button" onClick={() => void vote(q)} className={`flex shrink-0 flex-col items-center rounded-xl px-2 py-1 text-xs font-bold ${q.votes.includes(uid) ? 'text-orange-300' : 'text-white/60'}`} aria-pressed={q.votes.includes(uid)}>
                      <ThumbsUp className="h-4 w-4" />{q.votes.length}
                    </button>
                    <div className="min-w-0 flex-1"><p className="text-sm">{q.text}</p><p className="mt-1 text-[11px] text-white/45">{q.name}{q.answered ? ` · ${t.qa.answered}` : ''}</p></div>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/** Host: proyektor üzərində Q&A paneli. */
export function HostQA({ gameId, onClose }: { gameId: string; onClose: () => void }) {
  const items = useQA(gameId).filter((i) => !i.hidden)
  const set = (id: string, patch: Partial<QAItem>) => updateDoc(doc(db, 'games', gameId, 'qa', id), patch).catch(() => {})
  return (
    <div className="absolute inset-y-0 right-0 z-40 flex w-[38%] min-w-[420px] flex-col gap-4 border-l border-white/10 bg-night/95 p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between"><h2 className="flex items-center gap-3 text-3xl font-black"><MessageCircleQuestion className="h-8 w-8 text-orange-400" />{t.qa.title}</h2><button className="btn btn-ghost btn-icon" onClick={onClose} aria-label={t.app.close}><X /></button></div>
      <ul className="scrollbar-thin flex flex-col gap-3 overflow-auto">
        {items.length === 0 && <li className="py-10 text-center text-xl text-white/50">{t.qa.empty}</li>}
        {items.map((q) => (
          <motion.li layout key={q.id} className={`glass flex items-start gap-4 p-4 ${q.answered ? 'opacity-40' : ''}`}>
            <span className="flex shrink-0 flex-col items-center text-lg font-black text-orange-300"><ThumbsUp className="h-5 w-5" />{q.votes.length}</span>
            <div className="min-w-0 flex-1"><p className="text-2xl leading-snug">{q.text}</p><p className="mt-1 text-sm text-white/50">{q.name}</p></div>
            <div className="flex shrink-0 flex-col gap-1">
              <button className="btn btn-ghost btn-icon btn-sm" title={t.qa.markAnswered} onClick={() => void set(q.id, { answered: !q.answered })}><Check /></button>
              <button className="btn btn-ghost btn-icon btn-sm" title={t.qa.hide} onClick={() => void deleteDoc(doc(db, 'games', gameId, 'qa', q.id)).catch(() => {})}><EyeOff /></button>
            </div>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}
