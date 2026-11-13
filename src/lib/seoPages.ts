/**
 * İctimai səhifələrin SEO məlumatı — həm brauzer (useSeo), həm build (hər səhifə üçün statik HTML, vite.config.ts) istifadə edir.
 * Sırf məlumatdır: heç bir brauzer/React asılılığı olmamalıdır.
 */
export const SITE = 'https://jabr.az'
export type Lang = 'az' | 'ru' | 'en'
export type Meta = { title: string; desc: string }

export const PAGES: Record<string, Record<Lang, Meta>> = {
  '/': {
    az: { title: 'Jabr — canlı quiz platforması | Dərs, təlim və tədbirlər üçün', desc: 'Jabr — Azərbaycanın canlı quiz platforması. İnteraktiv viktorinalar yaradın, AI ilə suallar hazırlayın, iştirakçılar telefonla PIN və ya QR ilə qoşulsun.' },
    ru: { title: 'Jabr — платформа живых квизов | Для уроков, тренингов и мероприятий', desc: 'Jabr — платформа живых квизов. Создавайте интерактивные викторины, генерируйте вопросы с AI, участники подключаются по PIN или QR.' },
    en: { title: 'Jabr — live quiz platform | For classes, trainings and events', desc: 'Jabr is a live quiz platform. Create interactive quizzes, generate questions with AI, and let players join by PIN or QR code.' },
  },
  '/pricing': {
    az: { title: 'Qiymətlər — Jabr', desc: 'Jabr planları: pulsuz başlayın, Trainer, Pro və Business planları ilə daha çox iştirakçı, AI və analitika. Tələbələr üçün həmişə pulsuz.' },
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
  '/privacy': { az: { title: 'Məxfilik siyasəti — Jabr', desc: 'Jabr məxfilik siyasəti: hansı məlumatları topladığımız, necə saxladığımız və hüquqlarınız.' }, ru: { title: 'Политика конфиденциальности — Jabr', desc: 'Политика конфиденциальности Jabr.' }, en: { title: 'Privacy policy — Jabr', desc: 'Jabr privacy policy.' } },
  '/terms': { az: { title: 'İstifadə şərtləri — Jabr', desc: 'Jabr platformasının istifadə şərtləri.' }, ru: { title: 'Условия использования — Jabr', desc: 'Условия использования Jabr.' }, en: { title: 'Terms of use — Jabr', desc: 'Jabr terms of use.' } },
}

/** Serverdən gələn HTML-də (JS işə düşməzdən əvvəl) görünən mətn — hər ictimai səhifə üçün ayrıca. */
export const STATIC_BODY: Record<string, { h1: string; html: string }> = {
  '/': {
    h1: 'Jabr — canlı quiz platforması',
    html: `<p>Dərs, təlim və tədbirlər üçün interaktiv quizlər yaradın. Süni intellekt mövzudan, PDF və ya təqdimatdan sualları saniyələr içində hazırlayır; iştirakçılar telefonla PIN və ya QR kodla qoşulur, nəticələr real vaxtda ekranda görünür.</p>
<h2>İmkanlar</h2>
<ul><li>Canlı quiz oyunları — liderlər cədvəli, podium, səs effektləri</li><li>AI ilə sual yaratma (mövzu, mətn, PDF, PPTX, DOCX)</li><li>Siniflər, kurslar, tapşırıqlar və irəliləyiş</li><li>Analitika, Excel ixracı və sertifikatlar</li><li>Azərbaycan, rus və ingilis dillərində</li></ul>`,
  },
  '/pricing': {
    h1: 'Jabr qiymətləri',
    html: `<p>Pulsuz başlayın. Təlimçilər üçün Trainer, Pro və Business planları daha çox iştirakçı, AI ilə sual yaratma, analitika və komanda imkanları verir. Qiymət iştirakçı sayına görədir — iştirakçılar heç vaxt ödəmir.</p>
<p>Tələbələr üçün Jabr həmişə pulsuzdur. Təşkilatlar üçün fərdi təklif almaq mümkündür.</p>`,
  },
  '/join': {
    h1: 'Canlı quizə qoşul',
    html: '<p>Təlimçinin ekranındakı 6 rəqəmli PIN kodu daxil edin və ya QR kodu telefonla skan edin. Qeydiyyat tələb olunmur — adınızı yazın, avatar seçin və oyuna qoşulun.</p>',
  },
  '/start': {
    h1: 'Jabr-da pulsuz qeydiyyat',
    html: '<p>Google hesabı ilə bir kliklə qeydiyyatdan keçin. Təlimçilər 3 gün Pro planı pulsuz sınaya bilər, tələbələr isə quiz kataloqunda limitsiz məşq edir.</p>',
  },
  '/privacy': { h1: 'Məxfilik siyasəti', html: '<p>Jabr hansı şəxsi məlumatları toplayır, onları necə istifadə edir və saxlayır, və sizin hüquqlarınız.</p>' },
  '/terms': { h1: 'İstifadə şərtləri', html: '<p>Jabr platformasından istifadə qaydaları və şərtləri.</p>' },
}
