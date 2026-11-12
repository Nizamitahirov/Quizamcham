/**
 * Təlimçinin daimi QR-ı.
 *   qr/{kod}              → { ownerUid, activeGameId, pin, updatedAt }  — QR-da yalnız 8 simvollu kod görünür (uid yox)
 *   qrOwners/{uid}        → { code, legacyOff }                        — yalnız təlimçinin özü oxuyur (kod gizli qalır)
 *   settings/play_{uid}   → { activeGameId, pin }                      — köhnə /play?t=<uid> linkləri üçün (sıfırlananda boş qalır)
 * "QR-ı yenilə" yeni kod verir, köhnə kodu və köhnə uid linkini dərhal ləğv edir.
 */
import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, where, writeBatch, type WriteBatch } from 'firebase/firestore'
import { db } from '../firebase/config'

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => ALPHA[b % ALPHA.length]).join('')
export const normQr = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
export const qrUrl = (code: string) => `${location.origin}/q/${code}`

export interface MyQr { code: string; legacyOff: boolean; activeGameId: string | null; pin: string | null }

async function freeCode() {
  for (let i = 0; i < 6; i++) {
    const c = newCode()
    if (!(await getDoc(doc(db, 'qr', c)).catch(() => null))?.exists()) return c
  }
  throw new Error('qr-code-failed')
}

/** Təlimçinin QR kodu (yoxdursa yaradılır; köhnə uid linki işləməyə davam edir). */
export async function getMyQr(uid: string): Promise<MyQr> {
  const s = await getDoc(doc(db, 'qrOwners', uid)).catch(() => null)
  const d = s?.exists() ? s.data() : {}
  if (typeof d.code === 'string' && d.code) {
    const q = await getDoc(doc(db, 'qr', d.code)).catch(() => null)
    return { code: d.code, legacyOff: d.legacyOff === true, activeGameId: (q?.get('activeGameId') as string) ?? null, pin: (q?.get('pin') as string) ?? null }
  }
  return rotate(uid, false)
}

/** Yeni kod: köhnə kod silinir; reset=true olduqda köhnə /play?t=<uid> linki də söndürülür. */
export async function rotate(uid: string, reset = true): Promise<MyQr> {
  const s = await getDoc(doc(db, 'qrOwners', uid)).catch(() => null)
  const d = s?.exists() ? s.data() : {}
  const legacy = await getDoc(doc(db, 'settings', `play_${uid}`)).catch(() => null)
  const old = typeof d.code === 'string' ? d.code : ''
  const prev = old ? await getDoc(doc(db, 'qr', old)).catch(() => null) : null
  const activeGameId = (prev?.get('activeGameId') as string) ?? (legacy?.get('activeGameId') as string) ?? null
  const pin = (prev?.get('pin') as string) ?? (legacy?.get('pin') as string) ?? null
  const code = await freeCode()
  const legacyOff = reset || d.legacyOff === true
  const b = writeBatch(db)
  b.set(doc(db, 'qr', code), { ownerUid: uid, activeGameId, pin, updatedAt: serverTimestamp() })
  if (old) b.delete(doc(db, 'qr', old))
  b.set(doc(db, 'qrOwners', uid), { code, legacyOff, updatedAt: serverTimestamp() })
  b.set(doc(db, 'settings', `play_${uid}`), { activeGameId: legacyOff ? null : activeGameId, pin: legacyOff ? null : pin, updatedAt: serverTimestamp() })
  await b.commit()
  return { code, legacyOff, activeGameId, pin }
}

/** Oyun başlayanda: təlimçinin QR-ı bu oyuna yönəlir (eyni batch daxilində). */
export async function pointQr(batch: WriteBatch, uid: string, gameId: string | null, pin: string | null) {
  const s = await getDoc(doc(db, 'qrOwners', uid)).catch(() => null)
  const d = s?.exists() ? s.data() : {}
  const legacyOff = d.legacyOff === true
  if (typeof d.code === 'string' && d.code) batch.set(doc(db, 'qr', d.code), { ownerUid: uid, activeGameId: gameId, pin, updatedAt: serverTimestamp() })
  batch.set(doc(db, 'settings', `play_${uid}`), { activeGameId: legacyOff ? null : gameId, pin: legacyOff ? null : pin, updatedAt: serverTimestamp() })
}

/**
 * Oyun bitəndə / silinəndə: QR bu oyuna aparırdısa — təlimçinin başqa açıq canlı oyunu varsa ona, yoxsa boşalt.
 * (Eyni anda iki oyun aparan təlimçinin QR-ı ikincisi bitəndə "oyun yoxdur" göstərməsin.)
 */
export async function releaseQr(batch: WriteBatch, uid: string, gameId: string) {
  const s = await getDoc(doc(db, 'qrOwners', uid)).catch(() => null)
  const legacy = await getDoc(doc(db, 'settings', `play_${uid}`)).catch(() => null)
  const code = s?.exists() && typeof s.get('code') === 'string' ? (s.get('code') as string) : ''
  const q = code ? await getDoc(doc(db, 'qr', code)).catch(() => null) : null
  const pointsHere = q?.get('activeGameId') === gameId || legacy?.get('activeGameId') === gameId
  if (!pointsHere) return
  const other = await getDocs(query(collection(db, 'games'), where('hostUid', '==', uid), orderBy('createdAt', 'desc'), limit(10)))
    .then((r) => r.docs.find((g) => g.id !== gameId && g.get('phase') !== 'finished' && g.get('settings.mode') !== 'assign'), () => undefined)
  await pointQr(batch, uid, other?.id ?? null, (other?.get('pin') as string) ?? null)
}

/** QR skan olunanda: göstəricidən PIN; oyun həqiqətən açıqdırsa /join?pin=…, deyilsə "aktiv oyun yoxdur". */
export async function resolvePointer(path: string): Promise<string | null> {
  const p = await getDoc(doc(db, ...(path.split('/') as [string, string]))).catch(() => null)
  const pin = p?.exists() ? (p.get('pin') as string | null) : null
  const gameId = p?.exists() ? (p.get('activeGameId') as string | null) : null
  if (!pin) return null
  const pd = await getDoc(doc(db, 'pins', pin)).catch(() => null)
  if (!pd?.exists() || pd.get('active') === false || (gameId && pd.get('gameId') !== gameId)) return null
  return pin
}
