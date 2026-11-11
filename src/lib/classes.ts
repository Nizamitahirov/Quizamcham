/**
 * Siniflər (qruplar) və kurslar.
 *  classes/{cid}                 — təlimçinin sinfi (6 simvollu qoşulma kodu)
 *  classes/{cid}/members/{uid}   — tələbə (kodla qoşulur)
 *  classes/{cid}/tasks/{tid}     — tapşırıq: kataloq quizi, kurs və ya oyun (PIN)
 *  classes/{cid}/results/{uid_tid} — tələbənin nəticəsi (məşqi bitirəndə özü yazır)
 *  classCodes/{code}             — kod → sinif
 *  memberships/{uid_cid}         — tələbənin öz sinifləri siyahısı
 *  courses/{id} (+ /progress/{uid}) — kurs və irəliləyiş
 */
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
import { auth, db } from '../firebase/config'

export interface ClassRow { id: string; ownerUid: string; name: string; code: string; archived?: boolean; ownerName?: string; createdAt?: Timestamp }
export interface Member { uid: string; name: string; email?: string; joinedAt?: Timestamp }
export type TaskKind = 'practice' | 'course' | 'game'
export interface ClassTask { id: string; kind: TaskKind; title: string; quizId?: string; courseId?: string; gameId?: string; pin?: string; dueAt?: Timestamp | null; note?: string; createdAt?: Timestamp }
export interface ClassResult { id: string; uid: string; name: string; taskId: string; score: number; correct: number; total: number; pct: number; at?: Timestamp }
export interface Membership { id: string; uid: string; classId: string; className: string; joinedAt?: Timestamp }

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // qarışdırıla bilən 0/O, 1/I yoxdur
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('')
export const normCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
const uid = () => auth.currentUser?.uid ?? ''

// ---------- təlimçi ----------
export async function createClass(name: string, ownerName: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode()
    if ((await getDoc(doc(db, 'classCodes', code)).catch(() => null))?.exists()) continue
    const ref = doc(collection(db, 'classes'))
    const b = writeBatch(db)
    b.set(ref, { ownerUid: uid(), name: name.trim().slice(0, 80), code, createdAt: serverTimestamp(), archived: false, ownerName: ownerName.slice(0, 80) })
    b.set(doc(db, 'classCodes', code), { classId: ref.id })
    await b.commit()
    return ref.id
  }
  throw new Error('code-collision')
}
export async function listMyClasses(): Promise<ClassRow[]> {
  const s = await getDocs(query(collection(db, 'classes'), where('ownerUid', '==', uid())))
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClassRow, 'id'>) })).sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
}
export async function loadClass(cid: string): Promise<ClassRow | null> {
  const s = await getDoc(doc(db, 'classes', cid))
  return s.exists() ? ({ id: s.id, ...(s.data() as Omit<ClassRow, 'id'>) }) : null
}
export const renameClass = (cid: string, name: string) => updateDoc(doc(db, 'classes', cid), { name: name.trim().slice(0, 80) })
export const archiveClass = (cid: string, archived: boolean) => updateDoc(doc(db, 'classes', cid), { archived })
export async function deleteClass(c: ClassRow) {
  for (const sub of ['tasks', 'results', 'members'] as const) {
    const s = await getDocs(collection(db, 'classes', c.id, sub)).catch(() => null)
    for (const d of s?.docs ?? []) await deleteDoc(d.ref).catch(() => {})
  }
  await deleteDoc(doc(db, 'classCodes', c.code)).catch(() => {})
  await deleteDoc(doc(db, 'classes', c.id))
}
export async function listMembers(cid: string): Promise<Member[]> {
  const s = await getDocs(collection(db, 'classes', cid, 'members'))
  return s.docs.map((d) => d.data() as Member).sort((a, b) => a.name.localeCompare(b.name))
}
export const removeMember = (cid: string, memberUid: string) => deleteDoc(doc(db, 'classes', cid, 'members', memberUid))
export async function listTasks(cid: string): Promise<ClassTask[]> {
  const s = await getDocs(collection(db, 'classes', cid, 'tasks'))
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClassTask, 'id'>) })).sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
}
export async function addTask(cid: string, t: Omit<ClassTask, 'id' | 'createdAt'>) {
  const ref = doc(collection(db, 'classes', cid, 'tasks'))
  const clean = Object.fromEntries(Object.entries(t).filter(([, v]) => v !== undefined && v !== ''))
  await setDoc(ref, { ...clean, createdAt: serverTimestamp() })
  return ref.id
}
export const deleteTask = (cid: string, tid: string) => deleteDoc(doc(db, 'classes', cid, 'tasks', tid))
export async function listResults(cid: string): Promise<ClassResult[]> {
  const s = await getDocs(collection(db, 'classes', cid, 'results'))
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClassResult, 'id'>) }))
}

