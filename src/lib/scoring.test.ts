import { describe, it, expect } from 'vitest'
import { evaluateAnswer, streakBonus, rankPlayers, speedFactor, normalizeText } from './scoring'
import type { Question } from '../types'

const q = (over: Partial<Question>): Question => ({ id: 'q', type: 'single', text: 'x', timeLimit: 30, points: 'standard', options: [], correct: ['a'], ...over })

describe('tək seçim', () => {
  it('spesifikasiyadakı nümunə: 30 s sualda 2-ci saniyədə → 967', () => {
    expect(evaluateAnswer(q({}), 'a', 2000, 'speed')).toEqual({ correct: true, points: 967, scored: true })
  })
  it('dərhal cavab → 1000, son anda → 500', () => {
    expect(evaluateAnswer(q({}), 'a', 0, 'speed').points).toBe(1000)
    expect(evaluateAnswer(q({}), 'a', 30000, 'speed').points).toBe(500)
  })
  it('vaxtdan kənar cavab yarıdan aşağı düşmür', () => {
    expect(evaluateAnswer(q({}), 'a', 99999, 'speed').points).toBe(500)
    expect(evaluateAnswer(q({}), 'a', -50, 'speed').points).toBe(1000)
  })
  it('səhv və cavabsız → 0', () => {
    expect(evaluateAnswer(q({}), 'b', 1000, 'speed').points).toBe(0)
    expect(evaluateAnswer(q({}), null, 0, 'speed')).toEqual({ correct: false, points: 0, scored: true })
  })
  it('double → 2000, none → 0', () => {
    expect(evaluateAnswer(q({ points: 'double' }), 'a', 0, 'speed').points).toBe(2000)
    expect(evaluateAnswer(q({ points: 'none' }), 'a', 0, 'speed')).toEqual({ correct: true, points: 0, scored: true })
  })
  it('dəqiqlik rejimi sürəti nəzərə almır', () => {
    expect(evaluateAnswer(q({}), 'a', 29000, 'accuracy').points).toBe(1000)
  })
  it('massiv kimi göndərilən dəyər də qəbul olunur', () => {
    expect(evaluateAnswer(q({}), ['a'], 0, 'speed').correct).toBe(true)
  })
})

describe('çox seçim', () => {
  const m = q({ type: 'multi', correct: ['a', 'b', 'c'] })
  it('tam düzgün → tək seçim kimi tam xal', () => {
    expect(evaluateAnswer(m, ['a', 'b', 'c'], 0, 'speed')).toEqual({ correct: true, points: 1000, scored: true })
  })
  it('qismən düzgün → qismən xal, düzgün sayılmır', () => {
    const r = evaluateAnswer(m, ['a', 'b'], 0, 'speed')
    expect(r.correct).toBe(false)
    expect(r.points).toBe(667)
  })
  it('səhv seçim bir variant qədər azaldır', () => {
    expect(evaluateAnswer(m, ['a', 'b', 'd'], 0, 'speed').points).toBe(333)
  })
  it('0-dan aşağı düşmür', () => {
    expect(evaluateAnswer(m, ['d'], 0, 'speed').points).toBe(0)
  })
})

describe('digər tiplər', () => {
  it('poll xal vermir', () => {
    expect(evaluateAnswer(q({ type: 'poll', correct: [] }), 'a', 0, 'speed')).toEqual({ correct: false, points: 0, scored: false })
  })
  it('cavabı yaz: böyük-kiçik hərf və boşluq', () => {
    const t = q({ type: 'type', accepted: ['self-attention', 'Attention'], correct: [] })
    expect(evaluateAnswer(t, '  ATTENTION ', 0, 'speed').correct).toBe(true)
    expect(evaluateAnswer(t, 'Self-Attention', 0, 'speed').correct).toBe(true)
    expect(evaluateAnswer(t, 'transformer', 0, 'speed').correct).toBe(false)
  })
  it('yumşaq müqayisə: ə/e, ı/i', () => {
    const t = q({ type: 'type', accepted: ['Bakı şəhəri'], softMatch: true, correct: [] })
    expect(evaluateAnswer(t, 'baki seheri', 0, 'speed').correct).toBe(true)
    const strict = q({ type: 'type', accepted: ['Bakı'], softMatch: false, correct: [] })
    expect(evaluateAnswer(strict, 'baki', 0, 'speed').correct).toBe(false)
    expect(evaluateAnswer(strict, 'BAKI', 0, 'speed').correct).toBe(true)
  })
  it('sıralama yalnız tam düzgün', () => {
    const o = q({ type: 'order', correct: ['x', 'y', 'z'] })
    expect(evaluateAnswer(o, ['x', 'y', 'z'], 0, 'speed').correct).toBe(true)
    expect(evaluateAnswer(o, ['y', 'x', 'z'], 0, 'speed').correct).toBe(false)
  })
  it('slayder tolerans ilə', () => {
    const s = q({ type: 'slider', correct: [], slider: { min: 0, max: 100, step: 1, answer: 50, tolerance: 5 } })
    expect(evaluateAnswer(s, 54, 0, 'speed').correct).toBe(true)
    expect(evaluateAnswer(s, 56, 0, 'speed').correct).toBe(false)
  })
})

describe('seriya və reytinq', () => {
  it('seriya bonusu', () => {
    expect([1, 2, 3, 4, 7].map(streakBonus)).toEqual([0, 100, 200, 300, 300])
  })
  it('bərabər xalda az vaxt sərf edən önə keçir', () => {
    const r = rankPlayers([
      { uid: 'a', score: 900, totalCorrectTimeMs: 5000 },
      { uid: 'b', score: 900, totalCorrectTimeMs: 3000 },
      { uid: 'c', score: 1200, totalCorrectTimeMs: 9000 },
    ])
    expect(r.map((p) => [p.uid, p.rank])).toEqual([['c', 1], ['b', 2], ['a', 3]])
  })
  it('sürət əmsalı sərhədləri', () => {
    expect(speedFactor(0, 30)).toBe(1)
    expect(speedFactor(15000, 30)).toBe(0.75)
  })
  it('normalizeText durğu işarələrini atır', () => {
    expect(normalizeText('Attention!')).toBe('attention')
  })
})
