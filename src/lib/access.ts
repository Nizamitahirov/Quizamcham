import type { AdminState } from '../firebase/auth'

/** Sahib hər şeyi idarə edir; təlimçi yalnız özünə məxsus olanı. */
export const canManage = (admin: Pick<AdminState, 'user' | 'role'>, ownerUid?: string | null) =>
  admin.role === 'owner' || (!!ownerUid && ownerUid === admin.user?.uid)

/** Təlimçi yalnız öz oyunlarını görür (sahib — hamısını). */
export const visibleGames = <T extends { hostUid?: string }>(admin: Pick<AdminState, 'user' | 'role'>, games: T[]) =>
  admin.role === 'owner' ? games : games.filter((g) => g.hostUid === admin.user?.uid)
