/**
 * Jabr loqosu: "Jabr" sözü + fərqli rəngli nöqtə (brend qradiyenti, qırmızı → narıncı).
 * `size` təxmini hərf hündürlüyünü (px) idarə edir.
 */
export function Logo({ size = 40, dark = true, sub, mono }: { size?: number; dark?: boolean; sub?: string; mono?: boolean }) {
  const fs = Math.round(size * 0.82)
  const dot = Math.max(5, Math.round(fs * 0.24))
  return (
    <span className="inline-flex flex-col leading-none" aria-label="Jabr">
      <span className={`font-display inline-flex items-baseline tracking-[-0.04em] ${dark ? 'text-white' : 'text-ink'}`} style={{ fontSize: fs, fontWeight: 900 }}>
        Jabr
        <span aria-hidden className="inline-block shrink-0 rounded-full"
          style={{ width: dot, height: dot, marginLeft: Math.round(fs * 0.06), background: mono ? '#fff' : 'linear-gradient(135deg,#E8202A,#FF8A1A)', boxShadow: mono ? undefined : '0 0 12px rgba(255,90,31,.55)' }} />
      </span>
      {sub && <span className={`mt-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] ${dark ? 'text-white/55' : 'text-muted'}`}>{sub}</span>}
    </span>
  )
}

/** Yığcam nişan (ikonlar üçün): tünd kvadratda "J" + rəngli nöqtə. */
export function LogoMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center rounded-[28%] bg-night text-white ${className}`} style={{ width: size, height: size }} aria-hidden>
      <span className="font-display inline-flex items-baseline" style={{ fontSize: size * 0.62, fontWeight: 900, lineHeight: 1 }}>
        J<span className="ml-[0.06em] inline-block rounded-full" style={{ width: size * 0.16, height: size * 0.16, background: 'linear-gradient(135deg,#E8202A,#FF8A1A)' }} />
      </span>
    </span>
  )
}
