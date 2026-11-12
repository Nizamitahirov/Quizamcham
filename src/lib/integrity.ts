/**
 * Dürüstlük nəzarəti (anti-cheat): quiz zamanı şübhəli davranışların qeydə alınması.
 *  tab   — başqa tab/proqrama keçid (səhifə gizləndi)
 *  blur  — pəncərə fokusu itirdi (məs. başqa pəncərə, split-screen)
 *  paste — mətn yapışdırma cəhdi (yazılı cavablarda)
 *  copy  — sual mətnini kopyalama cəhdi
 *  dual  — eyni oyun eyni brauzerdə ikinci tabda açıqdır
 *  fast  — cavab insan üçün qeyri-real sürətlə verildi (< 350 ms)
 * Rejimlər: off | monitor (qeyd + xəbərdarlıq) | strict (həmin sual ərzində tabdan çıxıbsa cavab sayılmır).
 * Qeyd: brauzerdə tam qarşısını almaq mümkün deyil — məqsəd aşkarlamaq, çəkindirmək və müəllimə göstərməkdir.
 */
import { createContext, useCallback, useEffect, useRef, useState } from 'react'

export type IntegrityMode = 'off' | 'monitor' | 'strict'
export type FlagKind = 'tab' | 'blur' | 'paste' | 'copy' | 'dual' | 'fast'
export type FlagCounts = Partial<Record<FlagKind, number>>
export interface FlagEvent { k: FlagKind; q: number; at: number }
export const FLAG_KINDS: FlagKind[] = ['tab', 'blur', 'paste', 'copy', 'dual', 'fast']
export const FAST_MS = 350
export const flagTotal = (c?: FlagCounts | null) => FLAG_KINDS.reduce((s, k) => s + (c?.[k] ?? 0), 0)
/** Ciddi hesab edilənlər (bulanıqlıq/surət kopyalama tək başına zəif siqnaldır). */
export const flagSevere = (c?: FlagCounts | null) => (c?.tab ?? 0) + (c?.paste ?? 0) + (c?.dual ?? 0) + (c?.fast ?? 0)

/**
 * İstifadə: const g = useIntegrity({ mode, channel: gameId, q: questionIndex, active: sual ekranı açıqdır, onChange })
 *  g.awayNow() — bu sual ərzində tabdan çıxıbmı (strict üçün cavaba "away" bayrağı)
 *  g.counts / g.events — yığılmış qeydlər; g.warning — oyunçuya göstəriləcək son xəbərdarlıq
 *  g.markAnswer(ms) — cavab vaxtını yoxlayır ("fast")
 */
export function useIntegrity({ mode, channel, q, active, onChange }: { mode: IntegrityMode; channel: string; q: number; active: boolean; onChange?: (counts: FlagCounts, events: FlagEvent[]) => void }) {
  const on = mode !== 'off'
  const [counts, setCounts] = useState<FlagCounts>({})
  const [warning, setWarning] = useState<FlagKind | null>(null)
  const events = useRef<FlagEvent[]>([])
  const away = useRef<Set<number>>(new Set())
  const qRef = useRef(q); const activeRef = useRef(active)
  useEffect(() => { qRef.current = q; activeRef.current = active }, [q, active])
  const cb = useRef(onChange)
  useEffect(() => { cb.current = onChange }, [onChange])
  const last = useRef<Record<string, number>>({})

  const flag = useCallback((k: FlagKind) => {
    if (!on) return
    const now = Date.now()
    // eyni hadisənin təkrarı (məs. blur + visibilitychange birlikdə) 1.5 san ərzində bir dəfə sayılır
    if (now - (last.current[k] ?? 0) < 1500) return
    last.current[k] = now
    if ((k === 'tab' || k === 'blur') && activeRef.current) away.current.add(qRef.current)
    events.current = [...events.current, { k, q: qRef.current, at: now }].slice(-30)
    setCounts((c) => { const n = { ...c, [k]: (c[k] ?? 0) + 1 }; cb.current?.(n, events.current); return n })
    setWarning(k)
  }, [on])

  useEffect(() => {
    if (!on) return
    const vis = () => { if (document.visibilityState === 'hidden') flag('tab') }
    // blur yalnız sual ekranında sayılır (lobbidə telefonu kilidləmək normaldır)
    const blur = () => { if (activeRef.current && document.visibilityState === 'visible') flag('blur') }
    const paste = (e: ClipboardEvent) => { if (activeRef.current) { flag('paste'); if (mode === 'strict') e.preventDefault() } }
    const copy = (e: ClipboardEvent) => { if (activeRef.current) { flag('copy'); e.preventDefault() } }
    const ctx = (e: MouseEvent) => { if (activeRef.current) e.preventDefault() }
    document.addEventListener('visibilitychange', vis)
    window.addEventListener('blur', blur)
    document.addEventListener('paste', paste, true)
    document.addEventListener('copy', copy, true)
    document.addEventListener('contextmenu', ctx)
    // ikinci tab: eyni kanalda başqa tab "salam" deyirsə
    let bc: BroadcastChannel | null = null
    const me = Math.random().toString(36).slice(2)
    try {
      bc = new BroadcastChannel(`jabr-integrity-${channel}`)
      bc.onmessage = (e: MessageEvent<{ hi?: string; ack?: string }>) => {
        if (e.data.hi && e.data.hi !== me) { bc?.postMessage({ ack: me }); flag('dual') }
        if (e.data.ack && e.data.ack !== me) flag('dual')
      }
      bc.postMessage({ hi: me })
    } catch { /* köhnə brauzer */ }
    return () => {
      document.removeEventListener('visibilitychange', vis); window.removeEventListener('blur', blur)
      document.removeEventListener('paste', paste, true); document.removeEventListener('copy', copy, true); document.removeEventListener('contextmenu', ctx)
      bc?.close()
    }
  }, [on, channel, flag, mode])

  const dismiss = useCallback(() => setWarning(null), [])
  const setQ = useCallback((n: number) => { qRef.current = n }, [])
  const awayNow = useCallback(() => on && away.current.has(qRef.current), [on])
  const markAnswer = useCallback((ms: number) => { if (on && ms >= 0 && ms < FAST_MS) flag('fast') }, [on, flag])
  /** öz tempində rejim: cari sualın nömrəsi oyunçunun özündədir (setQ) */
  return { mode, counts, warning, dismiss, setQ, awayNow, markAnswer }
}

export type Integrity = ReturnType<typeof useIntegrity>
export const IntegrityCtx = createContext<Integrity | null>(null)
