/**
 * 1-ci / 2-ci / 3-cü yer nişanı (rozet + metal medal + dəfnə + lentlər).
 * Tək mənbə: SVG sətri — həm UI-da, həm sertifikat canvas-ında istifadə olunur.
 * withText=false: canvas üçün (SVG şəkli veb-şrifti görmür, mətni canvas Montserrat ilə yazır).
 */
export type Place = 1 | 2 | 3

const METAL: Record<Place, { hi: string; mid: string; lo: string; ring: string; edge: string; ink: string }> = {
  1: { hi: '#FFF6CF', mid: '#F7C948', lo: '#B7791F', ring: '#FFE9A3', edge: '#8A5A12', ink: '#5B3A06' },
  2: { hi: '#FFFFFF', mid: '#D3DAE3', lo: '#7C8796', ring: '#F1F5F9', edge: '#4B5563', ink: '#334155' },
  3: { hi: '#FFE6CC', mid: '#E0904F', lo: '#8A4B1F', ring: '#F8C9A0', edge: '#5C2F12', ink: '#4A230B' },
}

function rosette(cx: number, cy: number, rOut: number, rIn: number, n: number) {
  const pts: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? rOut : rIn
    const a = (Math.PI * i) / n - Math.PI / 2
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`)
  }
  return pts.join(' ')
}

function laurel(cx: number, cy: number, r: number, side: 1 | -1, color: string) {
  let out = ''
  for (let i = 0; i < 7; i++) {
    const a = Math.PI / 2 + side * (0.35 + i * 0.2) // altdan yuxarı
    const x = cx + r * Math.cos(a)
    const y = cy + r * Math.sin(a)
    const rot = (a * 180) / Math.PI + (side === 1 ? 60 : 120)
    out += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="7.5" ry="3.4" transform="rotate(${rot.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${color}" opacity=".85"/>`
  }
  return out
}

export function placeBadgeSvg(place: Place, opts: { withText?: boolean; label?: string } = {}): string {
  const m = METAL[place]
  const id = `b${place}`
  const text = opts.withText !== false
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 260" width="200" height="260">
  <defs>
    <linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E8202A"/><stop offset="1" stop-color="#FF8A1A"/></linearGradient>
    <linearGradient id="${id}m" x1="0.15" y1="0.05" x2="0.85" y2="0.95"><stop offset="0" stop-color="${m.hi}"/><stop offset=".45" stop-color="${m.mid}"/><stop offset="1" stop-color="${m.lo}"/></linearGradient>
    <linearGradient id="${id}e" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m.mid}"/><stop offset="1" stop-color="${m.edge}"/></linearGradient>
    <radialGradient id="${id}s" cx=".32" cy=".26" r=".55"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <filter id="${id}d" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#0F1129" flood-opacity=".35"/></filter>
  </defs>
  <g filter="url(#${id}d)">
    <path d="M62 128 L96 140 L84 252 L68 236 L48 248 Z" fill="url(#${id}r)"/>
    <path d="M138 128 L104 140 L116 252 L132 236 L152 248 Z" fill="url(#${id}r)"/>
    <path d="M70 140 L88 146 L80 232 L72 224 Z" fill="#fff" opacity=".18"/>
    <path d="M130 140 L112 146 L120 232 L128 224 Z" fill="#fff" opacity=".18"/>
    <polygon points="${rosette(100, 100, 94, 84, 24)}" fill="url(#${id}e)"/>
    <circle cx="100" cy="100" r="78" fill="url(#${id}m)"/>
    <circle cx="100" cy="100" r="66" fill="none" stroke="${m.ring}" stroke-width="3"/>
    <circle cx="100" cy="100" r="60" fill="none" stroke="${m.edge}" stroke-width="1.2" stroke-dasharray="2 4" opacity=".55"/>
    ${laurel(100, 100, 52, 1, m.edge)}${laurel(100, 100, 52, -1, m.edge)}
    <path d="M100 40 l4.2 8.6 9.4 1.4 -6.8 6.6 1.6 9.4 -8.4 -4.4 -8.4 4.4 1.6 -9.4 -6.8 -6.6 9.4 -1.4z" fill="${m.edge}" opacity=".8"/>
    <circle cx="100" cy="100" r="78" fill="url(#${id}s)"/>
  </g>
  ${text ? `<text x="100" y="122" text-anchor="middle" font-family="Montserrat, Arial Black, sans-serif" font-weight="900" font-size="64" fill="${m.ink}">${place}</text>
  <text x="100" y="146" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-weight="800" font-size="13" letter-spacing="2" fill="${m.ink}">${opts.label ?? ''}</text>` : ''}
</svg>`
}

export const badgeInk = (place: Place) => METAL[place].ink

export function badgeImage(place: Place): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = rej
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(placeBadgeSvg(place, { withText: false }))}`
  })
}
