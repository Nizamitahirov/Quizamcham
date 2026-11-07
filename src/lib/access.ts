import type { AdminState } from '../firebase/auth'

type A = Pick<AdminState, 'user' | 'perms'> & Partial<Pick<AdminState, 'org'>>

/** "Bütün məzmun" icazəsi olan hər şeyi idarə edir; müəssisə sahibi — təşkilatının məzmununu; digərləri — özününkünü. */
export const canManage = (admin: A, ownerUid?: string | null, orgId?: string | null) =>
  admin.perms.allContent || (!!ownerUid && ownerUid === admin.user?.uid) || (admin.org?.role === 'owner' && !!orgId && orgId === admin.org.id)

/** "Bütün məzmun" yoxdursa — öz oyunları (müəssisə sahibi üçün təşkilatın oyunları da). */
export const visibleGames = <T extends { hostUid?: string; orgId?: string }>(admin: A, games: T[]) =>
  admin.perms.allContent ? games : games.filter((g) => g.hostUid === admin.user?.uid || (admin.org?.role === 'owner' && g.orgId === admin.org.id))

/** Siyahı sorğuları üçün süzgəc (Rules bunu tələb edir): "bütün məzmun" yoxdursa öz uid-i. */
export const scopeUid = (admin: A) => (admin.perms.allContent ? undefined : admin.user?.uid)

/** Təşkilat süzgəci: quizlər — sahib və təlimçilər üçün; oyunlar — yalnız sahib üçün. */
export const orgScope = (admin: A) => (admin.perms.allContent || !admin.org?.role ? undefined : admin.org.id)
export const orgGamesScope = (admin: A) => (admin.perms.allContent || admin.org?.role !== 'owner' ? undefined : admin.org.id)
