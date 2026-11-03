import confetti from 'canvas-confetti'

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const COLORS = ['#E4202E', '#FF7A1F', '#FFD166', '#2563EB', '#16A34A', '#7C3AED', '#ffffff']

export function burst(power = 1) {
  if (reduced()) return
  void confetti({ particleCount: Math.round(80 * power), spread: 70 + 30 * power, origin: { y: 0.65 }, colors: COLORS, disableForReducedMotion: true })
}

export function celebrate(durationMs = 4000) {
  if (reduced()) return
  const end = Date.now() + durationMs
  const frame = () => {
    void confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: COLORS })
    void confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: COLORS })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
  setTimeout(() => void confetti({ particleCount: 200, spread: 160, startVelocity: 45, origin: { y: 0.4 }, colors: COLORS }), 300)
}
