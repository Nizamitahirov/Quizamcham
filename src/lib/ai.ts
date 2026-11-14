/**
 * AI (Groq) — serverimizin /api/ai/* uç nöqtələri. Açar yalnız serverdədir.
 * Köhnə (Firebase) saytda bu uç nöqtələr yoxdur → "aktiv deyil" xətası.
 */
import { auth } from '../firebase/config'

export type AiLang = 'az' | 'ru' | 'en'
export interface AiQuota { used: number; limit: number; tier: string; configured: boolean }
export class AiError extends Error { constructor(public code: string) { super(code) } }

async function call<T>(path: string, body?: unknown): Promise<T> {
  const token = await auth.currentUser?.getIdToken().catch(() => '')
  let res: Response
  try {
    res = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch { throw new AiError('ai-failed') }
  const json = await res.json().catch(() => null) as (T & { code?: string }) | null
  if (!res.ok || !json) throw new AiError(json?.code ?? (res.status === 404 ? 'ai-not-configured' : 'ai-failed'))
  return json
}

export const aiQuota = () => call<AiQuota>('/api/ai/quota')
/** Super admin: e-poçt göndərməni yoxlamaq (öz ünvanına test məktubu). */
const uiLang = () => { try { return localStorage.getItem('qz.lang') ?? 'az' } catch { return 'az' } }
export const mailTest = (provider?: MailProvider) => call<{ sent: boolean; status: number; error?: string; to: string; provider?: MailProvider; fellBack?: boolean }>('/api/mail/test', { lang: uiLang(), provider })
export type MailProvider = 'brevo' | 'smtp'
export interface MailCfg { provider: MailProvider; fallback: boolean; brevoConfigured: boolean }
export interface MailCheck { id: 'smtp' | 'port25' | 'aRecord' | 'ptr' | 'spf' | 'dkim' | 'dmarc'; ok: boolean; value?: string; expected?: { type: string; name: string; value: string } }
export const mailCfg = () => call<MailCfg>('/api/mail/config')
export const setMailCfg = (c: { provider: MailProvider; fallback: boolean }) => call<MailCfg>('/api/mail/config', c)
export const mailDiag = () => call<{ ip: string; host: string; domain: string; checks: MailCheck[]; ready: boolean }>('/api/mail/diagnostics')
/** Qeydiyyat bitəndə xoş gəldin məktubu (server hər istifadəçiyə bir dəfə göndərir). */
export const mailWelcome = () => call<{ sent: boolean }>('/api/mail/welcome', { lang: uiLang() })

// ---- E-poçt kampaniyaları (super admin) ----
export type CampTier = 'trial' | 'free' | 'trainer' | 'pro' | 'business' | 'team'
export type CampLicense = 'any' | 'expired' | 'expiring' | 'trialEnded'
export interface CampFilter { audience: 'all' | 'students' | 'trainers' | 'custom'; tiers: CampTier[]; langs: AiLang[]; joinedDays: number; emails: string[]; kind: 'marketing' | 'service'; license: CampLicense; licenseDays: number; exclude?: string[] }
export interface CampFeature { emoji: string; title: string; text: string }
export interface CampContent { subject: string; preheader: string; title: string; body: string; hero: string; features: CampFeature[]; ctaLabel: string; ctaUrl: string; lang: AiLang }
export interface CampItem { id: string; subject: string; kind: string; lang: string; total: number; sent: number; failed: number; status: string; errors: string[]; createdAt: number }
export interface CampRecipient { email: string; name: string; type: string; tier: string | null; lang: string; until: number | null }
export interface CampAudience { count: number; noConsent: number; noConsentEmails: string[]; notFound: string[]; excluded: number; sample: CampRecipient[] }
export const campAudience = (filter: CampFilter) => call<CampAudience>('/api/campaigns/audience', { filter })
export const campPreview = (content: CampContent, filter?: CampFilter) => call<{ subject: string; html: string }>('/api/campaigns/preview', { content, filter })
export const campSend = (content: CampContent, filter: CampFilter, test = false) => call<{ id?: string; total?: number; test?: boolean; to?: string; sent?: boolean; error?: string }>('/api/campaigns/send', { content, filter, test })
export const campList = () => call<{ items: CampItem[] }>('/api/campaigns')

export type AiLevel = 'easy' | 'medium' | 'hard'
export interface GenInput { topic?: string; text?: string; count: number; lang: AiLang; level: AiLevel; types: string[]; audience?: string; mix?: Record<AiLevel, number>; ordered?: boolean; timeByLevel?: boolean }
export const aiGenerate = (input: GenInput) => call<{ quiz: Record<string, unknown>; dropped?: number; levels?: Partial<Record<AiLevel, number>> }>('/api/ai/generate', input)

export interface InsightInput { lang: AiLang; title: string; players: number; questions: { text: string; correctPct: number; avgTimeS?: number; topWrong?: string[] }[] }
export interface Insights { summary: string; strengths: string[]; gaps: string[]; actions: string[] }
export const aiInsights = (input: InsightInput) => call<Insights>('/api/ai/insights', input)

export const aiGrade = (input: { lang: AiLang; question: string; rubric?: string; answers: { id: string; text: string }[] }) =>
  call<{ grades: { id: string; score: number; feedback: string }[] }>('/api/ai/grade', input)
