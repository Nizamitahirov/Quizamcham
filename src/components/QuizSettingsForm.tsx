import { ClipboardList, MessageCircleQuestion, Star, Eye, Flame, Footprints, Gamepad2, LogIn, Music, Presentation, Repeat, ShieldCheck, Shuffle, Sparkles, Timer, Users, Volume2, Zap } from 'lucide-react'
import { t } from '../i18n/az'
import { ASSIGN_DAYS, AUTO_DELAYS, READ_TIMES, SELF_MINUTES, TIME_OPTIONS } from '../lib/defaults'
import { Field, OptionCards, Section, Segmented, SwitchRow, type OptionDef } from './kit'
import { MusicPicker } from './MusicPicker'
import type { QuizSettings } from '../types'
import { PremiumBadge, useFeature } from './Premium'
import { Gauge } from 'lucide-react'

/** Quiz ayarları — redaktorda və təlimçi profilində (standart ayarlar) istifadə olunur. */
export function SettingsForm({ s, onChange, maxPlayersCap }: { s: QuizSettings; onChange: (p: Partial<QuizSettings>) => void; maxPlayersCap?: number }) {
  const S = t.settings
  const modes: OptionDef<QuizSettings['mode']>[] = [
    { value: 'host', icon: Presentation, title: S.modes.host.title, desc: S.modes.host.desc },
    { value: 'auto', icon: Repeat, title: S.modes.auto.title, desc: S.modes.auto.desc },
    { value: 'self', icon: Footprints, title: S.modes.self.title, desc: S.modes.self.desc },
    { value: 'assign', icon: ClipboardList, title: S.modes.assign.title, desc: S.modes.assign.desc },
  ]
  const sec = (n: number) => ({ value: n, label: t.editor.sec(n) })
  const live = s.mode !== 'self' && s.mode !== 'assign'
  // Açarlar 3×3 şəbəkədə (boş sütun yaranmasın deyə iştirakçı açarları da buradadır)
  const switches: { icon: typeof Zap; checked: boolean; label: string; on: (v: boolean) => void }[] = [
    { icon: Zap, checked: s.powerUps !== false, label: S.powerUps, on: (v) => onChange({ powerUps: v }) },
    { icon: Flame, checked: s.streakBonus, label: S.streakBonus, on: (v) => onChange({ streakBonus: v }) },
    { icon: Eye, checked: s.showCorrect, label: S.showCorrect, on: (v) => onChange({ showCorrect: v }) },
    { icon: Shuffle, checked: s.shuffleQuestions, label: S.shuffleQuestions, on: (v) => onChange({ shuffleQuestions: v }) },
    { icon: Shuffle, checked: s.shuffleOptions, label: S.shuffleOptions, on: (v) => onChange({ shuffleOptions: v }) },
    { icon: MessageCircleQuestion, checked: s.qa !== false, label: S.qa, on: (v) => onChange({ qa: v }) },
    { icon: Star, checked: s.feedback !== false, label: S.feedbackOn, on: (v) => onChange({ feedback: v }) },
    { icon: LogIn, checked: s.lateJoin, label: S.lateJoin, on: (v) => onChange({ lateJoin: v }) },
    { icon: ShieldCheck, checked: s.nameFilter, label: S.nameFilter, on: (v) => onChange({ nameFilter: v }) },
  ]
  return (
    <div className="flex flex-col gap-4">
      <Section icon={Gamepad2} title={S.mode} sub={S.generalSub}>
        <OptionCards cols={4} value={s.mode} options={modes} onChange={(mode) => onChange({ mode })} />
        {s.mode === 'auto' && <Field className="mt-4" label={S.autoDelay}><Segmented value={s.autoDelay ?? 6} options={AUTO_DELAYS.map(sec)} onChange={(autoDelay) => onChange({ autoDelay })} /></Field>}
        {s.mode === 'assign' && <Field className="mt-4" label={S.assignDays}><Segmented value={s.assignDays ?? 7} options={ASSIGN_DAYS.map((n) => ({ value: n, label: S.days(n) }))} onChange={(assignDays) => onChange({ assignDays })} /></Field>}
        {s.mode === 'self' && <Field className="mt-4" label={S.selfMinutes}><Segmented value={s.selfMinutes ?? 15} options={SELF_MINUTES.map((n) => ({ value: n, label: S.minutes(n) }))} onChange={(selfMinutes) => onChange({ selfMinutes })} /></Field>}
        <ConfidenceRow s={s} onChange={onChange} />
        {(s.mode === 'self' || s.mode === 'assign') && (
          <div className={`mt-4 grid gap-2 ${s.mode === 'self' ? 'lg:grid-cols-2' : ''}`}>
            <div className="rounded-xl border border-line px-3"><SwitchRow icon={Shuffle} checked={s.selfShuffle !== false} onChange={(selfShuffle) => onChange({ selfShuffle })} label={S.selfShuffle} desc={S.selfShuffleHint} /></div>
            {s.mode === 'self' && <div className="rounded-xl border border-line px-3"><SwitchRow icon={Eye} checked={s.selfFeedback !== false} onChange={(selfFeedback) => onChange({ selfFeedback })} label={S.selfFeedback} desc={S.selfFeedbackHint} /></div>}
          </div>
        )}
      </Section>

      <Section icon={Timer} title={S.scoring} sub={S.generalSub}>
        <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">
          <Field label={S.scoring}><Segmented value={s.scoring} options={[{ value: 'speed', label: S.scoringSpeed }, { value: 'accuracy', label: S.scoringAccuracy }]} onChange={(scoring) => onChange({ scoring })} /></Field>
          {live && <Field label={S.leaderboardEvery}><Segmented value={s.leaderboardEvery} options={[{ value: 1, label: S.lbEach }, { value: 3, label: S.lb3 }, { value: 0, label: S.lbEnd }]} onChange={(v) => onChange({ leaderboardEvery: v as QuizSettings['leaderboardEvery'] })} /></Field>}
          <Field label={S.defaultTime} className={live ? '' : 'lg:col-span-1'}><Segmented size="sm" value={s.defaultTime} options={TIME_OPTIONS.map(sec)} onChange={(defaultTime) => onChange({ defaultTime })} /></Field>
          {live && <Field label={S.readTime}><Segmented value={s.readTime ?? 4} options={READ_TIMES.map((x) => ({ value: x, label: x === 0 ? S.readNone : t.editor.sec(x) }))} onChange={(readTime) => onChange({ readTime })} /></Field>}
        </div>
      </Section>

      <Section icon={Sparkles} title={S.tabs.gameplay} sub={S.gameplaySub}>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {switches.map((x) => (
            <div key={x.label} className="rounded-xl border border-line px-3">
              <SwitchRow icon={x.icon} checked={x.checked} onChange={x.on} label={x.label} />
            </div>
          ))}
        </div>
      </Section>

      <Section icon={Music} title={S.music} sub={S.musicSub}
        actions={<button type="button" role="switch" aria-checked={s.music.on} aria-label={S.music} onClick={() => onChange({ music: { ...s.music, on: !s.music.on } })} className={`relative h-7 w-12 shrink-0 rounded-full transition ${s.music.on ? '' : 'bg-white/15'}`} style={s.music.on ? { background: 'var(--grad)' } : undefined}><span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${s.music.on ? 'left-[1.4rem]' : 'left-0.5'}`} /></button>}>
        <div className={s.music.on ? '' : 'pointer-events-none opacity-40'}>
          <MusicPicker value={s.music.theme} onChange={(theme) => onChange({ music: { ...s.music, theme } })} />
          <label className="mt-4 flex items-center gap-3">
            <Volume2 className="h-4 w-4 text-muted" />
            <input type="range" min={0} max={100} value={s.music.volume} className="flex-1 accent-[#E8202A]" onChange={(e) => onChange({ music: { ...s.music, volume: Number(e.target.value) } })} aria-label={S.volume} />
            <span className="w-10 text-right text-sm font-bold">{s.music.volume}</span>
          </label>
        </div>
      </Section>

      <Section icon={Users} title={S.tabs.players} sub={S.playersSub}>
        <div className="grid items-start gap-x-8 gap-y-5 lg:grid-cols-2">
          <Field label={S.teams}>
            <Segmented value={s.teams ?? 0} options={[{ value: 0, label: S.teamsOff }, ...([2, 3, 4] as const).map((n) => ({ value: n, label: S.teamsN(n) }))]} onChange={(v) => onChange({ teams: v as QuizSettings['teams'] })} />
          </Field>
          <Field label={S.maxPlayers}>
            {maxPlayersCap ? (
              <div className="flex min-h-11 flex-wrap items-center gap-3 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
                <span className="font-display text-lg font-black tabular-nums">{maxPlayersCap}</span>
                <span className="flex-1">{t.acct.freeCapHint}</span>
                <a href="/pricing#request" className="btn btn-primary btn-sm">{t.acct.getLicense}</a>
              </div>
            ) : (
              <div className="flex min-h-11 items-center gap-3">
                <input type="range" min={10} max={200} step={10} value={s.maxPlayers} className="flex-1 accent-[#E8202A]" onChange={(e) => onChange({ maxPlayers: Number(e.target.value) })} aria-label={S.maxPlayers} />
                <span className="w-12 text-right text-lg font-black tabular-nums">{s.maxPlayers}</span>
              </div>
            )}
          </Field>
        </div>
      </Section>
    </div>
  )
}

/** Əminlik rejimi (Pro): oyunçu cavabdan sonra "əminəm / əmin deyiləm" seçir. */
function ConfidenceRow({ s, onChange }: { s: QuizSettings; onChange: (p: Partial<QuizSettings>) => void }) {
  const allowed = useFeature('confidence')
  return (
    <div className="mt-4 flex items-center gap-2 rounded-xl border border-line px-3">
      <div className="min-w-0 flex-1"><SwitchRow icon={Gauge} checked={allowed && !!s.confidence} onChange={(confidence) => allowed && onChange({ confidence })} label={t.settings.confidence} desc={t.settings.confidenceHint} /></div>
      {!allowed && <PremiumBadge feature="confidence" />}
    </div>
  )
}
