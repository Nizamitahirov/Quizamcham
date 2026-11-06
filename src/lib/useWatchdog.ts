import { useEffect, useRef } from 'react'
import { disableNetwork, enableNetwork } from 'firebase/firestore'
import { db } from '../firebase/config'
import type { Game, Player } from '../types'

/**
 * Canlı bağlantı "donanda" (zəif mobil şəbəkə) ekran köhnə fazada qalır.
 * Ekran gözləniləndən uzun eyni vəziyyətdədirsə, Firestore bağlantısı məcburi yenidən qurulur
 * (disableNetwork → enableNetwork); dinləyicilər yenidən abunə olur və ən son vəziyyəti alır.
 * Yalnız ilişmə hallarında işləyir (10 saniyədə ən çox bir dəfə).
 */
export function useWatchdog(game: Game | null, player: Player | null, uid: string | null) {
  const seen = useRef<{ key: string; at: number }>({ key: '', at: Date.now() })
  const lastRefresh = useRef(0)
  useEffect(() => {
    if (!game || !uid) return
    const key = `${game.phase}:${game.questionIndex}:${game.questionEndsAt ? 1 : 0}:${player?.lastResult?.questionIndex ?? -1}`
    if (seen.current.key !== key) seen.current = { key, at: Date.now() }
  }, [game, player, uid])
  useEffect(() => {
    if (!game || !uid) return
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      const age = Date.now() - seen.current.at
      const stuck =
        (game.phase === 'countdown' && !game.questionStartedAt && age > (game.preview?.readMs ?? 4000) + 4000) ||
        (game.phase === 'question' && !game.questionEndsAt && game.pausedRemainingMs == null && game.currentQuestion?.type !== 'slide' && age > 3000) ||
        (game.phase === 'question' && game.questionEndsAt && Date.now() > game.questionEndsAt.toMillis() + 6000) ||
        (game.phase === 'reveal' && player?.lastResult?.questionIndex !== game.questionIndex && age > 5000)
      if (!stuck || Date.now() - lastRefresh.current < 10000) return
      lastRefresh.current = Date.now()
      void disableNetwork(db).then(() => enableNetwork(db)).catch(() => {})
    }, 1500)
    return () => clearInterval(id)
  }, [game, player, uid])
}
