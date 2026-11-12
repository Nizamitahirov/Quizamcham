/**
 * 3D avatar: konfiqurasiya modeli, seçim kataloqları, yoxlama və saxlama.
 *   avatars/{uid} = { config, thumb (webp data URL ≤ 90 KB), updatedAt }
 * Bütün hissələr prosedur olaraq (primitivlərdən) qurulur — xarici model faylı yoxdur.
 */
import { useEffect, useState } from 'react'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { currentLang } from '../i18n/az'

type L = { az: string; en: string; ru: string }
export interface Opt { id: string; e: string; l: L }
const o = (id: string, e: string, az: string, en: string, ru: string): Opt => ({ id, e, l: { az, en, ru } })
export const label = (x: { l: L }) => x.l[currentLang()] ?? x.l.az

export const SKIN = ['#FDE4D0', '#F9D2B4', '#F1C09A', '#E8AC80', '#D9966A', '#C68252', '#AD6B3F', '#93552F', '#7A4325', '#60331C', '#4A2715', '#B4C8E0']
export const HAIR_COLORS = ['#1C1714', '#3B2A20', '#5B3A24', '#8A5A32', '#B98445', '#E6C27A', '#F1E3C2', '#A8A8B0', '#E5E5EA', '#C2412D', '#F07AA8', '#8B6CF6', '#3BA3F5', '#3CCB9A']
export const PALETTE = ['#F0262F', '#FF7A1A', '#FFC531', '#3CCB7F', '#14B8A6', '#3B82F6', '#6366F1', '#A855F7', '#EC4899', '#F5F5F7', '#9CA3AF', '#374151', '#111827', '#7C4A2D', '#C2B280', '#1E3A5F']
export const EYE_COLORS = ['#2B1B12', '#5B3A24', '#3B82F6', '#14B8A6', '#3CCB7F', '#9CA3AF', '#A855F7', '#F59E0B']
export const BACKGROUNDS = [
  ['#F0262F', '#FF8A1A'], ['#6366F1', '#EC4899'], ['#0EA5E9', '#14B8A6'], ['#22C55E', '#A3E635'], ['#F59E0B', '#EF4444'], ['#111827', '#374151'], ['#A855F7', '#3B82F6'], ['#FDE68A', '#F9A8D4'],
] as const

