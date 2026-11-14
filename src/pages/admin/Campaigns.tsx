import { useCallback, useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { CheckCircle2, Clock, FlaskConical, ImageIcon, Info, Mail, Megaphone, Monitor, Plus, Send, Smartphone, Trash2, Undo2, UserMinus, Users, X } from 'lucide-react'
import type { AdminState } from '../../firebase/auth'
import { t } from '../../i18n/az'
import { Field, Section, Segmented, EmptyState } from '../../components/kit'
import { confirmDialog, toast } from '../../components/dialogs'
import { blank, fromTpl, TPL_FILTER, type Tpl } from '../../lib/mailTemplates'
import { campAudience, campList, campPreview, campSend, type AiLang, type CampContent, type CampFilter, type CampItem, type CampLicense, type CampTier } from '../../lib/ai'

const C = t.camp
const TIERS: CampTier[] = ['trial', 'free', 'trainer', 'pro', 'business', 'team']
const LANGS: AiLang[] = ['az', 'ru', 'en']
const DRAFT = 'jabr.camp.draft'

const DEFAULT_FILTER: CampFilter = { audience: 'all', tiers: [], langs: [], joinedDays: 0, emails: [], kind: 'marketing', license: 'any', licenseDays: 0 }
const LICENSES: CampLicense[] = ['any', 'expiring', 'expired', 'trialEnded']

function loadDraft(): { content: CampContent; filter: CampFilter } {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT) ?? 'null') as { content: CampContent; filter: CampFilter } | null
    if (d?.content && d.filter) return { content: { ...blank('az'), ...d.content }, filter: { ...DEFAULT_FILTER, ...d.filter } }
  } catch { /* noop */ }
  return { content: fromTpl('az', 'launch'), filter: DEFAULT_FILTER }
}

/** Çoxseçimli nişan düymələri (boş seçim = hamısı). */
function ChipPick<T extends string>({ all, value, options, onChange }: { all: string; value: T[]; options: { value: T; label: string }[]; onChange: (v: T[]) => void }) {
  const cls = (on: boolean) => `rounded-full border px-3 py-1.5 text-xs font-semibold transition ${on ? 'border-orange-400/40 bg-orange-500/15 text-orange-200' : 'border-line bg-white/[.03] text-fg2 hover:bg-white/[.06]'}`
  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" className={cls(!value.length)} onClick={() => onChange([])}>{all}</button>
      {options.map((o) => { const on = value.includes(o.value); return <button key={o.value} type="button" aria-pressed={on} className={cls(on)} onClick={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])}>{o.label}</button> })}
    </div>
  )
}

