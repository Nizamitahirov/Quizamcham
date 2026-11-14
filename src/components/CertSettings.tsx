import { useEffect, useRef, useState } from 'react'
import { Award, Download, ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { t } from '../i18n/az'
import type { AdminState } from '../firebase/auth'
import type { CertSettings as Cfg, TrainerProfile } from '../types'
import { saveProfile } from '../firebase/db'
import { MediaError, removeMedia, uploadMedia } from '../lib/media'
import { hasFeature } from '../lib/roles'
import { Field, Section, Segmented, SwitchRow } from './kit'
import { LockedCard } from './Premium'
import { toast } from './dialogs'

const C = t.certd
const COLORS = ['', '#F0262F', '#FF7A1A', '#B45309', '#16A34A', '#0D9488', '#2563EB', '#4F46E5', '#7C3AED', '#DB2777', '#0F172A']

/**
 * Sertifikat dizayneri: şablon, rəng, başlıq, imza edən şəxs və imza şəkli; canlı önizləmə.
 * "Jabr | şirkət loqosu" bloku və yoxlama QR-ı hər dizaynda sabit yerdə qalır (dəyişdirilmir).
 */
export function CertSettings({ admin, profile, onChange }: { admin: AdminState; profile: TrainerProfile; onChange: (c: Cfg) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [img, setImg] = useState('')
  const uid = admin.user?.uid ?? ''
  const c = profile.cert ?? {}
  const brand = profile.brand ?? {}
  const allowed = hasFeature(admin.plan.tier, 'branding') && admin.org.role !== 'member'
  // önizləmə: nümunə məlumatla, dizayn dəyişəndə yenidən çəkilir
  const key = JSON.stringify([c, brand.logo, brand.name, brand.color, brand.on, profile.name])
  useEffect(() => {
    if (!allowed) return
    let url = '', alive = true
    const id = setTimeout(() => {
      void import('../lib/certificate').then(async ({ renderCertificate }) => {
        const on = c.on === true
        const blob = await renderCertificate({
          name: C.sampleName, quiz: C.sampleQuiz, place: 1, total: 24, date: new Date(), completed: t.cert.completed,
          result: `${t.cert.place(1, 24)}  ·  ${t.cert.score('9 450')}`, trainer: profile.name, code: 'K7M2Q9XRT4', url: `${location.origin}/verify/K7M2Q9XRT4`,
          design: {
            template: on ? c.template ?? 'classic' : 'classic', color: on ? c.color || (brand.on ? brand.color ?? '' : '') : (brand.on ? brand.color ?? '' : ''),
            title: on ? c.title ?? '' : '', signer: on ? c.signer ?? '' : '', signerTitle: on ? c.signerTitle ?? '' : '', signature: on ? c.signature ?? '' : '',
            logo: brand.on ? brand.logo ?? '' : '', org: brand.on ? brand.name ?? '' : '',
          },
        })
        if (!alive) return
        url = URL.createObjectURL(blob); setImg(url)
      })
    }, 350)
    return () => { alive = false; clearTimeout(id); if (url) URL.revokeObjectURL(url) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, allowed])
  if (admin.org.role === 'member') return <Section icon={Award} title={C.title} sub={C.sub}><p className="text-sm text-muted">{C.member}</p></Section>
  if (!hasFeature(admin.plan.tier, 'branding')) return <LockedCard feature="branding" title={C.title}>{C.locked}</LockedCard>
  const save = async (patch: Cfg) => {
    const next = { ...c, ...patch }
    onChange(next)
    try { await saveProfile(uid, { cert: next }) } catch { toast(t.app.error, 'error') }
  }
  const pick = async (f?: File) => {
    if (!f) return
    setBusy(true)
    try { await save({ signature: await uploadMedia('sign', f), on: true }) } catch (e) { toast(t.photo.errors[e instanceof MediaError ? e.code : 'failed'], 'error') } finally { setBusy(false) }
  }
  const on = c.on === true
  return (
    <Section icon={Award} title={C.title} sub={C.sub}>
      <div className="flex flex-col gap-5">
        <SwitchRow checked={on} onChange={(v) => void save({ on: v })} label={C.on} desc={C.onDesc} />
        <div className={`grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] ${on ? '' : 'pointer-events-none opacity-50'}`} aria-disabled={!on}>
          <div className="flex flex-col gap-4">
            <Field label={C.template}><Segmented size="sm" value={c.template ?? 'classic'} onChange={(v) => void save({ template: v })} options={(['classic', 'modern', 'minimal'] as const).map((x) => ({ value: x, label: C.templates[x] }))} /></Field>
            <Field label={C.color}>
              <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={C.color}>
                {COLORS.map((x) => x ? (
                  <button key={x} type="button" role="radio" aria-checked={c.color === x} aria-label={x} onClick={() => void save({ color: x })}
                    className={`h-8 w-8 rounded-full border transition hover:scale-110 ${c.color === x ? 'border-[#fff] ring-2 ring-orange-400 ring-offset-2 ring-offset-[#171A33]' : 'border-white/15'}`} style={{ background: x }} />
                ) : <button key="auto" type="button" role="radio" aria-checked={!c.color} onClick={() => void save({ color: '' })} className={`h-8 rounded-full border px-3 text-xs font-semibold ${!c.color ? 'border-orange-400/60 bg-orange-500/10' : 'border-line text-muted'}`}>{C.auto}</button>)}
              </div>
            </Field>
            <Field label={C.heading} hint={C.headingHint}><input className="input" maxLength={60} placeholder={t.cert.title} value={c.title ?? ''} onChange={(e) => onChange({ ...c, title: e.target.value })} onBlur={(e) => void save({ title: e.target.value.trim() })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={C.signer}><input className="input" maxLength={60} placeholder={profile.name} value={c.signer ?? ''} onChange={(e) => onChange({ ...c, signer: e.target.value })} onBlur={(e) => void save({ signer: e.target.value.trim() })} /></Field>
              <Field label={C.signerTitle}><input className="input" maxLength={60} placeholder={t.cert.trainer} value={c.signerTitle ?? ''} onChange={(e) => onChange({ ...c, signerTitle: e.target.value })} onBlur={(e) => void save({ signerTitle: e.target.value.trim() })} /></Field>
            </div>
            <Field label={C.signature} hint={C.signatureHint}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-14 min-w-32 items-center justify-center rounded-xl border border-line bg-[#fff] px-3">
                  {c.signature ? <img src={c.signature} alt="" className="max-h-11 max-w-40 object-contain" /> : <ImagePlus className="h-5 w-5 text-[#9CA3AF]" />}
                </span>
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? <Loader2 className="animate-spin" /> : <ImagePlus />}{c.signature ? C.changeSig : C.uploadSig}</button>
                {c.signature && <button type="button" className="btn btn-ghost-dark btn-sm hover:text-red-300" disabled={busy} onClick={() => { void removeMedia('sign'); void save({ signature: '' }) }}><Trash2 />{t.photo.remove}</button>}
                <input ref={input} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
              </div>
            </Field>
            {!brand.on && <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-300">{C.noBrand}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <div className="overflow-hidden rounded-xl border border-line bg-[#fff] shadow-lg">{img ? <img src={img} alt={C.preview} className="block w-full" /> : <div className="flex aspect-[1754/1240] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#9CA3AF]" /></div>}</div>
            <div className="flex items-center justify-between gap-2 text-xs text-muted"><span>{C.fixedNote}</span>{img && <a className="btn btn-ghost-dark btn-sm" href={img} download="jabr-certificate-preview.png"><Download />{C.download}</a>}</div>
          </div>
        </div>
      </div>
    </Section>
  )
}
