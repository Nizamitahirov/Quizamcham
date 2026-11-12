import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Award, Check, ListOrdered, Lock, Play, RotateCcw, Target } from 'lucide-react'
import { t } from '../../i18n/az'
import { useAccount } from '../../lib/account'
import { coursePass, enrollCourse, loadCourse, myCourseProgress, type Course, type CourseProgress } from '../../lib/classes'
import { Spinner } from '../../components/ui'
import { EmptyState, Progress } from '../../components/kit'
import { StudentShell } from '../../components/StudentShell'

const K = t.course
const K2 = t.course2

/** Tələbə: kurs — quizlər ardıcıllıqla, irəliləyiş, hamısı bitəndə sertifikat. */
export default function CoursePage() {
  const { courseId = '' } = useParams()
  const { loading, user, profile } = useAccount()
  const [course, setCourse] = useState<Course | null | undefined>(undefined)
  const [prog, setProg] = useState<CourseProgress | null>(null)
  const who = profile ? `${profile.firstName} ${profile.lastName}`.trim() : ''
  useEffect(() => {
    if (!user || user.isAnonymous) return
    void (async () => {
      const c = await loadCourse(courseId).catch(() => null)
      setCourse(c)
      if (!c) return
      const p = await myCourseProgress(courseId).catch(() => null)
      // ilk açılışda kursa yazılır — "Kurslarım"da görünür, müəllim "başlayıb" sayır
      setProg(p ?? (c.ownerUid !== user.uid ? await enrollCourse(c, who).catch(() => null) : null))
    })()
  }, [user, courseId, who])
  if (loading) return <div className="bg-app flex min-h-dvh items-center justify-center"><Spinner /></div>
  if (!user) return <Navigate to={`/start?next=/learn/course/${courseId}`} replace />
  const done = new Set(prog?.done ?? [])
  const next = course?.items.find((i) => !done.has(i.quizId))
  const complete = !!course && course.items.every((i) => done.has(i.quizId))
  const doneN = course ? course.items.filter((i) => done.has(i.quizId)).length : 0
  const name = who
  const cert = async () => {
    if (!course) return
    const { renderCertificate } = await import('../../lib/shareCard')
    const blob = await renderCertificate(
      { name, quiz: course.title, place: 0, total: 0, score: 0, trainer: course.ownerName, date: prog?.completedAt?.toDate() ?? new Date() },
      { title: t.cert.title, given: t.cert.given, completed: K.completeTitle.replace(/ 🎉$/, ''), place: '', score: K.progress(course.items.length, course.items.length), trainer: t.cert.trainer, date: t.cert.date },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `jabr-course-${course.id}.png`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }
  return (
    <StudentShell back="/learn" title={course?.title} width="max-w-3xl">
      {course === undefined ? <Spinner /> : !course ? <EmptyState icon={RotateCcw} title={K.notFound} /> : (
        <>
          <section className="card hairline-top relative overflow-hidden p-6 sm:p-8">
            <span className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full opacity-25 blur-3xl" style={{ background: 'var(--grad)' }} />
            <div className="relative flex items-start gap-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-line-strong bg-white/[.05] text-4xl">{course.coverEmoji ?? '📚'}</span>
              <div className="min-w-0">
                <h1 className="break-words text-2xl font-extrabold sm:text-3xl">{course.title}</h1>
                {course.ownerName && <p className="mt-0.5 text-sm text-muted">{t.cert.trainer}: {course.ownerName}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="chip chip-muted" title={K2.passHint(coursePass(course))}><Target className="h-3 w-3" />{K2.passPct}: {coursePass(course)}%</span>
                  {course.sequential && <span className="chip chip-info" title={K2.sequentialDesc}><ListOrdered className="h-3 w-3" />{K2.sequential}</span>}
                </div>
              </div>
            </div>
            {course.description && <p className="relative mt-4 text-fg2">{course.description}</p>}
            <div className="relative mt-6 flex items-center gap-3"><Progress value={(doneN / course.items.length) * 100} className="flex-1" /><span className="text-sm font-semibold tabular">{K.progress(doneN, course.items.length)}</span></div>
            <div className="relative mt-5">
              {complete ? (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4">
                  <p className="mr-auto font-semibold text-emerald-200">{K.completeTitle}</p>
                  <button className="btn btn-primary" disabled={!name} onClick={() => void cert()}><Award />{K.certificate}</button>
                </div>
              ) : next && <Link to={`/learn/${next.quizId}?course=${course.id}`} className="btn btn-primary"><Play className="fill-current" />{K.start}: <span className="max-w-56 truncate">{next.title}</span></Link>}
            </div>
          </section>
          <ol className="relative flex flex-col gap-3 before:absolute before:bottom-6 before:left-[27px] before:top-6 before:w-px before:bg-line-strong">
            {course.items.map((it, i) => {
              const ok = done.has(it.quizId)
              const isNext = next?.quizId === it.quizId
              const locked = !!course.sequential && !ok && !isNext
              return (
                <li key={it.quizId} className={`card relative flex items-center gap-4 p-4 ${isNext ? 'border-orange-400/40 shadow-[0_0_0_3px_rgba(255,90,31,.10)]' : ''} ${locked ? 'opacity-60' : ''}`}>
                  <span className={`relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular ${ok ? 'bg-emerald-500 text-[#fff]' : isNext ? 'text-[#fff]' : 'border border-line-strong bg-panel text-muted'}`} style={isNext && !ok ? { background: 'var(--grad)' } : undefined}>
                    {ok ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1 break-words font-semibold">{it.title}</span>
                  {locked
                    ? <span className="chip chip-muted shrink-0" title={K2.lockedHint}><Lock className="h-3 w-3" />{K2.locked}</span>
                    : <Link to={`/learn/${it.quizId}?course=${course.id}`} className={`btn btn-sm ${isNext ? 'btn-primary' : 'btn-secondary'}`}>{ok ? <><RotateCcw />{K.again}</> : <><Play className="fill-current" />{K.start}</>}</Link>}
                </li>
              )
            })}
          </ol>
        </>
      )}
    </StudentShell>
  )
}
