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

export interface GenInput { topic?: string; text?: string; count: number; lang: AiLang; level: 'easy' | 'medium' | 'hard'; types: string[]; audience?: string }
export const aiGenerate = (input: GenInput) => call<{ quiz: Record<string, unknown>; dropped?: number }>('/api/ai/generate', input)

export interface InsightInput { lang: AiLang; title: string; players: number; questions: { text: string; correctPct: number; avgTimeS?: number; topWrong?: string[] }[] }
export interface Insights { summary: string; strengths: string[]; gaps: string[]; actions: string[] }
export const aiInsights = (input: InsightInput) => call<Insights>('/api/ai/insights', input)

export const aiGrade = (input: { lang: AiLang; question: string; rubric?: string; answers: { id: string; text: string }[] }) =>
  call<{ grades: { id: string; score: number; feedback: string }[] }>('/api/ai/grade', input)
