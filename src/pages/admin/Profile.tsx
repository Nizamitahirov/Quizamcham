import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth'
import { Dices, KeyRound, Save, SlidersHorizontal, UserRound } from 'lucide-react'
import { loadProfile, saveProfile } from '../../firebase/db'
import { withDefaults } from '../../lib/defaults'
import { t } from '../../i18n/az'
import { PageHeader, Spinner } from '../../components/ui'
import { Field, Section } from '../../components/kit'
import { Avatar } from '../../components/Avatar'
import { PRESETS, randomAvatar } from '../../components/AvatarPicker'
import { SettingsForm } from '../../components/QuizSettingsForm'
import type { AdminState } from '../../firebase/auth'
import type { QuizSettings, TrainerProfile } from '../../types'

export default function Profile() {
  const { user } = useOutletContext<AdminState>()
  const [p, setP] = useState<TrainerProfile | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [cur, setCur] = useState('')
  const [pw, setPw] = useState('')
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (!user) return
    void loadProfile(user.uid).then((x) => setP(x ?? { name: '', title: '', org: '', bio: '', email: user.email ?? '', avatar: randomAvatar(), defaults: {} }))
  }, [user])
  if (!p || !user) return <div className="p-10"><Spinner /></div>

  const set = (patch: Partial<TrainerProfile>) => { setP({ ...p, ...patch }); setMsg('') }
  const defaults = withDefaults(p.defaults as QuizSettings)
  const save = async () => {
    setBusy(true)
    try { await saveProfile(user.uid, { ...p, email: user.email ?? '' }); setMsg(t.profile.saved) } catch { setMsg(t.app.error) } finally { setBusy(false) }
  }
  const changePw = async () => {
    setPwMsg(null)
    if (pw.length < 8) return setPwMsg({ ok: false, text: t.profile.pwShort })
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email ?? '', cur))
      await updatePassword(user, pw)
      setCur(''); setPw('')
      setPwMsg({ ok: true, text: t.profile.pwChanged })
    } catch (e) {
      const code = (e as { code?: string }).code ?? ''
      setPwMsg({ ok: false, text: code.includes('wrong-password') || code.includes('invalid-credential') ? t.profile.pwWrong : t.app.error })
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-8">
      <PageHeader title={t.profile.title} sub={t.profile.sub}>
        {msg && <span className="text-sm font-semibold text-ok">{msg}</span>}
        <button className="btn btn-primary" disabled={busy} onClick={() => void save()}><Save />{t.app.save}</button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* Önizləmə kartı — sağ sütunun hündürlüyünə uzanır, məzmun ortada */}
        <div className="noise relative flex min-h-80 flex-col justify-center overflow-hidden rounded-3xl bg-night p-6 text-white lg:h-full">
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full opacity-50 blur-3xl" style={{ background: '#E8202A' }} />
          <div className="absolute left-6 top-5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">{t.profile.previewHint}</div>
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-60 blur-3xl" style={{ background: '#FF7A1A' }} />
          <div className="relative flex flex-col items-center gap-3 text-center">
            <div className="rounded-full p-1.5" style={{ background: 'var(--grad)' }}>
              {p.photoUrl ? <img src={p.photoUrl} alt="" className="h-28 w-28 rounded-full object-cover" /> : p.avatar ? <Avatar avatar={p.avatar} size={112} /> : null}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-white/50">{t.profile.trainer}</div>
            <div className="text-2xl font-black">{p.name || '—'}</div>
            {(p.title || p.org) && <div className="text-sm text-white/65">{[p.title, p.org].filter(Boolean).join(' · ')}</div>}
            {p.bio && <p className="text-sm leading-relaxed text-white/75">{p.bio}</p>}
            <div className="chip chip-dark mt-1">{user.email}</div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Section icon={UserRound} title={t.profile.title} sub={t.profile.sub}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.profile.name}><input className="input" value={p.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} /></Field>
              <Field label={t.profile.jobTitle}><input className="input" value={p.title ?? ''} maxLength={60} onChange={(e) => set({ title: e.target.value })} /></Field>
              <Field label={t.profile.org}><input className="input" value={p.org ?? ''} maxLength={60} onChange={(e) => set({ org: e.target.value })} /></Field>
              <Field label={t.profile.photoUrl}><input className="input" placeholder="https://…" value={p.photoUrl ?? ''} onChange={(e) => set({ photoUrl: /^https:\/\//.test(e.target.value) || !e.target.value ? e.target.value : p.photoUrl })} /></Field>
              <Field label={t.profile.bio} className="sm:col-span-2"><textarea className="input" rows={3} maxLength={280} value={p.bio ?? ''} onChange={(e) => set({ bio: e.target.value })} /></Field>
              <Field label={t.profile.avatar} className="sm:col-span-2">
                <div className="flex flex-wrap items-center gap-2">
                  {PRESETS.map((a) => {
                    const on = p.avatar?.seed === a.seed && p.avatar?.style === a.style
                    return <button key={a.style + a.seed} type="button" onClick={() => set({ avatar: a, photoUrl: '' })} className={`rounded-full p-0.5 transition ${on ? 'ring-2 ring-brand ring-offset-2' : 'opacity-80 hover:opacity-100'}`}><Avatar avatar={a} size={40} /></button>
                  })}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => set({ avatar: randomAvatar(), photoUrl: '' })}><Dices />{t.join.random}</button>
                </div>
              </Field>
            </div>
          </Section>

          <Section icon={KeyRound} title={t.profile.security} sub={user.email ?? ''}>
            <div className="grid items-end gap-4 md:grid-cols-[1fr_1fr_auto]">
              <Field label={t.profile.currentPw}><input className="input" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
              <Field label={t.profile.newPw}><input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
              <button className="btn btn-secondary" disabled={!cur || !pw} onClick={() => void changePw()}>{t.profile.changePw}</button>
            </div>
            {pwMsg && <p className={`mt-3 text-sm font-semibold ${pwMsg.ok ? 'text-ok' : 'text-red-600'}`}>{pwMsg.text}</p>}
          </Section>
        </div>
      </div>

      <div className="mb-3 mt-8 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl text-brand" style={{ background: 'var(--grad-soft)' }}><SlidersHorizontal className="h-5 w-5" /></span>
        <div><h2 className="text-lg font-bold">{t.profile.defaults}</h2><p className="text-xs text-muted">{t.profile.defaultsSub}</p></div>
      </div>
      <SettingsForm s={defaults} onChange={(patch) => set({ defaults: { ...defaults, ...patch } })} />
    </div>
  )
}
