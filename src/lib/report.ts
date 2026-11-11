import { t } from '../i18n/az'
import { fetchPlayers, loadSecret } from './gameEngine'
import { matchRightId, rankPlayers, SCORED_TYPES } from './scoring'
import { toCsv } from './csv'
import type { AnswerValue, Player, Question } from '../types'

export function answerText(q: Question | undefined, v: AnswerValue | null | undefined): string {
  if (v === null || v === undefined) return ''
  if (!q) return String(v)
  // uyğunlaşdırma: oyunçunun cütləri (sağ tərəfin gizli id-si → mətn)
  if (q.type === 'match' && Array.isArray(v)) return q.options.map((o, i) => `${o.text} ⇄ ${q.options.find((x) => matchRightId(q.matchSalt ?? '', x.id) === v[i])?.pair ?? '—'}`).join('; ')
  if (q.type === 'fill' && Array.isArray(v)) return v.join(' · ')
  if (Array.isArray(v)) return v.map((id) => q.options.find((o) => o.id === id)?.text ?? id).join(q.type === 'order' ? ' → ' : '; ')
  return String(v)
}

export interface QuestionStat { index: number; q: Question; answered: number; correct: number; accuracy: number; avgTimeMs: number; distribution: Record<string, number>; mostWrong?: string }

export interface GameReportData { players: (Player & { rank: number })[]; questions: Question[]; qstats: QuestionStat[]; scoredCount: number }

export async function loadReport(gameId: string): Promise<GameReportData> {
  const [players, questions] = await Promise.all([fetchPlayers(gameId), loadSecret(gameId)])
  const active = players.filter((p) => !p.kicked)
  const ranked = rankPlayers(active)
  const askedIdx = new Set(active.flatMap((p) => (p.history ?? []).map((h) => h.q)))
  const qstats: QuestionStat[] = questions.map((q, index) => {
    const hs = active.map((p) => p.history?.find((h) => h.q === index)).filter(Boolean) as Player['history']
    const answered = hs.filter((h) => h.answer !== null && h.answer !== undefined)
    const correct = hs.filter((h) => h.correct).length
    const times = answered.map((h) => h.timeMs ?? 0)
    const distribution: Record<string, number> = {}
    answered.forEach((h) => {
      const vals = Array.isArray(h.answer) ? (['order', 'match', 'fill'].includes(q.type) ? [answerText(q, h.answer)] : h.answer) : q.type === 'hotspot' ? [] : [String(h.answer)]
      vals.forEach((v) => (distribution[v] = (distribution[v] ?? 0) + 1))
    })
    let mostWrong: string | undefined
    if (['single', 'multi', 'truefalse'].includes(q.type)) {
      const wrong = q.options.filter((o) => !q.correct.includes(o.id)).sort((a, b) => (distribution[b.id] ?? 0) - (distribution[a.id] ?? 0))[0]
      if (wrong && distribution[wrong.id]) mostWrong = wrong.text
    }
    return { index, q, answered: answered.length, correct, accuracy: active.length ? correct / active.length : 0, avgTimeMs: times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0, distribution, mostWrong }
  }).filter((s) => askedIdx.has(s.index))
  const scoredCount = qstats.filter((s) => SCORED_TYPES.has(s.q.type)).length
  return { players: ranked, questions, qstats, scoredCount }
}

export function reportCsv(r: GameReportData): string {
  const H = t.csvHead
  const withTeams = r.players.some((p) => p.team != null)
  const head = [H.rank, H.first, H.last, ...(withTeams ? [H.team] : []), H.score, H.correct, H.acc, H.avg, H.streak]
  r.qstats.forEach((s) => head.push(`${H.q(s.index + 1)}: ${s.q.text}`, H.pts(s.index + 1)))
  const rows: (string | number)[][] = [head]
  for (const p of r.players) {
    const times = (p.history ?? []).filter((h) => h.answer != null && h.timeMs != null).map((h) => h.timeMs as number)
    const row: (string | number)[] = [
      p.rank, p.firstName, p.lastName, ...(withTeams ? [p.team != null ? t.extra.teamNames[p.team] ?? '' : ''] : []), p.score, p.correctCount ?? 0,
      r.scoredCount ? Math.round(((p.correctCount ?? 0) / r.scoredCount) * 100) : 0,
      times.length ? (times.reduce((a, b) => a + b, 0) / times.length / 1000).toFixed(1) : '',
      p.bestStreak ?? 0,
    ]
    r.qstats.forEach((s) => {
      const h = p.history?.find((x) => x.q === s.index)
      const mark = SCORED_TYPES.has(s.q.type) && h && h.answer != null ? (h.correct ? ' ✓' : ' ✗') : ''
      row.push(answerText(s.q, h?.answer) + mark, h?.points ?? 0)
    })
    rows.push(row)
  }
  return toCsv(rows)
}
