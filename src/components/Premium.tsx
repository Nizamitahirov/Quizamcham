import { Check, Crown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAdmin } from '../firebase/auth'
import { FEATURES, hasFeature, type Feature, type Tier } from '../lib/roles'
import { t } from '../i18n/az'

/** Cari istifadəçinin planında bu funksiya varmı? (Komanda hesabları — hamısı.) */
export function useFeature(f: Feature): boolean {
  const admin = useAdmin()
  return hasFeature(admin.plan.tier, f)
}

const TIER_NAME = (tier: Tier) => t.acct.plans[tier]?.title ?? tier

/**
 * Kilidli funksiya nişanı: tac + tələb olunan plan adı. Klikləyəndə planlar səhifəsi.
 * compact — yalnız tac (siyahı və düymələr üçün).
 */
export function PremiumBadge({ feature, compact = false, className = '' }: { feature: Feature; compact?: boolean; className?: string }) {
  const tier = FEATURES[feature] as Tier
  const label = t.premium.requires(TIER_NAME(tier))
  return (
    <Link to="/pricing" onClick={(e) => e.stopPropagation()} title={label} aria-label={label}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-500/20 ${className}`}>
      <Crown className="h-3 w-3" />{!compact && TIER_NAME(tier)}
    </Link>
  )
}

/** Kilidli bölmənin yerinə göstərilən təklif kartı: hansı plan lazımdır və o plan nə verir. */
export function LockedCard({ feature, title, children }: { feature: Feature; title: string; children?: React.ReactNode }) {
  const tier = FEATURES[feature] as Tier
  const feats = (t.acct.plans[tier]?.feats ?? []).slice(0, 5)
  return (
    <div className="card hairline-top relative grid gap-6 overflow-hidden p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
      <span className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full opacity-20 blur-3xl" style={{ background: 'var(--grad)' }} />
      <div className="relative">
        <span className="chip chip-warn mb-3"><Crown className="h-3 w-3" />{t.premium.requires(TIER_NAME(tier))}</span>
        <h3 className="font-sans text-xl font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-fg2">{children ?? t.premium.locked(TIER_NAME(tier))}</p>
        {feats.length > 0 && (
          <ul className="mt-4 grid gap-1.5 text-sm text-fg2 sm:grid-cols-2">
            {feats.map((f) => <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />{f}</li>)}
          </ul>
        )}
      </div>
      <Link to="/pricing" className="btn btn-primary relative"><Crown />{t.premium.upgrade}</Link>
    </div>
  )
}
