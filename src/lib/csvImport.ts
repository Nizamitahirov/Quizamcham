import { convertType, uid6 } from './defaults'
import type { Question, QuestionType } from '../types'

const TYPE_ALIASES: Record<string, QuestionType> = {
  single: 'single', 'tək': 'single', tek: 'single', multi: 'multi', 'çox': 'multi', cox: 'multi', truefalse: 'truefalse', 'doğru/yanlış': 'truefalse', dy: 'truefalse',
  type: 'type', yaz: 'type', poll: 'poll', 'sorğu': 'poll', order: 'order', 'sıralama': 'order', slider: 'slider', wordcloud: 'wordcloud', open: 'open', slide: 'slide',
}

/** Sadə CSV/TSV oxuyucusu (dırnaq içində vergül və sətir keçidi dəstəklənir). Ayırıcı avtomatik təyin olunur. */
export function parseTable(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const first = src.split('\n')[0] ?? ''
  const delim = first.includes('\t') ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ',')
  const rows: string[][] = []
  let row: string[] = [], cell = '', q = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++ } else if (c === '"') q = false; else cell += c
    } else if (c === '"' && cell === '') q = true
    else if (c === delim) { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += c
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((x) => x.trim() !== ''))
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

/** Sütunlar: tip, sual, vaxt, xal, A..F, düzgün, izah. Düzgün: hərflər (A / A,C) və ya “cavabı yaz” üçün qəbul olunanlar (a|b). */
export function rowsToQuestions(rows: string[][], defaultTime = 30): { questions: Question[]; errors: { row: number; msg: string }[] } {
  const questions: Question[] = []
  const errors: { row: number; msg: string }[] = []
  rows.slice(1).forEach((r, i) => {
    const rowNo = i + 2
    const [typeRaw, text, time, pts, a, b, c, d, e, f, correctRaw = '', explanation = ''] = r.map((x) => (x ?? '').trim())
    const type = TYPE_ALIASES[(typeRaw || 'single').toLocaleLowerCase('az-AZ')]
    if (!type) return errors.push({ row: rowNo, msg: `naməlum tip “${typeRaw}”` })
    if (!text) return errors.push({ row: rowNo, msg: 'sual mətni boşdur' })
    let q: Question = convertType({ id: uid6(), type: 'single', text: text.slice(0, 200), timeLimit: Number(time) || defaultTime, points: pts === 'double' || pts === '2x' ? 'double' : pts === 'none' || pts === '0' ? 'none' : 'standard', options: [], correct: [] }, type)
    q.timeLimit = Number(time) || defaultTime
    if (explanation) q.explanation = explanation.slice(0, 300)
    const opts = [a, b, c, d, e, f].map((x, k) => ({ id: LETTERS[k].toLowerCase(), text: (x ?? '').slice(0, 90) })).filter((o) => o.text)
    if (['single', 'multi', 'poll', 'order'].includes(type)) {
      if (opts.length < 2) return errors.push({ row: rowNo, msg: 'ən azı 2 variant lazımdır' })
      q.options = opts
      if (type === 'order') q.correct = opts.map((o) => o.id)
      else if (type !== 'poll') {
        q.correct = correctRaw.toUpperCase().split(/[\s,;|]+/).filter(Boolean).map((l) => l.toLowerCase()).filter((id) => opts.some((o) => o.id === id))
        if (!q.correct.length) return errors.push({ row: rowNo, msg: 'düzgün cavab göstərilməyib (A, B …)' })
        if (type === 'single') q.correct = q.correct.slice(0, 1)
      }
    } else if (type === 'truefalse') {
      const v = correctRaw.toLocaleLowerCase('az-AZ')
      q.correct = [v.startsWith('y') || v === 'false' || v === 'b' ? 'f' : 't']
    } else if (type === 'type') {
      q.accepted = correctRaw.split('|').map((x) => x.trim()).filter(Boolean).slice(0, 4)
      if (!q.accepted.length) return errors.push({ row: rowNo, msg: 'qəbul olunan cavab yoxdur' })
    } else if (type === 'slider') {
      const n = Number(correctRaw)
      q = { ...q, slider: { min: Number(a) || 0, max: Number(b) || 100, step: Number(c) || 1, answer: Number.isFinite(n) ? n : 50, tolerance: Number(d) || 0 } }
    }
    questions.push(JSON.parse(JSON.stringify(q)))
  })
  return { questions, errors }
}

export const CSV_TEMPLATE = [
  ['tip', 'sual', 'vaxt', 'xal', 'A', 'B', 'C', 'D', 'E', 'F', 'düzgün', 'izah'],
  ['single', 'LLM nə deməkdir?', '20', 'standard', 'Large Language Model', 'Low Latency Machine', 'Linear Learning Method', '', '', '', 'A', 'Böyük Dil Modeli'],
  ['multi', 'Yaxşı promptun elementləri?', '45', 'standard', 'Rol', 'Kontekst', 'Format', 'Bir söz', '', '', 'A,B,C', ''],
  ['truefalse', 'AI fakt səhvi edə bilər.', '15', 'standard', '', '', '', '', '', '', 'Doğru', 'Halüsinasiya'],
  ['type', 'Transformerin əsas mexanizmi? (bir söz)', '30', 'standard', '', '', '', '', '', '', 'attention|self-attention', ''],
  ['poll', 'AI-dan nə qədər istifadə edirsiniz?', '20', 'none', 'Hər gün', 'Həftədə', 'Arabir', 'Heç vaxt', '', '', '', ''],
]
