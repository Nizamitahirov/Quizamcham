import type { Timestamp } from 'firebase/firestore'

export type QuestionType = 'single' | 'multi' | 'truefalse' | 'type' | 'poll' | 'order' | 'slider' | 'wordcloud' | 'open' | 'slide'
export type PointsMode = 'standard' | 'double' | 'none'
export type Phase = 'lobby' | 'countdown' | 'question' | 'reveal' | 'leaderboard' | 'podium' | 'finished' | 'self'
export type GameMode = 'host' | 'auto' | 'self'

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

export type MusicTheme = 'energetic' | 'chill' | 'retro' | 'synthwave' | 'lofi' | 'house' | 'funk' | 'arcade' | 'epic' | 'jazz' | 'latin' | 'techno' | 'bossa' | 'space'
export interface MusicSettings { on: boolean; volume: number; theme: MusicTheme }

export interface QuizSettings {
  mode: GameMode
  autoDelay: number // avtomatik rejimdə nəticə/reytinq ekranlarının müddəti (s)
  selfMinutes: number // öz tempində rejimdə ümumi vaxt (dəq)
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
  powerUps: boolean
  readTime: number // sualı cavablardan əvvəl göstərmə (s)
}

export type PowerType = 'fifty' | 'double' | 'shield'
export type PowerInventory = Record<PowerType, number>
export interface PowerUse { q: number; type: PowerType }
export interface Award { key: 'fastest' | 'streak' | 'perfect' | 'sharp'; uid: string; name: string; avatar: AvatarData; value: string }
export interface Fastest { uid: string; name: string; avatar: AvatarData; ms: number }

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
  fastest?: Fastest | null
  correctCount?: number
}

export interface Preview { index: number; text: string; type: QuestionType; imageUrl?: string; points: PointsMode; readMs: number }

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
  preview?: Preview | null
  awards?: Award[]
  publicQuestions?: PublicQuestion[]
  selfEndsAt?: Timestamp | null
  host?: HostProfile | null
}

export interface HostProfile { name: string; title?: string; org?: string; avatar?: AvatarData | null; photoUrl?: string }
export interface TrainerProfile extends HostProfile { bio?: string; email?: string; defaults?: Partial<QuizSettings> }
export interface SelfReveal { correct: string[]; accepted?: string[] | null; sliderAnswer?: number | null; explanation?: string | null }

export interface ReviewItem { type: QuestionType; text: string; options: Option[]; correct: string[]; accepted: string[] | null; sliderAnswer: number | null; explanation: string | null; scored: boolean }

export interface GameStats { players: number; avgAccuracy: number; hardest?: { index: number; text: string; accuracy: number }; easiest?: { index: number; text: string; accuracy: number } }

export interface HistoryItem { q: number; answer: AnswerValue | null; correct: boolean; points: number; timeMs: number | null; power?: PowerType | null }
export interface LastResult { questionIndex: number; correct: boolean; points: number; streakBonus: number; rank: number; prevRank: number; answered: boolean; poll?: boolean; streak: number; total: number; timeMs?: number | null; power?: PowerType | null; shielded?: boolean; reveal?: SelfReveal | null }

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
  powerups?: PowerInventory
  power?: PowerUse | null
  fiftyHide?: { q: number; ids: string[] } | null
}

export type AnswerValue = string[] | string | number

export interface Answer { uid: string; questionIndex: number; value: AnswerValue | null; answeredAt: Timestamp | null }

export interface AppSettings { defaultTime: number; musicVolume: number; brandText: string; bannedWords: string[] }

export interface SoundClip { data: string; name: string; start: number; duration: number }
export interface SoundSettings { correct?: SoundClip | null; wrong?: SoundClip | null; enabled: boolean }
