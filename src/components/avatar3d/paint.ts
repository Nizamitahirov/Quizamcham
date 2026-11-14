/**
 * 3D avatar üçün çəkilən toxumalar (canvas): üz (gözlər, qaşlar, ağız, yanaq, saqqal) və üst geyim (naxış, detal).
 * Üz ayrıca şəffaf "etiket" kimi başın ön hissəsinə çəkilir — ifadələr təmiz və oyuncaq fiquru üslubunda alınır.
 */
import * as THREE from 'three'
import type { AvatarConfig } from '../../lib/avatar3d'

export function shade(hex: string, k: number) {
  const c = new THREE.Color(hex); const h = { h: 0, s: 0, l: 0 }; c.getHSL(h)
  return `#${new THREE.Color().setHSL(h.h, h.s, Math.max(0, Math.min(1, h.l + k))).getHexString()}`
}
const lum = (hex: string) => { const c = new THREE.Color(hex); return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b }
/** Fonla kontrastlı mürəkkəb rəngi (açıq → tünd, tünd → açıq). */
export const ink = (bg: string) => (lum(bg) > 0.55 ? '#1B1D2E' : '#FFFFFF')

const INK = '#2A1A1F'
type G = CanvasRenderingContext2D
const tex = (cv: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t }
const canvas = (w: number, h: number) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return [cv, cv.getContext('2d')!] as const }
/** Sabit təsadüfi ardıcıllıq (tük, çil nöqtələri hər çəkilişdə eyni olsun). */
const rng = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }

// ───────────────────────── ÜZ ─────────────────────────
export const FACE = { size: 512, phi: 0.85, theta0: 0.75, thetaLen: 1.7, eyeX: 98, eyeY: 262, mouthY: 356 }

