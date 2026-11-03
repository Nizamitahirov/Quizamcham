import { normalizeText } from './scoring'

// Kiçik başlanğıc siyahısı; admin /admin/settings-də genişləndirə bilər.
const BASE = ['admin', 'host', 'fuck', 'shit', 'sik', 'göt', 'qəhbə', 'peyser', 'blyat', 'suka']

export function isNameAllowed(name: string, extra: string[] = []): boolean {
  const n = normalizeText(name, true)
  return ![...BASE, ...extra].filter(Boolean).some((w) => {
    const ww = normalizeText(w, true)
    return ww.length > 0 && n.split(/[\s-]+/).some((part) => part === ww || (ww.length >= 4 && part.includes(ww)))
  })
}

export function cleanName(s: string): string {
  return s.replace(/[<>{}[\]\\/]/g, '').replace(/\s+/g, ' ').trimStart().slice(0, 20)
}

export const shortName = (first: string, last: string) => `${first} ${last ? last[0] + '.' : ''}`.trim()
