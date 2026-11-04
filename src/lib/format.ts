import { currentLang } from '../i18n/az'

/**
 * Tarix formatı. Brauzerlərin çoxunda az-AZ lokalında ay adları yoxdur ("2026 M11 4"),
 * ona görə azərbaycan dili üçün ay adları burada verilir.
 */
const AZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr']
const AZ_SHORT = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avq', 'sen', 'okt', 'noy', 'dek']
const pad = (n: number) => String(n).padStart(2, '0')
const en = () => currentLang() === 'en'

/** 4 noyabr 2026 */
export function fmtDate(d: Date): string {
  if (en()) return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  return `${d.getDate()} ${AZ_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
/** 4 noy 2026, 14:05 */
export function fmtDateTime(d: Date): string {
  if (en()) return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  return `${d.getDate()} ${AZ_SHORT[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
/** 4 noy */
export function fmtDayMonth(d: Date): string {
  if (en()) return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${d.getDate()} ${AZ_SHORT[d.getMonth()]}`
}
/** 14:05 */
export const fmtTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
