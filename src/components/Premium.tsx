import { Crown } from 'lucide-react'
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
      className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 hover:bg-amber-200 ${className}`}>
      <Crown className="h-3 w-3" />{!compact && TIER_NAME(tier)}
    </Link>
  )
}

/** Kilidli bölmənin yerinə göstərilən izah kartı. */
export function LockedCard({ feature, title, children }: { feature: Feature; title: string; children?: React.ReactNode }) {
  const tier = FEATURES[feature] as Tier
  return (
    <div className="card flex flex-col items-start gap-3 p-6">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Crown className="h-5 w-5" /></span>
      <div>
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="mt-1 text-sm text-muted">{children ?? t.premium.locked(TIER_NAME(tier))}</p>
      </div>
      <Link to="/pricing" className="btn btn-primary btn-sm"><Crown />{t.premium.upgrade}</Link>
    </div>
  )
}