export const OPTIONS = {
  build: [o('slim', '🧍', 'İncə', 'Slim', 'Стройный'), o('regular', '🧍‍♂️', 'Orta', 'Regular', 'Обычный'), o('broad', '💪', 'Enli', 'Broad', 'Крепкий')],
  eyes: [o('round', '👀', 'Dəyirmi', 'Round', 'Круглые'), o('happy', '😊', 'Xoşbəxt', 'Happy', 'Счастливые'), o('sleepy', '😌', 'Yuxulu', 'Sleepy', 'Сонные'), o('wink', '😉', 'Göz vuran', 'Wink', 'Подмигивание'),
    o('star', '🤩', 'Ulduz', 'Star', 'Звёзды'), o('sparkle', '🥺', 'Parlaq', 'Sparkle', 'Сияющие'), o('angry', '😠', 'Ciddi', 'Fierce', 'Серьёзные'), o('lashes', '😍', 'Kirpikli', 'Lashes', 'С ресницами')],
  brows: [o('none', '⬜', 'Yox', 'None', 'Нет'), o('soft', '〰️', 'Yumşaq', 'Soft', 'Мягкие'), o('thick', '➖', 'Qalın', 'Thick', 'Густые'), o('raised', '🤨', 'Qaldırılmış', 'Raised', 'Поднятые'), o('angry', '😤', 'Qəzəbli', 'Angry', 'Сердитые'), o('worried', '😟', 'Narahat', 'Worried', 'Тревожные')],
  mouth: [o('smile', '🙂', 'Təbəssüm', 'Smile', 'Улыбка'), o('grin', '😁', 'Gülüş', 'Grin', 'Ухмылка'), o('open', '😃', 'Açıq', 'Open', 'Открытый'), o('o', '😮', 'Təəccüb', 'Surprised', 'Удивление'),
    o('neutral', '😐', 'Sakit', 'Neutral', 'Спокойный'), o('smirk', '😏', 'Hiyləgər', 'Smirk', 'Хитрый'), o('tongue', '😛', 'Dil', 'Tongue', 'Язык'), o('cat', '😺', 'Pişik', 'Cat', 'Кошачий')],
  glasses: [o('none', '⬜', 'Yox', 'None', 'Нет'), o('round', '👓', 'Dəyirmi', 'Round', 'Круглые'), o('square', '🤓', 'Kvadrat', 'Square', 'Квадратные'), o('sun', '🕶️', 'Gün eynəyi', 'Sunglasses', 'Солнечные'),
    o('visor', '🥽', 'Kiber vizor', 'Cyber visor', 'Кибервизор'), o('monocle', '🧐', 'Monokl', 'Monocle', 'Монокль'), o('heart', '💖', 'Ürək', 'Hearts', 'Сердечки')],
  hair: [o('bald', '🥚', 'Keçəl', 'Bald', 'Лысый'), o('buzz', '💈', 'Qısa qırxıq', 'Buzz', 'Ёжик'), o('short', '💇', 'Qısa', 'Short', 'Короткие'), o('sidepart', '🧑‍💼', 'Yan ayırma', 'Side part', 'Пробор'),
    o('curly', '🧑‍🦱', 'Buruq', 'Curly', 'Кудри'), o('afro', '🌳', 'Afro', 'Afro', 'Афро'), o('bun', '🍡', 'Topuz', 'Bun', 'Пучок'), o('ponytail', '🐴', 'Quyruq', 'Ponytail', 'Хвост'),
    o('long', '👱‍♀️', 'Uzun', 'Long', 'Длинные'), o('bob', '💁', 'Bob', 'Bob', 'Каре'), o('mohawk', '🦔', 'İrokez', 'Mohawk', 'Ирокез'), o('spiky', '⚡', 'Tikanlı', 'Spiky', 'Колючки'),
    o('pigtails', '🎀', 'İki hörük', 'Pigtails', 'Хвостики'), o('wavy', '🌊', 'Dalğalı', 'Wavy', 'Волнистые')],
  facial: [o('none', '⬜', 'Yox', 'None', 'Нет'), o('stubble', '🧔‍♂️', 'Tük', 'Stubble', 'Щетина'), o('mustache', '🥸', 'Bığ', 'Mustache', 'Усы'), o('goatee', '🐐', 'Keçisaqqal', 'Goatee', 'Эспаньолка'), o('beard', '🧔', 'Saqqal', 'Beard', 'Борода')],
  hat: [o('none', '⬜', 'Yox', 'None', 'Нет'), o('cap', '🧢', 'Kepka', 'Cap', 'Кепка'), o('backcap', '🔄', 'Tərs kepka', 'Backwards cap', 'Кепка назад'), o('beanie', '🧶', 'Toxunma papaq', 'Beanie', 'Шапка'),
    o('bucket', '🪣', 'Panama', 'Bucket hat', 'Панама'), o('beret', '🎨', 'Beret', 'Beret', 'Берет'), o('cowboy', '🤠', 'Kovboy', 'Cowboy', 'Ковбойская'), o('tophat', '🎩', 'Silindr', 'Top hat', 'Цилиндр'),
    o('wizard', '🧙', 'Sehrbaz', 'Wizard', 'Колпак мага'), o('crown', '👑', 'Tac', 'Crown', 'Корона'), o('headphones', '🎧', 'Qulaqlıq', 'Headphones', 'Наушники'), o('bandana', '🏴‍☠️', 'Bandana', 'Bandana', 'Бандана'),
    o('halo', '😇', 'Nur halqası', 'Halo', 'Нимб'), o('cat', '🐱', 'Pişik qulaqları', 'Cat ears', 'Кошачьи ушки'), o('horns', '😈', 'Buynuzlar', 'Horns', 'Рожки'), o('flowers', '🌸', 'Gül çələngi', 'Flower crown', 'Венок')],
  top: [o('tshirt', '👕', 'Futbolka', 'T-shirt', 'Футболка'), o('hoodie', '🧥', 'Hudi', 'Hoodie', 'Худи'), o('jacket', '🧑‍🚀', 'Bomber', 'Bomber', 'Бомбер'), o('sweater', '🧶', 'Sviter', 'Sweater', 'Свитер'),
    o('tank', '🎽', 'Mayka', 'Tank top', 'Майка'), o('shirt', '👔', 'Köynək və qalstuk', 'Shirt & tie', 'Рубашка с галстуком'), o('jersey', '⚽', 'Forma', 'Jersey', 'Форма'), o('dress', '👗', 'Don', 'Dress', 'Платье')],
  pattern: [o('solid', '⬛', 'Sadə', 'Solid', 'Однотонный'), o('stripes', '🦓', 'Zolaqlı', 'Stripes', 'Полоски'), o('logo', '🔴', 'Jabr loqosu', 'Jabr logo', 'Логотип Jabr'), o('number', '🔢', 'Nömrə', 'Number', 'Номер')],
  bottom: [o('pants', '👖', 'Şalvar', 'Pants', 'Брюки'), o('jeans', '🩵', 'Cins', 'Jeans', 'Джинсы'), o('shorts', '🩳', 'Şort', 'Shorts', 'Шорты'), o('skirt', '🩱', 'Yubka', 'Skirt', 'Юбка'),
    o('joggers', '🏃', 'İdman şalvarı', 'Joggers', 'Джоггеры'), o('cargo', '🪖', 'Karqo', 'Cargo', 'Карго'), o('leggings', '🧘', 'Legginq', 'Leggings', 'Леггинсы')],
  shoes: [o('sneakers', '👟', 'Krossovka', 'Sneakers', 'Кроссовки'), o('hightops', '🏀', 'Hündür krossovka', 'High-tops', 'Высокие кеды'), o('boots', '🥾', 'Çəkmə', 'Boots', 'Ботинки'), o('loafers', '👞', 'Tufli', 'Loafers', 'Лоферы'), o('slides', '🩴', 'Şap-şap', 'Slides', 'Шлёпанцы')],
  back: [o('none', '⬜', 'Yox', 'None', 'Нет'), o('backpack', '🎒', 'Bel çantası', 'Backpack', 'Рюкзак'), o('crossbody', '👜', 'Çiyin çantası', 'Crossbody bag', 'Сумка через плечо'), o('tote', '🛍️', 'Tote çanta', 'Tote bag', 'Шопер'),
    o('guitar', '🎸', 'Gitara', 'Guitar', 'Гитара'), o('wings', '🪽', 'Qanadlar', 'Wings', 'Крылья'), o('cape', '🦸', 'Plaş', 'Cape', 'Плащ'), o('jetpack', '🚀', 'Reaktiv çanta', 'Jetpack', 'Джетпак')],
  neck: [o('none', '⬜', 'Yox', 'None', 'Нет'), o('scarf', '🧣', 'Şərf', 'Scarf', 'Шарф'), o('chain', '📿', 'Zəncir', 'Chain', 'Цепочка'), o('bowtie', '🎀', 'Kəpənək', 'Bow tie', 'Бабочка'), o('medal', '🏅', 'Medal', 'Medal', 'Медаль')],
  hand: [o('none', '⬜', 'Yox', 'None', 'Нет'), o('book', '📘', 'Kitab', 'Book', 'Книга'), o('trophy', '🏆', 'Kubok', 'Trophy', 'Кубок'), o('mic', '🎤', 'Mikrofon', 'Microphone', 'Микрофон'),
    o('balloon', '🎈', 'Şar', 'Balloon', 'Шарик'), o('phone', '📱', 'Telefon', 'Phone', 'Телефон'), o('icecream', '🍦', 'Dondurma', 'Ice cream', 'Мороженое')],
  pose: [o('idle', '🧍', 'Sakit', 'Idle', 'Стоит'), o('wave', '👋', 'Salam', 'Wave', 'Машет'), o('cheer', '🙌', 'Sevinc', 'Cheer', 'Радость'), o('dance', '🕺', 'Rəqs', 'Dance', 'Танец')],
} as const

