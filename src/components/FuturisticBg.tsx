/** Tünd fonda isti parıltılar + perspektiv tor (futuristik). */
export function FuturisticBg({ floor = true, intensity = 1 }: { floor?: boolean; intensity?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="orb" style={{ width: 520, height: 520, background: '#E8202A', top: '-12%', left: '-10%', opacity: 0.35 * intensity }} />
      <div className="orb" style={{ width: 460, height: 460, background: '#FF8A1A', top: '-8%', right: '-12%', opacity: 0.3 * intensity, animationDelay: '-5s' }} />
      <div className="orb" style={{ width: 380, height: 380, background: '#7C3AED', bottom: '-14%', left: '30%', opacity: 0.16 * intensity, animationDelay: '-9s' }} />
      {floor && <div className="grid-floor" />}
      <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.08) 1px, transparent 1px)', backgroundSize: '28px 28px', maskImage: 'radial-gradient(ellipse at center, #000 30%, transparent 75%)' }} />
    </div>
  )
}
