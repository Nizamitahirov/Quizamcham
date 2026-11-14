import { useEffect, useMemo, useRef, useState } from 'react'
import { FlaskConical, Send } from 'lucide-react'
import { t } from '../i18n/az'
import { campPreview, campSend, type AiLang, type CampContent, type CampFilter } from '../lib/ai'
import { ACCOUNT_TPLS, fromTpl, type Tpl } from '../lib/mailTemplates'
import { Modal } from './ui'
import { Field, Segmented } from './kit'
import { confirmDialog, toast } from './dialogs'

const C = t.camp
const LANGS: AiLang[] = ['az', 'ru', 'en']
type Pick = (typeof ACCOUNT_TPLS)[number] | 'blank'

export interface MailTarget { email: string; name: string; lang?: string; tpl: Pick }
/** Konsoldakı statusa görə uyğun şablon: lisenziya bitib / bitir / sınaq bitib. */
export function tplFor(status: string, hadLicense: boolean, endsAt: Date | null): Pick {
  if (status === 'licensed') return 'expiring'
  if (status === 'expired') return hadLicense ? 'renew' : 'trialEnded'
  if (status === 'trial' && endsAt) return 'trialEnded'
  return 'renew'
}

/** Super admin: bir istifadəçiyə şablonla məktub — şablon seç, önizlə, özünə test et, göndər (xidməti elan, kampaniya tarixçəsində qalır). */
export function MailUserDialog({ target, onClose }: { target: MailTarget | null; onClose: () => void }) {
  const [tpl, setTpl] = useState<Pick>('renew')
  const [lang, setLang] = useState<AiLang>('az')
  const [content, setContent] = useState<CampContent>(() => fromTpl('az', 'renew'))
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null)
  const [busy, setBusy] = useState<'' | 'test' | 'send'>('')
  useEffect(() => {
    if (!target) return
    const l: AiLang = target.lang === 'ru' || target.lang === 'en' ? target.lang : 'az'
    setLang(l); setTpl(target.tpl); setContent(fromTpl(l, target.tpl as Tpl)); setPreview(null)
  }, [target])
  const filter = useMemo<CampFilter>(() => ({ audience: 'custom', tiers: [], langs: [], joinedDays: 0, emails: target ? [target.email] : [], kind: 'service', license: 'any', licenseDays: 0 }), [target])
  const pick = (k: Pick, l = lang) => { setTpl(k); setLang(l); setContent(fromTpl(l, k as Tpl)) }
  const seq = useRef(0)
  useEffect(() => {
    if (!target) return
    const n = ++seq.current
    const id = setTimeout(() => {
      if (!content.subject.trim() || !content.title.trim()) return setPreview(null)
      void campPreview(content, filter).then((p) => { if (n === seq.current) setPreview(p) }).catch(() => {})
    }, 300)
    return () => clearTimeout(id)
  }, [content, filter, target])
  if (!target) return null
  const ready = !!content.subject.trim() && !!content.title.trim()
  const errMsg = (e: unknown) => C.errors[(e as { code?: string }).code ?? ''] ?? (e as Error).message
  const test = async () => {
    setBusy('test')
    try { const r = await campSend(content, filter, true); if (r.sent) toast(C.testSent(r.to ?? '')); else toast(t.mailTest.fail(r.error ?? ''), 'error') } catch (e) { toast(errMsg(e), 'error') } finally { setBusy('') }
  }
  const send = async () => {
    if (!(await confirmDialog({ title: C.one.confirm(target.email), body: preview?.subject ?? '', ok: C.one.send }))) return
    setBusy('send')
    try { await campSend(content, filter); toast(C.one.sent(target.email)); onClose() } catch (e) { toast(errMsg(e), 'error') } finally { setBusy('') }
  }
  return (
    <Modal open onClose={onClose} title={C.one.title} sub={`${target.name ? `${target.name} · ` : ''}${target.email}`} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <Field label={C.templates}>
            <Segmented size="sm" value={tpl} onChange={(k) => pick(k)} options={[...ACCOUNT_TPLS, 'blank' as const].map((k) => ({ value: k, label: C.tplNames[k] }))} />
          </Field>
          <Field label={C.letterLang}><Segmented size="sm" value={lang} onChange={(l) => pick(tpl, l)} options={LANGS.map((x) => ({ value: x, label: x.toUpperCase() }))} /></Field>
        </div>
        <Field label={C.subject}><input className="input" maxLength={200} value={content.subject} onChange={(e) => setContent((c) => ({ ...c, subject: e.target.value }))} /></Field>
        <Field label={C.heading}><input className="input" maxLength={200} value={content.title} onChange={(e) => setContent((c) => ({ ...c, title: e.target.value }))} /></Field>
        <Field label={C.body} hint={C.bodyHint}><textarea className="input" rows={5} maxLength={8000} value={content.body} onChange={(e) => setContent((c) => ({ ...c, body: e.target.value }))} /></Field>
        <div className="overflow-hidden rounded-xl border border-line">
          <div className="border-b border-line px-4 py-2 text-sm"><span className="text-muted">{C.subjectLine}: </span><b className="break-words">{preview?.subject ?? '—'}</b></div>
          <div className="flex justify-center bg-[#05060c] p-2">
            {preview ? <iframe title={C.preview} sandbox="" srcDoc={preview.html} className="h-[46vh] min-h-[320px] w-full rounded-lg bg-[#090A13]" /> : <div className="flex h-40 items-center justify-center text-sm text-muted">…</div>}
          </div>
        </div>
        <p className="text-xs text-muted">{C.one.note}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn btn-secondary" disabled={!ready || !!busy} onClick={() => void test()}><FlaskConical className={busy === 'test' ? 'animate-pulse' : ''} />{C.test}</button>
          <button className="btn btn-primary" disabled={!ready || !!busy} onClick={() => void send()}><Send className={busy === 'send' ? 'animate-pulse' : ''} />{C.one.send}</button>
        </div>
      </div>
    </Modal>
  )
}
