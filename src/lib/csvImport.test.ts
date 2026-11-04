import { describe, expect, it } from 'vitest'
import { CSV_TEMPLATE, parseTable, rowsToQuestions } from './csvImport'

const toTsv = (rows: string[][]) => rows.map((r) => r.join('\t')).join('\n')

describe('Excel/CSV idxalı', () => {
  it('Excel-dən yapışdırılan (TSV) şablonu oxuyur', () => {
    const { questions, errors } = rowsToQuestions(parseTable(toTsv(CSV_TEMPLATE)))
    expect(errors).toEqual([])
    expect(questions.map((q) => q.type)).toEqual(['single', 'multi', 'truefalse', 'type', 'poll'])
    expect(questions[0].correct).toEqual(['a'])
    expect(questions[1].correct).toEqual(['a', 'b', 'c'])
    expect(questions[2].correct).toEqual(['t'])
    expect(questions[3].accepted).toEqual(['attention', 'self-attention'])
    expect(questions[4].correct).toEqual([])
  })
  it('dırnaqlı CSV (vergül, nöqtəli vergül) və sətir keçidi', () => {
    const csv = 'tip;sual;vaxt;xal;A;B;C;D;E;F;düzgün;izah\nsingle;"Sual; içində ayırıcı";20;double;"Bir, iki";Üç;;;;;B;"İzah\nikinci sətir"'
    const { questions, errors } = rowsToQuestions(parseTable(csv))
    expect(errors).toEqual([])
    expect(questions[0].text).toBe('Sual; içində ayırıcı')
    expect(questions[0].options[0].text).toBe('Bir, iki')
    expect(questions[0].points).toBe('double')
    expect(questions[0].explanation).toContain('ikinci sətir')
  })
  it('səhv sətirləri bildirir, digərlərini idxal edir', () => {
    const rows = [CSV_TEMPLATE[0], ['single', 'Düzgünsüz', '20', '', 'A1', 'B1', '', '', '', '', ''], ['bilinməyən', 'x'], CSV_TEMPLATE[1]]
    const { questions, errors } = rowsToQuestions(rows)
    expect(questions).toHaveLength(1)
    expect(errors.map((e) => e.row)).toEqual([2, 3])
  })
})
