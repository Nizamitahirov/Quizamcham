/**
 * Axtarış sistemləri üçün ictimai quiz səhifələri (serverdə hazır HTML, JavaScript-siz):
 *   /quizzes              — ictimai kataloq (kateqoriyalar üzrə)
 *   /quiz/:id             — bir quizin səhifəsi: başlıq, təsvir, suallar (cavablarsız), "məşq et" / "canlı oyun" düymələri
 *   /sitemap-quizzes.xml  — bu səhifələrin sayt xəritəsi
 * Yalnız kataloqda açıq olanlar göstərilir (gizlədilmiş, yoxlamada olan və "yalnız link ilə" olanlar yox).
 * Düzgün cavablar heç vaxt göstərilmir.
 */
import type { FastifyInstance, FastifyReply } from 'fastify'
import { loadDoc, pool } from './store.js'
import type { Doc } from './values.js'

const SITE = 'https://jabr.az'
type Lang = 'az' | 'ru' | 'en'
type Q = { type?: string; text?: string; options?: { text?: string }[] }
type Item = Doc & { title?: string; description?: string; category?: string; level?: string; author?: string; questionCount?: number; questions?: Q[]; tags?: string[]; coverEmoji?: string; publishedAt?: { __t: number }; status?: string; hidden?: boolean; unlisted?: boolean }

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const visible = (d: Item | null): d is Item => !!d && !d.hidden && d.status !== 'review' && !d.unlisted
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)
/** Quizin dili: kiril → ru; Azərbaycan hərfləri → az; yalnız latın ASCII → en. */
export function detectLang(s: string): Lang {
  if (/[\u0400-\u04FF]/.test(s)) return 'ru'
  if (/[əğıöüşçƏĞİÖÜŞÇ]/.test(s)) return 'az'
  return /^[\x20-\x7E\s]*$/.test(s) && /[a-z]{3}/i.test(s) ? 'en' : 'az'
}

