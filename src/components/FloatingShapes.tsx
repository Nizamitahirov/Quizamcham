import { useMemo } from 'react'

const SHAPES = ['▲', '◆', '●', '■', '★', '⬢', '✦']

export function FloatingShapes({ count = 12 }: { count?: number }) {
  const items = useMemo(
    () => Array.from({ length: count }, (_, i) => ({
      i, s: SHAPES[i % SHAPES.length], left: Math.random() * 100, size: 18 + Math.random() * 50, dur: 20 + Math.random() * 24, delay: -Math.random() * 30,
      color: i % 3 === 0 ? '#FF8A1A' : i % 3 === 1 ? '#E8202A' : '#ffffff',
    })),
    [count],
  )
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {items.map((it) => (
        <span key={it.i} className="float-shape" style={{ left: `${it.left}%`, fontSize: it.size, color: it.color, animationDuration: `${it.dur}s`, animationDelay: `${it.delay}s` }}>
          {it.s}
        </span>
      ))}
    </div>
  )
}