export default function Campaigns() {
  const admin = useOutletContext<AdminState>()
  const [init] = useState(loadDraft)
  const [content, setContent] = useState<CampContent>(init.content)
  const [filter, setFilter] = useState<CampFilter>(init.filter)
  const [emailsText, setEmailsText] = useState(init.filter.emails.join('\n'))
  const [aud, setAud] = useState<Awaited<ReturnType<typeof campAudience>> | null>(null)
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null)
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [busy, setBusy] = useState<'' | 'test' | 'send'>('')
  const [items, setItems] = useState<CampItem[] | null>(null)
  const set = (p: Partial<CampContent>) => setContent((c) => ({ ...c, ...p }))
  const setF = (p: Partial<CampFilter>) => setFilter((f) => ({ ...f, ...p }))

  // qaralama yadda saxlanılır
  useEffect(() => { try { localStorage.setItem(DRAFT, JSON.stringify({ content, filter })) } catch { /* noop */ } }, [content, filter])
  useEffect(() => { const id = setTimeout(() => setF({ emails: emailsText.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean) }), 400); return () => clearTimeout(id) }, [emailsText])

  // auditoriya sayı (gecikmə ilə)
  const [audErr, setAudErr] = useState('')
  const [q, setQ] = useState('')
  const [showAll, setShowAll] = useState(false)
  useEffect(() => {
    setAud(null); setAudErr('')
    const id = setTimeout(() => { void campAudience(filter).then(setAud).catch((e: unknown) => { setAudErr((e as Error).message || C.audErr); setAud(null) }) }, 350)
    return () => clearTimeout(id)
  }, [filter])
  const excluded = filter.exclude ?? []
  const exclude = (email: string) => setF({ exclude: [...excluded, email] })
  const restore = (email: string) => setF({ exclude: excluded.filter((e) => e !== email) })
  // önizləmə
  const seq = useRef(0)
  useEffect(() => {
    const n = ++seq.current
    const id = setTimeout(() => {
      if (!content.subject.trim() || !content.title.trim()) return setPreview(null)
      void campPreview(content, filter).then((p) => { if (n === seq.current) setPreview(p) }).catch(() => {})
    }, 400)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, filter.license, filter.licenseDays])

  const loadList = useCallback(() => { void campList().then((r) => setItems(r.items)).catch(() => setItems([])) }, [])
  useEffect(loadList, [loadList])
  // göndərilən kampaniya varsa — gedişatı yenilə
  useEffect(() => {
    if (!items?.some((i) => i.status === 'sending')) return
    const id = setInterval(loadList, 3000)
    return () => clearInterval(id)
  }, [items, loadList])

  if (admin.role !== 'super') return <div className="mx-auto max-w-3xl p-4 sm:p-8"><p className="card p-6 text-sm font-semibold text-amber-300">{t.access.noPerm}</p></div>

  const errMsg = (e: unknown) => C.errors[(e as { code?: string }).code ?? ''] ?? (e as Error).message
  const test = async () => {
    setBusy('test')
    try { const r = await campSend(content, filter, true); if (r.sent) toast(C.testSent(r.to ?? '')); else toast(t.mailTest.fail(r.error ?? ''), 'error') } catch (e) { toast(errMsg(e), 'error') } finally { setBusy('') }
  }
  const send = async () => {
    const n = aud?.count ?? 0
    if (!n) return
    if (!(await confirmDialog({ title: C.confirm(n), body: C.confirmBody, ok: C.send(n) }))) return
    setBusy('send')
    try { const r = await campSend(content, filter); toast(C.started(r.total ?? n)); loadList() } catch (e) { toast(errMsg(e), 'error') } finally { setBusy('') }
  }
  const feats = content.features
  const setFeat = (i: number, p: Partial<CampContent['features'][number]>) => set({ features: feats.map((f, j) => (j === i ? { ...f, ...p } : f)) })
  const ready = !!content.subject.trim() && !!content.title.trim()

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl"><span className="icon-tile h-10 w-10"><Megaphone className="h-5 w-5" /></span>{C.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">{C.sub}</p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <Section icon={Users} title={C.audience} sub={C.audienceSub}>
            <div className="space-y-5">
              <Segmented value={filter.audience} onChange={(v) => setF({ audience: v })} options={[{ value: 'all', label: C.all }, { value: 'students', label: C.students }, { value: 'trainers', label: C.trainers }, { value: 'custom', label: C.custom }]} />
              {filter.audience === 'custom' ? (
                <Field label={C.emails} hint={C.emailsHint}><textarea className="input font-mono text-xs" rows={4} value={emailsText} onChange={(e) => setEmailsText(e.target.value)} placeholder={'ad@example.com\nsoyad@example.com'} /></Field>
              ) : (
                <>
                  {filter.audience === 'trainers' && <Field label={C.tiers}><ChipPick all={C.anyTier} value={filter.tiers} onChange={(v) => setF({ tiers: v })} options={TIERS.map((x) => ({ value: x, label: C.tierNames[x] }))} /></Field>}
                  {filter.audience === 'trainers' && (
                    <Field label={C.license}>
                      <Segmented size="sm" value={filter.license} onChange={(v) => setF({ license: v, licenseDays: v === 'expiring' ? 7 : 0 })} options={LICENSES.map((x) => ({ value: x, label: C.licOpts[x] }))} />
                      {filter.license !== 'any' && (
                        <div className="mt-2">
                          {filter.license === 'expiring'
                            ? <Segmented size="sm" value={filter.licenseDays || 7} onChange={(v) => setF({ licenseDays: v })} options={[7, 14, 30].map((d) => ({ value: d, label: C.licNext[d] }))} />
                            : <Segmented size="sm" value={filter.licenseDays} onChange={(v) => setF({ licenseDays: v })} options={[0, 7, 30, 90].map((d) => ({ value: d, label: C.licPast[d] }))} />}
                          <p className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-muted"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{C.licHint}</p>
                        </div>
                      )}
                    </Field>
                  )}
                  <Field label={C.langs}><ChipPick all={C.anyLang} value={filter.langs} onChange={(v) => setF({ langs: v })} options={LANGS.map((x) => ({ value: x, label: x.toUpperCase() }))} /></Field>
                  <Field label={C.joined}><Segmented size="sm" value={filter.joinedDays} onChange={(v) => setF({ joinedDays: v })} options={[0, 7, 30, 90].map((d) => ({ value: d, label: C.joinedOpts[d] }))} /></Field>
                </>
              )}
              <Field label={C.kind}>
                <Segmented size="sm" value={filter.kind} onChange={(v) => setF({ kind: v })} options={[{ value: 'marketing', label: C.marketing }, { value: 'service', label: C.service }]} />
                <p className={`mt-2 flex items-start gap-2 text-xs leading-relaxed ${filter.kind === 'service' ? 'text-amber-300' : 'text-muted'}`}><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{C.kindHint[filter.kind]}</p>
              </Field>
              <div className="rounded-2xl border border-line bg-white/[.03] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-2xl font-black tabular-nums">{aud ? aud.count : audErr ? '!' : '…'}</span>
                  <span className="text-sm text-fg2">{aud ? C.recipients(aud.count).replace(/^\d+\s*/, '') : audErr ? C.audErr : C.counting}</span>
                  {!!aud?.noConsent && <span className="chip chip-warn ml-auto" title={aud.noConsentEmails.join('\n')}>{C.noConsent(aud.noConsent)}</span>}
                </div>
                {audErr && <p className="mt-2 text-xs text-red-300">{audErr}</p>}
                {!!aud?.notFound.length && <p className="mt-2 text-xs text-amber-300" title={aud.notFound.join('\n')}>{C.notFound(aud.notFound.length)}: <span className="break-all font-mono">{aud.notFound.slice(0, 5).join(', ')}{aud.notFound.length > 5 ? '…' : ''}</span></p>}
                {aud && aud.count === 0 && (
                  <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">
                    <b>{C.zeroWhy}</b> {aud.noConsent ? C.zeroConsent(aud.noConsent) : aud.notFound.length ? C.notFound(aud.notFound.length) : C.zeroFilter}
                    {!!aud.noConsent && filter.kind === 'marketing' && <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={() => setF({ kind: 'service' })}>{C.service}</button>}
                  </div>
                )}
                {!!aud?.sample.length && (
                  <div className="mt-3 border-t border-line pt-3">
                    {aud.sample.length > 6 && <input className="input mb-2 h-9 text-xs" placeholder={C.search} value={q} onChange={(e) => setQ(e.target.value)} />}
                    <ul className={`space-y-1 ${showAll || q ? 'max-h-80 overflow-y-auto pr-1 scrollbar-thin' : ''}`}>
                      {aud.sample.filter((r) => !q || `${r.name} ${r.email}`.toLowerCase().includes(q.toLowerCase())).slice(0, showAll || q ? 5000 : 8).map((r) => (
                        <li key={r.email} className="group flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 text-xs hover:bg-white/[.04]">
                          <span className="truncate font-medium text-fg2">{r.name || '—'}</span><span className="truncate text-muted">{r.email}</span>
                          {r.until && filter.license !== 'any' && <span className="chip chip-warn ml-auto shrink-0">{(r.until > Date.now() ? C.until : C.ended)(new Date(r.until).toLocaleDateString())}</span>}
                          <span className={`chip chip-muted shrink-0 ${r.until && filter.license !== 'any' ? '' : 'ml-auto'}`}>{r.tier ? C.tierNames[r.tier] : C.students}</span><span className="chip chip-muted shrink-0">{r.lang.toUpperCase()}</span>
                          <button type="button" className="btn btn-ghost-dark btn-icon btn-sm shrink-0 hover:text-red-300" title={C.exclude} aria-label={`${C.exclude}: ${r.email}`} onClick={() => exclude(r.email)}><X /></button>
                        </li>
                      ))}
                    </ul>
                    {!showAll && !q && aud.sample.length > 8 && <button type="button" className="mt-2 text-xs font-semibold text-orange-300 hover:underline" onClick={() => setShowAll(true)}>{C.showAll(aud.sample.length)}</button>}
                  </div>
                )}
                {excluded.length > 0 && (
                  <div className="mt-3 border-t border-line pt-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted"><UserMinus className="h-3.5 w-3.5" />{C.excludedN(excluded.length)}<button type="button" className="ml-auto text-orange-300 hover:underline" onClick={() => setF({ exclude: [] })}>{C.clearExcluded}</button></div>
                    <div className="flex flex-wrap gap-1.5">
                      {excluded.map((e) => <button key={e} type="button" title={C.restore} className="chip chip-muted gap-1 line-through decoration-red-400/60 hover:no-underline" onClick={() => restore(e)}>{e}<Undo2 className="h-3 w-3" /></button>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Section>

          <Section icon={Mail} title={C.content} sub={C.contentSub}>
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <Field label={C.letterLang}><Segmented size="sm" value={content.lang} onChange={(v) => set({ lang: v })} options={LANGS.map((x) => ({ value: x, label: x.toUpperCase() }))} /></Field>
                <Field label={C.templates}>
                  <div className="flex flex-wrap gap-1.5">
                    {(['launch', 'offer', 'news', 'renew', 'expiring', 'trialEnded', 'blank'] as Tpl[]).map((k) => <button key={k} type="button" className="btn btn-secondary btn-sm" onClick={() => { setContent(fromTpl(content.lang, k)); const f = TPL_FILTER[k]; if (f) setF(f) }}>{C.tplNames[k]}</button>)}
                  </div>
                </Field>
              </div>
              <Field label={C.subject}><input className="input" maxLength={200} value={content.subject} onChange={(e) => set({ subject: e.target.value })} /></Field>
              <Field label={C.preheader} hint={C.preheaderHint}><input className="input" maxLength={200} value={content.preheader} onChange={(e) => set({ preheader: e.target.value })} /></Field>
              <Field label={C.heading}><input className="input" maxLength={200} value={content.title} onChange={(e) => set({ title: e.target.value })} /></Field>
              <Field label={C.hero}>
                <div className="relative"><ImageIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="input pl-9" type="url" placeholder="https://…" value={content.hero} onChange={(e) => set({ hero: e.target.value })} /></div>
              </Field>
              <Field label={C.body} hint={C.bodyHint}><textarea className="input" rows={6} maxLength={8000} value={content.body} onChange={(e) => set({ body: e.target.value })} /></Field>
              <div>
                <span className="label">{C.features}</span>
                <div className="space-y-2">
                  {feats.map((f, i) => (
                    <div key={i} className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-start gap-2 rounded-xl border border-line bg-white/[.02] p-2">
                      <input className="input px-0 text-center text-lg" maxLength={4} value={f.emoji} onChange={(e) => setFeat(i, { emoji: e.target.value })} aria-label="emoji" />
                      <div className="min-w-0 space-y-2">
                        <input className="input" placeholder={C.fTitle} maxLength={120} value={f.title} onChange={(e) => setFeat(i, { title: e.target.value })} />
                        <input className="input" placeholder={C.fText} maxLength={400} value={f.text} onChange={(e) => setFeat(i, { text: e.target.value })} />
                      </div>
                      <button type="button" className="btn btn-ghost-dark btn-icon btn-sm" aria-label="×" onClick={() => set({ features: feats.filter((_, j) => j !== i) })}><Trash2 /></button>
                    </div>
                  ))}
                  {feats.length < 4 && <button type="button" className="btn btn-secondary btn-sm" onClick={() => set({ features: [...feats, { emoji: '✨', title: '', text: '' }] })}><Plus />{C.addFeature}</button>}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={C.ctaLabel}><input className="input" maxLength={80} value={content.ctaLabel} onChange={(e) => set({ ctaLabel: e.target.value })} /></Field>
                <Field label={C.ctaUrl}><input className="input" type="url" value={content.ctaUrl} onChange={(e) => set({ ctaUrl: e.target.value })} /></Field>
              </div>
            </div>
          </Section>
        </div>

        <div className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <Section icon={Monitor} title={C.preview} actions={<Segmented size="sm" value={device} onChange={setDevice} options={[{ value: 'desktop', label: C.desktop }, { value: 'mobile', label: C.mobile }]} />} bodyClassName="p-0">
            <div className="border-b border-line px-5 py-3 text-sm"><span className="text-muted">{C.subjectLine}: </span><b className="break-words">{preview?.subject ?? '—'}</b></div>
            <div className="flex justify-center bg-[#05060c] p-3 sm:p-4">
              {preview
                ? <iframe title={C.preview} sandbox="" srcDoc={preview.html} className="h-[70vh] min-h-[480px] rounded-xl border border-line bg-[#090A13] transition-all" style={{ width: device === 'mobile' ? 375 : '100%', maxWidth: '100%' }} />
                : <div className="flex h-[50vh] items-center justify-center text-sm text-muted">{device === 'mobile' ? <Smartphone className="h-8 w-8 opacity-40" /> : <Monitor className="h-8 w-8 opacity-40" />}</div>}
            </div>
            <div className="space-y-3 border-t border-line p-4">
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-secondary" disabled={!ready || !!busy} onClick={() => void test()}><FlaskConical className={busy === 'test' ? 'animate-pulse' : ''} />{C.test}</button>
                <button className="btn btn-primary flex-1" disabled={!ready || !!busy || !aud?.count} onClick={() => void send()}><Send className={busy === 'send' ? 'animate-pulse' : ''} />{C.send(aud?.count ?? 0)}</button>
              </div>
              {(aud?.count ?? 0) > 300 && <p className="flex items-start gap-2 text-xs text-amber-300"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{C.limitNote}</p>}
            </div>
          </Section>
        </div>
      </div>

      <Section icon={Clock} title={C.history} bodyClassName="p-0">
        {!items ? <div className="skeleton m-5 h-16" /> : !items.length ? <EmptyState icon={Megaphone} title={C.empty} className="m-5 border-0 bg-transparent" /> : (
          <ul className="divide-y divide-line">
            {items.map((i) => {
              const pct = i.total ? Math.round(((i.sent + i.failed) / i.total) * 100) : 0
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <span className={`icon-tile h-9 w-9 ${i.status === 'done' ? 'text-emerald-300' : ''}`}>{i.status === 'done' ? <CheckCircle2 className="h-4 w-4" /> : <Send className="h-4 w-4 animate-pulse" />}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{i.subject}</div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                      <span>{new Date(i.createdAt).toLocaleString()}</span><span>{i.kind === 'service' ? C.service : C.marketing}</span><span>{i.lang.toUpperCase()}</span>
                      {i.errors[0] && <span className="truncate text-red-300" title={i.errors.join('\n')}>{i.errors[0]}</span>}
                    </div>
                    {i.status === 'sending' && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--grad)' }} /></div>}
                  </div>
                  <span className="chip chip-muted tabular-nums">{C.of(i.sent, i.total)}</span>
                  {!!i.failed && <span className="chip chip-bad">{C.failed(i.failed)}</span>}
                  <span className={`chip ${i.status === 'done' ? 'chip-ok' : 'chip-info'}`}>{C.status[i.status] ?? i.status}</span>
                </li>
              )
            })}
          </ul>
        )}
      </Section>
    </div>
  )
}
