import { useRef, useState } from 'react'
import { Building2, ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { t } from '../i18n/az'
import type { AdminState } from '../firebase/auth'
import type { Brand, TrainerProfile } from '../types'
import { saveProfile } from '../firebase/db'
import { MediaError, removeMedia, uploadMedia } from '../lib/media'
import { hasFeature } from '../lib/roles'
import { Field, Section, SwitchRow } from './kit'
import { LockedCard } from './Premium'
import { BrandLogo, brandVars } from './CompanyBrand'
import { toast } from './dialogs'

const B = t.brand
const COLORS = ['#F0262F', '#FF7A1A', '#F59E0B', '#16A34A', '#0D9488', '#0EA5E9', '#2563EB', '#4F46E5', '#7C3AED', '#DB2777', '#0F172A']

/** Şirkət brendi: loqo, ad və vurğu rəngi — oyun ekranlarında (aparıcı və oyunçu) Jabr loqosunun yerində görünür. */
export function BrandSettings({ admin, profile, onChange }: { admin: AdminState; profile: TrainerProfile; onChange: (b: TrainerProfile['brand']) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const uid = admin.user?.uid ?? ''
  if (admin.org.role === 'member') return <Section icon={Building2} title={B.title} sub={B.sub}><p className="text-sm text-muted">{B.member}</p></Section>
  if (!hasFeature(admin.plan.tier, 'branding')) return <LockedCard feature="branding" title={B.title}>{B.locked}</LockedCard>
  const b = profile.brand ?? {}
  const save = async (patch: TrainerProfile['brand']) => {
    const next = { ...b, ...patch }
    onChange(next)
    try { await saveProfile(uid, { brand: next }) } catch { toast(t.app.error, 'error') }
  }
  const pick = async (f?: File) => {
    if (!f) return
    setBusy(true)
    try { await save({ logo: await uploadMedia('logo', f), on: true }); toast(B.saved) }
    catch (e) { toast(t.photo.errors[e instanceof MediaError ? e.code : 'failed'], 'error') } finally { setBusy(false) }
  }
  const preview: Brand = { name: b.name ?? '', color: b.color ?? '', logo: b.logo ?? '' }
  return (
    <Section icon={Building2} title={B.title} sub={B.sub}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex flex-col gap-4">
          <SwitchRow checked={b.on === true} onChange={(v) => void save({ on: v })} label={B.on} desc={B.onDesc} />
          <Field label={B.name}><input className="input" maxLength={60} placeholder={profile.org || 'Acme Academy'} value={b.name ?? ''} onChange={(e) => onChange({ ...b, name: e.target.value })} onBlur={(e) => void save({ name: e.target.value.trim() })} /></Field>
          <Field label={B.logo} hint={B.logoHint}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-16 min-w-28 items-center justify-center rounded-xl border border-line bg-night px-4">
                {b.logo ? <img src={b.logo} alt="" className="max-h-10 max-w-40 object-contain" /> : <ImagePlus className="h-5 w-5 text-white/40" />}
              </span>
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? <Loader2 className="animate-spin" /> : <ImagePlus />}{b.logo ? B.changeLogo : B.uploadLogo}</button>
              {b.logo && <button type="button" className="btn btn-ghost-dark btn-sm hover:text-red-300" disabled={busy} onClick={() => { void removeMedia('logo'); void save({ logo: '' }) }}><Trash2 />{t.photo.remove}</button>}
              <input ref={input} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
            </div>
          </Field>
          <Field label={B.color}>
            <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={B.color}>
              <button type="button" role="radio" aria-checked={!b.color} onClick={() => void save({ color: '' })} className={`h-8 rounded-full border px-3 text-xs font-semibold ${!b.color ? 'border-orange-400/60 bg-orange-500/10' : 'border-line text-muted'}`}>{B.defaultColor}</button>
              {COLORS.map((c) => <button key={c} type="button" role="radio" aria-checked={b.color === c} aria-label={c} onClick={() => void save({ color: c })}
                className={`h-8 w-8 rounded-full border transition hover:scale-110 ${b.color === c ? 'border-[#fff] ring-2 ring-orange-400 ring-offset-2 ring-offset-[#171A33]' : 'border-white/15'}`} style={{ background: c }} />)}
              <label className="relative flex h-8 items-center rounded-full border border-dashed border-line-strong px-3 text-xs text-muted hover:text-fg">{t.av.custom}
                <input type="color" value={b.color || '#F0262F'} onChange={(e) => onChange({ ...b, color: e.target.value })} onBlur={(e) => void save({ color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" aria-label={B.color} />
              </label>
            </div>
          </Field>
        </div>
        {/* önizləmə: lobbi ekranının kiçik nüsxəsi */}
        <div className="theme-dark noise relative flex min-h-56 flex-col justify-between overflow-hidden rounded-2xl bg-night p-4 text-[#fff]" style={brandVars(b.on ? preview : null)}>
          <div className="flex items-center gap-2"><BrandLogo brand={b.on ? preview : null} size={24} /><span className="chip chip-dark ml-auto text-[10px]"><span className="h-1.5 w-1.5 rounded-full bg-red-500" />{t.host.live}</span></div>
          <div className="text-center">
            <div className="label-dark">PIN</div>
            <div className="font-display text-grad text-4xl font-black tracking-[.1em]">482 913</div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">{B.preview}</span>
            <span className="rounded-xl px-3 py-1.5 text-sm font-bold" style={{ background: 'var(--grad)' }}>12 {t.games.players}</span>
          </div>
        </div>
      </div>
    </Section>
  )
}
