import { useMemo } from 'react'

const SHAPES = ['▲', '◆', '●', '■', '★', '⬢', '✦']

export function FloatingShapes({ count = 14 }: { count?: number }) {
  const items = useMemo(
    () => Array.from({ length: count }, (_, i) => ({
      i, s: SHAPES[i % SHAPES.length], left: Math.random() * 100, size: 24 + Math.random() * 70, dur: 18 + Math.random() * 22, delay: -Math.random() * 30,
    })),
    [count],
  )
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {items.map((it) => (
        <span key={it.i} className="float-shape text-white" style={{ left: `${it.left}%`, fontSize: it.size, animationDuration: `${it.dur}s`, animationDelay: `${it.delay}s` }}>
          {it.s}
        </span>
      ))}
    </div>
  )
}
