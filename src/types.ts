import type { Timestamp } from 'firebase/firestore'

export type QuestionType = 'single' | 'multi' | 'truefalse' | 'type' | 'poll' | 'order' | 'slider' | 'wordcloud' | 'open' | 'slide'
export type PointsMode = 'standard' | 'double' | 'none'
export type Phase = 'lobby' | 'countdown' | 'question' | 'reveal' | 'leaderboard' | 'podium' | 'finished'

export interface Option { id: string; text: string }
export interface SliderCfg { min: number; max: number; step: number; answer: number; tolerance: number }

export interface Question {
  id: string
  type: QuestionType
  text: string
  imageUrl?: string
  explanation?: string
  timeLimit: number
  points: PointsMode
  options: Option[]
  correct: string[]
  accepted?: string[]
  softMatch?: boolean
  slider?: SliderCfg
  shuffleOptions?: boolean
}

export interface MusicSettings { on: boolean; volume: number; theme: 'energetic' | 'chill' | 'retro' }

export interface QuizSettings {
  mode: 'host' | 'self'
  scoring: 'speed' | 'accuracy'
  defaultTime: number
  streakBonus: boolean
  shuffleQuestions: boolean
  shuffleOptions: boolean
  showCorrect: boolean
  leaderboardEvery: 1 | 3 | 0 // 0 = yalnız sonda
  lateJoin: boolean
  music: MusicSettings
  nameFilter: boolean
  maxPlayers: number
}

export interface Quiz {
  id: string
  title: string
  description: string
  coverEmoji: string
  coverColor: string
  settings: QuizSettings
  questionOrder: string[]
  ownerUid: string
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export interface AvatarData { style: string; seed: string; accessory?: string }

export interface PublicQuestion {
  id: string
  type: QuestionType
  text: string
  imageUrl?: string
  options: Option[]
  timeLimit: number
  points: PointsMode
  slider?: { min: number; max: number; step: number }
  multiCount?: number
  shuffle?: boolean
  body?: string
}

export interface LobbyEntry { uid: string; firstName: string; lastName: string; avatar: AvatarData }
export interface LeaderEntry { uid: string; name: string; avatar: AvatarData; score: number; rank: number; delta: number }

export interface Reveal {
  correct: string[]
  accepted?: string[]
  sliderAnswer?: number
  explanation?: string
  distribution: Record<string, number>
  answeredCount: number
  texts?: string[]
}

export interface Game {
  id: string
  pin: string
  quizId: string
  hostUid: string
  title: string
  settings: QuizSettings
  phase: Phase
  locked: boolean
  questionIndex: number
  totalQuestions: number
  currentQuestion: PublicQuestion | null
  questionStartedAt: Timestamp | null
  questionEndsAt: Timestamp | null
  pausedRemainingMs: number | null
  reveal: Reveal | null
  lobby: LobbyEntry[]
  leaderboard: LeaderEntry[]
  playerCount: number
  answeredCount: number
  createdAt?: Timestamp
  startedAt?: Timestamp | null
  finishedAt?: Timestamp | null
  stats?: GameStats | null
  review?: ReviewItem[]
  scoredCount?: number
}

export interface ReviewItem { type: QuestionType; text: string; options: Option[]; correct: string[]; accepted: string[] | null; sliderAnswer: number | null; explanation: string | null; scored: boolean }

export interface GameStats { players: number; avgAccuracy: number; hardest?: { index: number; text: string; accuracy: number }; easiest?: { index: number; text: string; accuracy: number } }

export interface HistoryItem { q: number; answer: AnswerValue | null; correct: boolean; points: number; timeMs: number | null }
export interface LastResult { questionIndex: number; correct: boolean; points: number; streakBonus: number; rank: number; prevRank: number; answered: boolean; poll?: boolean; streak: number; total: number }

export interface Player {
  uid: string
  firstName: string
  lastName: string
  avatar: AvatarData
  joinedAt?: Timestamp
  lastSeen?: Timestamp
  kicked: boolean
  score: number
  correctCount: number
  streak: number
  bestStreak: number
  totalCorrectTimeMs: number
  lastResult: LastResult | null
  history: HistoryItem[]
}

export type AnswerValue = string[] | string | number

export interface Answer { uid: string; questionIndex: number; value: AnswerValue; answeredAt: Timestamp | null }

export interface AppSettings { defaultTime: number; musicVolume: number; brandText: string; bannedWords: string[] }
