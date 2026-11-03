import type { QuizSettings, Question, QuestionType, AppSettings } from '../types'

export const TIME_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240]

export const DEFAULT_SETTINGS: QuizSettings = {
  mode: 'host',
  scoring: 'speed',
  defaultTime: 45,
  streakBonus: true,
  shuffleQuestions: false,
  shuffleOptions: true,
  showCorrect: true,
  leaderboardEvery: 1,
  lateJoin: true,
  music: { on: true, volume: 60, theme: 'energetic' },
  nameFilter: true,
  maxPlayers: 100,
  powerUps: true,
  readTime: 4,
}

export const READ_TIMES = [0, 3, 4, 5, 8]
export const POWER_START = { fifty: 1, double: 1, shield: 1 } as const

export const DEFAULT_APP_SETTINGS: AppSettings = { defaultTime: 45, musicVolume: 60, brandText: 'Quizamcham', bannedWords: [] }

export const TYPE_DEFAULT_TIME: Record<QuestionType, number> = {
  single: 30, multi: 45, truefalse: 20, type: 45, poll: 20, order: 45, slider: 30, wordcloud: 45, open: 60, slide: 0,
}

export const MVP_TYPES: QuestionType[] = ['single', 'multi', 'truefalse', 'type', 'poll']
export const ALL_TYPES: QuestionType[] = ['single', 'multi', 'truefalse', 'type', 'poll', 'order', 'slider', 'wordcloud', 'open', 'slide']

export const uid6 = () => Math.random().toString(36).slice(2, 8)

export function withDefaults(s: Partial<QuizSettings> | undefined): QuizSettings {
  return { ...DEFAULT_SETTINGS, ...(s ?? {}), music: { ...DEFAULT_SETTINGS.music, ...(s?.music ?? {}) } }
}

export function newQuestion(type: QuestionType = 'single'): Question {
  const base: Question = { id: uid6(), type, text: '', timeLimit: TYPE_DEFAULT_TIME[type] || 30, points: 'standard', options: [], correct: [] }
  return convertType(base, type)
}

/** Sual tipini dəyişəndə variantları uyğunlaşdırır. */
export function convertType(q: Question, type: QuestionType): Question {
  const next: Question = { ...q, type }
  const ensure = (n: number) => {
    const opts = [...next.options]
    while (opts.length < n) opts.push({ id: uid6(), text: '' })
    next.options = opts
  }
  switch (type) {
    case 'truefalse':
      next.options = [{ id: 't', text: 'Doğru' }, { id: 'f', text: 'Yanlış' }]
      next.correct = q.correct.filter((c) => c === 't' || c === 'f').slice(0, 1)
      break
    case 'single':
    case 'multi':
    case 'poll':
      ensure(4)
      if (q.type === 'truefalse') { next.options = [0, 1, 2, 3].map(() => ({ id: uid6(), text: '' })); next.correct = [] }
      if (type === 'single') next.correct = next.correct.slice(0, 1)
      if (type === 'poll') next.correct = []
      break
    case 'order':
      ensure(4)
      next.options = next.options.slice(0, 5)
      next.correct = next.options.map((o) => o.id)
      break
    case 'type':
      next.options = []
      next.correct = []
      next.accepted = q.accepted?.length ? q.accepted : ['']
      next.softMatch = q.softMatch ?? true
      break
    case 'slider':
      next.options = []
      next.correct = []
      next.slider = q.slider ?? { min: 0, max: 100, step: 1, answer: 50, tolerance: 0 }
      break
    case 'wordcloud':
    case 'open':
    case 'slide':
      next.options = []
      next.correct = []
      if (type !== 'slide') next.points = 'none'
      break
  }
  if (type === 'poll') next.points = 'none'
  return next
}