function arcEye(g: G, cx: number, cy: number, up: boolean) {
  g.strokeStyle = INK; g.lineWidth = 8; g.lineCap = 'round'
  g.beginPath()
  if (up) { g.moveTo(cx - 30, cy + 10); g.quadraticCurveTo(cx, cy - 34, cx + 30, cy + 10) } else { g.moveTo(cx - 30, cy - 2); g.quadraticCurveTo(cx, cy + 20, cx + 30, cy - 2) }
  g.stroke()
}
function star(g: G, cx: number, cy: number, r1: number, r2: number) {
  g.beginPath()
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? r2 : r1; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) }
  g.closePath()
}
function openEye(g: G, cx: number, cy: number, m: 1 | -1, kind: AvatarConfig['eyes'], color: string) {
  const rx = 31, ry = 39
  g.save()
  g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  if (kind === 'sleepy') { g.clip(); g.beginPath(); g.rect(cx - 40, cy - 4, 80, 60) }
  if (kind === 'angry') { g.clip(); g.beginPath(); g.moveTo(cx - m * 44, cy - 2); g.lineTo(cx + m * 44, cy - 36); g.lineTo(cx + m * 44, cy + 50); g.lineTo(cx - m * 44, cy + 50); g.closePath() }
  g.clip()
  g.fillStyle = '#FFFFFF'; g.fillRect(cx - 40, cy - 50, 80, 100)
  // qüzehli qişa: yuxarıda tünd, aşağıda açıq
  const ir = kind === 'sparkle' ? 31 : 26, iy = cy + 5
  const gr = g.createLinearGradient(0, iy - ir, 0, iy + ir); gr.addColorStop(0, shade(color, -0.16)); gr.addColorStop(1, shade(color, 0.16))
  g.fillStyle = gr; g.beginPath(); g.arc(cx, iy, ir, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#16111B'; g.beginPath(); g.arc(cx, iy, ir * 0.52, 0, Math.PI * 2); g.fill()
  // parıltılar (işıq mənbəyi hər iki göz üçün eyni tərəfdədir)
  g.fillStyle = '#FFFFFF'
  g.beginPath(); g.arc(cx - 10, iy - 11, kind === 'sparkle' ? 10 : 8, 0, Math.PI * 2); g.fill()
  g.beginPath(); g.arc(cx + 11, iy + 12, 4, 0, Math.PI * 2); g.fill()
  if (kind === 'sparkle') { g.beginPath(); g.arc(cx + 13, iy - 8, 3.5, 0, Math.PI * 2); g.fill() }
  g.restore()
  // kontur və üst göz qapağı
  g.strokeStyle = INK; g.lineCap = 'round'
  if (kind === 'sleepy') { g.lineWidth = 8; g.beginPath(); g.moveTo(cx - 33, cy - 4); g.lineTo(cx + 33, cy - 4); g.stroke() }
  else if (kind === 'angry') { g.lineWidth = 9; g.beginPath(); g.moveTo(cx - m * 36, cy - 5); g.lineTo(cx + m * 36, cy - 32); g.stroke() }
  else { g.lineWidth = 8; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke() }
  g.globalAlpha = 0.28; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1
  if (kind === 'lashes') {
    g.lineWidth = 6
    for (const [a, l] of [[-0.25, 17], [-0.6, 19], [-0.95, 16]] as const) {
      const x0 = cx + m * Math.cos(a) * rx, y0 = cy + Math.sin(a) * ry
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + m * Math.cos(a - 0.25) * l, y0 + Math.sin(a - 0.25) * l); g.stroke()
    }
  }
}
function eye(g: G, cx: number, cy: number, m: 1 | -1, kind: AvatarConfig['eyes'], color: string, blink: boolean) {
  if (kind === 'happy' || (kind === 'wink' && m === 1)) return arcEye(g, cx, cy, true)
  if (blink) return arcEye(g, cx, cy + 6, false)
  if (kind === 'star') {
    star(g, cx, cy, 38, 17); g.fillStyle = '#FFC531'; g.fill(); g.strokeStyle = INK; g.lineWidth = 6; g.lineJoin = 'round'; g.stroke()
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(cx - 8, cy - 8, 6, 0, Math.PI * 2); g.fill()
    return
  }
  openEye(g, cx, cy, m, kind, color)
}
function brow(g: G, cx: number, cy: number, m: 1 | -1, kind: AvatarConfig['brows'], color: string) {
  if (kind === 'none') return
  g.strokeStyle = color; g.lineCap = 'round'; g.lineWidth = kind === 'thick' ? 15 : 9
  const inner = cx - m * 30, outer = cx + m * 32
  let yi = cy, yo = cy + 4, lift = -12
  if (kind === 'raised' && m === 1) { yi -= 12; yo -= 10; lift = -20 }
  if (kind === 'angry') { yi += 14; yo -= 10; lift = -2 }
  if (kind === 'worried') { yi -= 12; yo += 10; lift = -2 }
  g.beginPath(); g.moveTo(inner, yi); g.quadraticCurveTo(cx, (yi + yo) / 2 + lift, outer, yo); g.stroke()
}
function mouth(g: G, kind: AvatarConfig['mouth'], cy: number) {
  const cx = 256
  g.strokeStyle = INK; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 8
  const smile = (w: number, d: number, y = cy) => { g.beginPath(); g.moveTo(cx - w, y); g.quadraticCurveTo(cx, y + d, cx + w, y); g.stroke() }
  if (kind === 'smile') smile(40, 34)
  else if (kind === 'neutral') { g.beginPath(); g.moveTo(cx - 26, cy + 10); g.lineTo(cx + 26, cy + 10); g.stroke() }
  else if (kind === 'smirk') { g.beginPath(); g.moveTo(cx - 30, cy + 12); g.quadraticCurveTo(cx + 6, cy + 24, cx + 38, cy - 4); g.stroke() }
  else if (kind === 'o') { g.fillStyle = '#5A1F28'; g.beginPath(); g.ellipse(cx, cy + 12, 17, 22, 0, 0, Math.PI * 2); g.fill(); g.stroke() }
  else if (kind === 'cat') { g.beginPath(); g.moveTo(cx - 36, cy); g.quadraticCurveTo(cx - 18, cy + 26, cx, cy + 2); g.quadraticCurveTo(cx + 18, cy + 26, cx + 36, cy); g.stroke() }
  else if (kind === 'tongue') {
    smile(40, 30)
    g.fillStyle = '#FF7D8E'; g.beginPath(); g.moveTo(cx - 4, cy + 15); g.lineTo(cx + 26, cy + 12); g.quadraticCurveTo(cx + 30, cy + 44, cx + 12, cy + 44); g.quadraticCurveTo(cx - 6, cy + 44, cx - 4, cy + 15); g.fill(); g.lineWidth = 5; g.stroke()
  } else {
    // grin / open: yuxarısı düz, aşağısı qövs
    const w = kind === 'grin' ? 46 : 40, d = kind === 'grin' ? 44 : 62
    g.beginPath(); g.moveTo(cx - w, cy - 2); g.lineTo(cx + w, cy - 2); g.quadraticCurveTo(cx + w - 4, cy + d, cx, cy + d); g.quadraticCurveTo(cx - w + 4, cy + d, cx - w, cy - 2); g.closePath()
    g.fillStyle = kind === 'grin' ? '#FFFFFF' : '#5A1F28'; g.fill()
    if (kind === 'open') {
      g.save(); g.clip()
      g.fillStyle = '#FFFFFF'; g.fillRect(cx - w, cy - 4, w * 2, 15)
      g.fillStyle = '#FF7D8E'; g.beginPath(); g.ellipse(cx, cy + d + 6, 26, 24, 0, 0, Math.PI * 2); g.fill()
      g.restore()
    }
    g.stroke()
  }
}
function facial(g: G, kind: AvatarConfig['facial'], color: string, my: number) {
  if (kind === 'none') return
  const cx = 256
  if (kind === 'stubble') {
    const r = rng(7); g.fillStyle = color; g.globalAlpha = 0.42
    for (let i = 0; i < 520; i++) {
      const x = cx + (r() * 2 - 1) * 172, y = my - 42 + r() * 150
      const dx = (x - cx) / 172, edge = 1 - dx * dx
      if (y > my + 96 * edge + 8 || (Math.abs(x - cx) < 52 && y > my - 8 && y < my + 40) || (y < my - 16 && Math.abs(x - cx) < 34)) continue
      g.beginPath(); g.arc(x, y, 1.7, 0, Math.PI * 2); g.fill()
    }
    g.globalAlpha = 1
    return
  }
  g.fillStyle = color
  const stache = (w: number, h: number) => {
    g.beginPath(); g.moveTo(cx, my - 30)
    g.bezierCurveTo(cx + w * 0.4, my - 38 - h * 0.3, cx + w, my - 30, cx + w + 6, my - 6)
    g.bezierCurveTo(cx + w * 0.6, my - 12, cx + w * 0.3, my - 12 + h * 0.2, cx, my - 14)
    g.bezierCurveTo(cx - w * 0.3, my - 12 + h * 0.2, cx - w * 0.6, my - 12, cx - w - 6, my - 6)
    g.bezierCurveTo(cx - w, my - 30, cx - w * 0.4, my - 38 - h * 0.3, cx, my - 30)
    g.fill()
  }
  if (kind === 'mustache') stache(58, 18)
  if (kind === 'goatee') {
    stache(44, 12)
    g.beginPath(); g.moveTo(cx - 40, my + 38); g.quadraticCurveTo(cx, my + 26, cx + 40, my + 38); g.quadraticCurveTo(cx + 34, my + 104, cx, my + 106); g.quadraticCurveTo(cx - 34, my + 104, cx - 40, my + 38); g.fill()
  }
  if (kind === 'beard') {
    g.beginPath(); g.moveTo(52, 270)
    g.bezierCurveTo(56, 420, 170, 506, cx, 506); g.bezierCurveTo(342, 506, 456, 420, 460, 270)
    g.bezierCurveTo(430, 300, 400, 318, 372, 322); g.bezierCurveTo(330, 316, 290, my - 40, cx, my - 34)
    g.bezierCurveTo(222, my - 40, 182, 316, 140, 322); g.bezierCurveTo(112, 318, 82, 300, 52, 270)
    g.fill()
    // ağız ətrafı — bir az açıq (ağız görünsün)
    g.fillStyle = shade(color, lum(color) > 0.5 ? -0.08 : 0.07); g.beginPath(); g.ellipse(cx, my + 16, 60, 34, 0, 0, Math.PI * 2); g.fill()
  }
}

