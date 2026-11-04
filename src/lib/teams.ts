import type { Player, TeamEntry } from '../types'
import { t } from '../i18n/az'

const COLORS = [{ color: '#E11D2A', emoji: '🔴' }, { color: '#2563EB', emoji: '🔵' }, { color: '#059669', emoji: '🟢' }, { color: '#D97706', emoji: '🟡' }]
export const TEAMS = COLORS.map((c, i) => ({ ...c, name: t.extra.teamNames[i] }))

/** Komanda xalı = üzvlərin orta xalı (spec 8.3). */
export function computeTeams(players: Player[], n: number): TeamEntry[] {
  if (!n) return []
  const rows = Array.from({ length: n }, (_, team) => {
    const m = players.filter((p) => !p.kicked && p.team === team)
    const total = m.reduce((a, p) => a + (p.score ?? 0), 0)
    return { team, total, members: m.length, score: m.length ? Math.round(total / m.length) : 0 }
  })
  return rows.sort((a, b) => b.score - a.score)
}

/** Balanslı bölgü: ən az üzvü olan komanda (bərabərdirsə, ilki). */
export function pickTeam(counts: number[]): number {
  let best = 0
  counts.forEach((c, i) => { if (c < counts[best]) best = i })
  return best
}
