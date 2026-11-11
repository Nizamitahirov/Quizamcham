/**
 * Tələbə oyunlaşdırması: XP, səviyyə, gündəlik seriya və nişanlar.
 * Məlumat mənbəyi — tələbənin öz məşq nəticələri (attempts) və canlı oyun tarixçəsi (plays); ayrıca yazı tələb etmir.
 */
type TsLike = { toMillis(): number } | null | undefined
export interface AttemptLike { correct: number; total: number; at?: TsLike }
export interface PlayLike { score: number; rank: number; at?: TsLike }

export type BadgeId = 'first' | 'five' | 'twenty' | 'perfect' | 'perfect5' | 'streak3' | 'streak7' | 'streak30' | 'live' | 'podium' | 'champion' | 'xp1000'
export interface Badge { id: BadgeId; emoji: string; earned: boolean }
export interface Gamify { xp: number; level: number; levelFrom: number; levelTo: number; streak: number; today: boolean; badges: Badge[] }

const dayKey = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` }
const pct = (a: AttemptLike) => (a.total ? Math.round((a.correct / a.total) * 100) : 0)
/** Səviyyə: hər səviyyə əvvəlkindən bir az çox XP tələb edir (100, 300, 600, 1000, …). */
const levelStart = (n: number) => (50 * (n - 1) * n)

export function computeGamify(attempts: AttemptLike[], plays: PlayLike[], now = Date.now()): Gamify {
  const xp = Math.round(
    attempts.reduce((s, a) => s + 10 + a.correct * 10 + (pct(a) === 100 ? 50 : 0), 0)
    + plays.reduce((s, p) => s + 20 + Math.min(200, Math.round(p.score / 100)) + (p.rank === 1 ? 100 : p.rank <= 3 ? 50 : 0), 0),
  )
  let level = 1
  while (xp >= levelStart(level + 1)) level++
  // gündəlik seriya: bu gün (və ya dünən — bu gün hələ məşq etməyibsə) geriyə ardıcıl günlər
  const days = new Set([...attempts, ...plays].map((x) => x.at?.toMillis()).filter((x): x is number => !!x).map(dayKey))
  const today = days.has(dayKey(now))
  let streak = 0
  for (let d = today ? 0 : 1; d < 400; d++) { if (days.has(dayKey(now - d * 86_400_000))) streak++; else break }
  const perfects = attempts.filter((a) => pct(a) === 100).length
  const earned: Record<BadgeId, boolean> = {
    first: attempts.length + plays.length >= 1, five: attempts.length >= 5, twenty: attempts.length >= 20,
    perfect: perfects >= 1, perfect5: perfects >= 5, streak3: streak >= 3, streak7: streak >= 7, streak30: streak >= 30,
    live: plays.length >= 1, podium: plays.some((p) => p.rank <= 3), champion: plays.some((p) => p.rank === 1), xp1000: xp >= 1000,
  }
  const EMOJI: Record<BadgeId, string> = { first: '🌱', five: '📚', twenty: '🎓', perfect: '💯', perfect5: '🏅', streak3: '🔥', streak7: '⚡', streak30: '🌋', live: '🎮', podium: '🥉', champion: '👑', xp1000: '💎' }
  return {
    xp, level, levelFrom: levelStart(level), levelTo: levelStart(level + 1), streak, today,
    badges: (Object.keys(EMOJI) as BadgeId[]).map((id) => ({ id, emoji: EMOJI[id], earned: earned[id] })),
  }
}
