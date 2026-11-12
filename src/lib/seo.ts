/**
 * Səhifə meta məlumatı (SPA): başlıq, təsvir, canonical və indeksləmə — marşrut dəyişəndə yenilənir.
 * İctimai səhifələr indekslənir; şəxsi/oyun səhifələri "noindex".
 */
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { currentLang } from '../i18n/az'

const SITE = 'https://jabr.az'
type Meta = { title: string; desc: string }
const PAGES: Record<string, Record<'az' | 'ru' | 'en', Meta>> = {
  '/': {
    az: { title: 'Jabr — canlı quiz platforması | Dərs, təlim və tədbirlər üçün', desc: 'Jabr — Azərbaycanın canlı quiz platforması. İnteraktiv viktorinalar yaradın, AI ilə suallar hazırlayın, iştirakçılar telefonla PIN və ya QR ilə qoşulsun.' },
    ru: { title: 'Jabr — платформа живых квизов | Для уроков, тренингов и мероприятий', desc: 'Jabr — платформа живых квизов. Создавайте интерактивные викторины, генерируйте вопросы с AI, участники подключаются по PIN или QR.' },
    en: { title: 'Jabr — live quiz platform | For classes, trainings and events', desc: 'Jabr is a live quiz platform. Create interactive quizzes, generate questions with AI, and let players join by PIN or QR code.' },
  },
  '/pricing': {
    az: { title: 'Qiymətlər — Jabr', desc: 'Jabr planları: pulsuz başlayın, Trainer, Pro və Business planları ilə daha çox iştirakçı, AI və analitika.' },
    ru: { title: 'Цены — Jabr', desc: 'Планы Jabr: начните бесплатно; Trainer, Pro и Business — больше участников, AI и аналитика.' },
    en: { title: 'Pricing — Jabr', desc: 'Jabr plans: start free; Trainer, Pro and Business add more players, AI and analytics.' },
  },
  '/join': {
    az: { title: 'Oyuna qoşul — Jabr', desc: 'PIN kodu daxil edin və ya QR-ı skan edin — canlı quizə saniyələr içində qoşulun.' },
    ru: { title: 'Присоединиться к игре — Jabr', desc: 'Введите PIN или отсканируйте QR — подключитесь к живому квизу за секунды.' },
    en: { title: 'Join a game — Jabr', desc: 'Enter the PIN or scan the QR code to join a live quiz in seconds.' },
  },
  '/start': {
    az: { title: 'Pulsuz qeydiyyat — Jabr', desc: 'Google ilə bir kliklə qeydiyyatdan keçin: təlimçilər üçün 3 gün Pro sınaq, tələbələr üçün limitsiz məşq.' },
    ru: { title: 'Бесплатная регистрация — Jabr', desc: 'Регистрация в один клик через Google: 3 дня Pro для тренеров, безлимитная практика для студентов.' },
    en: { title: 'Sign up free — Jabr', desc: 'Sign up with Google in one click: a 3-day Pro trial for trainers, unlimited practice for students.' },
  },
  '/learn': {
    az: { title: 'Quiz kataloqu — Jabr', desc: 'Yüzlərlə ictimai quizlə pulsuz məşq edin, XP qazanın, nişan və sertifikat alın.' },
    ru: { title: 'Каталог квизов — Jabr', desc: 'Бесплатно тренируйтесь на сотнях квизов, получайте XP, значки и сертификаты.' },
    en: { title: 'Quiz catalogue — Jabr', desc: 'Practise for free with hundreds of public quizzes, earn XP, badges and certificates.' },
  },
  '/privacy': { az: { title: 'Məxfilik siyasəti — Jabr', desc: 'Jabr məxfilik siyasəti.' }, ru: { title: 'Политика конфиденциальности — Jabr', desc: 'Политика конфиденциальности Jabr.' }, en: { title: 'Privacy policy — Jabr', desc: 'Jabr privacy policy.' } },
  '/terms': { az: { title: 'İstifadə şərtləri — Jabr', desc: 'Jabr istifadə şərtləri.' }, ru: { title: 'Условия использования — Jabr', desc: 'Условия использования Jabr.' }, en: { title: 'Terms of use — Jabr', desc: 'Jabr terms of use.' } },
}
const PUBLIC = new Set([...Object.keys(PAGES), '/consent', '/marketing-consent'])

function setMeta(sel: string, attr: string, value: string, create: () => HTMLElement) {
  let el = document.head.querySelector(sel) as HTMLElement | null
  if (!el) { el = create(); document.head.appendChild(el) }
  el.setAttribute(attr, value)
}

/** App-də bir dəfə çağırılır. */
export function useSeo() {
  const { pathname } = useLocation()
  useEffect(() => {
    const path = pathname.replace(/\/+$/, '') || '/'
    const m = PAGES[path]?.[currentLang()] ?? PAGES[path]?.az
    const idx = PUBLIC.has(path)
    document.title = m?.title ?? (idx ? 'Jabr' : 'Jabr — canlı quiz platforması')
    if (m) {
      setMeta('meta[name="description"]', 'content', m.desc, () => Object.assign(document.createElement('meta'), { name: 'description' }))
      setMeta('meta[property="og:title"]', 'content', m.title, () => { const e = document.createElement('meta'); e.setAttribute('property', 'og:title'); return e })
      setMeta('meta[property="og:description"]', 'content', m.desc, () => { const e = document.createElement('meta'); e.setAttribute('property', 'og:description'); return e })
    }
    setMeta('link[rel="canonical"]', 'href', SITE + (path === '/' ? '/' : path), () => Object.assign(document.createElement('link'), { rel: 'canonical' }))
    setMeta('meta[property="og:url"]', 'content', SITE + (path === '/' ? '/' : path), () => { const e = document.createElement('meta'); e.setAttribute('property', 'og:url'); return e })
    // şəxsi səhifələr (panel, oyun, hesab) axtarışa düşməsin
    setMeta('meta[name="robots"]', 'content', idx ? 'index, follow, max-image-preview:large' : 'noindex, nofollow', () => Object.assign(document.createElement('meta'), { name: 'robots' }))
  }, [pathname])
}
