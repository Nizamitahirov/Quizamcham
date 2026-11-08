/**
 * Sənəd dəyərlərinin kodlaşdırılması (Firestore modeli ilə uyğun).
 *  - Timestamp      → { "__t": <millis> }
 *  - serverTimestamp → { "__sv": "ts" }           (yazıda; serverdə commit vaxtı ilə əvəz olunur)
 *  - deleteField    → { "__sv": "del" }
 *  - arrayUnion     → { "__sv": "au", "v": [...] }
 *  - arrayRemove    → { "__sv": "ar", "v": [...] }
 */
export type J = null | boolean | number | string | J[] | { [k: string]: J }
export type Doc = { [k: string]: J }

export const isObj = (v: unknown): v is { [k: string]: J } => !!v && typeof v === 'object' && !Array.isArray(v)
export const isTs = (v: unknown): v is { __t: number } => isObj(v) && typeof v.__t === 'number' && Object.keys(v).length === 1
export const isSentinel = (v: unknown): v is { __sv: string; v?: J[] } => isObj(v) && typeof v.__sv === 'string'
/** Firestore "map" tipi: obyekt, amma Timestamp və ya sentinel deyil. */
export const isMap = (v: unknown): v is Doc => isObj(v) && !isTs(v) && !isSentinel(v)
export const ts = (ms: number) => ({ __t: ms })

export function deepEqual(a: J | undefined, b: J | undefined): boolean {
  if (a === b) return true
  if (a === null || b === null || a === undefined || b === undefined) return false
  if (typeof a !== typeof b) return false
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => deepEqual(x, b[i]))
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a), kb = Object.keys(b)
    return ka.length === kb.length && ka.every((k) => k in b && deepEqual(a[k], b[k]))
  }
  return false
}

/** Sentinelləri dəyərlərə çevirir (set üçün). deleteField set-də sadəcə sahəni buraxır. */
export function resolve(v: J, now: number): J | undefined {
  if (isSentinel(v)) {
    if (v.__sv === 'ts') return ts(now)
    if (v.__sv === 'au') return [...(v.v ?? [])]
    if (v.__sv === 'ar') return []
    return undefined // del
  }
  if (Array.isArray(v)) return v.map((x) => resolve(x, now) ?? null)
  if (isMap(v)) {
    const out: Doc = {}
    for (const [k, x] of Object.entries(v)) { const r = resolve(x, now); if (r !== undefined) out[k] = r }
    return out
  }
  return v
}

/** Mövcud dəyərə sentinel tətbiqi (update/merge üçün). undefined → sahəni sil. */
function applyValue(cur: J | undefined, v: J, now: number): J | undefined {
  if (isSentinel(v)) {
    switch (v.__sv) {
      case 'ts': return ts(now)
      case 'del': return undefined
      case 'au': { const arr = Array.isArray(cur) ? [...cur] : []; for (const x of v.v ?? []) if (!arr.some((y) => deepEqual(y, x))) arr.push(x); return arr }
      case 'ar': { const arr = Array.isArray(cur) ? cur : []; return arr.filter((y) => !(v.v ?? []).some((x) => deepEqual(x, y))) }
    }
    return undefined
  }
  return resolve(v, now)
}

const clone = <T>(x: T): T => (x === undefined ? x : JSON.parse(JSON.stringify(x)))

/** updateDoc: "a.b.c" nöqtəli yollar dəstəklənir; mövcud sənəd tələb olunur. */
export function applyUpdate(base: Doc, fields: Doc, now: number): Doc {
  const out = clone(base)
  for (const [key, v] of Object.entries(fields)) {
    const parts = key.split('.')
    let node: Doc = out
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i]
      if (!isMap(node[p])) node[p] = {}
      node = node[p] as Doc
    }
    const last = parts[parts.length - 1]
    const r = applyValue(node[last], v, now)
    if (r === undefined) delete node[last]; else node[last] = r
  }
  return out
}

/** setDoc(..., { merge: true }): xəritələr dərindən birləşdirilir. */
export function mergeSet(base: Doc, data: Doc, now: number): Doc {
  const out = clone(base)
  const walk = (dst: Doc, src: Doc) => {
    for (const [k, v] of Object.entries(src)) {
      if (isMap(v) && isMap(dst[k])) { walk(dst[k] as Doc, v) ; continue }
      if (isMap(v)) { dst[k] = {}; walk(dst[k] as Doc, v); continue }
      const r = applyValue(dst[k], v, now)
      if (r === undefined) delete dst[k]; else dst[k] = r
    }
  }
  walk(out, data)
  return out
}

/** Dəyişmiş üst səviyyə açarlar (diff().affectedKeys()). */
export function affectedKeys(next: Doc, prev: Doc): Set<string> {
  const keys = new Set([...Object.keys(next), ...Object.keys(prev)])
  return new Set([...keys].filter((k) => !deepEqual(next[k], prev[k])))
}
