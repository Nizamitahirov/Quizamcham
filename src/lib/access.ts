import type { AdminState } from '../firebase/auth'
import { isManagerRole } from './roles'

/** Admin/super hər şeyi idarə edir; təlimçi yalnız özünə məxsus olanı. */
export const canManage = (admin: Pick<AdminState, 'user' | 'role'>, ownerUid?: string | null) =>
  isManagerRole(admin.role) || (!!ownerUid && ownerUid === admin.user?.uid)

/** Təlimçi yalnız öz oyunlarını görür (admin/super — hamısını). */
export const visibleGames = <T extends { hostUid?: string }>(admin: Pick<AdminState, 'user' | 'role'>, games: T[]) =>
  isManagerRole(admin.role) ? games : games.filter((g) => g.hostUid === admin.user?.uid)

/** Siyahı sorğuları üçün: təlimçidə hostUid/ownerUid süzgəci (Rules bunu tələb edir), adminlərdə yox. */
export const scopeUid = (admin: Pick<AdminState, 'user' | 'role'>) => (isManagerRole(admin.role) ? undefined : admin.user?.uid)
