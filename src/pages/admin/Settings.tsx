import { useEffect, useState } from 'react'
import { Save, ShieldCheck, SlidersHorizontal } from 'lucide-react'
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
        <p className="text-xs leading-relaxed text-muted">{t.admin.credits}</p>
      </div>
    </div>
  )
}
