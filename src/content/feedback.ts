export const CORRECT = ['Əla! 🎉', 'Bomba! 💥', 'Sən alovlanırsan! 🔥', 'Dahi! 🧠', 'Super sürət! ⚡', 'Möhtəşəm! 🚀', 'Tam hədəf! 🎯']
export const WRONG = ['Az qaldı! 💪', 'Növbəti səninkidir! 🚀', 'Təslim olmaq yox! 😎', 'Heç nə, davam! 🌱', 'Növbəti sualda partla! 💥']
export const STICKERS_OK = ['🎉', '🔥', '🚀', '🤩', '🏆', '💯', '⚡']
export const STICKERS_BAD = ['💪', '🙈', '😅', '🌱', '🫶']
export const streakText = (n: number) => `${n} ardıcıl! ${'🔥'.repeat(Math.min(n, 5))}`
export const pick = <T,>(arr: T[], seed = Math.random()) => arr[Math.floor(seed * arr.length) % arr.length]
