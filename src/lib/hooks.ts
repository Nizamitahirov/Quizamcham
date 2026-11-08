import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import type { Game, Player } from '../types'

export function useDocSnap<T>(path: string | null, map: (id: string, data: Record<string, unknown>) => T): { data: T | null; loading: boolean; error: string | null; missing: boolean } {
  type S = { path: string | null; data: T | null; loading: boolean; error: string | null; missing: boolean }
  const [state, setState] = useState<S>({ path: null, data: null, loading: false, error: null, missing: false })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => { setAttempt(0) }, [path])
  useEffect(() => {
    if (!path) return
    let retry: number | undefined
    // includeMetadataChanges: keşin "yoxdur" cavabı nəzərə alınmır, serverin təsdiqi (yalnız metadata dəyişikliyi) mütləq çatmalıdır
    const unsub = onSnapshot(
      doc(db, path), { includeMetadataChanges: true },
      (snap) => {
        // Keşdən gələn "yoxdur" sübut deyil (şəbəkə yenidən qurulanda / yaddaş keşində) — server təsdiqləyənə qədər gözlə
        if (!snap.exists() && snap.metadata.fromCache) return
        setState({ path, data: snap.exists() ? map(snap.id, snap.data()) : null, loading: false, error: null, missing: !snap.exists() })
      },
      (err) => {
        // Keçici rədd (giriş tokeni hələ çatmayıb, şəbəkə) — bir neçə dəfə yenidən abunə ol, ekranı dəyişmə
        if (attempt < 4 && (err.code === 'permission-denied' || err.code === 'unavailable' || err.code === 'unauthenticated')) {
          retry = window.setTimeout(() => setAttempt((a) => a + 1), 700 * (attempt + 1))
          return
        }
        setState({ path, data: null, loading: false, error: err.code ?? String(err), missing: false })
      },
    )
    return () => { unsub(); if (retry) clearTimeout(retry) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, attempt])
  // Bu yol üçün hələ cavab gəlməyibsə — yüklənir (yol dəyişdiyi ilk render-də köhnə/boş vəziyyət "yoxdur" sayılmasın)
  if (path && state.path !== path) return { data: null, loading: true, error: null, missing: false }
  return { data: state.data, loading: state.loading, error: state.error, missing: state.missing }
}

export const useGame = (gameId: string | null | undefined) =>
  useDocSnap<Game>(gameId ? `games/${gameId}` : null, (id, d) => ({ ...(d as unknown as Game), id }))

export const usePlayer = (gameId: string | null | undefined, uid: string | null | undefined) =>
  useDocSnap<Player>(gameId && uid ? `games/${gameId}/players/${uid}` : null, (id, d) => ({ ...(d as unknown as Player), uid: id }))

export function useInterval(fn: () => void, ms: number | null) {
  useEffect(() => {
    if (ms == null) return
    const id = setInterval(fn, ms)
    return () => clearInterval(id)
  }, [fn, ms])
}
