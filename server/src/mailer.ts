/**
 * E-poçt göndərmə. SMTP/Brevo açarı təyin olunanda (SMTP_URL) real göndərir; yoxdursa jurnala yazır.
 * Açarlar yalnız serverdəki deploy/.env faylında saxlanılır.
 */
export interface MailExtra { headers?: Record<string, string>; replyTo?: string; tags?: string[] }
export async function sendMail(to: string, subject: string, text: string, html?: string, extra: MailExtra = {}) {
  const url = process.env.BREVO_API_KEY
  if (!url) {
    console.log(`[mail:dry-run] to=${to} subject=${subject}\n${text}`)
    return { sent: false, status: 0, error: 'BREVO_API_KEY is not configured' }
  }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': url, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Jabr', email: process.env.MAIL_FROM ?? 'noreply@jabr.az' },
      to: [{ email: to }], subject, textContent: text, ...(html ? { htmlContent: html } : {}),
      replyTo: { email: extra.replyTo ?? process.env.MAIL_REPLY_TO ?? 'office@jabr.az', name: 'Jabr' },
      ...(extra.headers ? { headers: extra.headers } : {}), ...(extra.tags ? { tags: extra.tags } : {}),
    }),
  })
  const body = res.ok ? '' : (await res.text().catch(() => '')).slice(0, 300)
  if (!res.ok) console.error('[mail] failed', res.status, body)
  return { sent: res.ok, status: res.status, error: body || undefined }
}
