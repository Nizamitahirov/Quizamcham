import { useEffect, useRef, type MutableRefObject } from 'react'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { deliverFirstSelfQ, fetchPlayers, finishGame, scoreSelfAnswer, selfAnswersQuery, updateLeaderboard } from '../../lib/gameEngine'
import { serverNow } from '../../lib/timeSync'
import type { Answer, Game, Player, Question } from '../../types'

interface Args {
  game: Game | null
  questions: Question[] | null
  active: Player[]
  gameId: string
  guard: MutableRefObject<Set<string>>
  once: (key: string, fn: () => Promise<unknown>) => Promise<void>
}

/**
 * Öz tempində rejiminin host tərəfi:
 *  1) cavabları gəldikcə (oyunçu başına ardıcıl) qiymətləndirir və növbəti sualı göndərir;
 *  2) gec qoşulanlara ilk sualı verir;
 *  3) vaxt bitəndə və ya hamı bitirəndə oyunu yekunlaşdırır.
 * Qaytarır: ən son oyun vəziyyətinin ref-i (digər effektlər üçün).
 */
export function useSelfEngine({ game, questions, active, gameId, guard, once }: Args) {
  const gameRef = useRef(game)
  useEffect(() => { gameRef.current = game }, [game])
  const chains = useRef(new Map<string, Promise<unknown>>())
  const lbTimer = useRef<number | null>(null)
  const isSelf = game?.phase === 'self'
  useEffect(() => {
    if (!isSelf || !questions) return
    return onSnapshot(selfAnswersQuery(gameId), (snap) => {
      snap.docChanges().forEach((c) => {
        if (c.type !== 'added') return
        const a = c.doc.data() as Answer
        if (!a.answeredAt) return
        const key = `sa-${c.doc.id}`
        if (guard.current.has(key)) return
        guard.current.add(key)
        const prev = chains.current.get(a.uid) ?? Promise.resolve()
        const job = prev.then(async () => {
          const ps = await getDoc(doc(db, 'games', gameId, 'players', a.uid))
          if (!ps.exists()) return
          const g = gameRef.current
          if (g) await scoreSelfAnswer(g, questions, { ...(ps.data() as Player), uid: a.uid }, a)
          if (lbTimer.current) clearTimeout(lbTimer.current)
          lbTimer.current = window.setTimeout(() => { void fetchPlayers(gameId).then((pl) => updateLeaderboard(gameId, pl, gameRef.current?.leaderboard ?? [], gameRef.current?.settings.teams ?? 0)) }, 1500)
        }).catch((e) => { console.error(e); guard.current.delete(key) })
        chains.current.set(a.uid, job)
      })
    })
  }, [isSelf, questions, gameId, guard])
  // Öz tempində: gec qoşulanlara ilk sualı ver
  useEffect(() => {
    if (!game || !questions || game.phase !== 'self') return
    active.forEach((p) => {
      if (p.selfQ || (p.history?.length ?? 0) > 0) return
      const key = `sq0-${p.uid}`
      if (guard.current.has(key)) return
      guard.current.add(key)
      void deliverFirstSelfQ(gameId, p.uid, questions, game.settings).catch(() => guard.current.delete(key))
    })
  }, [game, questions, active, gameId, guard])

  // Öz tempində: vaxt bitdikdə və ya hamı bitirəndə avtomatik yekunlaşdır
  useEffect(() => {
    if (!game || !questions || game.phase !== 'self') return
    const check = () => {
      const ends = game.selfEndsAt?.toMillis() ?? Infinity
      const allDone = active.length > 0 && active.every((p) => (p.history?.length ?? 0) >= game.totalQuestions)
      if (serverNow() > ends + 6000 || allDone) void once('fin', () => finishGame(game, questions))
    }
    const id = setInterval(check, 1000)
    return () => clearInterval(id)
  }, [game, questions, active, once])

  return gameRef
}
