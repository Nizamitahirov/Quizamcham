/**
 * Oyunçu əlçatanlığı (bu cihazda saxlanılır): sualı səsli oxuma, oxunaqlı şrift, disleksiya rejimi (oxunaqlı şrift + geniş
 * hərf/söz/sətir aralığı — tədqiqatlarda xüsusi şriftdən daha faydalıdır), böyük mətn, yüksək kontrast.
 * Ayarlar <html data-a11y-*> atributları ilə tətbiq olunur (tokens.css); səsli oxuma — brauzerin SpeechSynthesis API-si.
 */
import { useEffect, useState } from 'react'

export type A11yFont = 'default' | 'readable' | 'dyslexic'
export interface A11y { tts: boolean; font: A11yFont; large: boolean; contrast: boolean; rate: number }
const KEY = 'jabr.a11y'
const DEF: A11y = { tts: false, font: 'default', large: false, contrast: false, rate: 1 }
let state: A11y = (() => { try { return { ...DEF, ...(JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<A11y> | null) } } catch { return DEF } })()
const subs = new Set<() => void>()
let fontsLoaded = false

function apply() {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  el.dataset.a11yFont = state.font
  el.toggleAttribute('data-a11y-large', state.large)
  el.toggleAttribute('data-a11y-contrast', state.contrast)
  // şriftlər yalnız lazım olanda yüklənir
  if (state.font !== 'default' && !fontsLoaded) {
    fontsLoaded = true
    // Atkinson Hyperlegible: genişləndirilmiş latın (ə, ğ, ş, ı) daxil; kiril — sistem şrifti
    void import('@fontsource/atkinson-hyperlegible/400.css'); void import('@fontsource/atkinson-hyperlegible/700.css')
  }
}
apply()

export const getA11y = () => state
export function setA11y(p: Partial<A11y>) {
  state = { ...state, ...p }
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* noop */ }
  if (!state.tts) stopSpeaking()
  apply(); subs.forEach((f) => f())
}
export function useA11y(): A11y {
  const [, tick] = useState(0)
  useEffect(() => { const f = () => tick((x) => x + 1); subs.add(f); return () => { subs.delete(f) } }, [])
  return state
}

// ───────── səsli oxuma
export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window
/** Mətnin dili: kiril → ru, Azərbaycan hərfləri → az, əks halda en (quiz öz dilində oxunsun). */
export function langOf(text: string): 'az' | 'ru' | 'en' {
  if (/[Ѐ-ӿ]/.test(text)) return 'ru'
  if (/[əğıöüşçƏĞİÖÜŞÇ]/.test(text)) return 'az'
  return /[a-z]{3}/i.test(text) ? 'en' : 'az'
}
const LOCALES = { az: ['az-AZ', 'az', 'tr-TR', 'tr'], ru: ['ru-RU', 'ru'], en: ['en-GB', 'en-US', 'en'] }
function voiceFor(lang: 'az' | 'ru' | 'en') {
  const vs = window.speechSynthesis.getVoices()
  for (const l of LOCALES[lang]) { const v = vs.find((x) => x.lang.toLowerCase().startsWith(l.toLowerCase())); if (v) return v }
  return null
}
export function stopSpeaking() { if (ttsSupported()) window.speechSynthesis.cancel() }
/** Sualı və variantları oxuyur (əvvəlki oxunuş dayandırılır). */
export function speak(parts: string[]) {
  if (!ttsSupported()) return
  const text = parts.map((x) => x.replace(/_{2,}/g, ' ... ').trim()).filter(Boolean).join('. ')
  if (!text) return
  stopSpeaking()
  const lang = langOf(text), u = new SpeechSynthesisUtterance(text), v = voiceFor(lang)
  if (v) u.voice = v
  u.lang = v?.lang ?? LOCALES[lang][0]
  u.rate = state.rate
  window.speechSynthesis.speak(u)
}
/** Sual dəyişəndə (və səsli oxuma açıqdırsa) avtomatik oxuyur. */
export function useReadAloud(key: string | number | null | undefined, parts: string[]) {
  const a = useA11y()
  const text = parts.join('|')
  useEffect(() => {
    if (!a.tts || key == null) return
    const id = setTimeout(() => speak(text.split('|')), 350)
    return () => { clearTimeout(id); stopSpeaking() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, a.tts])
}
