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
