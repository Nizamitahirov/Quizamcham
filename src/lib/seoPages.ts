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

export const LANGS: Lang[] = ['az', 'ru', 'en']
/** Dil + yol → tam ünvan: az prefikssiz, ru/en — /ru/..., /en/... */
export const pageUrl = (lang: Lang, route: string) => SITE + (lang === 'az' ? '' : `/${lang}`) + (route === '/' ? (lang === 'az' ? '/' : '') : route)

type Body = { h1: string; html: string }
/** Serverdən gələn HTML-də (JS işə düşməzdən əvvəl) görünən mətn — hər ictimai səhifə və dil üçün ayrıca. */
export const STATIC_BODY: Record<string, Record<Lang, Body>> = {
  '/': {
    az: {
      h1: 'Jabr — canlı quiz platforması',
      html: `<p>Dərs, təlim və tədbirlər üçün interaktiv quizlər yaradın. Süni intellekt mövzudan, PDF və ya təqdimatdan sualları saniyələr içində hazırlayır; iştirakçılar telefonla PIN və ya QR kodla qoşulur, nəticələr real vaxtda ekranda görünür.</p>
<h2>İmkanlar</h2>
<ul><li>Canlı quiz oyunları — liderlər cədvəli, podium, səs effektləri</li><li>AI ilə sual yaratma (mövzu, mətn, PDF, PPTX, DOCX)</li><li>Siniflər, kurslar, tapşırıqlar və irəliləyiş</li><li>Analitika, Excel ixracı və sertifikatlar</li><li>Azərbaycan, rus və ingilis dillərində</li></ul>`,
    },
    ru: {
      h1: 'Jabr — платформа живых квизов',
      html: `<p>Создавайте интерактивные квизы для уроков, тренингов и мероприятий. Искусственный интеллект за секунды готовит вопросы по теме, PDF или презентации; участники подключаются с телефона по PIN или QR-коду, а результаты появляются на экране в реальном времени.</p>
<h2>Возможности</h2>
<ul><li>Живые квиз-игры — таблица лидеров, подиум, звуковые эффекты</li><li>Генерация вопросов с AI (тема, текст, PDF, PPTX, DOCX)</li><li>Классы, курсы, задания и прогресс учеников</li><li>Аналитика, экспорт в Excel и сертификаты</li><li>На азербайджанском, русском и английском языках</li></ul>`,
    },
    en: {
      h1: 'Jabr — live quiz platform',
      html: `<p>Create interactive quizzes for classes, trainings and events. AI drafts questions from a topic, a PDF or a slide deck in seconds; players join from their phones with a PIN or QR code, and results appear on screen in real time.</p>
<h2>Features</h2>
<ul><li>Live quiz games — leaderboard, podium, sound effects</li><li>AI question generation (topic, text, PDF, PPTX, DOCX)</li><li>Classes, courses, assignments and progress tracking</li><li>Analytics, Excel export and certificates</li><li>Available in Azerbaijani, Russian and English</li></ul>`,
    },
  },
  '/pricing': {
    az: { h1: 'Jabr qiymətləri', html: '<p>Pulsuz başlayın. Təlimçilər üçün Trainer, Pro və Business planları daha çox iştirakçı, AI ilə sual yaratma, analitika və komanda imkanları verir. Qiymət iştirakçı sayına görədir — iştirakçılar heç vaxt ödəmir.</p>\n<p>Tələbələr üçün Jabr həmişə pulsuzdur. Təşkilatlar üçün fərdi təklif almaq mümkündür.</p>' },
    ru: { h1: 'Цены Jabr', html: '<p>Начните бесплатно. Планы Trainer, Pro и Business для тренеров дают больше участников, генерацию вопросов с AI, аналитику и командную работу. Цена зависит от числа участников — участники никогда не платят.</p>\n<p>Для студентов Jabr всегда бесплатен. Для организаций доступно индивидуальное предложение.</p>' },
    en: { h1: 'Jabr pricing', html: '<p>Start free. The Trainer, Pro and Business plans give trainers more players, AI question generation, analytics and team features. Pricing depends on the number of players — players never pay.</p>\n<p>Jabr is always free for students. Custom offers are available for organisations.</p>' },
  },
  '/join': {
    az: { h1: 'Canlı quizə qoşul', html: '<p>Təlimçinin ekranındakı 6 rəqəmli PIN kodu daxil edin və ya QR kodu telefonla skan edin. Qeydiyyat tələb olunmur — adınızı yazın, avatar seçin və oyuna qoşulun.</p>' },
    ru: { h1: 'Присоединиться к живому квизу', html: '<p>Введите 6-значный PIN с экрана тренера или отсканируйте QR-код телефоном. Регистрация не нужна — введите имя, выберите аватар и играйте.</p>' },
    en: { h1: 'Join a live quiz', html: '<p>Enter the 6-digit PIN shown on the host screen or scan the QR code with your phone. No sign-up needed — type your name, pick an avatar and play.</p>' },
  },
  '/start': {
    az: { h1: 'Jabr-da pulsuz qeydiyyat', html: '<p>Google hesabı ilə bir kliklə qeydiyyatdan keçin. Təlimçilər 3 gün Pro planı pulsuz sınaya bilər, tələbələr isə quiz kataloqunda limitsiz məşq edir.</p>' },
    ru: { h1: 'Бесплатная регистрация в Jabr', html: '<p>Зарегистрируйтесь в один клик через Google. Тренеры получают 3 дня Pro бесплатно, студенты — безлимитную практику в каталоге квизов.</p>' },
    en: { h1: 'Sign up to Jabr for free', html: '<p>Sign up with your Google account in one click. Trainers get a free 3-day Pro trial, and students get unlimited practice in the quiz catalogue.</p>' },
  },
  '/privacy': {
    az: { h1: 'Məxfilik siyasəti', html: '<p>Jabr hansı şəxsi məlumatları toplayır, onları necə istifadə edir və saxlayır, və sizin hüquqlarınız.</p>' },
    ru: { h1: 'Политика конфиденциальности', html: '<p>Какие персональные данные собирает Jabr, как они используются и хранятся, и ваши права.</p>' },
    en: { h1: 'Privacy policy', html: '<p>What personal data Jabr collects, how it is used and stored, and your rights.</p>' },
  },
  '/terms': {
    az: { h1: 'İstifadə şərtləri', html: '<p>Jabr platformasından istifadə qaydaları və şərtləri.</p>' },
    ru: { h1: 'Условия использования', html: '<p>Правила и условия использования платформы Jabr.</p>' },
    en: { h1: 'Terms of use', html: '<p>Rules and conditions for using the Jabr platform.</p>' },
  },
}
