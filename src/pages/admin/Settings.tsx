import { useEffect, useState } from 'react'
import { Bug, Database, Download, Save, ShieldCheck, SlidersHorizontal, Trash2 } from 'lucide-react'
import { cleanupGames, clearErrors, exportAll, listErrors, oldGames } from '../../lib/dataAdmin'
import { download } from '../../lib/csv'
import { loadAppSettings, saveAppSettings } from '../../firebase/db'
import { TIME_OPTIONS } from '../../lib/defaults'
import { t } from '../../i18n/az'
import { PageHeader, Spinner } from '../../components/ui'
import { Field, Section, Segmented } from '../../components/kit'
import type { AppSettings } from '../../types'

export default function Settings() {
  const [s, setS] = useState<AppSettings | null>(null)
  const [words, setWords] = useState('')
  const [msg, setMsg] = useState('')
  useEffect(() => { void loadAppSettings().then((x) => { setS(x); setWords(x.bannedWords.join(', ')) }) }, [])
  if (!s) return <div className="p-10"><Spinner /></div>
  const S = t.settings
  const save = async () => {
    const next = { ...s, bannedWords: words.split(',').map((w) => w.trim()).filter(Boolean) }
    try { await saveAppSettings(next); setS(next); setMsg(S.saved) } catch { setMsg(t.app.error) }
  }
  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-8">
      <PageHeader title={S.appTitle}>
        {msg && <span className="text-sm font-semibold text-ok" role="status">{msg}</span>}
        <button className="btn btn-primary" onClick={() => void save()}><Save />{t.app.save}</button>
      </PageHeader>
      <div className="flex flex-col gap-4">
        <Section icon={SlidersHorizontal} title={S.appTitle}>
          <div className="flex flex-col gap-5">
            <Field label={S.appDefaultTime}><Segmented size="sm" value={s.defaultTime} options={TIME_OPTIONS.map((x) => ({ value: x, label: t.editor.sec(x) }))} onChange={(defaultTime) => setS({ ...s, defaultTime })} /></Field>
            <Field label={`${S.appMusicVolume}: ${s.musicVolume}`}><input type="range" min={0} max={100} value={s.musicVolume} className="w-full accent-[#E8202A]" onChange={(e) => setS({ ...s, musicVolume: Number(e.target.value) })} /></Field>
            <Field label={S.brandText}><input className="input" value={s.brandText} maxLength={40} onChange={(e) => setS({ ...s, brandText: e.target.value })} /></Field>
          </div>
        </Section>
        <Section icon={ShieldCheck} title={S.nameFilter}>
          <Field label={S.bannedWords}><textarea className="input" rows={3} value={words} onChange={(e) => setWords(e.target.value)} /></Field>
        </Section>
        <DataSection />
        <ErrorLog />
        <p className="text-xs leading-relaxed text-muted">{t.admin.credits}</p>
      </div>
    </div>
  )
}

function DataSection() {
  const D = t.data
  const [days, setDays] = useState(30)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const cleanup = async () => {
    setBusy(true); setMsg('')
    try {
      const list = await oldGames(days)
      if (!list.length) { setMsg(D.none); return }
      if (!confirm(D.cleanupConfirm(list.length))) return
      setMsg(D.cleaned(await cleanupGames(days)))
    } catch { setMsg(t.app.error) } finally { setBusy(false) }
  }
  const exp = async () => {
    setBusy(true); setMsg(D.exporting)
    try { download(`quizamcham-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(await exportAll(), null, 2), 'application/json'); setMsg('') } catch { setMsg(t.app.error) } finally { setBusy(false) }
  }
  return (
    <Section icon={Database} title={D.title} sub={D.sub}>
      <div className="flex flex-col gap-5">
        <Field label={D.cleanup}>
          <div className="flex flex-wrap items-center gap-3">
            <Segmented value={days} options={[7, 30, 90, 180].map((d) => ({ value: d, label: D.olderThan(d) }))} onChange={setDays} />
            <button className="btn btn-danger" disabled={busy} onClick={() => void cleanup()}><Trash2 />{D.cleanupBtn}</button>
          </div>
        </Field>
        <div><button className="btn btn-secondary" disabled={busy} onClick={() => void exp()}><Download />{D.exportAll}</button></div>
        {msg && <p className="text-sm font-semibold text-muted">{msg}</p>}
      </div>
    </Section>
  )
}

function ErrorLog() {
  const D = t.data
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listErrors>> | null>(null)
  const load = () => { void listErrors().then(setRows).catch(() => setRows([])) }
  useEffect(load, [])
  return (
    <Section icon={Bug} title={D.errors} actions={rows?.length ? <button className="btn btn-ghost-dark btn-sm" onClick={async () => { await clearErrors(); load() }}><Trash2 />{D.clearErrors}</button> : undefined}>
      {!rows ? <Spinner /> : rows.length === 0 ? <p className="text-sm text-muted">{D.noErrors}</p> : (
        <ul className="scrollbar-thin flex max-h-80 flex-col gap-2 overflow-auto">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl bg-surface p-3 text-xs">
              <div className="font-bold text-red-700">{r.message}</div>
              <div className="mt-1 text-muted">{r.at?.toDate().toLocaleString('az-AZ')} · {r.url} · {r.context}</div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