export function paintFace(cfg: AvatarConfig, blink: boolean): THREE.CanvasTexture {
  const [cv, g] = canvas(FACE.size, FACE.size)
  const { eyeX, eyeY, mouthY } = FACE
  if (cfg.blush) for (const m of [-1, 1]) {
    const x = 256 + m * 160, y = 326, gr = g.createRadialGradient(x, y, 4, x, y, 50)
    gr.addColorStop(0, 'rgba(255,92,105,.46)'); gr.addColorStop(1, 'rgba(255,92,105,0)')
    g.fillStyle = gr; g.fillRect(x - 52, y - 52, 104, 104)
  }
  if (cfg.freckles) {
    const r = rng(3); g.fillStyle = shade(cfg.skin, -0.2); g.globalAlpha = 0.75
    for (const m of [-1, 1]) for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(256 + m * (112 + r() * 78), 300 + r() * 34, 2.6 + r() * 1.6, 0, Math.PI * 2); g.fill() }
    g.globalAlpha = 1
  }
  // cizgilər iri çəkilir (oyuncaq üslubu): mərkəz ətrafında böyütmə
  const K = 1.28, CY = 300
  facial(g, cfg.facial, cfg.hairColor, CY + (mouthY - CY) * K)
  g.save(); g.translate(256, CY); g.scale(K, K); g.translate(-256, -CY)
  for (const m of [-1, 1] as const) eye(g, 256 + m * eyeX, eyeY, m, cfg.eyes, cfg.eyeColor, blink)
  const bc = lum(cfg.hairColor) > 0.6 ? shade(cfg.hairColor, -0.3) : shade(cfg.hairColor, -0.04)
  for (const m of [-1, 1] as const) brow(g, 256 + m * eyeX, eyeY - 62, m, cfg.brows, bc)
  mouth(g, cfg.mouth, mouthY)
  g.restore()
  return tex(cv)
}

