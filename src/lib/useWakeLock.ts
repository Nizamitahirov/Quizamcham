import { useEffect } from 'react'

type Sentinel = { release: () => Promise<void>; addEventListener: (t: 'release', f: () => void) => void }

/** Ekranın sönməsinin qarşısını alır (Screen Wake Lock API). Dəstəklənmirsə, səssizcə heç nə etmir. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } }).wakeLock
    if (!active || !wl) return
    let sentinel: Sentinel | null = null
    let cancelled = false
    const acquire = async () => {
      try {
        if (document.visibilityState !== 'visible') return
        sentinel = await wl.request('screen')
        if (cancelled) void sentinel.release()
      } catch { /* istifadəçi icazə vermədi və ya batareya qənaəti */ }
    }
    const onVis = () => { if (document.visibilityState === 'visible') void acquire() }
    void acquire()
    document.addEventListener('visibilitychange', onVis)
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVis); void sentinel?.release().catch(() => {}) }
  }, [active])
}

/** Oyun gedərkən səhifəni bağlamağa çalışanda xəbərdarlıq. */
export function useLeaveGuard(active: boolean) {
  useEffect(() => {
    if (!active) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [active])
}
