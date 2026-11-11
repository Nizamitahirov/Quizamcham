import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, Award, CheckCircle2, Circle, Play, RotateCcw } from 'lucide-react'
import { t } from '../../i18n/az'
import { useAccount } from '../../lib/account'
import { loadCourse, myCourseProgress, type Course, type CourseProgress } from '../../lib/classes'
import { FuturisticBg } from '../../components/FuturisticBg'
import { Logo } from '../../components/Brand'
import { Spinner } from '../../components/ui'

const K = t.course

/** Tələbə: kurs — quizlər ardıcıllıqla, irəliləyiş, hamısı bitəndə sertifikat. */
export default function CoursePage() {
  const { courseId = '' } = useParams()
  const { loading, user, profile } = useAccount()
  const [course, setCourse] = useState<Course | null | undefined>(undefined)
  const [prog, setProg] = useState<CourseProgress | null>(null)
  useEffect(() => {
    if (!user) return
    void loadCourse(courseId).then(setCourse).catch(() => setCourse(null))
    void myCourseProgress(courseId).then(setProg).catch(() => setProg(null))
  }, [user, courseId])
  if (loading) return <div className="flex min-h-dvh items-center justify-center bg-night"><Spinner /></div>
  if (!user) return <Navigate to={`/start?next=/learn/course/${courseId}`} replace />
  const done = new Set(prog?.done ?? [])
  const next = course?.items.find((i) => !done.has(i.quizId))
  const complete = !!course && course.items.every((i) => done.has(i.quizId))
  const name = profile ? `${profile.firstName} ${profile.lastName}`.trim() : ''
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
    <div className="noise relative min-h-dvh overflow-hidden bg-night text-white">
      <FuturisticBg floor={false} intensity={0.5} />
      <header className="relative z-10 mx-auto flex w-full max-w-3xl items-center gap-3 px-4 pt-5">
        <Link to="/learn" className="btn btn-ghost btn-icon" aria-label={t.app.back}><ArrowLeft className="h-4 w-4" /></Link>
        <Logo size={28} />
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
        {course === undefined ? <Spinner /> : !course ? <p className="glass p-6 text-center">{K.notFound}</p> : (
          <>
            <section className="glass-strong p-6">
              <div className="text-4xl">{course.coverEmoji ?? '📚'}</div>
              <h1 className="mt-2 break-words text-2xl font-black sm:text-3xl">{course.title}</h1>
              {course.description && <p className="mt-1 text-white/65">{course.description}</p>}
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${(done.size / course.items.length) * 100}%`, background: 'var(--grad)' }} /></div>
              <p className="mt-2 text-sm text-white/65">{K.progress(course.items.filter((i) => done.has(i.quizId)).length, course.items.length)}</p>
              {complete ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <p className="text-lg font-black">{K.completeTitle}</p>
                  <button className="btn btn-primary" disabled={!name} onClick={() => void cert()}><Award />{K.certificate}</button>
                </div>
              ) : next && <Link to={`/learn/${next.quizId}?course=${course.id}`} className="btn btn-primary mt-4"><Play />{K.start}: {next.title}</Link>}
            </section>
            <ol className="flex flex-col gap-2">
              {course.items.map((it, i) => {
                const ok = done.has(it.quizId)
                return (
                  <li key={it.quizId} className="glass flex items-center gap-3 p-4">
                    {ok ? <CheckCircle2 className="h-6 w-6 shrink-0 text-green-400" /> : <Circle className="h-6 w-6 shrink-0 text-white/30" />}
                    <span className="w-6 font-display font-black text-white/50">{i + 1}</span>
                    <span className="min-w-0 flex-1 break-words font-bold">{it.title}</span>
                    <Link to={`/learn/${it.quizId}?course=${course.id}`} className="btn btn-ghost btn-sm">{ok ? <><RotateCcw />{K.again}</> : <><Play />{K.start}</>}</Link>
                  </li>
                )
              })}
            </ol>
          </>
        )}
      </main>
    </div>
  )
}