export type Key = keyof typeof OPTIONS
type Id<K extends Key> = (typeof OPTIONS)[K][number]['id']
export interface AvatarConfig {
  v: 1
  skin: string; build: Id<'build'>
  eyes: Id<'eyes'>; eyeColor: string; brows: Id<'brows'>; mouth: Id<'mouth'>; blush: boolean; freckles: boolean; glasses: Id<'glasses'>; glassesColor: string
  hair: Id<'hair'>; hairColor: string; facial: Id<'facial'>
  hat: Id<'hat'>; hatColor: string
  top: Id<'top'>; topColor: string; topColor2: string; pattern: Id<'pattern'>; number: number
  bottom: Id<'bottom'>; bottomColor: string
  shoes: Id<'shoes'>; shoeColor: string
  back: Id<'back'>; backColor: string
  neck: Id<'neck'>; neckColor: string
  hand: Id<'hand'>
  pose: Id<'pose'>; bg: number
}

export const DEFAULT_AVATAR: AvatarConfig = {
  v: 1, skin: SKIN[2], build: 'regular',
  eyes: 'happy', eyeColor: EYE_COLORS[0], brows: 'soft', mouth: 'smile', blush: true, freckles: false, glasses: 'none', glassesColor: '#111827',
  hair: 'short', hairColor: HAIR_COLORS[1], facial: 'none',
  hat: 'none', hatColor: PALETTE[0],
  top: 'hoodie', topColor: PALETTE[0], topColor2: '#F5F5F7', pattern: 'logo', number: 7,
  bottom: 'joggers', bottomColor: PALETTE[12],
  shoes: 'sneakers', shoeColor: '#F5F5F7',
  back: 'none', backColor: PALETTE[5], neck: 'none', neckColor: '#FFC531', hand: 'none',
  pose: 'wave', bg: 0,
}

