/**
 * Brendli e-poçt şablonları (saytın "Jabr Night" üslubu): tünd fon, panel kart, "Jabr." loqosu, qradiyent düymə.
 * E-poçt müştəriləri üçün: cədvəl əsaslı düzülüş, yalnız inline stil, şəkil yoxdur (loqo mətndir) — Gmail, Outlook, Apple Mail.
 * Hər məktubun həm HTML, həm də sadə mətn variantı var.
 */
export type Lang = 'az' | 'ru' | 'en'
export const pickLang = (v: unknown): Lang => (v === 'ru' || v === 'en' ? v : 'az')

const C = {
  canvas: '#090A13', panel: '#10122A', raised: '#171A33', line: '#23263F', fg: '#F3F4FB', fg2: '#C3C6DC', muted: '#8C90AE',
  brand: '#F0262F', brand2: '#FF7A1A', gradient: 'linear-gradient(135deg,#EE1D2C 0%,#FF4D1F 52%,#FF8A1A 100%)',
}
const FONT = "'Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const DISPLAY = "'Montserrat','Inter','Segoe UI',Helvetica,Arial,sans-serif"
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export interface EmailParts {
  lang: Lang
  preheader: string           // gələnlər siyahısında mövzunun yanında görünən qısa mətn
  title: string
  intro: string[]             // abzaslar
  cta?: { label: string; url: string }
  facts?: { label: string; value: string }[]  // kiçik məlumat cədvəli (məs. kod, tarix)
  note?: string               // düymənin altındakı kiçik qeyd
  footer: string
  hero?: string               // (marketinq) başlıqdan əvvəl geniş şəkil — https ünvanı
  features?: { emoji: string; title: string; text: string }[]  // təqdimat kartları
  unsubscribe?: string        // (marketinq) abunəlikdən çıxma keçidi
}

const FOOT: Record<Lang, { why: string; site: string }> = {
  az: { why: 'Bu məktub Jabr hesabınızla bağlı göndərilib.', site: 'Canlı quiz platforması' },
  ru: { why: 'Это письмо отправлено в связи с вашим аккаунтом Jabr.', site: 'Платформа живых квизов' },
  en: { why: 'You received this email because of your Jabr account.', site: 'Live quiz platform' },
}

const UNSUB: Record<Lang, { why: string; link: string }> = {
  az: { why: 'Bu məktubu marketinq bildirişlərinə razılıq verdiyiniz üçün alırsınız.', link: 'Abunəlikdən çıxın' },
  ru: { why: 'Вы получили это письмо, так как дали согласие на рассылку.', link: 'Отписаться' },
  en: { why: 'You received this because you opted in to marketing emails.', link: 'Unsubscribe' },
}

