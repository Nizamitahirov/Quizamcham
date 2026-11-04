import type { Timestamp } from 'firebase/firestore'
import { listGames } from '../firebase/db'
import { finishGame, gradeAssignment, loadSecret } from './gameEngine'
import type { Game } from '../types'

const STALE_MS = 12 * 3600_000

/**
 * Server (Cloud Functions) olmadığı üçün baxım təlimçinin brauzerində işləyir — panel açılanda, sessiyada bir dəfə:
 *  • son tarixi keçmiş tapşırıqlar qiymətləndirilib bağlanır;
 *  • 12 saatdan köhnə yarımçıq canlı oyunlar yekunlaşdırılır (PIN-ləri deaktiv olur, iştirakçılar nəticəni görür).
 * Yalnız təlimçinin özünün keçirdiyi oyunlara toxunur.
 */
export async function runMaintenance(uid: string): Promise<number> {
  const games = (await listGames(300)) as unknown as (Game & { createdAt?: Timestamp })[]
  const now = Date.now()
  let n = 0
  for (const g of games) {
    if (g.hostUid !== uid || g.phase === 'finished') continue
    try {
      const expiredAssign = g.settings?.mode === 'assign' && g.phase === 'self' && (g.selfEndsAt?.toMillis() ?? Infinity) < now
      const staleLive = g.settings?.mode !== 'assign' && (g.createdAt?.toMillis() ?? now) < now - STALE_MS
      if (expiredAssign) { await gradeAssignment(g, await loadSecret(g.id)); n++ }
      else if (staleLive) { await finishGame(g, await loadSecret(g.id)); n++ }
    } catch { /* növbəti dəfə yenidən cəhd */ }
  }
  return n
}
