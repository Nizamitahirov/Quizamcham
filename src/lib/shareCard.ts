import { avatarUri } from '../components/Avatar'
import type { AvatarData } from '../types'

interface CardData { name: string; title: string; place: number; total: number; score: number; accuracy: number; streak: number; avatar: AvatarData; awards: string[] }

const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src })

/** 1080×1350 nəticə kartı (Instagram/LinkedIn üçün). */
export async function renderShareCard(d: CardData): Promise<Blob> {
  await document.fonts?.ready
  const W = 1080, H = 1350
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = '#0A0B16'; g.fillRect(0, 0, W, H)
  const glow = (x: number, y: number, r: number, col: string) => { const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, 'transparent'); g.fillStyle = rg; g.fillRect(0, 0, W, H) }
  glow(1000, 80, 700, 'rgba(255,122,26,.55)'); glow(60, 1300, 760, 'rgba(232,32,42,.55)')
  const grad = g.createLinearGradient(0, 0, W, 0); grad.addColorStop(0, '#E8202A'); grad.addColorStop(1, '#FF8A1A')
  // loqo
  g.fillStyle = grad; roundRect(g, 80, 80, 84, 84, 26); g.fill()
  g.fillStyle = '#fff'; g.font = '900 52px Montserrat'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Q', 122, 124)
  g.textAlign = 'left'; g.font = '900 46px Montserrat'; g.fillText('Quiz', 190, 124)
  const qw = g.measureText('Quiz').width; g.fillStyle = grad; g.fillText('amcham', 190 + qw, 124)
  // avatar
  const img = await loadImg(await avatarUri(d.avatar.style, d.avatar.seed))
  g.save(); g.beginPath(); g.arc(W / 2, 420, 170, 0, Math.PI * 2); g.fillStyle = grad; g.fill(); g.beginPath(); g.arc(W / 2, 420, 156, 0, Math.PI * 2); g.clip(); g.drawImage(img, W / 2 - 156, 264, 312, 312); g.restore()
  if (d.avatar.accessory) { g.font = '110px serif'; g.textAlign = 'center'; g.fillText(d.avatar.accessory, W / 2 + 140, 290) }
  g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = '800 58px Montserrat'; g.fillText(d.name, W / 2, 660)
  g.font = '900 170px Montserrat'; g.fillStyle = grad; g.fillText(`#${d.place}`, W / 2, 820)
  g.fillStyle = 'rgba(255,255,255,.6)'; g.font = '600 34px Montserrat'; g.fillText(`${d.total} iştirakçı arasında`, W / 2, 925)
  // statistikalar
  const stats = [[d.score.toLocaleString('az-AZ'), 'xal'], [`${d.accuracy}%`, 'dəqiqlik'], [`🔥 ${d.streak}`, 'seriya']]
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