export function renderEmail(p: EmailParts, baseUrl: string): { html: string; text: string } {
  const site = baseUrl.replace(/\/$/, '') || 'https://jabr.az'
  const host = site.replace(/^https?:\/\//, '')
  const paras = p.intro.map((x) => `<p style="margin:0 0 14px;font:400 15px/1.6 ${FONT};color:${C.fg2};">${esc(x)}</p>`).join('')
  const button = p.cta ? `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 8px;">
      <tr><td align="center" bgcolor="${C.brand}" style="border-radius:12px;background:${C.brand};background-image:${C.gradient};box-shadow:0 10px 30px -10px rgba(240,38,47,.65);">
        <a href="${esc(p.cta.url)}" target="_blank" style="display:inline-block;padding:15px 30px;font:700 15px/1 ${FONT};color:#FFFFFF;text-decoration:none;border-radius:12px;">${esc(p.cta.label)} &rarr;</a>
      </td></tr>
    </table>
    <p style="margin:14px 0 0;font:400 12px/1.6 ${FONT};color:${C.muted};word-break:break-all;">${esc(p.cta.url)}</p>` : ''
  const facts = p.facts?.length ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 4px;border:1px solid ${C.line};border-radius:12px;background:${C.raised};">
      ${p.facts.map((f, i) => `<tr><td style="padding:12px 16px;${i ? `border-top:1px solid ${C.line};` : ''}font:500 13px/1.4 ${FONT};color:${C.muted};">${esc(f.label)}</td>
        <td align="right" style="padding:12px 16px;${i ? `border-top:1px solid ${C.line};` : ''}font:700 14px/1.4 ${FONT};color:${C.fg};">${esc(f.value)}</td></tr>`).join('')}
    </table>` : ''
  const hero = p.hero && /^https:\/\//.test(p.hero) ? `<tr><td style="padding:0 0 0;"><img src="${esc(p.hero)}" width="560" alt="" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:20px 20px 0 0;"></td></tr>` : ''
  const feats = p.features?.length ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 4px;">
      ${p.features.map((x) => `<tr><td style="padding:0 0 10px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.line};border-radius:14px;background:${C.raised};">
          <tr><td width="44" valign="top" style="padding:16px 0 16px 16px;"><div style="width:40px;height:40px;border-radius:12px;background:rgba(255,122,26,.12);border:1px solid rgba(255,122,26,.25);text-align:center;font:400 20px/40px ${FONT};">${esc(x.emoji)}</div></td>
          <td valign="top" style="padding:16px 16px 16px 14px;"><div style="font:700 15px/1.35 ${FONT};color:${C.fg};">${esc(x.title)}</div><div style="margin-top:4px;font:400 13.5px/1.55 ${FONT};color:${C.fg2};">${esc(x.text)}</div></td></tr>
        </table></td></tr>`).join('')}
    </table>` : ''
  const note = p.note ? `<p style="margin:22px 0 0;padding:14px 16px;border-radius:12px;background:${C.raised};border:1px solid ${C.line};font:400 13px/1.6 ${FONT};color:${C.muted};">${esc(p.note)}</p>` : ''
  const f = FOOT[p.lang]
  const html = `<!doctype html>
<html lang="${p.lang}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light">
<title>${esc(p.title)}</title>
<style>
  @media (max-width:600px){ .wrap{padding:16px 10px !important} .card{padding:28px 22px !important} .h1{font-size:24px !important} }
  a{color:${C.brand2}}
</style>
</head>
<body style="margin:0;padding:0;background:${C.canvas};" bgcolor="${C.canvas}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(p.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.canvas}" style="background:${C.canvas};background-image:radial-gradient(60rem 30rem at 100% -10%,rgba(255,122,26,.18),transparent 60%),radial-gradient(50rem 30rem at -10% 110%,rgba(240,38,47,.16),transparent 60%);">
  <tr><td align="center" class="wrap" style="padding:36px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
      <!-- loqo -->
      <tr><td style="padding:0 6px 22px;">
        <a href="${esc(site)}" target="_blank" style="text-decoration:none;font:800 30px/1 ${DISPLAY};letter-spacing:-1px;color:#FFFFFF;">Jabr<span style="color:${C.brand2};">.</span></a>
        <div style="margin-top:6px;font:600 10px/1 ${FONT};letter-spacing:2.5px;text-transform:uppercase;color:${C.muted};">${esc(f.site)}</div>
      </td></tr>
      <!-- kart -->
      ${hero ? `<tr><td style="border:1px solid ${C.line};border-bottom:0;border-radius:20px 20px 0 0;background:${C.panel};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${hero}</table></td></tr>` : ''}
      <tr><td class="card" bgcolor="${C.panel}" style="background:${C.panel};border:1px solid ${C.line};${hero ? 'border-top:0;border-radius:0 0 20px 20px;' : 'border-radius:20px;'}padding:36px 34px;">
        <div style="height:4px;width:56px;border-radius:4px;background:${C.brand};background-image:${C.gradient};margin:0 0 22px;"></div>
        <h1 class="h1" style="margin:0 0 16px;font:800 27px/1.25 ${DISPLAY};letter-spacing:-.5px;color:${C.fg};">${esc(p.title)}</h1>
        ${paras}${feats}${facts}${button}${note}
      </td></tr>
      <!-- alt hissə -->
      <tr><td style="padding:24px 6px 0;font:400 12px/1.7 ${FONT};color:${C.muted};">
        ${esc(p.footer)}<br>${esc(f.why)}<br>
        <a href="${esc(site)}" target="_blank" style="color:${C.fg2};text-decoration:none;font-weight:600;">${esc(host)}</a>
        ${p.unsubscribe ? `<br><br>${esc(UNSUB[p.lang].why)} <a href="${esc(p.unsubscribe)}" target="_blank" style="color:${C.fg2};text-decoration:underline;">${esc(UNSUB[p.lang].link)}</a>` : ''}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
  const text = [p.title, '', ...p.intro.flatMap((x) => [x, '']), ...(p.features ?? []).flatMap((x) => [`${x.emoji} ${x.title} — ${x.text}`]), ...(p.features?.length ? [''] : []), ...(p.facts ?? []).map((x) => `${x.label}: ${x.value}`), ...(p.facts?.length ? [''] : []),
    ...(p.cta ? [`${p.cta.label}: ${p.cta.url}`, ''] : []), ...(p.note ? [p.note, ''] : []), '—', p.footer, f.why, site, ...(p.unsubscribe ? ['', `${UNSUB[p.lang].link}: ${p.unsubscribe}`] : [])].join('\n')
  return { html, text }
}

// ---------- konkret məktublar ----------
const SIGN: Record<Lang, string> = { az: 'Hörmətlə, Jabr komandası', ru: 'С уважением, команда Jabr', en: 'Best regards, the Jabr team' }

export function resetEmail(lang: Lang, url: string, base: string) {
  const T = {
    az: { subject: 'Jabr — şifrəni sıfırlayın', pre: 'Yeni şifrə təyin etmək üçün keçid 1 saat etibarlıdır', title: 'Şifrəni sıfırlayın', intro: ['Salam!', 'Jabr hesabınız üçün şifrə sıfırlama tələbi aldıq. Yeni şifrə təyin etmək üçün aşağıdakı düyməni basın.'], cta: 'Yeni şifrə təyin et', note: 'Keçid 1 saat ərzində və yalnız bir dəfə işləyir. Bu tələbi siz göndərməmisinizsə, məktubu nəzərə almayın — şifrəniz dəyişməyəcək.' },
    ru: { subject: 'Jabr — сброс пароля', pre: 'Ссылка для нового пароля действует 1 час', title: 'Сброс пароля', intro: ['Здравствуйте!', 'Мы получили запрос на сброс пароля для вашего аккаунта Jabr. Нажмите кнопку ниже, чтобы задать новый пароль.'], cta: 'Задать новый пароль', note: 'Ссылка действует 1 час и только один раз. Если вы не запрашивали сброс, просто проигнорируйте письмо — пароль не изменится.' },
    en: { subject: 'Jabr — reset your password', pre: 'Your link to set a new password is valid for 1 hour', title: 'Reset your password', intro: ['Hi there!', 'We received a request to reset the password for your Jabr account. Click the button below to choose a new one.'], cta: 'Set a new password', note: 'The link works once and expires in 1 hour. If you did not request this, you can ignore this email — your password will not change.' },
  }[lang]
  return { subject: T.subject, ...renderEmail({ lang, preheader: T.pre, title: T.title, intro: T.intro, cta: { label: T.cta, url }, note: T.note, footer: SIGN[lang] }, base) }
}

export function testEmail(lang: Lang, base: string) {
  const now = new Date().toLocaleString(lang === 'az' ? 'az-AZ' : lang === 'ru' ? 'ru-RU' : 'en-GB', { timeZone: 'Asia/Baku' })
  const T = {
    az: { subject: 'Jabr — test məktubu', pre: 'E-poçt göndərmə düzgün işləyir', title: 'E-poçt işləyir ✓', intro: ['Bu, Jabr serverindən göndərilmiş test məktubudur.', 'Onu görürsünüzsə, məktublar jabr.az domeni ilə düzgün imzalanır və çatdırılır.'], cta: 'Jabr-ı aç', facts: [{ label: 'Göndərən', value: 'noreply@jabr.az' }, { label: 'Vaxt (Bakı)', value: now }] },
    ru: { subject: 'Jabr — тестовое письмо', pre: 'Отправка почты работает', title: 'Почта работает ✓', intro: ['Это тестовое письмо с сервера Jabr.', 'Если вы его видите, письма с домена jabr.az подписываются и доставляются корректно.'], cta: 'Открыть Jabr', facts: [{ label: 'Отправитель', value: 'noreply@jabr.az' }, { label: 'Время (Баку)', value: now }] },
    en: { subject: 'Jabr — test email', pre: 'Email delivery is working', title: 'Email works ✓', intro: ['This is a test email from the Jabr server.', 'If you can see it, emails from the jabr.az domain are signed and delivered correctly.'], cta: 'Open Jabr', facts: [{ label: 'Sender', value: 'noreply@jabr.az' }, { label: 'Time (Baku)', value: now }] },
  }[lang]
  return { subject: T.subject, ...renderEmail({ lang, preheader: T.pre, title: T.title, intro: T.intro, cta: { label: T.cta, url: base || 'https://jabr.az' }, facts: T.facts, footer: SIGN[lang] }, base) }
}

// ---------- Xoş gəldin (qeydiyyatdan dərhal sonra) ----------
export function welcomeEmail(lang: Lang, o: { name: string; student: boolean; trialEnds?: Date | null }, base: string) {
  const site = base || 'https://jabr.az'
  const date = o.trialEnds ? o.trialEnds.toLocaleDateString(lang === 'az' ? 'az-AZ' : lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Baku' }) : ''
  const hi = { az: o.name ? `Xoş gəldiniz, ${o.name}!` : 'Xoş gəldiniz!', ru: o.name ? `Добро пожаловать, ${o.name}!` : 'Добро пожаловать!', en: o.name ? `Welcome, ${o.name}!` : 'Welcome!' }[lang]
  if (o.student) {
    const T = {
      az: { subject: 'Jabr-a xoş gəldiniz 🎉', pre: 'Quizlər, XP və 3D avatarınız sizi gözləyir', intro: ['Qeydiyyatınız tamamlandı — artıq Jabr ailəsinin üzvüsünüz.', 'Canlı oyunlara PIN ilə qoşulun, kataloqdakı quizlərlə istədiyiniz qədər pulsuz məşq edin və irəliləyişinizi izləyin.'],
        f: [['🎯', 'Limitsiz məşq', 'Kataloqdakı yüzlərlə quizi istədiyiniz vaxt, pulsuz həll edin.'], ['🔥', 'XP, nişanlar və seriya', 'Hər gün öyrənin, səviyyə qaldırın və nişanlar qazanın.'], ['🧑‍🚀', '3D avatar', 'Öz unikal 3D obrazınızı yaradın — oyunlarda o görünəcək.']], cta: 'Öyrənməyə başla' },
      ru: { subject: 'Добро пожаловать в Jabr 🎉', pre: 'Квизы, XP и ваш 3D-аватар уже ждут', intro: ['Регистрация завершена — теперь вы в команде Jabr.', 'Подключайтесь к живым играм по PIN, бесплатно тренируйтесь на квизах из каталога и следите за прогрессом.'],
        f: [['🎯', 'Безлимитная практика', 'Сотни квизов из каталога — бесплатно и в любое время.'], ['🔥', 'XP, значки и серии', 'Учитесь каждый день, повышайте уровень и собирайте значки.'], ['🧑‍🚀', '3D-аватар', 'Создайте свой уникальный 3D-образ — он появится в играх.']], cta: 'Начать обучение' },
      en: { subject: 'Welcome to Jabr 🎉', pre: 'Quizzes, XP and your 3D avatar are waiting', intro: ['Your registration is complete — you are now part of Jabr.', 'Join live games with a PIN, practise for free with quizzes from the catalogue and track your progress.'],
        f: [['🎯', 'Unlimited practice', 'Hundreds of catalogue quizzes, free, whenever you like.'], ['🔥', 'XP, badges and streaks', 'Learn every day, level up and collect badges.'], ['🧑‍🚀', '3D avatar', 'Design your own unique 3D look — it shows up in games.']], cta: 'Start learning' },
    }[lang]
    return { subject: T.subject, ...renderEmail({ lang, preheader: T.pre, title: hi, intro: T.intro, features: T.f.map(([emoji, title, text]) => ({ emoji, title, text })), cta: { label: T.cta, url: `${site}/learn` }, footer: SIGN[lang] }, base) }
  }
  const T = {
    az: { subject: 'Jabr-a xoş gəldiniz — Pro sınağınız aktivdir 🚀', pre: 'İlk canlı quizinizi bir neçə dəqiqəyə qurun', intro: ['Qeydiyyatınız tamamlandı. Hesabınızda bütün Pro imkanları sınaq müddətində açıqdır.', 'Auditoriyanızı canlı quizlərlə həvəsləndirin — tədris, təlim və tədbirlər üçün.'],
      f: [['⚡', 'AI ilə quiz', 'Mövzu yazın və ya PDF/PPTX yükləyin — suallar saniyələr içində hazırdır.'], ['📡', 'Canlı oyun və daimi QR', 'İştirakçılar PIN və ya QR ilə qoşulur, nəticələr real vaxtda görünür.'], ['📊', 'Analitika və hesabatlar', 'Kim nəyi bilmir — sual-sual görün, Excel-ə ixrac edin.']],
      cta: 'İlk quizimi yaradım', facts: [{ label: 'Plan', value: 'Pro · sınaq' }, ...(date ? [{ label: 'Sınaq bitir', value: date }] : [])], note: 'Sualınız var? Sadəcə bu məktuba cavab yazın — komandamız kömək edəcək.' },
    ru: { subject: 'Добро пожаловать в Jabr — пробный Pro активен 🚀', pre: 'Создайте первый живой квиз за пару минут', intro: ['Регистрация завершена. На время пробного периода вам доступны все возможности Pro.', 'Вовлекайте аудиторию живыми квизами — на уроках, тренингах и мероприятиях.'],
      f: [['⚡', 'Квиз с помощью AI', 'Укажите тему или загрузите PDF/PPTX — вопросы готовы за секунды.'], ['📡', 'Живая игра и постоянный QR', 'Участники входят по PIN или QR, результаты — в реальном времени.'], ['📊', 'Аналитика и отчёты', 'Видно, что не усвоено, по каждому вопросу; экспорт в Excel.']],
      cta: 'Создать первый квиз', facts: [{ label: 'План', value: 'Pro · пробный' }, ...(date ? [{ label: 'Пробный до', value: date }] : [])], note: 'Есть вопросы? Просто ответьте на это письмо — мы поможем.' },
    en: { subject: 'Welcome to Jabr — your Pro trial is on 🚀', pre: 'Set up your first live quiz in minutes', intro: ['Your registration is complete. Every Pro feature is unlocked during your trial.', 'Engage your audience with live quizzes — for classes, trainings and events.'],
      f: [['⚡', 'AI quiz builder', 'Type a topic or upload a PDF/PPTX — questions are ready in seconds.'], ['📡', 'Live games and a permanent QR', 'Players join by PIN or QR and results update in real time.'], ['📊', 'Analytics and reports', 'See what was missed question by question and export to Excel.']],
      cta: 'Create my first quiz', facts: [{ label: 'Plan', value: 'Pro · trial' }, ...(date ? [{ label: 'Trial ends', value: date }] : [])], note: 'Questions? Just reply to this email — our team is happy to help.' },
  }[lang]
  return { subject: T.subject, ...renderEmail({ lang, preheader: T.pre, title: hi, intro: T.intro, features: T.f.map(([emoji, title, text]) => ({ emoji, title, text })), facts: T.facts, cta: { label: T.cta, url: `${site}/admin/quizzes` }, note: T.note, footer: SIGN[lang] }, base) }
}

// ---------- Marketinq kampaniyası ----------
export interface CampaignContent { subject: string; preheader?: string; title: string; body: string; hero?: string; features?: { emoji: string; title: string; text: string }[]; ctaLabel?: string; ctaUrl?: string; lang: Lang }
/** {ad} → alıcının adı. Mətn abzaslara boş sətirlə bölünür. */
export function campaignEmail(c: CampaignContent, o: { name: string; unsubscribe?: string }, base: string) {
  const fill = (s: string) => s.replace(/\{(ad|name|имя)\}/gi, o.name || '').replace(/\s+([,!.?])/g, '$1').trim()
  const intro = c.body.split(/\n\s*\n/).map((x) => fill(x.replace(/\s*\n\s*/g, ' '))).filter(Boolean)
  const cta = c.ctaLabel && c.ctaUrl && /^https?:\/\//.test(c.ctaUrl) ? { label: c.ctaLabel, url: c.ctaUrl } : undefined
  const features = (c.features ?? []).filter((f) => f.title.trim()).map((f) => ({ emoji: f.emoji || '✨', title: fill(f.title), text: fill(f.text) }))
  return { subject: fill(c.subject), ...renderEmail({ lang: c.lang, preheader: fill(c.preheader || ''), title: fill(c.title), intro, features, hero: c.hero, cta, unsubscribe: o.unsubscribe, footer: SIGN[c.lang] }, base) }
}
