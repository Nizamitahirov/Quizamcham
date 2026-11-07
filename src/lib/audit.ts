import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase/config'

/** Audit jurnalı hadisələri (yalnız super admin oxuyur; yazılandan sonra dəyişdirilə/silinə bilməz). */
export type AuditAction =
  | 'login' | 'password_changed' | 'password_reset_sent'
  | 'member_created' | 'member_role' | 'member_restricted' | 'member_unrestricted' | 'member_removed'
  | 'quiz_deleted' | 'quiz_shared' | 'quiz_unshared' | 'game_deleted' | 'settings_saved' | 'sounds_saved'
  | 'data_export' | 'data_cleanup' | 'logs_cleared' | 'access_changed' | 'member_perms'
  | 'quiz_published' | 'quiz_unpublished' | 'pricing_saved' | 'license_granted' | 'license_revoked' | 'trial_extended'
  | 'account_deleted' | 'data_exported' | 'member_converted'

export interface AuditRow {
  id: string; actor: string; actorEmail?: string; action: AuditAction
  target?: string; targetEmail?: string; details?: Record<string, unknown>; at?: { toDate(): Date }
}

/** Heç vaxt istifadəçi axınını pozmur: jurnal yazılmasa da əməliyyat davam edir. */
export function logAudit(action: AuditAction, extra: { target?: string; targetEmail?: string; details?: Record<string, unknown> } = {}): Promise<void> {
  const u = auth.currentUser
  if (!u || u.isAnonymous) return Promise.resolve()
  const data = JSON.parse(JSON.stringify({ actor: u.uid, actorEmail: u.email ?? '', action, ...extra })) as Record<string, unknown>
  return addDoc(collection(db, 'audit'), { ...data, at: serverTimestamp() }).then(() => {}, (e) => { console.warn('audit write failed', action, (e as { code?: string }).code ?? e) })
}

export async function listAudit(max = 300): Promise<AuditRow[]> {
  const s = await getDocs(query(collection(db, 'audit'), orderBy('at', 'desc'), limit(max)))
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditRow, 'id'>) }))
}
