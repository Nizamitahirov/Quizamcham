import { describe, it, expect } from 'vitest'
import { writeFileSync } from 'node:fs'
import { xlsxBlob } from './xlsx'

describe('xlsx', () => {
  it('etibarlı .xlsx yaradır (Azərbaycan/rus hərfləri, rəqəmlər, xüsusi simvollar)', async () => {
    const blob = await xlsxBlob([
      { name: 'Nəticələr', rows: [['Ad', 'Xal', 'Qeyd'], ['Aysel Məmmədova', 1200, 'düz <5> & "əla"'], ['Иван', 0.5, null]] },
      { name: 'Suallar/statistika', rows: [['#', 'Sual'], [1, 'Şəki?']] },
    ])
    const buf = Buffer.from(await blob.arrayBuffer())
    expect(buf.subarray(0, 2).toString()).toBe('PK')
    if (process.env.XLSX_OUT) writeFileSync(process.env.XLSX_OUT, buf)
  })
})
