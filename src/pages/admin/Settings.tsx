import { useEffect, useState } from 'react'
import { loadAppSettings, saveAppSettings } from '../../firebase/db'
import { TIME_OPTIONS } from '../../lib/defaults'
import { t } from '../../i18n/az'
import { PageHeader, Spinner } from '../../components/ui'
import { Save } from 'lucide-react'
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
    <div className="mx-auto max-w-2xl p-4 sm:p-8">
      <PageHeader title={S.appTitle} />
      <div className="card flex flex-col gap-4 p-5">
        <div>
          <label className="label">{S.appDefaultTime}</label>
          <select className="input" value={s.defaultTime} onChange={(e) => setS({ ...s, defaultTime: Number(e.target.value) })}>
            {TIME_OPTIONS.map((x) => <option key={x} value={x}>{t.editor.sec(x)}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{S.appMusicVolume}: {s.musicVolume}</label>
          <input type="range" min={0} max={100} value={s.musicVolume} className="w-full accent-[#E8202A]" onChange={(e) => setS({ ...s, musicVolume: Number(e.target.value) })} />
        </div>
        <div>
          <label className="label">{S.brandText}</label>
          <input className="input" value={s.brandText} maxLength={40} onChange={(e) => setS({ ...s, brandText: e.target.value })} />
        </div>
        <div>
          <label className="label">{S.bannedWords}</label>
          <textarea className="input" rows={3} value={words} onChange={(e) => setWords(e.target.value)} />
        </div>
        {msg && <p className="text-sm font-semibold text-ok" role="status">{msg}</p>}
        <button className="btn btn-primary" onClick={() => void save()}><Save />{t.app.save}</button>
      </div>
      <p className="mt-6 text-xs leading-relaxed text-muted">{t.admin.credits}</p>
    </div>
  )
}
