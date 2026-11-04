import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'

export interface FeedbackRow { uid: string; rating: number; comment?: string; name?: string }

export function useFeedback(gameId: string) {
  const [rows, setRows] = useState<FeedbackRow[]>([])
  useEffect(() => onSnapshot(collection(db, 'games', gameId, 'feedback'), (s) => setRows(s.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<FeedbackRow, 'uid'>) }))), () => {}), [gameId])
  const avg = rows.length ? rows.reduce((a, r) => a + r.rating, 0) / rows.length : 0
  return { rows, avg }
}
