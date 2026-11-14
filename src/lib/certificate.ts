/**
 * Sertifikat: server buraxır (unikal kod, jabr.az/verify/<kod>), klient A4 üfüqi PNG çəkir.
 * Dizayn (şablon, rəng, başlıq, imza, şirkət loqosu) buraxan təlimçidən gəlir; "Jabr | şirkət" bloku və QR
 * hər şablonda eyni, sabit yerdədir — şirkət dizaynı dəyişsə də Jabr loqosu yerində qalır.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QRCodeSVG } from 'qrcode.react'
import { auth } from '../firebase/config'
import { fmtDate } from './format'
import { t } from '../i18n/az'
import { drawBadge, drawWordmark, roundRect } from './shareCard'
import type { Place } from './badge'

export type CertTemplate = 'classic' | 'modern' | 'minimal'
export interface CertDesign { template: CertTemplate; color: string; title: string; signer: string; signerTitle: string; signature: string; logo: string; org: string }
export interface IssuedCert {
  id: string; kind: 'game' | 'practice' | 'course'; name: string; title: string; date: number
  place: number; total: number; score: number; correct: number; questions: number; trainer: string; org: string; url: string; design: CertDesign | null
}
/** Sertifikatı serverdə buraxır (və ya əvvəl buraxılanı qaytarır). Firebase rejimində və ya xətada null — o halda kodsuz çəkilir. */
export async function issueCert(kind: IssuedCert['kind'], ref: string): Promise<IssuedCert | null> {
  if (import.meta.env.VITE_BACKEND !== 'jabr') return null
  const tk = await auth.currentUser?.getIdToken().catch(() => '')
  const r = await fetch('/api/certs', { method: 'POST', headers: { 'content-type': 'application/json', ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: JSON.stringify({ kind, ref }) }).catch(() => null)
  return r?.ok ? ((await r.json()) as IssuedCert) : null
}

export interface CertView {
  name: string; quiz: string; place: number; total: number; date: Date
  /** "aşağıdakı quizdə iştirak etmişdir" kimi sətir */
  completed: string
  /** nəticə sətri (yer · xal, və ya 9/10 düzgün) */
  result: string
  trainer?: string
  code?: string; url?: string
  design?: CertDesign | null
}

const W = 1754, H = 1240
const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src })
const HEX = /^#[0-9a-fA-F]{6}$/
function mix(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16), to = k > 0 ? 255 : 0, a = Math.abs(k)
  return `#${[n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (to - v) * a).toString(16).padStart(2, '0')).join('')}`
}
/** Mətni enə sığdırır (lazım olsa şrifti kiçildir). */
function fit(g: CanvasRenderingContext2D, text: string, weight: number, px: number, maxW: number, family = 'Montserrat') {
  let s = px
  do { g.font = `${weight} ${s}px ${family}`; if (g.measureText(text).width <= maxW) break; s -= 2 } while (s > 18)
  return s
}
/** Loqonun görünən pikselləri əsasən açıqdırmı (ağ kağızda oxunmaz)? */
function isLight(img: HTMLImageElement) {
  try {
    const k = 64, c = document.createElement('canvas'); c.width = c.height = k
    const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0, k, k)
    const px = g.getImageData(0, 0, k, k).data
    let sum = 0, n = 0
    for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 128) { sum += (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255; n++ }
    return n > 0 && sum / n > 0.72
  } catch { return false }
}
async function qrImage(url: string, color: string) {
  let svg = renderToStaticMarkup(createElement(QRCodeSVG, { value: url, size: 512, level: 'M', marginSize: 0, fgColor: color, bgColor: '#FFFFFF' }))
  // şəkil kimi yüklənməsi üçün SVG ad sahəsi mütləqdir
  if (!svg.includes('xmlns=')) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"')
  return loadImg(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
}

export async function renderCertificate(d: CertView): Promise<Blob> {
  await document.fonts?.ready
  await Promise.all([document.fonts?.load('800 72px Figtree'), document.fonts?.load('900 72px Montserrat')].map((p) => p?.catch(() => {})))
  const design = d.design ?? null
  const tpl: CertTemplate = design?.template ?? 'classic'
  const accent = design?.color && HEX.test(design.color) ? design.color : ''
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d')!
  const ink = '#0F1129', soft = '#6B6F8A'
  const grad = (x0: number, y0: number, x1: number, y1: number) => {
    const gr = g.createLinearGradient(x0, y0, x1, y1)
    if (accent) { gr.addColorStop(0, mix(accent, -0.12)); gr.addColorStop(1, mix(accent, 0.22)) } else { gr.addColorStop(0, '#E8202A'); gr.addColorStop(1, '#FF8A1A') }
    return gr
  }
  const solid = accent || '#E8202A'

  // ───────── fon və çərçivə (şablona görə)
  const L = tpl === 'modern' ? 300 : 0 // modern: sol tərəfdə rəngli zolaq
  g.fillStyle = tpl === 'minimal' ? '#FBFAF7' : '#FFFFFF'; g.fillRect(0, 0, W, H)
  if (tpl === 'classic') {
    g.strokeStyle = grad(0, 0, W, H); g.lineWidth = 18; roundRect(g, 40, 40, W - 80, H - 80, 36); g.stroke()
    g.strokeStyle = accent ? `${accent}40` : 'rgba(232,32,42,.25)'; g.lineWidth = 3; roundRect(g, 72, 72, W - 144, H - 144, 26); g.stroke()
    const glow = (x: number, y: number, r: number, col: string) => { const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, 'transparent'); g.fillStyle = rg; g.fillRect(0, 0, W, H) }
    glow(W - 120, 120, 420, accent ? `${accent}24` : 'rgba(255,138,26,.18)'); glow(120, H - 120, 420, accent ? `${accent}1C` : 'rgba(232,32,42,.14)')
  } else if (tpl === 'modern') {
    g.fillStyle = grad(0, 0, L, H); g.fillRect(0, 0, L, H)
    g.globalAlpha = 0.14; g.fillStyle = '#FFFFFF'
    for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(0, 160 + i * 170); g.lineTo(L, 40 + i * 170); g.lineTo(L, 100 + i * 170); g.lineTo(0, 220 + i * 170); g.fill() }
    g.globalAlpha = 1
    g.fillStyle = solid; g.fillRect(L, H - 14, W - L, 14)
  } else {
    g.strokeStyle = '#D9D6CC'; g.lineWidth = 2; g.strokeRect(56, 56, W - 112, H - 112)
    g.fillStyle = solid; g.fillRect(56, 56, 220, 6)
  }

  // ───────── sabit "Jabr | şirkət" bloku (hər şablonda eyni yer)
  const lx = tpl === 'modern' ? L + 110 : 140, ly = 190
  g.textBaseline = 'alphabetic'
  drawWordmark(g, lx, ly, 60, ink, 'left')
  g.font = '800 60px Figtree, Montserrat, sans-serif'
  const jw = g.measureText('Jabr').width - 0.035 * 60 * 3 + 60 * 0.33
  if (design && (design.logo || design.org)) {
    const sx = lx + jw + 34
    g.fillStyle = '#C9CCDA'; g.fillRect(sx, ly - 58, 3, 70)
    let drew = false
    if (design.logo) {
      try {
        const img = await loadImg(design.logo), h = 74, w = Math.min(420, (img.width / img.height) * h)
        // açıq rəngli loqo (tünd ekranlar üçün) ağ kağızda itməsin deyə — yalnız onda tünd "lövhə" üzərində
        if (isLight(img)) { g.fillStyle = ink; roundRect(g, sx + 30, ly - 66, w + 36, h + 14, 16); g.fill(); g.drawImage(img, sx + 48, ly - 59, w, h) }
        else g.drawImage(img, sx + 30, ly - 59, w, h)
        drew = true
      } catch { /* loqo yüklənmədi — ad yazılır */ }
    }
    if (!drew && design.org) { g.fillStyle = ink; g.textAlign = 'left'; fit(g, design.org, 800, 44, 520); g.fillText(design.org, sx + 30, ly - 6) }
  }

  // ───────── əsas mətn
  const cx = tpl === 'modern' ? L + (W - L) / 2 : W / 2
  const maxW = (tpl === 'modern' ? W - L : W) - 320
  g.textAlign = 'center'; g.textBaseline = 'middle'
  const title = design?.title || t.cert.title
  g.fillStyle = tpl === 'minimal' ? ink : grad(cx - 400, 0, cx + 400, 0); fit(g, title, 900, tpl === 'minimal' ? 62 : 72, maxW); g.fillText(title, cx, 345)
  g.fillStyle = soft; g.font = '600 32px Montserrat'; g.fillText(t.cert.given, cx, 435)
  g.fillStyle = ink; fit(g, d.name, 900, 96, maxW); g.fillText(d.name, cx, 535)
  g.fillStyle = tpl === 'minimal' ? solid : grad(cx - 260, 0, cx + 260, 0); g.fillRect(cx - 260, 600, 520, tpl === 'minimal' ? 3 : 5)
  g.fillStyle = soft; fit(g, d.completed, 600, 32, maxW); g.fillText(d.completed, cx, 668)
  const quiz = `“${d.quiz}”`
  g.fillStyle = ink; fit(g, quiz, 800, 46, maxW); g.fillText(quiz, cx, 742)
  if (d.result) { g.fillStyle = solid; g.font = '800 36px Montserrat'; g.fillText(d.result, cx, 818) }
  if (d.place >= 1 && d.place <= 3) await drawBadge(g, d.place as Place, cx - 70, 850, 140)

  // ───────── alt sıra: imza (sol) · tarix (orta) · QR (sağ, sabit yer)
  const by = 1060, left = tpl === 'modern' ? L + 100 : 160
  const signer = design?.signer || d.trainer || ''
  if (design?.signature) { try { const s = await loadImg(design.signature), h = 96, w = Math.min(340, (s.width / s.height) * h); g.drawImage(s, left, by - 30 - h, w, h) } catch { /* noop */ } }
  g.textAlign = 'left'; g.fillStyle = ink; fit(g, signer || '—', 700, 30, 380); g.fillText(signer || '—', left, by - 10)
  g.fillStyle = '#C9CCDA'; g.fillRect(left, by + 14, 380, 3)
  g.fillStyle = soft; g.font = '600 24px Montserrat'; g.fillText(design?.signerTitle || t.cert.trainer, left, by + 48)
  const mid = left + (tpl === 'modern' ? 430 : 560)
  g.fillStyle = ink; g.font = '700 30px Montserrat'; g.fillText(fmtDate(d.date), mid, by - 10)
  g.fillStyle = '#C9CCDA'; g.fillRect(mid, by + 14, 250, 3)
  g.fillStyle = soft; g.font = '600 24px Montserrat'; g.fillText(t.cert.date, mid, by + 48)
  if (d.url && d.code) {
    const q = 160, qx = W - 130 - q, qy = by - 135
    g.fillStyle = '#FFFFFF'; roundRect(g, qx - 10, qy - 10, q + 20, q + 20, 14); g.fill()
    try { g.drawImage(await qrImage(d.url, ink), qx, qy, q, q) } catch { /* noop */ }
    g.textAlign = 'center'; g.fillStyle = soft; g.font = '600 17px Montserrat'; g.fillText(d.url.replace(/^https?:\/\//, ''), qx + q / 2, qy + q + 34)
    g.textAlign = 'right'; g.fillStyle = soft; g.font = '600 20px Montserrat'
    g.fillText(t.cert.verify, qx - 24, qy + 62)
    g.fillStyle = ink; g.font = '800 28px Montserrat'; g.fillText(d.code, qx - 24, qy + 102)
  }
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'))
}

/** Buraxılmış sertifikatı (və ya serverə çatmadıqda — yerli məlumatla) çəkib yükləyir. */
export async function downloadCertificate(kind: IssuedCert['kind'], ref: string, local: Omit<CertView, 'code' | 'url' | 'design'>, file: string) {
  const s = await issueCert(kind, ref).catch(() => null)
  const view: CertView = s ? { ...local, name: s.name || local.name, quiz: s.title || local.quiz, date: new Date(s.date), trainer: s.trainer || local.trainer, code: s.id, url: s.url, design: s.design } : local
  const blob = await renderCertificate(view)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = file; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
