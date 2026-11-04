import { useEffect, useState } from 'react'
import { collection, getCountFromServer } from 'firebase/firestore'
import { CalendarClock, ClipboardCheck, Copy, Link2, Users } from 'lucide-react'
import { db } from '../../firebase/config'
import { gradeAssignment, loadSecret } from '../../lib/gameEngine'
import { t } from '../../i18n/az'
import { QRDownload } from '../../components/QRBlock'
import { Section } from '../../components/kit'
import type { Game } from '../../types'

/** Tapşırıq rejimi: paylaşma linki, irəliləyiş və qiymətləndirmə. */
export function AssignmentPanel({ game, onGraded }: { game: Game; onGraded: () => void }) {
  const A = t.assign
  const url = `${window.location.origin}/join?pin=${game.pin}`
  const [counts, setCounts] = useState<{ p: number; a: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  useEffect(() => {
    void Promise.all([getCountFromServer(collection(db, 'games', game.id, 'players')), getCountFromServer(collection(db, 'games', game.id, 'answers'))])
      .then(([p, a]) => setCounts({ p: p.data().count, a: a.data().count })).catch(() => {})
  }, [game.id])
  const grade = async () => {
    if (!confirm(A.gradeConfirm)) return
    setProgress(A.grading(0, counts?.p ?? 0))
    try {
      await gradeAssignment(game, await loadSecret(game.id), (d, n) => setProgress(A.grading(d, n)))
      onGraded()
    } catch { setProgress(t.app.error) }
  }
  return (
    <Section icon={ClipboardCheck} title={`${A.title} · ${A.running}`} sub={game.title} className="mb-6">
      <div className="grid gap-5 md:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-4">
          <div>
            <span className="label">{A.link}</span>
            <div className="flex items-center gap-2"><code className="flex-1 truncate rounded-lg bg-surface px-3 py-2.5 text-sm"><Link2 className="mr-1 inline h-4 w-4" />{url}</code>
              <button className="btn btn-secondary" onClick={() => { void navigator.clipboard.writeText(url); setCopied(true) }}><Copy />{copied ? A.copied : A.copy}</button></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-surface p-3"><div className="label flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{A.deadline}</div><div className="text-sm font-bold">{game.selfEndsAt?.toDate().toLocaleString('az-AZ', { dateStyle: 'medium', timeStyle: 'short' })}</div></div>
            <div className="rounded-xl bg-surface p-3"><div className="label flex items-center gap-1"><Users className="h-3.5 w-3.5" />{A.participants}</div><div className="text-2xl font-black">{counts?.p ?? '–'}</div></div>
            <div className="rounded-xl bg-surface p-3"><div className="label">{A.answers}</div><div className="text-2xl font-black">{counts?.a ?? '–'}</div></div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-primary" disabled={!!progress} onClick={() => void grade()}><ClipboardCheck />{A.grade}</button>
            <QRDownload url={url} filename={`tapsiriq-${game.pin}.png`} label={t.admin.downloadQr} className="btn btn-secondary" />
            {progress && <span className="text-sm font-semibold text-muted">{progress}</span>}
          </div>
        </div>
      </div>
    </Section>
  )
}
