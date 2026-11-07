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
/** Plan tələb edən icazələr — sınaq/lisenziya bitəndə bağlanır (Rules-dakı planOk ilə eyni). */
export const PLAN_PERMS: PermKey[] = ['createQuiz', 'runGames', 'share', 'publish']

export interface PlanInfo {
  selfServe: boolean // Google ilə özü qeydiyyatdan keçib
  licensed: boolean
  endsAt: Date | null // sınaq və ya lisenziya bitmə vaxtı
  active: boolean
}

type TsLike = { toMillis(): number } | null | undefined
export function planInfo(d: { source?: unknown; createdAt?: TsLike; trialEndsAt?: TsLike; licenseUntil?: TsLike } | null, now = Date.now()): PlanInfo {
  if (!d || d.source !== 'signup') return { selfServe: false, licensed: false, endsAt: null, active: true }
  const end = d.licenseUntil?.toMillis() ?? d.trialEndsAt?.toMillis() ?? (d.createdAt ? d.createdAt.toMillis() + TRIAL_DAYS * 86_400_000 : 0)
  return { selfServe: true, licensed: !!d.licenseUntil, endsAt: end ? new Date(end) : null, active: now < end }
}
