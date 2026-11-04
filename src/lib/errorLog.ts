import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase/config'

let sent = 0
const seen = new Set<string>()

/** Klient xətalarını Firestore-a yazır (sessiyada ən çox 10, təkrarlar bir dəfə). Admin → Ayarlar → Xəta jurnalı. */
export function logError(err: unknown, context = '') {
  try {
    const e = err instanceof Error ? err : new Error(String(err))
    const key = `${e.message}|${context}`
    if (seen.has(key) || sent >= 10) return
    seen.add(key)
    sent++
    void addDoc(collection(db, 'errors'), {
      message: e.message.slice(0, 500), stack: (e.stack ?? '').slice(0, 4000), url: location.pathname.slice(0, 200),
      ua: navigator.userAgent.slice(0, 200), uid: auth.currentUser?.uid ?? '', at: serverTimestamp(), context: context.slice(0, 100),
    }).catch(() => {})
  } catch { /* jurnal özü xəta verməməlidir */ }
}

export function installGlobalErrorHandlers() {
  window.addEventListener('error', (e) => logError(e.error ?? e.message, 'window.error'))
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as { code?: string } | undefined
    if (r?.code === 'permission-denied') return // gözlənilən (məs. gec cavab)
    logError(e.reason, 'unhandledrejection')
  })
}
