import type { AdminState } from '../firebase/auth'

type A = Pick<AdminState, 'user' | 'perms'>

/** "Bütün məzmun" icazəsi olan hər şeyi idarə edir; digərləri yalnız özünə məxsus olanı. */
export const canManage = (admin: A, ownerUid?: string | null) => admin.perms.allContent || (!!ownerUid && ownerUid === admin.user?.uid)

/** "Bütün məzmun" yoxdursa — yalnız öz oyunları. */
export const visibleGames = <T extends { hostUid?: string }>(admin: A, games: T[]) =>
  admin.perms.allContent ? games : games.filter((g) => g.hostUid === admin.user?.uid)

/** Siyahı sorğuları üçün süzgəc (Rules bunu tələb edir): "bütün məzmun" yoxdursa öz uid-i. */
export const scopeUid = (admin: A) => (admin.perms.allContent ? undefined : admin.user?.uid)