// ───────────────────────── ÜST GEYİM ─────────────────────────
/** Gövdə toxuması: u — ətraf (0.5 = ön), v — hündürlük (Y0..Y1 xətti). */
export const TORSO = { y0: 0.46, y1: 1.1, w: 1024, h: 512 }
const ty = (y: number) => (1 - (y - TORSO.y0) / (TORSO.y1 - TORSO.y0)) * TORSO.h

function logo(g: G, cx: number, cy: number, s: number, color: string, dot: string) {
  g.fillStyle = color; g.font = `900 ${s}px Montserrat, 'Arial Black', Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText('J', cx - s * 0.12, cy)
  g.fillStyle = dot; g.beginPath(); g.arc(cx + s * 0.3, cy + s * 0.27, s * 0.1, 0, Math.PI * 2); g.fill()
}

export function paintTorso(cfg: AvatarConfig): THREE.CanvasTexture {
  const { w: W, h: H } = TORSO
  const [cv, g] = canvas(W, H)
  const c1 = cfg.topColor, c2 = cfg.topColor2, dark = shade(c1, -0.09), cx = W / 2
  const dress = cfg.top === 'dress'
  // üst geyimin ətəyi hansı hündürlükdə bitir (aşağısı — şalvarın beli)
  const hem = dress ? TORSO.y0 : cfg.top === 'tank' || cfg.top === 'tshirt' || cfg.top === 'jersey' || cfg.top === 'shirt' ? 0.6 : 0.56
  g.fillStyle = c1; g.fillRect(0, 0, W, H)
  if (cfg.top === 'sweater') { // toxunma naxışı
    g.strokeStyle = dark; g.lineWidth = 2; g.globalAlpha = 0.55
    for (let y = 8; y < H; y += 14) { g.beginPath(); for (let x = 0; x <= W; x += 16) g.lineTo(x, y + ((x / 16) % 2 ? 5 : 0)); g.stroke() }
    g.globalAlpha = 1
  }
  if (cfg.pattern === 'stripes') { g.fillStyle = c2; for (let y = ty(0.98); y < ty(hem) - 10; y += 62) g.fillRect(0, y, W, 28) }
  if (cfg.top === 'jersey') { g.fillStyle = c2; g.fillRect(W * 0.25 - 26, 0, 52, H); g.fillRect(W * 0.75 - 26, 0, 52, H) }
  // ───── detallar
  const front = (fn: () => void) => { g.save(); fn(); g.restore() }
  if (cfg.top === 'hoodie') front(() => {
    g.fillStyle = dark; g.strokeStyle = shade(c1, -0.16); g.lineWidth = 5
    const y0 = ty(0.78), y1 = ty(0.6)
    g.beginPath(); g.moveTo(cx - 105, y0); g.lineTo(cx + 105, y0); g.lineTo(cx + 138, y1); g.lineTo(cx - 138, y1); g.closePath(); g.fill(); g.stroke()
    g.strokeStyle = c2; g.lineWidth = 7; g.lineCap = 'round'
    for (const m of [-1, 1]) { g.beginPath(); g.moveTo(cx + m * 30, ty(1.04)); g.lineTo(cx + m * 34, ty(0.9)); g.stroke(); g.fillStyle = c2; g.beginPath(); g.arc(cx + m * 34, ty(0.9) + 6, 7, 0, Math.PI * 2); g.fill() }
  })
  if (cfg.top === 'jacket') front(() => {
    g.fillStyle = c2; g.fillRect(0, ty(hem + 0.07), W, 60); g.fillRect(0, 0, W, ty(1.03))
    g.strokeStyle = shade(c2, lum(c2) > 0.5 ? -0.22 : 0.22); g.lineWidth = 3
    for (let x = 0; x < W; x += 14) { g.beginPath(); g.moveTo(x, ty(hem + 0.07)); g.lineTo(x, H); g.stroke() }
    g.fillStyle = '#C9CDD6'; g.fillRect(cx - 5, 0, 10, H); g.fillStyle = '#8A8F9C'; for (let y = 6; y < H; y += 12) g.fillRect(cx - 5, y, 10, 3)
    g.strokeStyle = dark; g.lineWidth = 7; g.lineCap = 'round'
    for (const m of [-1, 1]) { g.beginPath(); g.moveTo(cx + m * 150, ty(0.8)); g.lineTo(cx + m * 118, ty(0.66)); g.stroke() }
  })
  if (cfg.top === 'sweater') front(() => {
    g.fillStyle = shade(c1, -0.06); g.fillRect(0, ty(hem + 0.06), W, 60); g.fillRect(0, 0, W, ty(1.02))
    g.strokeStyle = shade(c1, -0.17); g.lineWidth = 3
    for (let x = 0; x < W; x += 12) { g.beginPath(); g.moveTo(x, ty(hem + 0.06)); g.lineTo(x, H); g.moveTo(x, 0); g.lineTo(x, ty(1.02)); g.stroke() }
    if (cfg.pattern === 'solid') { g.fillStyle = c2; g.fillRect(0, ty(0.9), W, 20); g.fillRect(0, ty(0.9) + 30, W, 8) }
  })
  if (cfg.top === 'shirt') front(() => {
    g.strokeStyle = dark; g.lineWidth = 4; g.beginPath(); g.moveTo(cx - 16, 0); g.lineTo(cx - 16, H); g.moveTo(cx + 16, 0); g.lineTo(cx + 16, H); g.stroke()
    g.fillStyle = shade(c1, lum(c1) > 0.5 ? -0.3 : 0.4); for (let y = ty(0.82); y < ty(hem); y += 44) { g.beginPath(); g.arc(cx, y, 6, 0, Math.PI * 2); g.fill() }
    // yaxalıq və qalstuk
    g.fillStyle = c2; g.beginPath(); g.moveTo(cx - 15, ty(1.02)); g.lineTo(cx + 15, ty(1.02)); g.lineTo(cx + 10, ty(0.97)); g.lineTo(cx + 24, ty(0.74)); g.lineTo(cx, ty(0.68)); g.lineTo(cx - 24, ty(0.74)); g.lineTo(cx - 10, ty(0.97)); g.closePath(); g.fill()
    g.fillStyle = shade(c1, lum(c1) > 0.8 ? -0.07 : 0.1); g.strokeStyle = dark; g.lineWidth = 4
    for (const m of [-1, 1]) { g.beginPath(); g.moveTo(cx + m * 4, ty(1.0)); g.lineTo(cx + m * 96, ty(1.07)); g.lineTo(cx + m * 62, ty(0.92)); g.closePath(); g.fill(); g.stroke() }
  })
  if (cfg.top === 'tshirt' || cfg.top === 'jersey' || cfg.top === 'dress') front(() => {
    g.fillStyle = cfg.top === 'tshirt' ? dark : c2
    if (cfg.top === 'jersey') { g.beginPath(); g.moveTo(cx - 80, 0); g.lineTo(cx, ty(0.95)); g.lineTo(cx + 80, 0); g.lineTo(cx + 52, 0); g.lineTo(cx, ty(0.99)); g.lineTo(cx - 52, 0); g.closePath(); g.fill(); g.fillRect(0, 0, cx - 60, ty(1.05)); g.fillRect(cx + 60, 0, cx, ty(1.05)) }
    else g.fillRect(0, 0, W, ty(1.045))
  })
  if (cfg.top === 'tank') front(() => {
    // çiyinlər açıq: yuxarı hissə dəri rəngində, iki qayış
    g.fillStyle = cfg.skin; g.fillRect(0, 0, W, ty(0.97))
    g.fillStyle = c1
    for (const u of [0.5, 0, 1]) for (const m of [-1, 1]) g.fillRect(W * u + m * 118 - 30, 0, 60, ty(0.96))
    g.strokeStyle = dark; g.lineWidth = 5; g.beginPath(); g.moveTo(0, ty(0.97)); g.lineTo(W, ty(0.97)); g.stroke()
  })
  // ───── naxış: loqo / nömrə
  const number = String(cfg.number)
  if (cfg.pattern === 'logo' && cfg.top !== 'shirt') logo(g, cfg.top === 'jacket' ? cx - 96 : cx, ty(cfg.top === 'jacket' ? 0.9 : 0.86), cfg.top === 'jacket' ? 64 : 124, lum(c1) > 0.75 ? '#1B1D2E' : '#FFFFFF', lum(c1) > 0.75 || c1.toUpperCase() !== '#FF7A1A' ? '#FF7A1A' : '#FFFFFF')
  if ((cfg.pattern === 'number' || cfg.top === 'jersey') && cfg.top !== 'shirt') {
    g.fillStyle = cfg.top === 'jersey' || lum(c2) === lum(c1) ? ink(c1) : c2
    g.font = `900 ${cfg.pattern === 'logo' ? 0 : 150}px Montserrat, 'Arial Black', Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'
    if (cfg.pattern !== 'logo') g.fillText(number, cx, ty(0.84))
    if (cfg.top === 'jersey') { g.font = `900 130px Montserrat, 'Arial Black', Arial, sans-serif`; g.fillText(number, 0, ty(0.84)); g.fillText(number, W, ty(0.84)) }
  }
  // ───── şalvarın beli (ətəkdən aşağı)
  if (!dress) {
    const y = ty(hem)
    g.fillStyle = cfg.bottomColor; g.fillRect(0, y, W, H - y)
    g.fillStyle = shade(cfg.bottomColor, lum(cfg.bottomColor) > 0.5 ? -0.14 : 0.1); g.fillRect(0, y, W, 16)
    if (cfg.bottom === 'jeans' || cfg.bottom === 'cargo' || cfg.bottom === 'pants') { g.fillStyle = '#C9A35B'; g.fillRect(cx - 9, y + 2, 18, 12) }
  } else { g.fillStyle = c2; g.fillRect(0, ty(0.66), W, 14) }
  return tex(cv)
}
