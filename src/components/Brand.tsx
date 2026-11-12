/**
 * Jabr loqosu: "Jabr" sözü (Figtree 800, sıx hərf aralığı) + brend qradiyentli nöqtə.
 * Yalnız loqo bu şriftdədir; interfeys Montserrat-dadır.
 */
export const LOGO_FONT = '"Figtree", "Montserrat", sans-serif'
export const LOGO_DOT = 'linear-gradient(135deg,#E8202A,#FF8A1A)'
export const LOGO_TRACKING = -0.035 // em

export function Logo({ size = 40, dark = true, sub, mono }: { size?: number; dark?: boolean; sub?: string; mono?: boolean }) {
  const fs = Math.round(size * 0.86)
  const dot = Math.max(5, Math.round(fs * 0.26))
  return (
    <span className="inline-flex flex-col leading-none" aria-label="Jabr">
      <span className={`inline-flex items-baseline ${dark ? 'text-fg' : 'text-ink'}`} style={{ fontFamily: LOGO_FONT, fontWeight: 800, fontSize: fs, letterSpacing: `${LOGO_TRACKING}em` }}>
        Jabr
        <span aria-hidden className="inline-block shrink-0 rounded-full"
          style={{ width: dot, height: dot, marginLeft: Math.round(fs * 0.07), background: mono ? '#fff' : LOGO_DOT, boxShadow: mono ? undefined : '0 0 12px rgba(255,90,31,.55)' }} />
      </span>
      {sub && <span className={`mt-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] ${dark ? 'text-fg/55' : 'text-muted'}`}>{sub}</span>}
    </span>
  )
}

/** Yığcam nişan (ikonlar üçün): tünd kvadratda "J" + brend qradiyentli nöqtə. */
export function LogoMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center rounded-[28%] bg-night text-[#fff] ${className}`} style={{ width: size, height: size }} aria-hidden>
      <span className="inline-flex items-baseline" style={{ fontFamily: LOGO_FONT, fontSize: size * 0.56, fontWeight: 800, lineHeight: 1 }}>
        J<span className="ml-[0.08em] inline-block rounded-full" style={{ width: size * 0.15, height: size * 0.15, background: LOGO_DOT }} />
      </span>
    </span>
  )
}
