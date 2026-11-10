/**
 * İctimai kataloq üçün avtomatik məzmun yoxlaması (həm brauzerdə, həm serverdə eyni kod işləyir).
 *
 * Yoxlanılır: söyüş/vulqarizm (az, tr, ru, en), açıq seksual məzmun, təhqir və nifrət ifadələri,
 * zorakılığa/özünəzərərə çağırış, reklam/əlaqə məlumatı (telefon, e-poçt, keçid, messencer), keyfiyyət.
 * Şəkilli quizlər avtomatik yoxlana bilmir — super adminin təsdiqinə göndərilir (hasImages).
 *
 * Yanlış həyəcanların qarşısını almaq üçün: söz kökləri yalnız "təhlükəsiz" olanlarda prefiks kimi,
 * qalanları tam söz/forma kimi tutulur (məs. "şikayət" ≠ söyüş). Biologiya terminləri (cinsi, penis və s.) bloklanmır.
 */

export type ModCode = 'profanity' | 'sexual' | 'hate' | 'violence' | 'contact' | 'link' | 'quality'
export interface ModIssue { code: ModCode; where: string; match?: string }
export interface ModResult { ok: boolean; issues: ModIssue[]; hasImages: boolean }

// ---------- normallaşdırma ----------
const FOLD: Record<string, string> = {
  // "ı" saxlanılır: türkcə "sık/sıkış" (tez-tez, sıxmaq) söyüşlə qarışmasın
  ə: 'e', i̇: 'i', ö: 'o', ü: 'u', ğ: 'g', ç: 'c', ş: 's', â: 'a', î: 'i', û: 'u',
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i',
  // latın hərfinə bənzəyən kiril hərfləri (qarışıq yazılış) — yalnız tamamilə latın sözlərdə əvəz olunur, bax mixed()
}
const CYR_LAT: Record<string, string> = { а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', х: 'x', у: 'y', к: 'k', м: 'm', т: 't', в: 'b', н: 'h' }

export function normalize(s: string): string {
  let t = s.toLowerCase().normalize('NFC')
  t = Array.from(t, (ch) => FOLD[ch] ?? ch).join('')
  // "fuuuck" → "fuck", "сууука" → "сука"
  t = t.replace(/(\p{L})\1+/gu, '$1')
  return t
}
/** Latın sözünün içinə qatılmış kiril hərflərini latına çevirir (məs. "fuсk" kiril "с" ilə). */
const mixed = (tok: string) => (/[a-z]/.test(tok) && /[Ѐ-ӿ]/.test(tok) ? Array.from(tok, (c) => CYR_LAT[c] ?? c).join('') : tok)

function tokens(s: string): string[] {
  const n = normalize(s)
  const toks = n.split(/[^\p{L}]+/u).filter(Boolean).map(mixed)
  // "s i k t i r", "f.u.c.k" kimi hərf-hərf yazılışlar birləşdirilir
  const out = [...toks]
  let run: string[] = []
  const flush = () => { if (run.length >= 3) out.push(run.join('')); run = [] }
  for (const t of toks) { if (t.length === 1) run.push(t); else flush() }
  flush()
  return out
}

// ---------- söz siyahıları (normallaşdırılmış formada müqayisə olunur) ----------
type List = { exact: string[]; prefix: string[]; phrase?: string[] }
const LISTS: Record<Exclude<ModCode, 'contact' | 'link' | 'quality'>, List> = {
  profanity: {
    exact: [
      'sik', 'sikim', 'sikdi', 'sikib', 'sikmek', 'sikerem', 'sikeyim', 'sikiyim', 'sikdir', 'sikdirin',
      'shit', 'shitty', 'bullshit', 'bitch', 'bitches', 'cunt', 'dickhead', 'twat', 'wanker', 'asshole', 'arsehole', 'whore', 'slut',
      'got', 'gotun', 'gotune', 'gotu', // yalnız birlikdə: bax GOT_GUARD
      'suka', 'suki', 'blyat', 'blyad', 'bljad', 'nahuy', 'nahui', 'pizdec', 'pizda', 'eblan', 'yeban', 'mudak', 'gandon',
      'сука', 'суки', 'сучка', 'бля', 'блять', 'блядь', 'мудак', 'гандон', 'нахуй', 'нахер', 'хер',
      'gavat', 'peyser', 'qancig', 'qanciq', 'qancıq', 'kancık', 'kancik', 'dalbayob', 'dolbayob', 'gicdilaq', 'gijdilaq', 'gıcdılaq', 'gijdılaq', 'oglancig', 'oglancıq',
    ],
    prefix: [
      'fuck', 'motherfuck', 'siktir', 'sikdir', 'sikis', 'sikerim', 'amcig', 'amciq', 'amcıq', 'amcık', 'amcik', 'aminakoy', 'amınakoy', 'aminako',
      'orospu', 'oruspu', 'qehbe', 'gehbe', 'kahpe', 'fahise', 'pezeveng', 'gotveren', 'yarrak',
      'хуй', 'хуе', 'хуё', 'хуя', 'пизд', 'ебат', 'ебан', 'ёбан', 'ебал', 'ебл', 'выеб', 'заеб', 'залуп', 'шлюх', 'мудил', 'пидор', 'пидар', 'pizd', 'ebat',
    ],
    phrase: ['anan sik', 'anani sik', 'bacini sik', 'ananin ami', 'it oglu it', 'son of a bitch', 'go fuck'],
  },
  sexual: {
    exact: ['xxx', 'nude', 'nudes', 'hentai', 'onlyfans', 'tits', 'boobs', 'milf', 'blowjob', 'handjob', 'dildo', 'sexy', 'порно'],
    prefix: ['porn', 'порн', 'masturb', 'мастурб', 'orgasm', 'оргазм', 'erotik', 'erotic', 'эротик', 'striptiz', 'striptease', 'стриптиз', 'camgirl', 'эскорт', 'sikis'],
    phrase: ['cinsi elaqe qur', 'yataga gir', 'send nudes'],
  },
  hate: {
    exact: ['nigger', 'nigga', 'niggers', 'faggot', 'faggots', 'tranny', 'kike', 'хач', 'жид', 'жиды', 'чурка'],
    prefix: ['пидорас'],
    phrase: ['heil hitler', 'sieg heil', 'white power'],
  },
  violence: {
    exact: ['kys'],
    prefix: [],
    phrase: ['kill yourself', 'go die', 'oldurmek lazimdir', 'ozunu oldur', 'ozunu as', 'intihar et', 'intihar edin', 'oldurun onlari', 'убей себя', 'иди умри', 'bomba qur', 'make a bomb'],
  },
}
// "got" (ingiliscə "got") yalnız açıq-aşkar söyüş kontekstində tutulur
const GOT_GUARD = new Set(['got', 'gotun', 'gotune', 'gotu'])
const GOT_CONTEXT = /\b(got(un|une|u)?)\s+(veren|verenin|deliyi|deliy|bas|yala)/

const SETS = Object.fromEntries(Object.entries(LISTS).map(([k, l]) => [k, {
  exact: new Set(l.exact.map((w) => tokens(w).join(''))),
  prefix: l.prefix.map((w) => tokens(w).join('')),
  phrase: (l.phrase ?? []).map((p) => tokens(p).join(' ')),
}])) as Record<keyof typeof LISTS, { exact: Set<string>; prefix: string[]; phrase: string[] }>

// ---------- reklam / əlaqə ----------
const EMAIL = /[\p{L}\d._%+-]+@[\p{L}\d.-]+\.[a-z]{2,}/iu
const URL = /\b(?:https?:\/\/|www\.)\S+|\b(?:t\.me|wa\.me|bit\.ly|tinyurl\.com|goo\.gl|instagram\.com|tiktok\.com|onlyfans\.com|telegram\.me)\/\S*/i
const MESSENGER = /\b(?:whats\s?app|telegram|viber|instagram|insta|tiktok)\b[^.\n]{0,25}(?:@|\+?\d)/i
const HANDLE = /(?:^|\s)@[a-z0-9_.]{4,}/i
function phone(s: string) {
  const m = s.match(/(?:\+|\b00|\b0)?\d[\d\s\-().]{7,}\d/g) ?? []
  return m.find((x) => {
    const d = x.replace(/\D/g, '')
    // Azərbaycan (+994 / 0XX) və beynəlxalq formatlar; illər/riyazi ifadələr (məs. "1918 1920") nəzərə alınmır
    return (d.length >= 9 && d.length <= 15) && (/^\+|^00/.test(x.trim()) || /^0\d{8,9}$/.test(d) || /^994\d{9}$/.test(d))
  })
}

/** Bir mətndə tapılan problemlər. */
export function checkText(text: string, where: string): ModIssue[] {
  if (!text) return []
  const issues: ModIssue[] = []
  const toks = tokens(text)
  const joined = ' ' + toks.join(' ') + ' '
  const flat = normalize(text)
  for (const code of Object.keys(SETS) as (keyof typeof SETS)[]) {
    const S = SETS[code]
    let hit: string | undefined
    for (const t of toks) {
      if (GOT_GUARD.has(t)) { if (code === 'profanity' && GOT_CONTEXT.test(flat)) { hit = t; break } continue }
      if (S.exact.has(t) || S.prefix.some((p) => t.startsWith(p))) { hit = t; break }
    }
    if (!hit) hit = S.phrase.find((p) => joined.includes(' ' + p + ' '))
    if (hit) issues.push({ code, where, match: hit })
  }
  const em = text.match(EMAIL)?.[0]
  const ph = phone(text)
  const msg = text.match(MESSENGER)?.[0] ?? text.match(HANDLE)?.[0]?.trim()
  if (em || ph || msg) issues.push({ code: 'contact', where, match: em ?? ph ?? msg })
  const url = text.match(URL)?.[0]
  if (url) issues.push({ code: 'link', where, match: url })
  return issues
}

// ---------- bütöv quiz ----------
interface QLike { type?: string; text?: string; explanation?: string; imageUrl?: string; options?: { text?: string; imageUrl?: string }[]; accepted?: string[]; correct?: string[] }
export interface QuizLike { title?: string; description?: string; tags?: string[]; questions?: QLike[] }
const SCORED = new Set(['single', 'multi', 'truefalse', 'type', 'order', 'slider'])

export function moderateQuiz(q: QuizLike): ModResult {
  const issues: ModIssue[] = []
  const add = (s: unknown, where: string) => { if (typeof s === 'string') issues.push(...checkText(s, where)) }
  add(q.title, 'title'); add(q.description, 'description')
  ;(q.tags ?? []).forEach((t) => add(t, 'tags'))
  let hasImages = false, scored = 0
  ;(q.questions ?? []).forEach((x, i) => {
    const w = `q${i + 1}`
    add(x.text, w); add(x.explanation, `${w}.explanation`)
    ;(x.accepted ?? []).forEach((a) => add(a, `${w}.answer`))
    ;(x.options ?? []).forEach((o, k) => { add(o.text, `${w}.option${k + 1}`); if (o.imageUrl) hasImages = true })
    if (x.imageUrl) hasImages = true
    if (SCORED.has(x.type ?? '')) {
      scored++
      if (!String(x.text ?? '').trim()) issues.push({ code: 'quality', where: w, match: 'empty-question' })
      if ((x.type === 'single' || x.type === 'multi') && ((x.options ?? []).filter((o) => String(o.text ?? '').trim() || o.imageUrl).length < 2 || !(x.correct ?? []).length))
        issues.push({ code: 'quality', where: w, match: 'options' })
    }
  })
  const title = String(q.title ?? '').trim()
  if (title.length < 5 || title.length > 120) issues.push({ code: 'quality', where: 'title', match: 'title-length' })
  if (scored < 3) issues.push({ code: 'quality', where: 'questions', match: 'min-questions' })
  // eyni problem bir yerdə bir dəfə
  const seen = new Set<string>()
  const uniq = issues.filter((x) => { const k = `${x.code}|${x.where}`; if (seen.has(k)) return false; seen.add(k); return true })
  return { ok: uniq.length === 0, issues: uniq, hasImages }
}
