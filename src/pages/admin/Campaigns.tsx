import { useCallback, useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { CheckCircle2, Clock, FlaskConical, ImageIcon, Info, Mail, Megaphone, Monitor, Plus, Send, Smartphone, Trash2, Users } from 'lucide-react'
import type { AdminState } from '../../firebase/auth'
import { t } from '../../i18n/az'
import { Field, Section, Segmented, EmptyState } from '../../components/kit'
import { confirmDialog, toast } from '../../components/dialogs'
import { campAudience, campList, campPreview, campSend, type AiLang, type CampContent, type CampFilter, type CampItem, type CampLicense, type CampTier } from '../../lib/ai'

const C = t.camp
const TIERS: CampTier[] = ['trial', 'free', 'trainer', 'pro', 'business', 'team']
const LANGS: AiLang[] = ['az', 'ru', 'en']
const DRAFT = 'jabr.camp.draft'
const site = typeof location !== 'undefined' ? location.origin : 'https://jabr.az'

type Tpl = 'launch' | 'offer' | 'news' | 'renew' | 'expiring' | 'blank'
const TPL: Record<AiLang, Record<Exclude<Tpl, 'blank'>, Omit<CampContent, 'lang' | 'hero'>>> = {
  az: {
    launch: { subject: 'Jabr-da yenilik: {ad}, bunu sınamısınız? ✨', preheader: 'Yeni imkanlar artıq hesabınızda', title: 'Quizləriniz indi daha güclüdür', body: 'Salam, {ad}!\n\nJabr-a yeni imkanlar əlavə etdik — dərslərinizi və təlimlərinizi daha canlı etmək üçün.\n\nAşağıda ən vacibləri:', features: [{ emoji: '⚡', title: 'AI ilə quiz', text: 'PDF və ya təqdimat yükləyin — suallar saniyələr içində hazır.' }, { emoji: '🧑‍🚀', title: '3D avatarlar', text: 'İştirakçılar öz 3D obrazları ilə oyuna qoşulur.' }, { emoji: '📊', title: 'Dərin analitika', text: 'Hər sual üzrə kim nəyi bilmir — bir baxışda.' }], ctaLabel: 'Yenilikləri sına', ctaUrl: `${site}/admin` },
    offer: { subject: '{ad}, Pro plana xüsusi təklif 🎁', preheader: 'Məhdud müddətli endirim', title: 'Pro ilə auditoriyanızı böyüdün', body: 'Salam, {ad}!\n\nPro plan ilə bir oyunda 200 iştirakçıya qədər, AI ilə qiymətləndirmə və kurslar sizin olur.\n\nBu həftə ərzində Pro plana keçənlər üçün xüsusi endirim etdik.', features: [{ emoji: '👥', title: '200 iştirakçı', text: 'Böyük auditoriya və tədbirlər üçün.' }, { emoji: '🤖', title: 'AI qiymətləndirmə', text: 'Açıq cavablar avtomatik yoxlanılır.' }, { emoji: '🎓', title: 'Kurslar', text: 'Quizləri ardıcıl təlim proqramına çevirin.' }], ctaLabel: 'Təklifə bax', ctaUrl: `${site}/pricing` },
    renew: { subject: '{ad}, Jabr lisenziyanız bitib', preheader: 'Quizləriniz yerindədir — planı yeniləyin', title: 'Lisenziyanız {tarix} tarixində bitib', body: 'Salam, {ad}!\n\nJabr lisenziyanızın müddəti {tarix} tarixində başa çatıb. Hesabınız pulsuz plana keçib: quizləriniz, siniflər və nəticələr yerindədir, amma oyunlarda iştirakçı sayı və AI imkanları məhdudlaşıb.\n\nPlanı yeniləmək üçün aşağıdakı düyməyə klikləyin və ya bu məktuba cavab yazın — sizinlə əlaqə saxlayaq.', features: [{ emoji: '👥', title: 'Böyük auditoriya', text: 'Bir oyunda daha çox iştirakçı.' }, { emoji: '🤖', title: 'AI ilə quiz', text: 'Suallar mövzudan və ya fayldan saniyələr içində.' }, { emoji: '📊', title: 'Analitika və hesabatlar', text: 'Excel ixracı, sertifikatlar, dərin təhlil.' }], ctaLabel: 'Planı yenilə', ctaUrl: `${site}/pricing` },
    expiring: { subject: '{ad}, lisenziyanız {tarix} tarixində bitir', preheader: 'Fasilə olmasın — vaxtında yeniləyin', title: 'Lisenziyanız tezliklə bitir', body: 'Salam, {ad}!\n\nJabr lisenziyanızın müddəti {tarix} tarixində bitir. Dərs və təlimləriniz yarımçıq qalmasın deyə planı əvvəlcədən yeniləməyi tövsiyə edirik.\n\nSualınız varsa, bu məktuba cavab yazın.', features: [], ctaLabel: 'Planı yenilə', ctaUrl: `${site}/pricing` },
    news: { subject: 'Jabr xəbərləri', preheader: 'Bu ay platformada nələr oldu', title: 'Bu ayın xəbərləri', body: 'Salam, {ad}!\n\nBu ay Jabr-da nələr dəyişdi — qısaca.', features: [], ctaLabel: 'Jabr-ı aç', ctaUrl: site },
  },
  ru: {
    launch: { subject: 'Новое в Jabr: {имя}, уже пробовали? ✨', preheader: 'Новые возможности уже в вашем аккаунте', title: 'Ваши квизы стали мощнее', body: 'Здравствуйте, {имя}!\n\nМы добавили в Jabr новые возможности, чтобы ваши уроки и тренинги стали живее.\n\nСамое важное:', features: [{ emoji: '⚡', title: 'Квиз с AI', text: 'Загрузите PDF или презентацию — вопросы готовы за секунды.' }, { emoji: '🧑‍🚀', title: '3D-аватары', text: 'Участники входят в игру со своим 3D-образом.' }, { emoji: '📊', title: 'Глубокая аналитика', text: 'Что не усвоено — по каждому вопросу.' }], ctaLabel: 'Попробовать', ctaUrl: `${site}/admin` },
    offer: { subject: '{имя}, особое предложение на Pro 🎁', preheader: 'Скидка на ограниченное время', title: 'Расширьте аудиторию с Pro', body: 'Здравствуйте, {имя}!\n\nС Pro — до 200 участников в игре, AI-проверка ответов и курсы.\n\nНа этой неделе для перехода на Pro действует особая скидка.', features: [{ emoji: '👥', title: '200 участников', text: 'Для больших аудиторий и мероприятий.' }, { emoji: '🤖', title: 'AI-проверка', text: 'Открытые ответы проверяются автоматически.' }, { emoji: '🎓', title: 'Курсы', text: 'Соберите квизы в учебную программу.' }], ctaLabel: 'Смотреть предложение', ctaUrl: `${site}/pricing` },
    renew: { subject: '{имя}, срок вашей лицензии Jabr истёк', preheader: 'Ваши квизы на месте — продлите план', title: 'Лицензия истекла {дата}', body: 'Здравствуйте, {имя}!\n\nСрок вашей лицензии Jabr истёк {дата}. Аккаунт переведён на бесплатный план: квизы, классы и результаты сохранены, но число участников и AI-функции ограничены.\n\nЧтобы продлить план, нажмите кнопку ниже или ответьте на это письмо — мы свяжемся с вами.', features: [{ emoji: '👥', title: 'Большая аудитория', text: 'Больше участников в одной игре.' }, { emoji: '🤖', title: 'Квизы с AI', text: 'Вопросы по теме или файлу за секунды.' }, { emoji: '📊', title: 'Аналитика и отчёты', text: 'Экспорт в Excel, сертификаты, глубокий анализ.' }], ctaLabel: 'Продлить план', ctaUrl: `${site}/pricing` },
    expiring: { subject: '{имя}, ваша лицензия истекает {дата}', preheader: 'Продлите заранее, чтобы не было перерыва', title: 'Лицензия скоро истекает', body: 'Здравствуйте, {имя}!\n\nСрок вашей лицензии Jabr истекает {дата}. Чтобы занятия и тренинги не прерывались, рекомендуем продлить план заранее.\n\nЕсли есть вопросы — просто ответьте на это письмо.', features: [], ctaLabel: 'Продлить план', ctaUrl: `${site}/pricing` },
    news: { subject: 'Новости Jabr', preheader: 'Что нового на платформе за месяц', title: 'Новости месяца', body: 'Здравствуйте, {имя}!\n\nКоротко о том, что изменилось в Jabr за этот месяц.', features: [], ctaLabel: 'Открыть Jabr', ctaUrl: site },
  },
  en: {
    launch: { subject: 'New in Jabr: {name}, have you tried this? ✨', preheader: 'New features are already in your account', title: 'Your quizzes just got more powerful', body: 'Hi {name}!\n\nWe added new features to Jabr to make your classes and trainings more engaging.\n\nThe highlights:', features: [{ emoji: '⚡', title: 'AI quiz builder', text: 'Upload a PDF or a deck — questions are ready in seconds.' }, { emoji: '🧑‍🚀', title: '3D avatars', text: 'Players join with their own 3D look.' }, { emoji: '📊', title: 'Deep analytics', text: 'See what was missed, question by question.' }], ctaLabel: 'Try it now', ctaUrl: `${site}/admin` },
    offer: { subject: '{name}, a special Pro offer 🎁', preheader: 'Limited-time discount', title: 'Grow your audience with Pro', body: 'Hi {name}!\n\nPro gives you up to 200 players per game, AI grading and courses.\n\nThis week only, upgrading to Pro comes with a special discount.', features: [{ emoji: '👥', title: '200 players', text: 'For large audiences and events.' }, { emoji: '🤖', title: 'AI grading', text: 'Open answers are checked automatically.' }, { emoji: '🎓', title: 'Courses', text: 'Turn quizzes into a learning path.' }], ctaLabel: 'See the offer', ctaUrl: `${site}/pricing` },
    renew: { subject: '{name}, your Jabr licence has expired', preheader: 'Your quizzes are safe — renew your plan', title: 'Your licence expired on {date}', body: 'Hi {name}!\n\nYour Jabr licence expired on {date}. Your account has moved to the free plan: your quizzes, classes and results are safe, but player numbers and AI features are now limited.\n\nTo renew, click the button below or reply to this email and we will get in touch.', features: [{ emoji: '👥', title: 'Bigger audiences', text: 'More players in a single game.' }, { emoji: '🤖', title: 'AI quizzes', text: 'Questions from a topic or a file in seconds.' }, { emoji: '📊', title: 'Analytics and reports', text: 'Excel export, certificates, deep insights.' }], ctaLabel: 'Renew my plan', ctaUrl: `${site}/pricing` },
    expiring: { subject: '{name}, your licence ends on {date}', preheader: 'Renew early to avoid a break', title: 'Your licence ends soon', body: 'Hi {name}!\n\nYour Jabr licence ends on {date}. Renew ahead of time so your classes and trainings are not interrupted.\n\nQuestions? Just reply to this email.', features: [], ctaLabel: 'Renew my plan', ctaUrl: `${site}/pricing` },
    news: { subject: 'Jabr news', preheader: 'What happened on the platform this month', title: 'This month at Jabr', body: 'Hi {name}!\n\nA quick look at what changed in Jabr this month.', features: [], ctaLabel: 'Open Jabr', ctaUrl: site },
  },
}
const blank = (lang: AiLang): CampContent => ({ subject: '', preheader: '', title: '', body: '', hero: '', features: [], ctaLabel: '', ctaUrl: site, lang })
const fromTpl = (lang: AiLang, k: Tpl): CampContent => (k === 'blank' ? blank(lang) : { ...TPL[lang][k], hero: '', lang })
const DEFAULT_FILTER: CampFilter = { audience: 'all', tiers: [], langs: [], joinedDays: 0, emails: [], kind: 'marketing', license: 'any', licenseDays: 0 }
const LICENSES: CampLicense[] = ['any', 'expiring', 'expired', 'trialEnded']
/** Lisenziya şablonu seçiləndə auditoriya da uyğun qurulur (xidməti elan — hesabla bağlı məlumat). */
const TPL_FILTER: Partial<Record<Tpl, Partial<CampFilter>>> = {
  renew: { audience: 'trainers', tiers: [], license: 'expired', licenseDays: 30, kind: 'service' },
  expiring: { audience: 'trainers', tiers: [], license: 'expiring', licenseDays: 7, kind: 'service' },
}

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
  useEffect(() => {
    setAud(null)
    const id = setTimeout(() => { void campAudience(filter).then(setAud).catch(() => setAud({ count: 0, noConsent: 0, sample: [] })) }, 350)
    return () => clearTimeout(id)
  }, [filter])
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
                  <span className="text-2xl font-black tabular-nums">{aud ? aud.count : '…'}</span>
                  <span className="text-sm text-fg2">{aud ? C.recipients(aud.count).replace(/^\d+\s*/, '') : C.counting}</span>
                  {!!aud?.noConsent && <span className="chip chip-warn ml-auto">{C.noConsent(aud.noConsent)}</span>}
                </div>
                {!!aud?.sample.length && (
                  <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
                    {aud.sample.map((r) => (
                      <li key={r.email} className="flex min-w-0 items-center gap-2 text-xs">
                        <span className="truncate font-medium text-fg2">{r.name || '—'}</span><span className="truncate text-muted">{r.email}</span>
                        {r.until && filter.license !== 'any' && <span className="chip chip-warn ml-auto shrink-0">{(r.until > Date.now() ? C.until : C.ended)(new Date(r.until).toLocaleDateString())}</span>}
                        <span className={`chip chip-muted shrink-0 ${r.until && filter.license !== 'any' ? '' : 'ml-auto'}`}>{r.tier ? C.tierNames[r.tier] : C.students}</span><span className="chip chip-muted shrink-0">{r.lang.toUpperCase()}</span>
                      </li>
                    ))}
                  </ul>
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
                    {(['launch', 'offer', 'news', 'renew', 'expiring', 'blank'] as Tpl[]).map((k) => <button key={k} type="button" className="btn btn-secondary btn-sm" onClick={() => { setContent(fromTpl(content.lang, k)); const f = TPL_FILTER[k]; if (f) setF(f) }}>{C.tplNames[k]}</button>)}
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
