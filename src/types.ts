import type { Timestamp } from 'firebase/firestore'

export type QuestionType = 'single' | 'multi' | 'truefalse' | 'type' | 'poll' | 'order' | 'slider' | 'wordcloud' | 'open' | 'slide' | 'match' | 'fill' | 'hotspot'
export type PointsMode = 'standard' | 'double' | 'none'
export type Phase = 'lobby' | 'countdown' | 'question' | 'reveal' | 'leaderboard' | 'podium' | 'finished' | 'self'
export type GameMode = 'host' | 'auto' | 'self' | 'assign'

/** pair — uyğunlaşdırma sualında sağ tərəf (yalnız gizli nüsxədə) */
export interface Option { id: string; text: string; pair?: string }
/** Şəkil üzərində düzgün sahə: mərkəz və radius — şəklin eninə/hündürlüyünə görə faizlə */
export interface Hotspot { x: number; y: number; r: number }
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
  hotspot?: Hotspot
  /** oyun başlayanda təsadüfi — uyğunlaşdırma cavablarının id-lərini gizlədir (yalnız gizli nüsxədə) */
  matchSalt?: string
}

export type MusicTheme = 'energetic' | 'chill' | 'retro' | 'synthwave' | 'lofi' | 'house' | 'funk' | 'arcade' | 'epic' | 'jazz' | 'latin' | 'techno' | 'bossa' | 'space'
export interface MusicSettings { on: boolean; volume: number; theme: MusicTheme }

export interface QuizSettings {
  mode: GameMode
  autoDelay: number // avtomatik rejimdə nəticə/reytinq ekranlarının müddəti (s)
  selfMinutes: number // öz tempində rejimdə ümumi vaxt (dəq)
  assignDays: number // tapşırıq rejimində son tarix (gün)
  scoring: 'speed' | 'accuracy'
  defaultTime: number
  streakBonus: boolean
  /** əminlik rejimi: oyunçu cavabla birlikdə 'əminəm' seçir — düz ×1.5, səhv −25% */
  confidence?: boolean
  shuffleQuestions: boolean
  shuffleOptions: boolean
  showCorrect: boolean
  leaderboardEvery: 1 | 3 | 0 // 0 = yalnız sonda
  lateJoin: boolean
  music: MusicSettings
  nameFilter: boolean
  maxPlayers: number
  powerUps: boolean
  qa: boolean
  feedback: boolean
  teams: 0 | 2 | 3 | 4
  readTime: number // sualı cavablardan əvvəl göstərmə (s)
  selfShuffle?: boolean // öz tempində / tapşırıq: hər iştirakçıya sualların fərqli ardıcıllığı
  selfFeedback?: boolean // öz tempində: hər sualdan sonra nəticə (false → nəticələr sonda)
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
  shared?: boolean // kitabxanaya paylaşılıb: bütün təlimçilər görür və surətini çıxara bilir
  orgId?: string // müəssisə: təşkilat daxilində ortaq
  tags?: string[]
  /** qovluq (təlimçinin öz təşkilatı üçün) */
  folder?: string
  /** birgə redaktə edən həmmüəlliflərin e-poçtları (kiçik hərflə) */
  editors?: string[]
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
  /** uyğunlaşdırma: sağ tərəf, qarışdırılmış, gizli id-lərlə */
  right?: Option[]
  /** boşluq doldurma: boşluq sayı (mətndə ___ ilə) */
  blanks?: number
}

export interface LobbyEntry { uid: string; firstName: string; lastName: string; avatar: AvatarData; team?: number }
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
  /** yeni növlər: düzgün cütlər, boşluqların cavabları, şəkildə düzgün sahə */
  pairs?: { left: string; right: string }[]
  blanks?: string[][]
  hotspot?: Hotspot
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
  teamBoard?: TeamEntry[]
  selfEndsAt?: Timestamp | null
  countdownAt?: Timestamp | null // sualın oxuma mərhələsinin server vaxtı (başlanğıc = countdownAt + readMs)
  selfDone?: number // öz tempində: bütün sualları bitirənlərin sayı
  host?: HostProfile | null
  plan?: 'free' | 'pro' | 'team' // pulsuz planda maks. 10 iştirakçı
  orgId?: string
}

export interface TeamEntry { team: number; score: number; members: number; total: number }

export interface HostProfile { name: string; title?: string; org?: string; avatar?: AvatarData | null; photoUrl?: string }
export interface TrainerProfile extends HostProfile { bio?: string; email?: string; defaults?: Partial<QuizSettings> }
export interface SelfReveal { correct: string[]; accepted?: string[] | null; sliderAnswer?: number | null; explanation?: string | null; pairs?: { left: string; right: string }[]; blanks?: string[][]; hotspot?: Hotspot; text?: string }

export interface ReviewItem { type: QuestionType; text: string; options: Option[]; correct: string[]; accepted: string[] | null; sliderAnswer: number | null; explanation: string | null; scored: boolean; pairs?: { left: string; right: string }[]; blanks?: string[][]; hotspot?: Hotspot; imageUrl?: string }

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
  selfQ?: { index: number; step?: number; q: PublicQuestion | null } | null
  team?: number
}

export type AnswerValue = string[] | string | number

export interface Answer { uid: string; questionIndex: number; value: AnswerValue | null; answeredAt: Timestamp | null; conf?: boolean }

export interface AppSettings { defaultTime: number; musicVolume: number; brandText: string; bannedWords: string[] }

export interface SoundClip { data: string; name: string; start: number; duration: number }
export interface SoundSettings { correct?: SoundClip | null; wrong?: SoundClip | null; enabled: boolean }
