import { useState } from 'react'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { Star } from 'lucide-react'
import { db } from '../firebase/config'
import { t } from '../i18n/az'

/** Təlim sonu rəy sorğusu (1–5 ulduz + şərh). */
export function FeedbackForm({ gameId, uid, name }: { gameId: string; uid: string; name: string }) {
  const key = `qz.fb.${gameId}`
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [done, setDone] = useState(() => { try { return !!localStorage.getItem(key) } catch { return false } })
  const [busy, setBusy] = useState(false)
  if (done) return <div className="glass p-4 text-center text-sm font-semibold">{t.feedback2.thanks}</div>
  const send = async () => {
    setBusy(true)
    try {
      await setDoc(doc(db, 'games', gameId, 'feedback', uid), { rating, comment: comment.trim().slice(0, 500), name, at: serverTimestamp() })
      try { localStorage.setItem(key, '1') } catch { /* noop */ }
      setDone(true)
    } catch { /* noop */ } finally { setBusy(false) }
  }
  return (
    <div className="glass flex flex-col gap-3 p-4">
      <p className="text-center text-sm font-bold">{t.feedback2.title}</p>
      <div className="flex justify-center gap-1" role="radiogroup" aria-label={t.feedback2.title}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}`} onClick={() => setRating(n)} className="p-1 transition active:scale-90">
            <Star className={`h-9 w-9 ${n <= rating ? 'text-yellow-300' : 'text-white/25'}`} fill={n <= rating ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <>
          <textarea className="input-dark min-h-20 text-sm" maxLength={500} placeholder={t.feedback2.comment} value={comment} onChange={(e) => setComment(e.target.value)} />
          <button className="btn btn-primary" disabled={busy} onClick={() => void send()}>{t.feedback2.send}</button>
        </>
      )}
    </div>
  )
}
