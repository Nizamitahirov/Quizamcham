import { useEffect, useMemo, useState } from 'react'
import { Check, Globe2, Loader2, Lock, Search } from 'lucide-react'
import { t } from '../i18n/az'
import { listCatalog, ModerationError, publishToCatalog, type CatalogItem } from '../lib/account'
import { listQuizzes } from '../firebase/db'
import { Segmented } from './kit'
import { toast } from './dialogs'

export interface PickedQuiz { quizId: string; title: string; emoji?: string }
type Row = { id: string; title: string; emoji: string; count: number; published: boolean; mine: boolean }
const C = t.cls2

/**
 * Quiz seçimi: "Mənim quizlərim" (şəxsi də daxil) və ya kataloq.
 * Şəxsi quiz seçiləndə avtomatik "yalnız link ilə" dərc olunur (moderasiya yoxlaması ilə) — tələbələr aça bilsin.
 */
export function QuizPicker({ me, author, exclude = [], selected, onPick }: { me: string; author: string; exclude?: string[]; selected?: string; onPick: (q: PickedQuiz) => void }) {
  const [src, setSrc] = useState<'mine' | 'catalog'>('mine')
  const [catalog, setCatalog] = useState<CatalogItem[] | null>(null)
  const [mine, setMine] = useState<{ id: string; title: string; coverEmoji?: string; count: number }[] | null>(null)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState('')
  useEffect(() => {
    void listCatalog(true).then(setCatalog).catch(() => setCatalog([]))
    void listQuizzes(me, false).then((r) => setMine(r.filter((x) => x.ownerUid === me))).catch(() => setMine([]))
  }, [me])
  const pub = useMemo(() => new Map((catalog ?? []).map((c) => [c.id, c])), [catalog])
  const rows: Row[] | null = useMemo(() => {
    if (!catalog || !mine) return null
    const list: Row[] = src === 'mine'
      ? mine.map((x) => ({ id: x.id, title: x.title, emoji: x.coverEmoji ?? '🎯', count: x.count, published: pub.has(x.id) && !pub.get(x.id)!.hidden, mine: true }))
      : catalog.filter((c) => !c.hidden && c.status !== 'review' && (!c.unlisted || c.publishedBy === me))
        .map((c) => ({ id: c.id, title: c.title, emoji: c.coverEmoji ?? '📘', count: c.questionCount ?? 0, published: true, mine: c.publishedBy === me }))
    const needle = q.trim().toLocaleLowerCase('az-AZ')
    return list.filter((r) => !exclude.includes(r.id) && (!needle || r.title.toLocaleLowerCase('az-AZ').includes(needle)))
  }, [catalog, mine, src, q, exclude, pub, me])

  const pick = async (r: Row) => {
    if (r.published) return onPick({ quizId: r.id, title: r.title, emoji: r.emoji })
    setBusy(r.id)
    try {
      await publishToCatalog(r.id, author, {}, { unlisted: true })
      setCatalog(await listCatalog(true).catch(() => catalog))
      onPick({ quizId: r.id, title: r.title, emoji: r.emoji })
    } catch (e) {
      toast(e instanceof ModerationError ? C.modFail : (e as Error).message === 'no-scored' ? C.noScored : t.app.error, 'error')
    } finally { setBusy('') }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented size="sm" value={src} onChange={setSrc} options={[{ value: 'mine', label: C.source.mine }, { value: 'catalog', label: C.source.catalog }]} />
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input h-9 min-h-9 pl-9 text-sm" placeholder={C.search} value={q} onChange={(e) => setQ(e.target.value)} aria-label={C.search} />
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto rounded-xl border border-line scrollbar-thin" role="listbox" aria-label={src === 'mine' ? C.source.mine : C.source.catalog}>
        {!rows ? <div className="flex flex-col gap-2 p-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-11" />)}</div>
          : rows.length === 0 ? <p className="p-6 text-center text-sm text-muted">{C.nothing}</p>
          : rows.map((r) => {
            const on = selected === r.id
            return (
              <button key={r.id} type="button" role="option" aria-selected={on} disabled={!!busy} onClick={() => void pick(r)}
                className={`flex w-full items-center gap-3 border-b border-line px-3 py-2.5 text-left text-sm transition last:border-b-0 ${on ? 'bg-orange-500/10' : 'hover:bg-white/[.04]'}`}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-white/[.04] text-lg">{r.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.title}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted">{t.admin.questionsCount(r.count)}
                    {src === 'mine' && (r.published ? <><span>·</span><Globe2 className="h-3 w-3" />{C.published}</> : <><span>·</span><Lock className="h-3 w-3" />{C.private}</>)}
                  </span>
                </span>
                {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin text-muted" /> : on ? <Check className="h-4 w-4 text-orange-300" /> : null}
              </button>
            )
          })}
      </div>
      {src === 'mine' && <p className="text-xs text-muted">{C.willPublish}</p>}
    </div>
  )
}
