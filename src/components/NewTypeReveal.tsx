import { t } from '../i18n/az'
import type { Hotspot } from '../types'

interface RevealLike { pairs?: { left: string; right: string }[]; blanks?: string[][]; hotspot?: Hotspot }

/**
 * Yeni sual növlərinin düzgün cavabı: uyğun cütlər, boşluqların cavabları, şəkildə düzgün sahə (+ oyunçuların nöqtələri).
 * big — host (proyektor) ekranı üçün.
 */
export function NewTypeReveal({ type, rv, imageUrl, points = [], big = false }: { type: string; rv: RevealLike; imageUrl?: string; points?: string[]; big?: boolean }) {
  if (type === 'match' && rv.pairs?.length) return (
    <ul className={`flex flex-col ${big ? 'gap-3' : 'gap-1.5'}`}>
      {rv.pairs.map((p, i) => (
        <li key={i} className={`flex items-center gap-3 rounded-2xl bg-green-600/90 font-bold text-white ${big ? 'px-6 py-3 text-3xl' : 'px-3 py-2 text-sm'}`}>
          <span className="min-w-0 flex-1">{p.left}</span><span aria-hidden>⇄</span><span className="min-w-0 flex-1 text-right">{p.right}</span>
        </li>
      ))}
    </ul>
  )
  if (type === 'fill' && rv.blanks?.length) return (
    <ol className={`list-decimal pl-6 font-bold ${big ? 'space-y-2 text-4xl' : 'text-base'}`}>
      {rv.blanks.map((alts, i) => <li key={i}>{alts.join(' / ')}</li>)}
    </ol>
  )
  if (type === 'hotspot' && rv.hotspot && imageUrl) {
    const h = rv.hotspot
    return (
      <div className="relative mx-auto inline-block max-w-full overflow-hidden rounded-2xl">
        <img src={imageUrl} alt="" className={`block max-w-full ${big ? 'max-h-[55vh]' : 'max-h-56'}`} />
        <span className="pointer-events-none absolute rounded-full border-4 border-green-400 bg-green-400/30" aria-label={t.game.correctAnswer}
          style={{ left: `${h.x}%`, top: `${h.y}%`, width: `${h.r * 2}%`, aspectRatio: '1', transform: 'translate(-50%, -50%)' }} />
        {points.slice(0, 300).map((p, i) => {
          const [x, y] = p.split(',').map(Number)
          if (!Number.isFinite(x) || !Number.isFinite(y)) return null
          const ok = Math.hypot(x - h.x, y - h.y) <= h.r
          return <span key={i} className={`pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white ${ok ? 'bg-green-500' : 'bg-red-500'}`} style={{ left: `${x}%`, top: `${y}%` }} />
        })}
      </div>
    )
  }
  return null
}
