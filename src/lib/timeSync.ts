import { doc, getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '../firebase/config'

let offsetMs = 0

/** serverTime ≈ Date.now() + offset */
export const getOffset = () => offsetMs
export const serverNow = () => Date.now() + offsetMs

/**
 * Saat fərqini ölçür: serverTimestamp() yazılır, dərhal oxunur.
 * offset = serverTime − (göndərmə + qəbul)/2
 */
export async function syncClock(path: string, extra: Record<string, unknown> = {}) {
  try {
    const ref = doc(db, path)
    const t0 = Date.now()
    await setDoc(ref, { lastSeen: serverTimestamp(), ...extra }, { merge: true })
    const snap = await getDoc(ref)
    const t1 = Date.now()
    const ts = snap.get('lastSeen') as Timestamp | undefined
    if (ts) offsetMs = ts.toMillis() - (t0 + t1) / 2
  } catch {
    /* sinxron alınmadısa offset 0 qalır */
  }
  return offsetMs
}

export const remainingMs = (endsAt: Timestamp | null | undefined) => (endsAt ? endsAt.toMillis() - serverNow() : Infinity)
