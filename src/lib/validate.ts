import { t } from '../i18n/az'
import type { Question } from '../types'
import { parseBlanks } from './scoring'

export function validateQuestion(q: Question): string[] {
  const e = t.editor.errors
  const errs: string[] = []
  if (!q.text.trim()) errs.push(e.emptyText)
  if (q.imageUrl && !/^(https:\/\/|data:image\/)/i.test(q.imageUrl)) errs.push(e.badImage)
  switch (q.type) {
    case 'single': case 'multi': case 'truefalse': case 'poll': case 'order':
      if (q.options.length < 2) errs.push(e.fewOptions)
      if (q.options.some((o) => !o.text.trim())) errs.push(e.emptyOption)
      if ((q.type === 'single' || q.type === 'multi' || q.type === 'truefalse') && q.correct.filter((c) => q.options.some((o) => o.id === c)).length === 0) errs.push(e.noCorrect)
      break
    case 'type':
      if (!(q.accepted ?? []).some((a) => a.trim())) errs.push(e.noAccepted)
      break
    case 'match':
      if (q.options.length < 2) errs.push(e.fewOptions)
      if (q.options.some((o) => !o.text.trim() || !(o.pair ?? '').trim())) errs.push(e.emptyPair)
      break
    case 'fill':
      if (parseBlanks(q.text).answers.length === 0) errs.push(e.noBlanks)
      break
    case 'hotspot':
      if (!q.imageUrl) errs.push(e.needImage)
      if (!q.hotspot) errs.push(e.noHotspot)
      break
    case 'slider': {
      const s = q.slider
      if (!s || !(s.max > s.min) || !(s.step > 0) || s.answer < s.min || s.answer > s.max) errs.push(e.sliderRange)
      break
    }
  }
  return errs
}
