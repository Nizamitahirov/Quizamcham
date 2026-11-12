import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Copy, FlaskConical, Mail, RefreshCw, Server, XCircle } from 'lucide-react'
import { t } from '../../i18n/az'
import { Section, Segmented, SwitchRow } from '../../components/kit'
import { confirmDialog, toast } from '../../components/dialogs'
import { mailCfg, mailDiag, mailTest, setMailCfg, type MailCfg, type MailCheck, type MailProvider } from '../../lib/ai'

type Diag = Awaited<ReturnType<typeof mailDiag>>

/** Super admin: Brevo ↔ öz mail server (Contabo) keçidi + öz serverin hazırlıq yoxlaması. */
export function MailSettings() {
  const M = t.mailSrv
  const [cfg, setCfg] = useState<MailCfg | null>(null)
  const [diag, setDiag] = useState<Diag | null>(null)
  const [checking, setChecking] = useState(false)
  const [busy, setBusy] = useState<'' | MailProvider | 'save'>('')
  const check = useCallback(() => { setChecking(true); void mailDiag().then(setDiag, () => setDiag(null)).finally(() => setChecking(false)) }, [])
  useEffect(() => { void mailCfg().then(setCfg, () => setCfg(null)); check() }, [check])
  if (!cfg) return null
  const label = (p: MailProvider) => (p === 'smtp' ? M.smtp : M.brevo)

  const save = async (next: { provider: MailProvider; fallback: boolean }) => {
    if (next.provider === 'smtp' && cfg.provider !== 'smtp' && diag && !diag.ready
      && !(await confirmDialog({ title: M.notReady, body: M.notReadyBody, ok: M.smtp }))) return
    setBusy('save')
    try { setCfg(await setMailCfg(next)); toast(M.saved) } catch { toast(t.app.error, 'error') } finally { setBusy('') }
  }
  const test = async (p: MailProvider) => {
    setBusy(p)
    try {
      const r = await mailTest(p)
      if (r.sent) toast(M.sentVia(r.to, label(r.provider ?? p), !!r.fellBack)); else toast(t.mailTest.fail(r.error || `HTTP ${r.status}`), 'error')
    } catch (e) { toast(t.mailTest.fail((e as Error).message), 'error') } finally { setBusy('') }
  }
  const copy = (v: string) => { void navigator.clipboard?.writeText(v).then(() => toast(M.copied)) }

  return (
    <>
      <Section icon={Mail} title={M.title} sub={M.sub}>
        <div className="flex flex-col gap-4">
          <div>
            <span className="label">{M.provider}</span>
            <Segmented value={cfg.provider} onChange={(provider) => void save({ provider, fallback: cfg.fallback })} options={[{ value: 'brevo', label: M.brevo }, { value: 'smtp', label: M.smtp }]} />
            <p className="mt-2 text-xs leading-relaxed text-muted">{cfg.provider === 'smtp' ? M.smtpHint : M.brevoHint}</p>
            {!cfg.brevoConfigured && <p className="mt-1 text-xs font-semibold text-amber-300">{M.noBrevo}</p>}
          </div>
          <div className="border-t border-line"><SwitchRow checked={cfg.fallback} onChange={(fallback) => void save({ provider: cfg.provider, fallback })} label={M.fallback} desc={M.fallbackDesc} /></div>
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            {(['brevo', 'smtp'] as MailProvider[]).map((p) => (
              <button key={p} className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => void test(p)}><FlaskConical className={busy === p ? 'animate-pulse' : ''} />{M.test(label(p))}</button>
            ))}
          </div>
        </div>
      </Section>

      <Section icon={Server} title={M.diag} sub={diag ? `${M.diagSub} · ${diag.host}${diag.ip ? ` · ${diag.ip}` : ''}` : M.diagSub}
        actions={<button className="btn btn-ghost-dark btn-sm" disabled={checking} onClick={check}><RefreshCw className={checking ? 'animate-spin' : ''} />{M.recheck}</button>} bodyClassName="p-0">
        {!diag ? <div className="skeleton m-5 h-24" /> : (
          <ul className="divide-y divide-line">
            {diag.checks.map((c) => <CheckRow key={c.id} c={c} onCopy={copy} />)}
          </ul>
        )}
      </Section>
    </>
  )
}

function CheckRow({ c, onCopy }: { c: MailCheck; onCopy: (v: string) => void }) {
  const M = t.mailSrv
  const [title, hint] = M.checks[c.id] ?? [c.id, '']
  return (
    <li className="flex gap-3 px-5 py-4">
      {c.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{title}</span>
          <span className={`chip ${c.ok ? 'chip-ok' : 'chip-warn'}`}>{c.ok ? M.ready : M.missing}</span>
        </div>
        {!c.ok && <p className="mt-1 text-xs leading-relaxed text-muted">{hint}</p>}
        {c.value && c.value !== '—' && <p className="mt-1 break-all font-mono text-[11px] text-muted"><span className="font-sans font-semibold text-fg2">{M.current}: </span>{c.value}</p>}
        {!c.ok && c.expected && (
          <div className="mt-2 rounded-xl border border-line bg-white/[.03] p-3">
            <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{M.record}<span className="chip chip-muted normal-case tracking-normal">{c.expected.type}</span></div>
            <div className="grid gap-1.5 text-xs">
              {[c.expected.name, c.expected.value].map((v, i) => (
                <div key={i} className="flex min-w-0 items-start gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-lg bg-black/30 px-2 py-1.5 font-mono text-[11px] text-fg2">{v}</code>
                  <button type="button" className="btn btn-ghost-dark btn-icon btn-sm shrink-0" aria-label={M.copy} onClick={() => onCopy(v)}><Copy /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </li>
  )
}
