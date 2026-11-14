/**
 * Profil şəkli və şirkət loqosu: brauzerdə kiçildilir, sonra serverə yüklənir (/api/media/…).
 * Qayıdan ünvan (/api/media/photo/<uid>?v=…) profil sənədində saxlanılır; şəkil ictimai oxunur (lobbidə oyunçular görür).
 */
import { auth } from '../firebase/config'
import type { Brand } from '../types'

export class MediaError extends Error { constructor(public code: 'type' | 'too-large' | 'failed') { super(code) } }
const bearer = async (): Promise<Record<string, string>> => { const tk = await auth.currentUser?.getIdToken().catch(() => ''); return tk ? { authorization: `Bearer ${tk}` } : {} }
const toBlob = (c: HTMLCanvasElement, type: string, q: number) => new Promise<Blob | null>((res) => c.toBlob(res, type, q))

/** Şəkli kətana çəkir: square — mərkəzdən kvadrat kəsim (profil), əks halda nisbət saxlanılır (loqo, şəffaflıq qalır). */
async function render(file: File, max: number, square: boolean): Promise<Blob> {
  if (!/^image\/(png|jpe?g|webp|heic|heif|gif|bmp)$/i.test(file.type)) throw new MediaError('type')
  const bmp = await createImageBitmap(file).catch(() => { throw new MediaError('type') })
  const side = Math.min(bmp.width, bmp.height)
  const sw = square ? side : bmp.width, sh = square ? side : bmp.height
  const k = Math.min(1, max / Math.max(sw, sh))
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(sw * k)); c.height = Math.max(1, Math.round(sh * k))
  const g = c.getContext('2d')!
  g.imageSmoothingQuality = 'high'
  g.drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh, 0, 0, c.width, c.height)
  for (const q of [0.9, 0.8, 0.65, 0.5]) {
    const b = (await toBlob(c, 'image/webp', q)) ?? (await toBlob(c, square ? 'image/jpeg' : 'image/png', q))
    if (b && b.size <= 380 * 1024) return b
  }
  throw new MediaError('too-large')
}

export async function uploadMedia(kind: 'photo' | 'logo', file: File): Promise<string> {
  const blob = await render(file, kind === 'photo' ? 320 : 512, kind === 'photo')
  const r = await fetch(`/api/media/${kind}`, { method: 'POST', headers: { ...(await bearer()), 'content-type': 'application/octet-stream' }, body: blob })
  const j = (await r.json().catch(() => null)) as { url?: string } | null
  if (!r.ok || !j?.url) throw new MediaError(r.status === 413 ? 'too-large' : r.status === 400 ? 'type' : 'failed')
  return j.url
}
export async function removeMedia(kind: 'photo' | 'logo') {
  await fetch(`/api/media/${kind}`, { method: 'DELETE', headers: await bearer() }).catch(() => {})
}
/** Öz yüklədiyimiz şəkildirmi (3D avatardan və Google şəklindən üstün tutulur). */
export const isUploaded = (url?: string | null) => !!url && url.startsWith('/api/media/photo/')

/** Çağıranın effektiv brendi (Business planı; təşkilat üzvü üçün sahibin brendi). Firebase rejimində və ya xətada null. */
export async function brandOf(): Promise<Brand | null> {
  if (import.meta.env.VITE_BACKEND !== 'jabr') return null
  const r = await fetch('/api/brand', { headers: await bearer() })
  if (!r.ok) return null
  return ((await r.json()) as { brand: Brand | null }).brand ?? null
}
