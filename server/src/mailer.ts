/**
 * E-poçt göndərmə. SMTP/Brevo açarı təyin olunanda (SMTP_URL) real göndərir; yoxdursa jurnala yazır.
 * Açarlar yalnız serverdəki deploy/.env faylında saxlanılır.
 */
export async function sendMail(to: string, subject: string, text: string) {
  const url = process.env.BREVO_API_KEY
  if (!url) {
    console.log(`[mail:dry-run] to=${to} subject=${subject}\n${text}`)
    return { sent: false }
  }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': url, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Jabr', email: process.env.MAIL_FROM ?? 'noreply@jabr.az' },
      to: [{ email: to }], subject, textContent: text,
    }),
  })
  if (!res.ok) console.error('[mail] failed', res.status, await res.text().catch(() => ''))
  return { sent: res.ok }
}
