import { ClipboardList, MessageCircleQuestion, Star, Eye, Flame, Footprints, Gamepad2, LogIn, Music, Presentation, Repeat, ShieldCheck, Shuffle, Sparkles, Timer, Users, Volume2, Zap } from 'lucide-react'
import { t } from '../i18n/az'
import { ASSIGN_DAYS, AUTO_DELAYS, READ_TIMES, SELF_MINUTES, TIME_OPTIONS } from '../lib/defaults'
import { Field, OptionCards, Section, Segmented, SwitchRow, type OptionDef } from './kit'
import { MusicPicker } from './MusicPicker'
import type { QuizSettings } from '../types'

/** Quiz ayarları — redaktorda və təlimçi profilində (standart ayarlar) istifadə olunur. */
export function SettingsForm({ s, onChange }: { s: QuizSettings; onChange: (p: Partial<QuizSettings>) => void }) {
  const S = t.settings
  const modes: OptionDef<QuizSettings['mode']>[] = [
    { value: 'host', icon: Presentation, title: S.modes.host.title, desc: S.modes.host.desc },
    { value: 'auto', icon: Repeat, title: S.modes.auto.title, desc: S.modes.auto.desc },
    { value: 'self', icon: Footprints, title: S.modes.self.title, desc: S.modes.self.desc },
    { value: 'assign', icon: ClipboardList, title: S.modes.assign.title, desc: S.modes.assign.desc },
  ]
  const sec = (n: number) => ({ value: n, label: t.editor.sec(n) })
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Section icon={Gamepad2} title={S.mode} sub={S.generalSub} className="xl:col-span-2">
        <OptionCards cols={4} value={s.mode} options={modes} onChange={(mode) => onChange({ mode })} />
        {s.mode === 'auto' && <Field className="mt-4" label={S.autoDelay}><Segmented value={s.autoDelay ?? 6} options={AUTO_DELAYS.map(sec)} onChange={(autoDelay) => onChange({ autoDelay })} /></Field>}
        {s.mode === 'assign' && <Field className="mt-4" label={S.assignDays}><Segmented value={s.assignDays ?? 7} options={ASSIGN_DAYS.map((n) => ({ value: n, label: S.days(n) }))} onChange={(assignDays) => onChange({ assignDays })} /></Field>}
        {s.mode === 'self' && <Field className="mt-4" label={S.selfMinutes}><Segmented value={s.selfMinutes ?? 15} options={SELF_MINUTES.map((n) => ({ value: n, label: S.minutes(n) }))} onChange={(selfMinutes) => onChange({ selfMinutes })} /></Field>}
      </Section>

      <Section icon={Timer} title={S.scoring} sub={S.generalSub}>
        <div className="flex flex-col gap-4">
          <Field label={S.scoring}><Segmented value={s.scoring} options={[{ value: 'speed', label: S.scoringSpeed }, { value: 'accuracy', label: S.scoringAccuracy }]} onChange={(scoring) => onChange({ scoring })} /></Field>
          <Field label={S.defaultTime}><Segmented size="sm" value={s.defaultTime} options={TIME_OPTIONS.map(sec)} onChange={(defaultTime) => onChange({ defaultTime })} /></Field>
          {s.mode !== 'self' && s.mode !== 'assign' && <Field label={S.readTime}><Segmented value={s.readTime ?? 4} options={READ_TIMES.map((x) => ({ value: x, label: x === 0 ? S.readNone : t.editor.sec(x) }))} onChange={(readTime) => onChange({ readTime })} /></Field>}
          {s.mode !== 'self' && s.mode !== 'assign' && <Field label={S.leaderboardEvery}><Segmented value={s.leaderboardEvery} options={[{ value: 1, label: S.lbEach }, { value: 3, label: S.lb3 }, { value: 0, label: S.lbEnd }]} onChange={(v) => onChange({ leaderboardEvery: v as QuizSettings['leaderboardEvery'] })} /></Field>}
        </div>
      </Section>

      <Section icon={Sparkles} title={S.tabs.gameplay} sub={S.gameplaySub}>
        <div className="divide-y divide-line">
          <SwitchRow icon={Zap} checked={s.powerUps !== false} onChange={(v) => onChange({ powerUps: v })} label={S.powerUps} />
          <SwitchRow icon={Flame} checked={s.streakBonus} onChange={(v) => onChange({ streakBonus: v })} label={S.streakBonus} />
          <SwitchRow icon={Shuffle} checked={s.shuffleQuestions} onChange={(v) => onChange({ shuffleQuestions: v })} label={S.shuffleQuestions} />
          <SwitchRow icon={Shuffle} checked={s.shuffleOptions} onChange={(v) => onChange({ shuffleOptions: v })} label={S.shuffleOptions} />
          <SwitchRow icon={Eye} checked={s.showCorrect} onChange={(v) => onChange({ showCorrect: v })} label={S.showCorrect} />
          <SwitchRow icon={MessageCircleQuestion} checked={s.qa !== false} onChange={(v) => onChange({ qa: v })} label={S.qa} />
          <SwitchRow icon={Star} checked={s.feedback !== false} onChange={(v) => onChange({ feedback: v })} label={S.feedbackOn} />
        </div>
      </Section>

      <Section icon={Music} title={S.music} sub={S.musicSub} className="xl:col-span-2"
        actions={<button type="button" role="switch" aria-checked={s.music.on} onClick={() => onChange({ music: { ...s.music, on: !s.music.on } })} className={`relative h-7 w-12 shrink-0 rounded-full transition ${s.music.on ? '' : 'bg-slate-300'}`} style={s.music.on ? { background: 'var(--grad)' } : undefined}><span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${s.music.on ? 'left-[1.4rem]' : 'left-0.5'}`} /></button>}>
        <div className={s.music.on ? '' : 'pointer-events-none opacity-40'}>
          <MusicPicker value={s.music.theme} onChange={(theme) => onChange({ music: { ...s.music, theme } })} />
          <label className="mt-4 flex items-center gap-3">
            <Volume2 className="h-4 w-4 text-muted" />
            <input type="range" min={0} max={100} value={s.music.volume} className="flex-1 accent-[#E8202A]" onChange={(e) => onChange({ music: { ...s.music, volume: Number(e.target.value) } })} aria-label={S.volume} />
            <span className="w-10 text-right text-sm font-bold">{s.music.volume}</span>
          </label>
        </div>
      </Section>

      <Section icon={Users} title={S.tabs.players} sub={S.playersSub} className="xl:col-span-2">
        <div className="grid gap-x-8 md:grid-cols-2">
          <div className="divide-y divide-line">
            <SwitchRow icon={LogIn} checked={s.lateJoin} onChange={(v) => onChange({ lateJoin: v })} label={S.lateJoin} />
            <SwitchRow icon={ShieldCheck} checked={s.nameFilter} onChange={(v) => onChange({ nameFilter: v })} label={S.nameFilter} />
          </div>
          <Field label={S.teams} className="py-3">
            <Segmented value={s.teams ?? 0} options={[{ value: 0, label: S.teamsOff }, ...([2, 3, 4] as const).map((n) => ({ value: n, label: S.teamsN(n) }))]} onChange={(v) => onChange({ teams: v as QuizSettings['teams'] })} />
          </Field>
          <Field label={S.maxPlayers} className="py-3">
            <div className="flex items-center gap-3">
              <input type="range" min={10} max={200} step={10} value={s.maxPlayers} className="flex-1 accent-[#E8202A]" onChange={(e) => onChange({ maxPlayers: Number(e.target.value) })} />
              <span className="w-12 text-right text-lg font-black">{s.maxPlayers}</span>
            </div>
          </Field>
        </div>
      </Section>
    </div>
  )
}