// ---------- tələbə ----------
/** Kodla qoşulma: üzv sənədi (kod qaydada yoxlanılır) → sinfin adı → öz siyahısına əlavə. */
export async function joinClass(code: string, name: string, email: string): Promise<{ classId: string; name: string }> {
  const c = await getDoc(doc(db, 'classCodes', normCode(code))).catch(() => null)
  if (!c?.exists()) throw new Error('not-found')
  const classId = String(c.get('classId'))
  const me = uid()
  const existing = await getDoc(doc(db, 'classes', classId, 'members', me)).catch(() => null)
  if (!existing?.exists()) await setDoc(doc(db, 'classes', classId, 'members', me), { uid: me, name: name.slice(0, 80), email: email.slice(0, 120), code: normCode(code), joinedAt: serverTimestamp() })
  const cls = await loadClass(classId)
  if (!cls) throw new Error('not-found')
  await setDoc(doc(db, 'memberships', `${me}_${classId}`), { uid: me, classId, className: cls.name.slice(0, 80), joinedAt: serverTimestamp() }).catch(() => {})
  return { classId, name: cls.name }
}
export async function myMemberships(): Promise<Membership[]> {
  const s = await getDocs(query(collection(db, 'memberships'), where('uid', '==', uid())))
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Membership, 'id'>) }))
}
export async function leaveClass(classId: string) {
  const me = uid()
  await deleteDoc(doc(db, 'classes', classId, 'members', me)).catch(() => {})
  await deleteDoc(doc(db, 'memberships', `${me}_${classId}`)).catch(() => {})
}
export async function myResults(classId: string): Promise<ClassResult[]> {
  const s = await getDocs(query(collection(db, 'classes', classId, 'results'), where('uid', '==', uid()))).catch(() => null)
  return s?.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClassResult, 'id'>) })) ?? []
}
/** Məşq bitəndə: sinif tapşırığının nəticəsi (ən yaxşısı saxlanılır). */
export async function saveClassResult(classId: string, taskId: string, name: string, r: { score: number; correct: number; total: number }) {
  const ref = doc(db, 'classes', classId, 'results', `${uid()}_${taskId}`)
  const pct = r.total ? Math.round((r.correct / r.total) * 100) : 0
  const prev = await getDoc(ref).catch(() => null)
  if (prev?.exists() && Number(prev.get('pct')) >= pct) return
  await setDoc(ref, { uid: uid(), name: name.slice(0, 80), taskId, score: Math.round(r.score), correct: r.correct, total: r.total, pct, at: serverTimestamp() })
}

// ---------- kurslar ----------
export interface CourseItem { quizId: string; title: string }
export interface Course { id: string; ownerUid: string; ownerName?: string; title: string; description?: string; items: CourseItem[]; coverEmoji?: string; updatedAt?: Timestamp }
export interface CourseProgress { uid: string; name?: string; done: string[]; completedAt?: Timestamp | null; at?: Timestamp }

export async function saveCourse(c: Omit<Course, 'id' | 'ownerUid' | 'updatedAt'> & { id?: string }): Promise<string> {
  const ref = c.id ? doc(db, 'courses', c.id) : doc(collection(db, 'courses'))
  const prev = c.id ? await getDoc(ref).catch(() => null) : null
  await setDoc(ref, {
    ownerUid: uid(), ownerName: (c.ownerName ?? '').slice(0, 80), title: c.title.trim().slice(0, 120), description: (c.description ?? '').slice(0, 500),
    items: c.items.slice(0, 50).map((i) => ({ quizId: i.quizId, title: i.title.slice(0, 120) })), coverEmoji: c.coverEmoji ?? '📚',
    createdAt: prev?.exists() ? prev.get('createdAt') : serverTimestamp(), updatedAt: serverTimestamp(),
  })
  return ref.id
}
export async function listMyCourses(): Promise<Course[]> {
  const s = await getDocs(query(collection(db, 'courses'), where('ownerUid', '==', uid())))
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Course, 'id'>) }))
}
export async function loadCourse(id: string): Promise<Course | null> {
  const s = await getDoc(doc(db, 'courses', id))
  return s.exists() ? ({ id: s.id, ...(s.data() as Omit<Course, 'id'>) }) : null
}
export const deleteCourse = (id: string) => deleteDoc(doc(db, 'courses', id))
export async function myCourseProgress(courseId: string): Promise<CourseProgress | null> {
  const s = await getDoc(doc(db, 'courses', courseId, 'progress', uid())).catch(() => null)
  return s?.exists() ? (s.data() as CourseProgress) : null
}
/** Kursun bir quizini bitirdi → irəliləyiş; hamısı bitəndə tamamlanma vaxtı. */
export async function markCourseItem(course: Course, quizId: string, name: string) {
  const prev = await myCourseProgress(course.id)
  const done = [...new Set([...(prev?.done ?? []), quizId])].filter((q) => course.items.some((i) => i.quizId === q))
  const complete = course.items.every((i) => done.includes(i.quizId))
  await setDoc(doc(db, 'courses', course.id, 'progress', uid()), {
    uid: uid(), name: name.slice(0, 80), done,
    ...(complete ? { completedAt: prev?.completedAt ?? serverTimestamp() } : {}), at: serverTimestamp(),
  })
  return { done, complete }
}
export async function courseProgressAll(courseId: string, memberUids: string[]): Promise<Map<string, CourseProgress>> {
  const out = new Map<string, CourseProgress>()
  await Promise.all(memberUids.map(async (u) => {
    const s = await getDoc(doc(db, 'courses', courseId, 'progress', u)).catch(() => null)
    if (s?.exists()) out.set(u, s.data() as CourseProgress)
  }))
  return out
}
export const dueLabel = (t?: Timestamp | null) => (t ? t.toDate() : null)