const T = {
  az: {
    catalog: 'Quiz kataloqu', catalogTitle: 'Pulsuz quizlər — Jabr kataloqu', catalogDesc: 'Jabr-da pulsuz ictimai quizlər: mövzular üzrə məşq edin və ya canlı oyun kimi keçirin.',
    questions: (n: number) => `${n} sual`, level: { easy: 'Asan', medium: 'Orta', hard: 'Çətin' } as Record<string, string>,
    practice: 'Pulsuz məşq et', host: 'Canlı oyun kimi keçir', preview: 'Suallar', more: (n: number) => `və daha ${n} sual`,
    author: 'Müəllif', desc: (t: string, n: number) => `“${t}” — ${n} suallıq pulsuz quiz. Jabr-da məşq edin və ya sinifdə canlı oyun kimi keçirin.`,
    tf: 'Doğru / Yanlış', open: 'Açıq cavab', notFound: 'Quiz tapılmadı', back: 'Kataloqa qayıt', home: 'Ana səhifə', empty: 'Hələ ictimai quiz yoxdur.', other: 'Digər',
  },
  ru: {
    catalog: 'Каталог квизов', catalogTitle: 'Бесплатные квизы — каталог Jabr', catalogDesc: 'Бесплатные публичные квизы в Jabr: тренируйтесь по темам или проводите как живую игру.',
    questions: (n: number) => `${n} вопр.`, level: { easy: 'Лёгкий', medium: 'Средний', hard: 'Сложный' } as Record<string, string>,
    practice: 'Тренироваться бесплатно', host: 'Провести как живую игру', preview: 'Вопросы', more: (n: number) => `и ещё ${n} вопр.`,
    author: 'Автор', desc: (t: string, n: number) => `«${t}» — бесплатный квиз из ${n} вопросов. Тренируйтесь в Jabr или проведите его в классе как живую игру.`,
    tf: 'Верно / Неверно', open: 'Открытый ответ', notFound: 'Квиз не найден', back: 'Вернуться в каталог', home: 'Главная', empty: 'Пока нет публичных квизов.', other: 'Другое',
  },
  en: {
    catalog: 'Quiz catalogue', catalogTitle: 'Free quizzes — Jabr catalogue', catalogDesc: 'Free public quizzes on Jabr: practise by topic or run them as a live game.',
    questions: (n: number) => `${n} questions`, level: { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as Record<string, string>,
    practice: 'Practise for free', host: 'Run as a live game', preview: 'Questions', more: (n: number) => `and ${n} more`,
    author: 'Author', desc: (t: string, n: number) => `“${t}” — a free ${n}-question quiz. Practise on Jabr or run it in class as a live game.`,
    tf: 'True / False', open: 'Open answer', notFound: 'Quiz not found', back: 'Back to the catalogue', home: 'Home', empty: 'No public quizzes yet.', other: 'Other',
  },
}

const CSS = `*{box-sizing:border-box}body{margin:0;background:#090A13;color:#C3C6DC;font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
a{color:#FF8A3D}main{max-width:860px;margin:0 auto;padding:28px 18px 64px}header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:28px}
.logo{font-weight:900;font-size:22px;color:#fff;text-decoration:none;letter-spacing:-.02em}.logo span{color:#FF7A1A}
h1{color:#fff;font-size:clamp(26px,5vw,38px);line-height:1.15;margin:.2em 0 .4em}h2{color:#fff;font-size:20px;margin:32px 0 12px}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px;padding:0;list-style:none}.chips li{border:1px solid #2A2D45;border-radius:999px;padding:3px 12px;font-size:13px}
.cta{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0}.btn{display:inline-block;padding:12px 20px;border-radius:12px;font-weight:700;text-decoration:none}
.btn-p{background:#FF7A1A;color:#fff}.btn-s{border:1px solid #3A3D5C;color:#fff}
ol.qs{padding-left:22px}ol.qs li{margin:0 0 14px}ol.qs ul{margin:6px 0 0;padding-left:18px;color:#9A9DB8;font-size:15px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;list-style:none;padding:0}
.card{display:block;height:100%;border:1px solid #23263C;border-radius:16px;padding:14px 16px;background:#11131F;text-decoration:none;color:#C3C6DC}
.card b{display:block;color:#fff;font-size:16px;margin-bottom:4px}.card small{color:#8E91AD}footer{margin-top:48px;font-size:14px;color:#8E91AD}`

function page(lang: Lang, o: { title: string; desc: string; url: string; body: string; jsonLd?: unknown; noindex?: boolean }) {
  const ld = o.jsonLd ? `<script type="application/ld+json">${JSON.stringify(o.jsonLd).replace(/</g, '\\u003c')}</script>` : ''
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(o.title)}</title><meta name="description" content="${esc(o.desc)}">
<meta name="robots" content="${o.noindex ? 'noindex' : 'index, follow, max-image-preview:large'}"><link rel="canonical" href="${o.url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Jabr"><meta property="og:url" content="${o.url}">
<meta property="og:title" content="${esc(o.title)}"><meta property="og:description" content="${esc(o.desc)}"><meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#090A13">
<link rel="icon" type="image/png" href="/icons/favicon-64.png"><style>${CSS}</style>${ld}</head>
<body><main><header><a class="logo" href="/">Jabr<span>.</span></a><a href="/quizzes">${esc(T[lang].catalog)}</a></header>${o.body}
<footer><a href="/">${esc(T[lang].home)}</a> · <a href="/quizzes">${esc(T[lang].catalog)}</a> · <a href="/pricing">Jabr</a></footer></main></body></html>`
}

async function listVisible(): Promise<{ id: string; d: Item }[]> {
  const r = await pool.query<{ id: string; data: Item }>(`select id, data from docs where parent = 'catalog' order by updated_at desc limit 5000`)
  return r.rows.filter((x) => visible(x.data)).map((x) => ({ id: x.id, d: x.data }))
}

const html = (reply: FastifyReply, code: number, body: string) =>
  reply.code(code).type('text/html; charset=utf-8').header('cache-control', code === 200 ? 'public, max-age=600' : 'no-store').send(body)

export function quizPage(id: string, d: Item): { lang: Lang; html: string } {
  const title = String(d.title ?? '').trim() || 'Quiz'
  const lang = detectLang(`${title} ${d.description ?? ''} ${(d.questions ?? []).slice(0, 3).map((q) => q.text ?? '').join(' ')}`)
  const L = T[lang]
  const qs = (d.questions ?? []).filter((q) => q.type !== 'slide' && (q.text ?? '').trim())
  const n = Number(d.questionCount) || qs.length
  const url = `${SITE}/quiz/${id}`
  const desc = clip(String(d.description ?? '').trim() || L.desc(title, n), 158)
  const SHOW = 15
  const items = qs.slice(0, SHOW).map((q) => {
    const opts = q.type === 'single' || q.type === 'multi' ? (q.options ?? []).map((o) => String(o.text ?? '').trim()).filter(Boolean) : []
    const hint = q.type === 'truefalse' ? L.tf : q.type === 'open' ? L.open : ''
    return `<li>${esc(clip(String(q.text).trim(), 300))}${opts.length ? `<ul>${opts.map((o) => `<li>${esc(clip(o, 160))}</li>`).join('')}</ul>` : hint ? `<ul><li>${esc(hint)}</li></ul>` : ''}</li>`
  }).join('')
  const chips = [d.category || '', d.level ? L.level[d.level] ?? '' : '', L.questions(n), d.author ? `${L.author}: ${d.author}` : ''].filter(Boolean)
  const body = `<p><a href="/quizzes">← ${esc(L.back)}</a></p><h1>${esc(d.coverEmoji ? `${d.coverEmoji} ` : '')}${esc(title)}</h1>
<ul class="chips">${chips.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
${d.description ? `<p>${esc(d.description)}</p>` : `<p>${esc(L.desc(title, n))}</p>`}
<div class="cta"><a class="btn btn-p" href="/learn/${encodeURIComponent(id)}">${esc(L.practice)}</a><a class="btn btn-s" href="/start">${esc(L.host)}</a></div>
${items ? `<h2>${esc(L.preview)}</h2><ol class="qs">${items}</ol>${qs.length > SHOW ? `<p>${esc(L.more(qs.length - SHOW))}</p>` : ''}` : ''}`
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Quiz', name: title, description: desc, url, inLanguage: lang,
    educationalLevel: d.level, about: d.category ? { '@type': 'Thing', name: d.category } : undefined,
    author: d.author ? { '@type': 'Person', name: d.author } : undefined,
    publisher: { '@type': 'Organization', name: 'Jabr', url: `${SITE}/` },
    datePublished: d.publishedAt?.__t ? new Date(d.publishedAt.__t).toISOString() : undefined,
    isAccessibleForFree: true,
  }
  return { lang, html: page(lang, { title: `${clip(title, 55)} — quiz | Jabr`, desc, url, body, jsonLd }) }
}

export function catalogPage(list: { id: string; d: Item }[]): string {
  const L = T.az
  const groups = new Map<string, { id: string; d: Item }[]>()
  for (const x of list) { const k = String(x.d.category || L.other); groups.set(k, [...(groups.get(k) ?? []), x]) }
  const sections = [...groups.entries()].sort((a, b) => b[1].length - a[1].length).map(([cat, xs]) => `<h2>${esc(cat)}</h2><ul class="grid">${xs.map(({ id, d }) =>
    `<li><a class="card" href="/quiz/${encodeURIComponent(id)}"><b>${esc(d.coverEmoji ? `${d.coverEmoji} ` : '')}${esc(clip(String(d.title ?? 'Quiz'), 80))}</b><small>${esc(L.questions(Number(d.questionCount) || 0))}${d.level ? ` · ${esc(L.level[d.level] ?? '')}` : ''}</small></a></li>`).join('')}</ul>`).join('')
  const body = `<h1>${esc(L.catalogTitle.split(' — ')[0])}</h1><p>${esc(L.catalogDesc)}</p>${sections || `<p>${esc(L.empty)}</p>`}`
  return page('az', { title: L.catalogTitle, desc: L.catalogDesc, url: `${SITE}/quizzes`, body, jsonLd: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: L.catalogTitle, url: `${SITE}/quizzes` } })
}

export function publicPageRoutes(app: FastifyInstance) {
  app.get('/quizzes', async (_req, reply) => html(reply, 200, catalogPage(await listVisible())))

  app.get<{ Params: { id: string } }>('/quiz/:id', async (req, reply) => {
    const id = req.params.id
    const d = /^[\w-]{1,64}$/.test(id) ? ((await loadDoc(`catalog/${id}`)) as Item | null) : null
    if (!visible(d)) {
      const L = T.az
      return html(reply, 404, page('az', { title: `${L.notFound} — Jabr`, desc: L.notFound, url: `${SITE}/quizzes`, noindex: true, body: `<h1>${esc(L.notFound)}</h1><p><a href="/quizzes">${esc(L.back)}</a></p>` }))
    }
    return html(reply, 200, quizPage(id, d).html)
  })

  app.get('/sitemap-quizzes.xml', async (_req, reply) => {
    const list = await listVisible()
    const urls = [`  <url><loc>${SITE}/quizzes</loc></url>`, ...list.map(({ id, d }) =>
      `  <url><loc>${SITE}/quiz/${encodeURIComponent(id)}</loc>${d.publishedAt?.__t ? `<lastmod>${new Date(d.publishedAt.__t).toISOString().slice(0, 10)}</lastmod>` : ''}</url>`)]
    return reply.type('application/xml; charset=utf-8').header('cache-control', 'public, max-age=3600')
      .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`)
  })
}
