import { badgeImage, badgeInk, type Place } from './badge'
import { fmtDate } from './format'
import { avatarUri } from '../components/Avatar'
import { LOCALE, t } from '../i18n/az'
import type { AvatarData } from '../types'

interface CardData { name: string; title: string; place: number; total: number; score: number; accuracy: number; streak: number; avatar: AvatarData; awards: string[] }

const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src })

/** 1080×1350 nəticə kartı (Instagram/LinkedIn üçün). */
export async function renderShareCard(d: CardData): Promise<Blob> {
  await document.fonts?.ready
  await document.fonts?.load('800 72px Figtree').catch(() => {})
  const W = 1080, H = 1350
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = '#0A0B16'; g.fillRect(0, 0, W, H)
  const glow = (x: number, y: number, r: number, col: string) => { const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, 'transparent'); g.fillStyle = rg; g.fillRect(0, 0, W, H) }
  glow(1000, 80, 700, 'rgba(255,122,26,.55)'); glow(60, 1300, 760, 'rgba(232,32,42,.55)')
  const grad = g.createLinearGradient(0, 0, W, 0); grad.addColorStop(0, '#E8202A'); grad.addColorStop(1, '#FF8A1A')
  // loqo
  g.textBaseline = 'alphabetic'
  drawWordmark(g, 80, 150, 72, '#ffffff', 'left')
  g.textBaseline = 'middle'
  if (d.place >= 1 && d.place <= 3) await drawBadge(g, d.place as Place, W - 250, 50, 170)
  // avatar
  const img = await loadImg(await avatarUri(d.avatar.style, d.avatar.seed))
  g.save(); g.beginPath(); g.arc(W / 2, 420, 170, 0, Math.PI * 2); g.fillStyle = grad; g.fill(); g.beginPath(); g.arc(W / 2, 420, 156, 0, Math.PI * 2); g.clip(); g.drawImage(img, W / 2 - 156, 264, 312, 312); g.restore()
  if (d.avatar.accessory) { g.font = '110px serif'; g.textAlign = 'center'; g.fillText(d.avatar.accessory, W / 2 + 140, 290) }
  g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = '800 58px Montserrat'; g.fillText(d.name, W / 2, 660)
  g.font = '900 170px Montserrat'; g.fillStyle = grad; g.fillText(`#${d.place}`, W / 2, 820)
  g.fillStyle = 'rgba(255,255,255,.6)'; g.font = '600 34px Montserrat'; g.fillText(t.extra.cardAmong(d.total), W / 2, 925)
  // statistikalar
  const stats = [[d.score.toLocaleString(LOCALE), t.extra.cardPoints], [`${d.accuracy}%`, t.extra.cardAccuracy], [`🔥 ${d.streak}`, t.extra.cardStreak]]
  stats.forEach(([v, l], i) => {
    const x = 120 + i * 290
    g.fillStyle = 'rgba(255,255,255,.07)'; roundRect(g, x, 990, 260, 150, 28); g.fill()
    g.fillStyle = '#fff'; g.font = '900 50px Montserrat'; g.fillText(v, x + 130, 1052)
    g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '600 28px Montserrat'; g.fillText(l, x + 130, 1105)
  })
  if (d.awards.length) { g.fillStyle = '#FFD166'; g.font = '800 34px Montserrat'; g.fillText(d.awards.join('   '), W / 2, 1200) }
  g.fillStyle = 'rgba(255,255,255,.45)'; g.font = '600 28px Montserrat'; g.fillText(d.title.slice(0, 60), W / 2, 1275)
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'))
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
}

interface CertData { name: string; quiz: string; place: number; total: number; score: number; trainer?: string; date: Date }

