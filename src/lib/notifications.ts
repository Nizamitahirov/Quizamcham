/**
 * Bildirişlər: mövcud məlumatlardan (sinif, oyun, kataloq, plan, AI limiti, məşq tarixçəsi) hesablanır.
 * Oxunma vəziyyəti istifadəçi üzrə cihazda saxlanılır. Sayğac artanda (məs. yeni tələbə) bildiriş yenidən "yeni" olur.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { auth, db } from '../firebase/config'
import { t } from '../i18n/az'
import type { AdminState } from '../firebase/auth'
import { listGames } from '../firebase/db'
import { listCatalog, listReports, myAttempts, myPlays } from './account'
import { listMembers, listMyClasses, listResults, listTasks, myMemberships, myResults, mySubmissions } from './classes'
import { aiQuota } from './ai'
import { computeGamify } from './gamify'
import { loadAvatar } from './avatar3d'

export type Tone = 'brand' | 'ok' | 'warn' | 'bad' | 'info'
export type Icon = 'clock' | 'crown' | 'bot' | 'users' | 'check' | 'calendar' | 'game' | 'eye' | 'share' | 'inbox' | 'flag' | 'sparkles' | 'flame' | 'award' | 'plus'
export interface Notice { id: string; title: string; body?: string; at: number; to: string; tone: Tone; icon: Icon; sticky?: boolean }

const DAY = 86_400_000
const WEEK = 7 * DAY
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const N = t.nt
const ms = (v: unknown) => (v && typeof v === 'object' && 'toMillis' in v ? (v as { toMillis(): number }).toMillis() : 0)
const safe = async <T,>(p: Promise<T>, d: T): Promise<T> => { try { return await p } catch { return d } }

// ---------- təlimçi ----------
export async function trainerNotices(admin: AdminState): Promise<Notice[]> {
  const uid = admin.user?.uid
  if (!uid) return []
  const now = Date.now(), out: Notice[] = []
  const plan = admin.plan
  // plan / sınaq
  if (plan.selfServe && plan.endsAt) {
    const left = plan.endsAt.getTime() - now, days = Math.ceil(left / DAY)
    if (left <= 0) out.push({ id: `plan-ended:${dayKey(plan.endsAt.getTime())}`, title: N.planEnded, body: N.planEndedBody, at: plan.endsAt.getTime(), to: '/pricing', tone: 'bad', icon: 'crown', sticky: true })
    else if (days <= (plan.trial ? 2 : 7)) out.push({ id: `plan-soon:${dayKey(plan.endsAt.getTime())}:${days}`, title: plan.trial ? N.trialSoon(days - 1) : N.licenseSoon(days - 1), body: N.renewBody, at: now - DAY / 2, to: '/pricing', tone: 'warn', icon: 'clock', sticky: true })
  }
  const [quota, classes, games, catalog, shared] = await Promise.all([
    safe(aiQuota(), null),
    safe(listMyClasses(), []),
    safe(listGames(20, uid) as Promise<{ id: string; title?: string; phase?: string; createdAt?: unknown }[]>, []),
    safe(listCatalog(true), []),
    admin.user?.email ? safe(getDocs(query(collection(db, 'quizzes'), where('editors', 'array-contains', admin.user.email.toLowerCase()), limit(30))).then((s) => s.docs), []) : Promise.resolve([]),
  ])
  // AI limiti
  if (quota && quota.limit > 0 && quota.used / quota.limit >= 0.8) {
    const p = Math.min(100, Math.round((quota.used / quota.limit) * 100))
    out.push({ id: `ai:${new Date().toISOString().slice(0, 7)}:${p >= 100 ? 100 : 80}`, title: N.aiQuota(p), body: N.aiQuotaBody(quota.used, quota.limit), at: now - 60_000, to: '/pricing', tone: p >= 100 ? 'bad' : 'warn', icon: 'bot' })
  }
  // siniflər: yeni tələbələr, yeni nəticələr, sabah bitən tapşırıqlar
  for (const c of classes.filter((x) => !x.archived).slice(0, 8)) {
    const [members, results, tasks] = await Promise.all([safe(listMembers(c.id), []), safe(listResults(c.id), []), safe(listTasks(c.id), [])])
    const joined = members.filter((m) => now - ms(m.joinedAt) < WEEK)
    if (joined.length) out.push({ id: `members:${c.id}:${members.length}`, title: N.newMembers(joined.length, c.name), at: Math.max(...joined.map((m) => ms(m.joinedAt))), to: `/admin/classes/${c.id}`, tone: 'info', icon: 'users' })
    const fresh = results.filter((r) => now - ms(r.at) < WEEK)
    if (fresh.length) out.push({ id: `results:${c.id}:${results.length}`, title: N.newResults(fresh.length, c.name), at: Math.max(...fresh.map((r) => ms(r.at))), to: `/admin/classes/${c.id}`, tone: 'ok', icon: 'check' })
    for (const tk of tasks) {
      const due = ms(tk.dueAt)
      if (tk.kind !== 'practice' || !due || due < now || due - now > DAY * 1.5 || !members.length) continue
      const done = results.filter((r) => r.taskId === tk.id).length
      if (done < members.length) out.push({ id: `due:${c.id}:${tk.id}`, title: N.taskDue(tk.title), body: N.taskDueBody(done, members.length), at: due - DAY, to: `/admin/classes/${c.id}`, tone: 'warn', icon: 'calendar' })
    }
  }
  // açıq qalmış oyunlar
  for (const g of games) {
    const created = ms(g.createdAt)
    if (g.phase && g.phase !== 'finished' && created && now - created > 3 * 3600_000 && now - created < WEEK)
      out.push({ id: `open-game:${g.id}`, title: N.openGame(g.title ?? ''), body: N.openGameBody, at: created + 3 * 3600_000, to: `/host/${g.id}`, tone: 'warn', icon: 'game' })
  }
  // kataloq: gizlədilmiş / yoxlamada
  for (const c of catalog.filter((x) => x.publishedBy === uid)) {
    if (c.hidden) out.push({ id: `hidden:${c.id}`, title: N.hidden(c.title), body: N.hiddenBody, at: ms(c.publishedAt) || now, to: `/admin/quiz/${c.id}`, tone: 'bad', icon: 'eye', sticky: true })
    else if (c.status === 'review') out.push({ id: `review:${c.id}`, title: N.review(c.title), body: N.reviewBody, at: ms(c.publishedAt) || now, to: `/admin/quiz/${c.id}`, tone: 'info', icon: 'clock' })
  }
  // birgə redaktə
  for (const d of shared) {
    if (d.get('ownerUid') === uid) continue
    out.push({ id: `shared:${d.id}`, title: N.shared(String(d.get('title') ?? '')), body: N.sharedBody, at: ms(d.get('updatedAt')) || now, to: `/admin/quiz/${d.id}`, tone: 'brand', icon: 'share' })
  }
  // konsol: müraciətlər və şikayətlər
  if (admin.perms.console) {
    const [leads, reports] = await Promise.all([
      safe(getDocs(query(collection(db, 'licenseRequests'), where('status', '==', 'new'), limit(100))).then((s) => s.docs), []),
      safe(listReports(), []),
    ])
    if (leads.length) out.push({ id: `leads:${leads.length}`, title: N.leads(leads.length), body: N.leadsBody, at: Math.max(...leads.map((d) => ms(d.get('createdAt')))) || now, to: '/admin/console', tone: 'brand', icon: 'inbox' })
    if (reports.length) out.push({ id: `reports:${reports.length}`, title: N.reports(reports.length), body: N.reportsBody, at: Math.max(...reports.map((r) => ms(r.at))) || now, to: '/admin/console', tone: 'bad', icon: 'flag' })
  }
  // başlanğıc məsləhəti
  if (admin.perms.createQuiz) {
    const own = await safe(getDocs(query(collection(db, 'quizzes'), where('ownerUid', '==', uid), limit(1))).then((s) => s.size), 1)
    if (own === 0) out.push({ id: 'tip:first-quiz', title: N.firstQuiz, body: N.firstQuizBody, at: now - DAY, to: '/admin/quizzes', tone: 'brand', icon: 'plus' })
  }
  return out
}

// ---------- tələbə ----------
export async function studentNotices(uid: string): Promise<Notice[]> {
  const now = Date.now(), out: Notice[] = []
  const [ms0, attempts, plays, av] = await Promise.all([safe(myMemberships(), []), safe(myAttempts(uid), []), safe(myPlays(uid), []), safe(loadAvatar(uid), null)])
  for (const m of ms0.slice(0, 10)) {
    const [tasks, mine] = await Promise.all([safe(listTasks(m.classId), []), safe(myResults(m.classId), [])])
    const subs = tasks.some((x) => x.kind === 'assignment') ? await safe(mySubmissions(m.classId), []) : []
    for (const tk of tasks) {
      const sub = subs.find((x) => x.taskId === tk.id)
      const to = tk.kind === 'assignment' ? `/learn/class/${m.classId}/task/${tk.id}` : '/learn'
      // qiymətləndirilmiş tapşırıq → bildiriş
      if (sub?.status === 'returned' && sub.grade != null) { const at = ms(sub.gradedAt); if (at && now - at < WEEK) out.push({ id: `graded:${tk.id}:${at}`, title: N.graded(tk.title, sub.grade, tk.points ?? 100), body: sub.feedback?.slice(0, 120) || N.taskBody, at, to, tone: 'ok', icon: 'award' }); continue }
      if (mine.some((r) => r.taskId === tk.id) || (sub && sub.status !== 'draft')) continue
      const due = ms(tk.dueAt), created = ms(tk.createdAt)
      if (due && due < now && now - due < WEEK) out.push({ id: `overdue:${tk.id}`, title: N.overdue(tk.title), body: N.taskBody, at: due, to, tone: 'bad', icon: 'calendar', sticky: true })
      else if (due && due > now && due - now < DAY * 1.5) out.push({ id: `due:${tk.id}`, title: N.dueTomorrow(tk.title), body: N.taskBody, at: due - DAY, to, tone: 'warn', icon: 'calendar' })
      else if (created && now - created < WEEK) out.push({ id: `task:${tk.id}`, title: N.newTask(tk.title, m.className), body: N.taskBody, at: created, to, tone: 'brand', icon: 'plus' })
    }
  }
  // seriya və nişanlar
  const g = computeGamify(attempts, plays, now)
  if (g.streak >= 2 && !g.today && new Date().getHours() >= 12) out.push({ id: `streak:${dayKey(now)}`, title: N.streak(g.streak), body: N.streakBody, at: now - 3600_000, to: '/learn#catalog', tone: 'warn', icon: 'flame' })
  const key = `jabr.badges.${uid}`
  let known: Record<string, number> = {}
  try { known = JSON.parse(localStorage.getItem(key) ?? 'null') ?? {} } catch { /* noop */ }
  const first = !Object.keys(known).length
  for (const b of g.badges.filter((x) => x.earned)) {
    if (!(b.id in known)) known[b.id] = first ? 0 : now // ilk dəfə: köhnə nişanlar bildiriş sayılmır
    if (known[b.id] && now - known[b.id] < WEEK) out.push({ id: `badge:${b.id}`, title: N.badge(t.gamify.names[b.id] ?? b.id), body: N.badgeBody, at: known[b.id], to: '/learn', tone: 'ok', icon: 'award' })
  }
  try { localStorage.setItem(key, JSON.stringify(known)) } catch { /* noop */ }
  if (!av) out.push({ id: 'tip:avatar', title: N.avatarTip, body: N.avatarTipBody, at: now - DAY, to: '/avatar', tone: 'brand', icon: 'sparkles' })
  return out
}

