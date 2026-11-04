import { app } from './config'

/**
 * İstəyə bağlı: App Check (reCAPTCHA v3) və Analytics.
 * App Check yalnız VITE_RECAPTCHA_SITE_KEY təyin olunanda aktivdir (README → App Check).
 */
export async function initExtras() {
  const key = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined
  if (key) {
    try {
      const { initializeAppCheck, ReCaptchaV3Provider } = await import('firebase/app-check')
      initializeAppCheck(app, { provider: new ReCaptchaV3Provider(key), isTokenAutoRefreshEnabled: true })
    } catch { /* App Check yüklənmədi */ }
  }
  if (import.meta.env.PROD && (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-PDCNXPQH5D')) {
    try {
      const { getAnalytics, isSupported } = await import('firebase/analytics')
      if (await isSupported()) analyticsInstance = getAnalytics(app)
    } catch { /* analytics bloklandı */ }
  }
}

let analyticsInstance: unknown = null
/** Anonim istifadə hadisələri (oyun yaradıldı, oyunçu qoşuldu və s.). */
export async function track(name: string, params: Record<string, string | number> = {}) {
  if (!analyticsInstance) return
  try {
    const { logEvent } = await import('firebase/analytics')
    logEvent(analyticsInstance as Parameters<typeof logEvent>[0], name, params)
  } catch { /* noop */ }
}
