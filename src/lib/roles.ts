/**
 * Rollar (Firestore Rules ilə eyni model — əsl məhdudiyyət orada tətbiq olunur):
 *  - super: platformanın sahibi, hesab ID-si ilə sabitlənib; hər şey + loglar. Silinə/məhdudlaşdırıla bilməz.
 *  - admin: təlimçiləri idarə edir; bütün quiz/oyun/analitika; ayarlar və səslər.
 *  - trainer: yalnız öz quizləri (+ kitabxanaya paylaşılanlar), öz oyunları və analitikası.
 */
export type Role = 'super' | 'admin' | 'trainer'

export const SUPER_UID = 'ii98moHX58SDPcn9lA4SYHWanou1'

/** Köhnə 'owner' rolu admin sayılır; super yalnız sabit hesabdır. */
export function normalizeRole(raw: unknown, uid: string): Role {
  if (uid === SUPER_UID) return 'super'
  return raw === 'admin' || raw === 'owner' ? 'admin' : 'trainer'
}

export const isManagerRole = (r: Role | null | undefined) => r === 'super' || r === 'admin'
export const isSuperRole = (r: Role | null | undefined) => r === 'super'

/** Bu rol hədəf hesabı idarə edə bilərmi (rol dəyişmək, sıfırlamaq, məhdudlaşdırmaq, silmək)? */
export function canManageMember(me: Role | null, myUid: string | undefined, target: { uid: string; role: Role }) {
  if (target.uid === SUPER_UID || target.uid === myUid) return false
  if (me === 'super') return true
  return me === 'admin' && target.role === 'trainer'
}

// ---------------- Tənzimlənən icazələr (Rules ilə eyni açarlar və standartlar) ----------------
export const PERM_KEYS = ['createQuiz', 'runGames', 'library', 'share', 'publish', 'allContent', 'trainers', 'settings', 'console', 'logs'] as const
export type PermKey = (typeof PERM_KEYS)[number]
export type PermMap = Partial<Record<PermKey, boolean>>
export type Perms = Record<PermKey, boolean>
export interface AccessConfig { admin: PermMap; trainer: PermMap }

export const DEFAULT_ACCESS: { admin: Perms; trainer: Perms } = {
  admin: { createQuiz: true, runGames: true, library: true, share: true, publish: true, allContent: true, trainers: true, settings: true, console: false, logs: false },
  trainer: { createQuiz: true, runGames: true, library: true, share: true, publish: false, allContent: false, trainers: false, settings: false, console: false, logs: false },
}

/** Qruplar (UI üçün) */
export const PERM_GROUPS: { key: 'content' | 'manage'; perms: PermKey[] }[] = [
  { key: 'content', perms: ['createQuiz', 'runGames', 'library', 'share', 'publish'] },
  { key: 'manage', perms: ['allContent', 'trainers', 'settings', 'console', 'logs'] },
]

/** Rolun standartı: settings/access → yoxdursa daxili standart. */
export const roleDefault = (role: 'admin' | 'trainer', cfg: AccessConfig | null, p: PermKey) => cfg?.[role]?.[p] ?? DEFAULT_ACCESS[role][p]

/** Effektiv icazələr: super → hamısı; digərləri → fərdi istisna ?? rol standartı. */
export function effectivePerms(role: Role | null, cfg: AccessConfig | null, overrides: PermMap | undefined): Perms {
  const out = {} as Perms
  for (const p of PERM_KEYS) out[p] = role === 'super' ? true : !role ? false : (overrides?.[p] ?? roleDefault(role, cfg, p))
  return out
}

// ---------------- Plan (özü qeydiyyatdan keçən təlimçilər) ----------------
export const TRIAL_DAYS = 3
export const FREE_MAX_PLAYERS = 10
/** Özü qeydiyyatdan keçən müştəri platforma üzrə ortaq məkanlara məzmun çıxara bilməz (Rules-dakı selfServe ilə eyni). */
export const SELF_SERVE_BLOCKED: PermKey[] = ['share', 'publish']

