import { Zap } from 'lucide-react'

export function LogoMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[30%] text-white shadow-[0_10px_30px_-8px_rgba(232,32,42,.7)] ${className}`} style={{ width: size, height: size, background: 'var(--grad)' }}>
      <span className="font-display" style={{ fontSize: size * 0.56, lineHeight: 1, fontWeight: 900 }}>Q</span>
      <Zap className="absolute" style={{ width: size * 0.34, height: size * 0.34, right: size * 0.1, bottom: size * 0.08 }} fill="#FFD166" stroke="none" />
    </span>
  )
}

export function Logo({ size = 40, dark = true, sub, mono }: { size?: number; dark?: boolean; sub?: string; mono?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3">
      <LogoMark size={size} />
      <span className="flex flex-col leading-none">
        <span className={`font-display tracking-tight ${dark ? 'text-white' : 'text-ink'}`} style={{ fontSize: size * 0.5, fontWeight: 900 }}>
          Quiz<span className={mono ? '' : 'text-grad'}>amcham</span>
        </span>
        {sub && <span className={`mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${dark ? 'text-white/55' : 'text-muted'}`}>{sub}</span>}
      </span>
    </span>
  )
}
