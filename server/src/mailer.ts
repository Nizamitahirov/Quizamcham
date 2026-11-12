/**
 * E-poçt göndərmə — iki provayder, super admin "Ayarlar"dan seçir:
 *   brevo — Brevo HTTP API (BREVO_API_KEY)
 *   smtp  — öz serverimiz: Contabo-dakı Postfix konteyneri (DKIM imzalı), daxili şəbəkədə SMTP_HOST:SMTP_PORT
 * Seçim mailConfig/main sənədində saxlanılır; "fallback" açıqdırsa, seçilən provayder uğursuz olanda digəri yoxlanılır.
 * Açarlar yalnız serverdəki deploy/.env faylında saxlanılır.
 */
import nodemailer, { type Transporter } from 'nodemailer'
import { loadDoc } from './store.js'

export type MailProvider = 'brevo' | 'smtp'
export interface MailConfig { provider: MailProvider; fallback: boolean }
export interface MailExtra { headers?: Record<string, string>; replyTo?: string; tags?: string[] }
export interface MailResult { sent: boolean; status: number; error?: string; provider?: MailProvider; fellBack?: boolean }

const FROM = () => process.env.MAIL_FROM ?? 'noreply@jabr.az'
const REPLY = () => process.env.MAIL_REPLY_TO ?? 'office@jabr.az'

// ---------- konfiqurasiya (30 san. keş; dəyişəndə dərhal sıfırlanır) ----------
let cfgCache: { at: number; v: MailConfig } | null = null
export async function mailConfig(): Promise<MailConfig> {
  if (cfgCache && Date.now() - cfgCache.at < 30_000) return cfgCache.v
  const d = await loadDoc('mailConfig/main').catch(() => null)
  const v: MailConfig = { provider: d?.provider === 'smtp' ? 'smtp' : 'brevo', fallback: d?.fallback !== false }
  cfgCache = { at: Date.now(), v }
  return v
}
export const resetMailConfigCache = () => { cfgCache = null }

// ---------- SMTP (öz server) ----------
let transport: Transporter | null = null
export function smtp(): Transporter {
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'mail', port: Number(process.env.SMTP_PORT ?? 587), secure: false,
    // konteynerlər arası daxili şəbəkə: TLS lazım deyil, autentifikasiya mynetworks ilə
    ignoreTLS: true, pool: true, maxConnections: 4, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 30_000,
  })
  return transport
}
async function viaSmtp(to: string, subject: string, text: string, html: string | undefined, extra: MailExtra): Promise<MailResult> {
  try {
    const info = await smtp().sendMail({
      from: { name: 'Jabr', address: FROM() }, to, subject, text, html, replyTo: { name: 'Jabr', address: extra.replyTo ?? REPLY() },
      headers: extra.headers, envelope: { from: FROM(), to },
    })
    const ok = (info.accepted?.length ?? 0) > 0
    return { sent: ok, status: ok ? 250 : 550, error: ok ? undefined : String(info.response ?? '').slice(0, 300), provider: 'smtp' }
  } catch (e) {
    const msg = (e as Error).message.slice(0, 300)
    console.error('[mail:smtp] failed', msg)
    return { sent: false, status: 0, error: `SMTP: ${msg}`, provider: 'smtp' }
  }
}

// ---------- Brevo ----------
async function viaBrevo(to: string, subject: string, text: string, html: string | undefined, extra: MailExtra): Promise<MailResult> {
  const key = process.env.BREVO_API_KEY
  if (!key) {
    console.log(`[mail:dry-run] to=${to} subject=${subject}`)
    return { sent: false, status: 0, error: 'BREVO_API_KEY is not configured', provider: 'brevo' }
  }
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: 'Jabr', email: FROM() },
        to: [{ email: to }], subject, textContent: text, ...(html ? { htmlContent: html } : {}),
        replyTo: { email: extra.replyTo ?? REPLY(), name: 'Jabr' },
        ...(extra.headers ? { headers: extra.headers } : {}), ...(extra.tags ? { tags: extra.tags } : {}),
      }),
      signal: AbortSignal.timeout(20_000),
    })
    const body = res.ok ? '' : (await res.text().catch(() => '')).slice(0, 300)
    if (!res.ok) console.error('[mail:brevo] failed', res.status, body)
    return { sent: res.ok, status: res.status, error: body || undefined, provider: 'brevo' }
  } catch (e) {
    return { sent: false, status: 0, error: `Brevo: ${(e as Error).message.slice(0, 200)}`, provider: 'brevo' }
  }
}

const via = (p: MailProvider) => (p === 'smtp' ? viaSmtp : viaBrevo)

/** Məktub göndərir. force — test üçün konkret provayder (fallback olmadan). */
export async function sendMail(to: string, subject: string, text: string, html?: string, extra: MailExtra = {}, force?: MailProvider): Promise<MailResult> {
  if (force) return via(force)(to, subject, text, html, extra)
  const cfg = await mailConfig()
  const first = await via(cfg.provider)(to, subject, text, html, extra)
  if (first.sent || !cfg.fallback) return first
  const other: MailProvider = cfg.provider === 'smtp' ? 'brevo' : 'smtp'
  if (other === 'brevo' && !process.env.BREVO_API_KEY) return first
  const second = await via(other)(to, subject, text, html, extra)
  return second.sent ? { ...second, fellBack: true } : first
}
