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
export const PERM_KEYS = ['createQuiz', 'runGames', 'library', 'share', 'allContent', 'trainers', 'settings', 'logs'] as const
export type PermKey = (typeof PERM_KEYS)[number]
export type PermMap = Partial<Record<PermKey, boolean>>
export type Perms = Record<PermKey, boolean>
export interface AccessConfig { admin: PermMap; trainer: PermMap }

export const DEFAULT_ACCESS: { admin: Perms; trainer: Perms } = {
  admin: { createQuiz: true, runGames: true, library: true, share: true, allContent: true, trainers: true, settings: true, logs: false },
  trainer: { createQuiz: true, runGames: true, library: true, share: true, allContent: false, trainers: false, settings: false, logs: false },
}

/** Qruplar (UI üçün) */
export const PERM_GROUPS: { key: 'content' | 'manage'; perms: PermKey[] }[] = [
  { key: 'content', perms: ['createQuiz', 'runGames', 'library', 'share'] },
  { key: 'manage', perms: ['allContent', 'trainers', 'settings', 'logs'] },
]

/** Rolun standartı: settings/access → yoxdursa daxili standart. */
export const roleDefault = (role: 'admin' | 'trainer', cfg: AccessConfig | null, p: PermKey) => cfg?.[role]?.[p] ?? DEFAULT_ACCESS[role][p]

/** Effektiv icazələr: super → hamısı; digərləri → fərdi istisna ?? rol standartı. */
export function effectivePerms(role: Role | null, cfg: AccessConfig | null, overrides: PermMap | undefined): Perms {
  const out = {} as Perms
  for (const p of PERM_KEYS) out[p] = role === 'super' ? true : !role ? false : (overrides?.[p] ?? roleDefault(role, cfg, p))
  return out
}
