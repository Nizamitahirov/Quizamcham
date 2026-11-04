/**
 * Jabr loqosu: "Jabr" sözü (Lexend Giga 700, sıx hərf aralığı) + kəhrəba nöqtə.
 * Yalnız loqo bu şriftdədir; interfeys Montserrat-dadır.
 */
export const LOGO_FONT = '"Lexend Giga", "Montserrat", sans-serif'
export const LOGO_DOT = '#FEA606'
export const LOGO_TRACKING = -0.2 // em

export function Logo({ size = 40, dark = true, sub, mono }: { size?: number; dark?: boolean; sub?: string; mono?: boolean }) {
  const fs = Math.round(size * 0.78)
  const dot = Math.max(5, Math.round(fs * 0.26))
  return (
    <span className="inline-flex flex-col leading-none" aria-label="Jabr">
      <span className={`inline-flex items-baseline ${dark ? 'text-white' : 'text-ink'}`} style={{ fontFamily: LOGO_FONT, fontWeight: 700, fontSize: fs, letterSpacing: `${LOGO_TRACKING}em` }}>
        Jabr
        <span aria-hidden className="inline-block shrink-0 rounded-full"
          style={{ width: dot, height: dot, marginLeft: Math.round(fs * 0.12), background: mono ? '#fff' : LOGO_DOT }} />
      </span>
      {sub && <span className={`mt-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] ${dark ? 'text-white/55' : 'text-muted'}`}>{sub}</span>}
    </span>
  )
}

/** Yığcam nişan (ikonlar üçün): tünd kvadratda "J" + kəhrəba nöqtə. */
export function LogoMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center rounded-[28%] bg-night text-white ${className}`} style={{ width: size, height: size }} aria-hidden>
      <span className="inline-flex items-baseline" style={{ fontFamily: LOGO_FONT, fontSize: size * 0.56, fontWeight: 700, lineHeight: 1 }}>
        J<span className="ml-[0.08em] inline-block rounded-full" style={{ width: size * 0.15, height: size * 0.15, background: LOGO_DOT }} />
      </span>
    </span>
  )
}
