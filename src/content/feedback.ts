import { t } from '../i18n/az'

export const CORRECT = t.extra.correctPhrases
export const WRONG = t.extra.wrongPhrases
export const STICKERS_OK = ['🎉', '🔥', '🚀', '🤩', '🏆', '💯', '⚡']
export const STICKERS_BAD = ['💪', '🙈', '😅', '🌱', '🫶']
export const streakText = (n: number) => t.extra.streakText(n)
export const pick = <T,>(arr: T[], seed = Math.random()) => arr[Math.floor(seed * arr.length) % arr.length]