// ---------------- Plan pillələri (Kahoot modeli: host ödəyir, auditoriya ölçüsünə görə) ----------------
export type Tier = 'free' | 'trainer' | 'pro' | 'business'
export const TIER_ORDER: Tier[] = ['free', 'trainer', 'pro', 'business']
/** players — oyunda maksimum iştirakçı (Rules: playerCap); ai — ayda AI generasiya sayı (server tətbiq edir). */
export const TIERS: Record<Tier, { players: number; ai: number }> = {
  free: { players: 10, ai: 5 },
  trainer: { players: 50, ai: 50 },
  pro: { players: 200, ai: 200 },
  business: { players: 1000, ai: 1000 },
}
/** Funksiya → tələb olunan minimum pillə. */
export const FEATURES = {
  newTypes: 'trainer', // uyğunlaşdırma, boşluq doldurma
  excel: 'trainer',
  sharedEdit: 'trainer',
  classes: 'trainer',
  premiumTypes: 'pro', // şəkil üzərində nöqtə
  confidence: 'pro',
  aiInsights: 'pro',
  aiGrading: 'pro',
  courses: 'pro',
  antiCheat: 'pro',
  branding: 'business',
} as const satisfies Record<string, Tier>
export type Feature = keyof typeof FEATURES
export const tierRank = (t: Tier) => TIER_ORDER.indexOf(t)
export const hasFeature = (t: Tier, f: Feature) => tierRank(t) >= tierRank(FEATURES[f])
/** Lisenziya planı (admins.plan) → pillə. Köhnə "pro" lisenziyalar Pro sayılır. */
export const planTier = (p: unknown): Tier => (p === 'trainer' ? 'trainer' : p === 'business' || p === 'institution' ? 'business' : 'pro')

export interface PlanInfo {
  selfServe: boolean // Google ilə özü qeydiyyatdan keçib
  licensed: boolean
  endsAt: Date | null // sınaq və ya lisenziya bitmə vaxtı
  active: boolean
  free: boolean // sınaq/lisenziya bitib → pulsuz plan (oyunda maks. 10 iştirakçı)
  /** effektiv pillə: komanda hesabları business, sınaq pro, bitmiş — free */
  tier: Tier
  trial: boolean
  players: number
}

type TsLike = { toMillis(): number } | null | undefined
type PlanDoc = { source?: unknown; createdAt?: TsLike; trialEndsAt?: TsLike; licenseUntil?: TsLike; plan?: unknown }
const mk = (p: Omit<PlanInfo, 'players'>): PlanInfo => ({ ...p, players: p.selfServe ? TIERS[p.tier].players : 100000 })
/** owner: müəssisə təlimçisi üçün sahibin sənədi (lisenziya oradan gəlir). Rules-dakı playerCap ilə eyni məntiq. */
export function planInfo(d: PlanDoc | null, now = Date.now(), owner?: PlanDoc | null): PlanInfo {
  if (d?.source === 'org') {
    const end = owner?.plan === 'institution' ? owner.licenseUntil?.toMillis() ?? 0 : 0
    const active = now < end
    return mk({ selfServe: true, licensed: !!end, endsAt: end ? new Date(end) : null, active, free: !active, tier: active ? 'business' : 'free', trial: false })
  }
  if (!d || d.source !== 'signup') return mk({ selfServe: false, licensed: false, endsAt: null, active: true, free: false, tier: 'business', trial: false })
  const lic = d.licenseUntil?.toMillis() ?? 0
  const licensed = now < lic
  const end = d.licenseUntil?.toMillis() ?? d.trialEndsAt?.toMillis() ?? (d.createdAt ? d.createdAt.toMillis() + TRIAL_DAYS * 86_400_000 : 0)
  const active = now < end
  const tier: Tier = !active ? 'free' : licensed ? planTier(d.plan) : 'pro'
  return mk({ selfServe: true, licensed: !!d.licenseUntil, endsAt: end ? new Date(end) : null, active, free: !active, tier, trial: active && !licensed })
}

/** Təşkilat: müəssisə sahibi (lisenziya planı "institution") və ya onun təlimçisi. */
export interface OrgInfo { role: 'owner' | 'member' | null; id: string; seats: number }
export function orgInfo(uid: string, d: { source?: unknown; plan?: unknown; orgId?: unknown; seats?: unknown } | null): OrgInfo {
  if (d?.source === 'org' && typeof d.orgId === 'string') return { role: 'member', id: d.orgId, seats: 0 }
  if (d?.source === 'signup' && d.plan === 'institution') return { role: 'owner', id: uid, seats: Number(d.seats) || 1 }
  return { role: null, id: '', seats: 0 }
}