// ---------- oxunma vəziyyəti ----------
const readKey = (uid: string) => `jabr.notif.read.${uid}`
function loadRead(uid: string): Set<string> { try { return new Set(JSON.parse(localStorage.getItem(readKey(uid)) ?? '[]') as string[]) } catch { return new Set() } }
function saveRead(uid: string, s: Set<string>) { try { localStorage.setItem(readKey(uid), JSON.stringify([...s].slice(-400))) } catch { /* noop */ } }

export function timeAgo(at: number) {
  const d = Date.now() - at
  if (d < 60_000) return N.now
  if (d < 3600_000) return N.minAgo(Math.floor(d / 60_000))
  if (d < DAY) return N.hAgo(Math.floor(d / 3600_000))
  return N.dAgo(Math.floor(d / DAY))
}

/** Bildiriş axını: yükləmə, 2 dəqiqədən bir yeniləmə, oxunmuş/oxunmamış. */
export function useNotices(load: (() => Promise<Notice[]>) | null) {
  const uid = auth.currentUser?.uid ?? ''
  const [items, setItems] = useState<Notice[] | null>(null)
  const [read, setRead] = useState<Set<string>>(() => (uid ? loadRead(uid) : new Set()))
  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load }, [load])
  const refresh = useCallback(() => {
    const fn = loadRef.current
    if (!fn) return
    void fn().then((x) => setItems(x.sort((a, b) => Number(!!b.sticky) - Number(!!a.sticky) || b.at - a.at))).catch(() => setItems([]))
  }, [])
  useEffect(() => {
    if (!load) return
    refresh()
    const id = setInterval(refresh, 120_000)
    return () => clearInterval(id)
  }, [!!load, refresh]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (uid) setRead(loadRead(uid)) }, [uid])
  const markOne = useCallback((id: string) => setRead((s) => { const n = new Set(s); n.add(id); if (uid) saveRead(uid, n); return n }), [uid])
  const markAll = useCallback(() => setRead((s) => { const n = new Set(s); (items ?? []).forEach((x) => n.add(x.id)); if (uid) saveRead(uid, n); return n }), [uid, items])
  const unread = (items ?? []).filter((x) => !read.has(x.id)).length
  return { items, read, unread, refresh, markOne, markAll }
}
