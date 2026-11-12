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
}

const FOOT: Record<Lang, { why: string; site: string }> = {
  az: { why: 'Bu məktub Jabr hesabınızla bağlı göndərilib.', site: 'Canlı quiz platforması' },
  ru: { why: 'Это письмо отправлено в связи с вашим аккаунтом Jabr.', site: 'Платформа живых квизов' },
  en: { why: 'You received this email because of your Jabr account.', site: 'Live quiz platform' },
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
      <tr><td class="card" bgcolor="${C.panel}" style="background:${C.panel};border:1px solid ${C.line};border-radius:20px;padding:36px 34px;">
        <div style="height:4px;width:56px;border-radius:4px;background:${C.brand};background-image:${C.gradient};margin:0 0 22px;"></div>
        <h1 class="h1" style="margin:0 0 16px;font:800 27px/1.25 ${DISPLAY};letter-spacing:-.5px;color:${C.fg};">${esc(p.title)}</h1>
        ${paras}${facts}${button}${note}
      </td></tr>
      <!-- alt hissə -->
      <tr><td style="padding:24px 6px 0;font:400 12px/1.7 ${FONT};color:${C.muted};">
        ${esc(p.footer)}<br>${esc(f.why)}<br>
        <a href="${esc(site)}" target="_blank" style="color:${C.fg2};text-decoration:none;font-weight:600;">${esc(host)}</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
  const text = [p.title, '', ...p.intro.flatMap((x) => [x, '']), ...(p.facts ?? []).map((x) => `${x.label}: ${x.value}`), ...(p.facts?.length ? [''] : []),
    ...(p.cta ? [`${p.cta.label}: ${p.cta.url}`, ''] : []), ...(p.note ? [p.note, ''] : []), '—', p.footer, f.why, site].join('\n')
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
