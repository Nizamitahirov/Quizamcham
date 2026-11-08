/**
 * Jabr klient SDK — "firebase/app" uyğun interfeys (öz serverimiz üçün).
 * Tətbiq kodu dəyişmir: Vite alias-ı ilə "firebase/*" importları bu modullara yönləndirilir (VITE_BACKEND=jabr).
 */
export interface FirebaseOptions { apiKey?: string; projectId?: string; appId?: string; baseUrl?: string; [k: string]: unknown }
export interface FirebaseApp { name: string; options: FirebaseOptions; _services: Map<string, unknown>; _deleted?: boolean }

const apps = new Map<string, FirebaseApp>()

export function initializeApp(options: FirebaseOptions = {}, name = '[DEFAULT]'): FirebaseApp {
  const existing = apps.get(name)
  if (existing) return existing
  const app: FirebaseApp = { name, options: { ...options }, _services: new Map() }
  apps.set(name, app)
  return app
}
export const getApp = (name = '[DEFAULT]') => apps.get(name) ?? initializeApp({}, name)
export const getApps = () => [...apps.values()]
export async function deleteApp(app: FirebaseApp) {
  for (const s of app._services.values()) (s as { _terminate?: () => void })._terminate?.()
  app._deleted = true
  apps.delete(app.name)
}

/** API ünvanı: options.baseUrl → VITE_API_URL → cari sayt. */
export function apiBase(app: FirebaseApp): string {
  const fromOpts = app.options.baseUrl
  const env = (import.meta as { env?: Record<string, string | undefined> }).env
  const b = fromOpts || env?.VITE_API_URL || (typeof location !== 'undefined' ? location.origin : 'http://localhost:3000')
  return String(b).replace(/\/$/, '')
}

export class FirebaseError extends Error {
  constructor(public code: string, message?: string) { super(message ?? code); this.name = 'FirebaseError' }
}

/** Bütün HTTP sorğuları üçün ortaq köməkçi. */
export async function http<T>(base: string, path: string, body: unknown, headers: Record<string, string> = {}, prefix = ''): Promise<T> {
  let res: Response
  try {
    res = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (e) {
    throw new FirebaseError(prefix + (prefix ? 'network-request-failed' : 'unavailable'), (e as Error).message)
  }
  const text = await res.text()
  const json = text ? JSON.parse(text) : {}
  if (!res.ok) throw new FirebaseError(json.code ?? (res.status >= 500 ? 'internal' : 'unknown'), json.message)
  return json as T
}
