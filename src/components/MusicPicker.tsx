import { useEffect, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { THEME_LIST, THEMES } from '../audio/themes'
import { audio } from '../audio/AudioEngine'
import { t } from '../i18n/az'
import type { MusicTheme } from '../types'

/** 14 musiqi mövzusundan seçim + 8 saniyəlik dinləmə. */
export function MusicPicker({ value, onChange }: { value: MusicTheme; onChange: (v: MusicTheme) => void }) {
  const [playing, setPlaying] = useState<MusicTheme | null>(null)
  useEffect(() => () => audio.stopMusic(), [])
  const toggle = (th: MusicTheme) => {
    if (playing === th) { audio.stopMusic(); setPlaying(null); return }
    audio.setVolume(70)
    audio.preview(th)
    setPlaying(th)
    window.setTimeout(() => setPlaying((p) => (p === th ? null : p)), 8000)
  }
  return (
    // 14 mövzu: telefonda 2×7, genişdə 7×2 — boş xana qalmır
    <div className="grid grid-cols-2 gap-2 md:grid-cols-7" role="radiogroup">
      {THEME_LIST.map((th) => {
        const on = th === value
        return (
          <div key={th} className={`relative flex items-center gap-2 rounded-2xl border p-2 transition md:flex-col md:items-start md:p-3 ${on ? 'border-transparent shadow-[0_0_0_2px_#E8202A]' : 'border-line hover:border-line-strong'}`}>
            <button type="button" role="radio" aria-checked={on} onClick={() => onChange(th)} className="flex min-w-0 flex-1 items-center gap-2 text-left md:w-full md:flex-col md:items-start">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${on ? '' : 'bg-surface'}`} style={on ? { background: 'var(--grad)' } : undefined}>{t.settings.themeEmoji[th]}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{t.settings.themes[th]}</span>
                <span className="block text-[11px] text-muted">{THEMES[th].bpm} BPM</span>
              </span>
            </button>
            <button type="button" onClick={() => toggle(th)} aria-label={`${playing === th ? t.settings.stop : t.settings.preview}: ${t.settings.themes[th]}`}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full md:absolute md:right-2 md:top-2 ${playing === th ? 'text-white' : 'bg-white/10 text-fg hover:bg-white/15'}`} style={playing === th ? { background: 'var(--grad)' } : undefined}>
              {playing === th ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            </button>
          </div>
        )
      })}
    </div>
  )
}