/** A4 üfüqi (1754×1240) iştirak sertifikatı — PNG. */
export async function renderCertificate(d: CertData, labels: { title: string; given: string; completed: string; place: string; score: string; trainer: string; date: string }): Promise<Blob> {
  await document.fonts?.ready
  await document.fonts?.load('800 72px Figtree').catch(() => {})
  const W = 1754, H = 1240
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H)
  const grad = g.createLinearGradient(0, 0, W, H); grad.addColorStop(0, '#E8202A'); grad.addColorStop(1, '#FF8A1A')
  // çərçivə
  g.strokeStyle = grad; g.lineWidth = 18; roundRect(g, 40, 40, W - 80, H - 80, 36); g.stroke()
  g.strokeStyle = 'rgba(232,32,42,.25)'; g.lineWidth = 3; roundRect(g, 72, 72, W - 144, H - 144, 26); g.stroke()
  // künc parıltıları
  const glow = (x: number, y: number, r: number, col: string) => { const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, 'transparent'); g.fillStyle = rg; g.fillRect(0, 0, W, H) }
  glow(W - 120, 120, 420, 'rgba(255,138,26,.18)'); glow(120, H - 120, 420, 'rgba(232,32,42,.14)')
  // loqo
  g.textBaseline = 'alphabetic'
  drawWordmark(g, W / 2, 240, 96, '#0F1129', 'center')
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillStyle = grad; g.font = '900 74px Montserrat'; g.fillText(labels.title, W / 2, 380)
  g.fillStyle = '#6B6F8A'; g.font = '600 32px Montserrat'; g.fillText(labels.given, W / 2, 470)
  g.fillStyle = '#0F1129'; g.font = '900 96px Montserrat'; g.fillText(d.name, W / 2, 580)
  g.fillStyle = grad; g.fillRect(W / 2 - 260, 640, 520, 5)
  g.fillStyle = '#6B6F8A'; g.font = '600 32px Montserrat'; g.fillText(labels.completed, W / 2, 712)
  g.fillStyle = '#0F1129'; g.font = '800 46px Montserrat'; g.fillText(`“${d.quiz.slice(0, 60)}”`, W / 2, 785)
  g.fillStyle = '#E8202A'; g.font = '800 36px Montserrat'; g.fillText(`${labels.place}  ·  ${labels.score}`, W / 2, 865)
  // 1–3-cü yerlər üçün nişan (imzaların arasında, möhür kimi)
  if (d.place >= 1 && d.place <= 3) await drawBadge(g, d.place as Place, W / 2 - 95, 884, 190)
  // imzalar
  g.textAlign = 'left'; g.fillStyle = '#0F1129'; g.font = '700 30px Montserrat'
  g.fillText(d.trainer || '—', 220, 1040); g.fillStyle = '#C9CCDA'; g.fillRect(220, 1065, 420, 3); g.fillStyle = '#6B6F8A'; g.font = '600 24px Montserrat'; g.fillText(labels.trainer, 220, 1100)
  g.textAlign = 'right'; g.fillStyle = '#0F1129'; g.font = '700 30px Montserrat'
  g.fillText(fmtDate(d.date), W - 220, 1040)
  g.fillStyle = '#C9CCDA'; g.fillRect(W - 640, 1065, 420, 3); g.fillStyle = '#6B6F8A'; g.font = '600 24px Montserrat'; g.fillText(labels.date, W - 220, 1100)
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'))
}

/** "Jabr" loqosu (Figtree 800, sıx hərf aralığı) + brend qradiyentli nöqtə — UI loqosu ilə eyni. y — əsas xətt. */
function drawWordmark(g: CanvasRenderingContext2D, x: number, y: number, px: number, color: string, align: 'left' | 'center') {
  g.save()
  g.font = `800 ${px}px Figtree, Montserrat, sans-serif`
  g.textAlign = 'left'
  g.textBaseline = 'alphabetic'
  const track = -0.035 * px
  const chars = [...'Jabr']
  const widths = chars.map((c) => g.measureText(c).width)
  const w = widths.reduce((a, b) => a + b, 0) + track * (chars.length - 1)
  const r = px * 0.13, gap = px * 0.07
  const total = w + gap + 2 * r
  let cx = align === 'center' ? x - total / 2 : x
  g.fillStyle = color
  chars.forEach((c, i) => { g.fillText(c, cx, y); cx += widths[i] + track })
  const dx = cx + gap + r, dy = y - r
  const grad = g.createLinearGradient(dx - r, dy - r, dx + r, dy + r)
  grad.addColorStop(0, '#E8202A'); grad.addColorStop(1, '#FF8A1A')
  g.fillStyle = grad
  g.beginPath(); g.arc(dx, dy, r, 0, Math.PI * 2); g.fill()
  g.restore()
}

/** Yer nişanı: SVG forması + Montserrat ilə rəqəm və "YER". size — en (px), hündürlük = 1.3 × en. */
async function drawBadge(g: CanvasRenderingContext2D, place: Place, x: number, y: number, size: number) {
  const img = await badgeImage(place)
  const s = size / 200
  g.drawImage(img, x, y, size, size * 1.3)
  g.save()
  g.fillStyle = badgeInk(place)
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'
  g.font = `900 ${Math.round(64 * s)}px Montserrat`
  g.fillText(String(place), x + 100 * s, y + 122 * s)
  g.font = `800 ${Math.round(13 * s)}px Montserrat`
  g.fillText(t.cert.badgeLabel.split('').join(String.fromCharCode(8202)), x + 100 * s, y + 146 * s)
  g.restore()
}
