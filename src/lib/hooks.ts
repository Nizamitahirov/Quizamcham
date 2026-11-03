import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import type { Game, Player } from '../types'

export function useDocSnap<T>(path: string | null, map: (id: string, data: Record<string, unknown>) => T): { data: T | null; loading: boolean; error: string | null; missing: boolean } {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null; missing: boolean }>({ data: null, loading: !!path, error: null, missing: false })
  useEffect(() => {
    if (!path) return
    setState((s) => ({ ...s, loading: true }))
    return onSnapshot(
      doc(db, path),
      (snap) => setState({ data: snap.exists() ? map(snap.id, snap.data()) : null, loading: false, error: null, missing: !snap.exists() }),
      (err) => setState({ data: null, loading: false, error: err.code ?? String(err), missing: false }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])
  return state
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
