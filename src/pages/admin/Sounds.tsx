import { useEffect, useMemo, useRef, useState } from 'react'
import { Frown, Music2, PartyPopper, Play, Save, Trash2, Upload } from 'lucide-react'
import { loadSounds, saveSoundClip, setSoundsEnabled } from '../../firebase/db'
import { cutClip, decodeFile, MAX_CLIP_SEC, peaks } from '../../lib/soundClip'
import { audio } from '../../audio/AudioEngine'
import { t } from '../../i18n/az'
import { PageHeader, Spinner } from '../../components/ui'
import { Field, Section, SwitchRow } from '../../components/kit'
import type { SoundClip, SoundSettings } from '../../types'

const S = t.sounds

function playData(data: string) {
  const a = new Audio(data)
  void a.play().catch(() => {})
}

export default function Sounds() {
  const [s, setS] = useState<SoundSettings | null>(null)
  useEffect(() => { void loadSounds().then(setS) }, [])
  if (!s) return <div className="p-10"><Spinner /></div>
  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-8">
      <PageHeader title={S.title} sub={S.sub} />
      <div className="card mb-4 px-5">
        <SwitchRow icon={Music2} checked={s.enabled} onChange={(v) => { setS({ ...s, enabled: v }); void setSoundsEnabled(v) }} label={S.enabled} desc={S.hint} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ClipEditor kind="correct" clip={s.correct ?? null} onSaved={(c) => setS({ ...s, correct: c })} />
        <ClipEditor kind="wrong" clip={s.wrong ?? null} onSaved={(c) => setS({ ...s, wrong: c })} />
      </div>
    </div>
  )
}

function ClipEditor({ kind, clip, onSaved }: { kind: 'correct' | 'wrong'; clip: SoundClip | null; onSaved: (c: SoundClip | null) => void }) {
  const [buf, setBuf] = useState<AudioBuffer | null>(null)
  const [name, setName] = useState('')
  const [start, setStart] = useState(0)
  const [dur, setDur] = useState(5)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const pk = useMemo(() => (buf ? peaks(buf, 160) : []), [buf])
  const Icon = kind === 'correct' ? PartyPopper : Frown

  const pick = async (f: File | undefined) => {
    if (!f) return
    setBusy(true); setMsg('')
    try { const b = await decodeFile(f); setBuf(b); setName(f.name); setStart(0); setDur(Math.min(5, b.duration)) } catch { setMsg(t.admin.importBad) } finally { setBusy(false) }
  }
  const preview = async () => { if (buf) playData(await cutClip(buf, start, dur)) }
  const save = async () => {
    if (!buf) return
    setBusy(true); setMsg(S.processing)
    try {
      const data = await cutClip(buf, start, dur)
      const c: SoundClip = { data, name, start, duration: dur }
      await saveSoundClip(kind, c)
      onSaved(c); setBuf(null); setMsg(S.saved)
    } catch { setMsg(t.app.error) } finally { setBusy(false) }
  }
  const builtin = () => { audio.unlock(); audio.setMuted(false); void audio.loadClips(null).then(() => (kind === 'correct' ? audio.correct() : audio.wrong())) }

  return (
    <Section icon={Icon} title={kind === 'correct' ? S.correct : S.wrong} sub={clip ? `${S.custom}: ${clip.name} · ${clip.start.toFixed(1)}s +${clip.duration.toFixed(1)}s` : S.builtin}>
      <div className="flex flex-wrap gap-2">
        {clip ? (
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => playData(clip.data)}><Play />{S.listen}</button>
            <button className="btn btn-ghost-dark btn-sm text-red-600" onClick={async () => { await saveSoundClip(kind, null); onSaved(null) }}><Trash2 />{S.remove}</button>
          </>
        ) : <button className="btn btn-secondary btn-sm" onClick={builtin}><Play />{S.builtin}</button>}
        <button className="btn btn-soft btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}><Upload />{S.upload}</button>
        <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      {buf && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="relative h-20 overflow-hidden rounded-xl bg-surface">
            <div className="absolute inset-0 flex items-center gap-px px-1">
              {pk.map((v, i) => {
                const tSec = (i / pk.length) * buf.duration
                const inSel = tSec >= start && tSec <= start + dur
                return <span key={i} className="flex-1 rounded-full" style={{ height: `${Math.max(4, v * 100)}%`, background: inSel ? 'var(--brand)' : '#C9CCDA' }} />
              })}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`${S.start}: ${start.toFixed(1)}`}><input type="range" className="w-full accent-[#E8202A]" min={0} max={Math.max(0, buf.duration - 0.5)} step={0.1} value={start} onChange={(e) => setStart(Number(e.target.value))} /></Field>
            <Field label={`${S.duration}: ${dur.toFixed(1)}`} hint={S.tooLong}><input type="range" className="w-full accent-[#E8202A]" min={0.5} max={Math.min(MAX_CLIP_SEC, buf.duration - start)} step={0.1} value={dur} onChange={(e) => setDur(Number(e.target.value))} /></Field>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={() => void preview()}><Play />{S.listen}</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void save()}><Save />{S.save}</button>
          </div>
        </div>
      )}
      {msg && <p className="mt-3 text-sm font-semibold text-muted">{msg}</p>}
    </Section>
  )
}