const HEX = /^#[0-9A-Fa-f]{6}$/
/** Bazadan və ya istifadəçidən gələn konfiqurasiyanı təmizləyir (naməlum dəyər → standart). */
export function sanitize(raw: unknown): AvatarConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out = { ...DEFAULT_AVATAR } as Record<string, unknown>
  for (const k of Object.keys(DEFAULT_AVATAR)) {
    const v = r[k], d = (DEFAULT_AVATAR as unknown as Record<string, unknown>)[k]
    if (k in OPTIONS) { if (typeof v === 'string' && (OPTIONS[k as Key] as readonly Opt[]).some((x) => x.id === v)) out[k] = v }
    else if (typeof d === 'string' && d.startsWith('#')) { if (typeof v === 'string' && HEX.test(v)) out[k] = v }
    else if (typeof d === 'boolean') { if (typeof v === 'boolean') out[k] = v }
    else if (k === 'number') { if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 99) out[k] = v }
    else if (k === 'bg') { if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < BACKGROUNDS.length) out[k] = v }
  }
  out.v = 1
  return out as unknown as AvatarConfig
}

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]
/** Təsadüfi, amma ahəngdar avatar. */
export function randomAvatar(): AvatarConfig {
  const ids = <K extends Key>(k: K) => (OPTIONS[k] as readonly Opt[]).map((x) => x.id)
  const c = sanitize({
    skin: pick(SKIN.slice(0, 11)), build: pick(ids('build')), eyes: pick(ids('eyes')), eyeColor: pick(EYE_COLORS), brows: pick(ids('brows')), mouth: pick(ids('mouth')),
    blush: Math.random() < 0.5, freckles: Math.random() < 0.25, glasses: Math.random() < 0.6 ? 'none' : pick(ids('glasses')), glassesColor: pick(PALETTE),
    hair: pick(ids('hair')), hairColor: pick(HAIR_COLORS), facial: Math.random() < 0.7 ? 'none' : pick(ids('facial')),
    hat: Math.random() < 0.45 ? 'none' : pick(ids('hat')), hatColor: pick(PALETTE),
    top: pick(ids('top')), topColor: pick(PALETTE), topColor2: pick(PALETTE), pattern: pick(ids('pattern')), number: Math.floor(Math.random() * 99) + 1,
    bottom: pick(ids('bottom')), bottomColor: pick(PALETTE), shoes: pick(ids('shoes')), shoeColor: pick(PALETTE),
    back: Math.random() < 0.5 ? 'none' : pick(ids('back')), backColor: pick(PALETTE), neck: Math.random() < 0.6 ? 'none' : pick(ids('neck')), neckColor: pick(PALETTE),
    hand: Math.random() < 0.5 ? 'none' : pick(ids('hand')), pose: pick(ids('pose')), bg: Math.floor(Math.random() * BACKGROUNDS.length),
  })
  return c
}

// ---------- saxlama ----------
const cache = new Map<string, string | null>()
const listeners = new Set<() => void>()
export async function loadAvatar(uid: string): Promise<{ config: AvatarConfig; thumb: string } | null> {
  const s = await getDoc(doc(db, 'avatars', uid)).catch(() => null)
  if (!s?.exists()) return null
  return { config: sanitize(s.get('config')), thumb: String(s.get('thumb') ?? '') }
}
export async function saveAvatar(uid: string, config: AvatarConfig, thumb: string) {
  await setDoc(doc(db, 'avatars', uid), { config: sanitize(config), thumb, updatedAt: serverTimestamp() })
  cache.set(uid, thumb); listeners.forEach((f) => f())
}
/** Hesab menyusu və profillər üçün kiçik şəkil (sessiya üzrə keşlənir). */
export function useAvatarThumb(uid?: string): string | null {
  const [, tick] = useState(0)
  useEffect(() => {
    const f = () => tick((x) => x + 1)
    listeners.add(f)
    if (uid && !cache.has(uid)) {
      cache.set(uid, null)
      void loadAvatar(uid).then((a) => { cache.set(uid, a?.thumb || null); listeners.forEach((g) => g()) })
    }
    return () => { listeners.delete(f) }
  }, [uid])
  return uid ? cache.get(uid) ?? null : null
}
