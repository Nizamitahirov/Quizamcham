import type { AnswerValue, Question, QuizSettings } from '../types'

export const SCORED_TYPES = new Set(['single', 'multi', 'truefalse', 'type', 'order', 'slider'])

export function basePoints(points: Question['points']): number {
  return points === 'double' ? 2000 : points === 'none' ? 0 : 1000
}

/** 1 → 0.5 aralığında sürət əmsalı (Kahoot düsturu). */
export function speedFactor(responseMs: number, timeLimitSec: number): number {
  const tl = Math.max(1, timeLimitSec * 1000)
  const r = Math.min(Math.max(0, responseMs), tl)
  return 1 - r / tl / 2
}

const SOFT_MAP: Record<string, string> = { ə: 'e', ı: 'i', ö: 'o', ü: 'u', ş: 's', ç: 'c', ğ: 'g', i̇: 'i' }

export function normalizeText(s: string, soft = false, locale: string = 'az-AZ'): string {
  let t = s.normalize('NFC').toLocaleLowerCase(locale).trim().replace(/\s+/g, ' ')
  t = t.replace(/[.,!?;:"'“”«»]/g, '').trim()
  if (soft) t = t.replace(/i̇/g, 'i').replace(/[əıöüşçğ]/g, (c) => SOFT_MAP[c] ?? c)
  return t
}

export interface EvalResult { correct: boolean; points: number; scored: boolean }

/**
 * Bir cavabı qiymətləndirir (seriya bonusu daxil deyil).
 * responseMs — server vaxtı ilə (answeredAt − questionStartedAt).
 */
export function evaluateAnswer(q: Question, value: AnswerValue | null | undefined, responseMs: number, scoring: QuizSettings['scoring']): EvalResult {
  const scored = SCORED_TYPES.has(q.type)
  if (!scored) return { correct: false, points: 0, scored: false }
  if (value === null || value === undefined) return { correct: false, points: 0, scored: true }
  const base = basePoints(q.points)
  const factor = scoring === 'speed' ? speedFactor(responseMs, q.timeLimit) : 1

  if (q.type === 'multi') {
    const sel = new Set(Array.isArray(value) ? value : [String(value)])
    const correctSet = new Set(q.correct)
    if (correctSet.size === 0) return { correct: false, points: 0, scored: true }
    let good = 0
    let bad = 0
    sel.forEach((v) => (correctSet.has(v) ? good++ : bad++))
    const per = (base * factor) / correctSet.size
    const pts = Math.max(0, Math.round(per * (good - bad)))
    const exact = bad === 0 && good === correctSet.size
    return { correct: exact, points: pts, scored: true }
  }

  let ok = false
  switch (q.type) {
    case 'single':
    case 'truefalse': {
      const v = Array.isArray(value) ? value[0] : String(value)
      ok = q.correct.includes(v)
      break
    }
    case 'type': {
      // Azərbaycan (I→ı) və ingilis (I→i) kiçik hərf qaydalarının hər ikisi yoxlanılır
      const variants = (x: string) => new Set([normalizeText(x, !!q.softMatch), normalizeText(x, !!q.softMatch, 'en-US')])
      const vs = variants(String(value))
      ok = (q.accepted ?? []).some((a) => a.trim() !== '' && [...variants(a)].some((x) => vs.has(x)))
      break
    }
    case 'order': {
      const v = Array.isArray(value) ? value : []
      ok = v.length === q.correct.length && v.every((id, i) => id === q.correct[i])
      break
    }
    case 'slider': {
      const n = Number(value)
      ok = !!q.slider && Number.isFinite(n) && Math.abs(n - q.slider.answer) <= (q.slider.tolerance ?? 0) + 1e-9
      break
    }
  }
  return { correct: ok, points: ok ? Math.round(base * factor) : 0, scored: true }
}

/** Ardıcıl düzgün cavab sayına görə bonus: 2→100, 3→200, 4+→300. */
export function streakBonus(streak: number): number {
  if (streak < 2) return 0
  return Math.min(300, (streak - 1) * 100)
}

export interface Rankable { uid: string; score: number; totalCorrectTimeMs: number }

/** Xal azalan, bərabər xalda düzgün cavabların ümumi vaxtı az olan önə. */
export function rankPlayers<T extends Rankable>(players: T[]): (T & { rank: number })[] {
  return [...players]
    .sort((a, b) => b.score - a.score || a.totalCorrectTimeMs - b.totalCorrectTimeMs || a.uid.localeCompare(b.uid))
    .map((p, i) => ({ ...p, rank: i + 1 }))
}
