/** Rəng rejimi: tünd (standart) və ya açıq. Seçim brauzerdə saxlanılır; ilk yükləmədə /theme-init.js tətbiq edir. */
import { useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light'
const KEY = 'jabr.theme'
const subs = new Set<() => void>()
export const getTheme = (): Theme => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')
export function setTheme(t: Theme) {
  if (t === 'light') document.documentElement.dataset.theme = 'light'
  else delete document.documentElement.dataset.theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#F4F5FA' : '#090A13')
  try { localStorage.setItem(KEY, t) } catch { /* noop */ }
  subs.forEach((f) => f())
}
export const useTheme = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, getTheme, () => 'dark' as Theme)
