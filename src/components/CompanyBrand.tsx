import type { CSSProperties } from 'react'
import type { Brand } from '../types'
import { Logo } from './Brand'

const HEX = /^#[0-9a-fA-F]{6}$/
/** #RRGGBB rəngini açıqlaşdırır/tündləşdirir (k: -1..1). */
function mix(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16), to = k > 0 ? 255 : 0, a = Math.abs(k)
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (to - v) * a))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
/** Brend rəngi oyun ekranının vurğu rəngini əvəz edir (qradiyent, parıltı, düymələr) — CSS dəyişənləri ilə. */
export function brandVars(brand?: Brand | null): CSSProperties {
  const c = brand?.color
  if (!c || !HEX.test(c)) return {}
  return {
    '--brand': c, '--brand-2': mix(c, 0.22), '--brand-3': mix(c, 0.45), '--color-brand': c, '--color-brand2': mix(c, 0.22),
    '--grad': `linear-gradient(135deg, ${mix(c, -0.12)} 0%, ${c} 52%, ${mix(c, 0.28)} 100%)`,
    '--glow': `0 12px 40px -12px ${c}99`,
  } as CSSProperties
}
/** Şirkət loqosu (və ya adı); brend yoxdursa — Jabr loqosu. */
export function BrandLogo({ brand, size = 36, mono }: { brand?: Brand | null; size?: number; mono?: boolean }) {
  if (brand?.logo) return <img src={brand.logo} alt={brand.name || ''} draggable={false} className="w-auto max-w-[40vw] object-contain" style={{ height: size * 1.15 }} />
  if (brand?.name) return <span className="truncate font-display font-black tracking-tight text-[#fff]" style={{ fontSize: size * 0.7 }}>{brand.name}</span>
  return <Logo size={size} mono={mono} />
}
