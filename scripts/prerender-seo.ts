/**
 * Build-dən sonra: hər ictimai səhifə və hər dil üçün öz HTML faylı (dist/<yol>/index.html, dist/ru/<yol>/index.html, dist/en/...).
 * Başlıq, təsvir, canonical, hreflang, og:* və görünən mətn həmin səhifəyə və dilə uyğun olur — Google və link önizləmə
 * botları JS işləmədən də düzgün məlumat görür. sitemap.xml də buradan yaradılır (bütün dillər + hreflang).
 * Caddy: try_files {path} {path}/index.html /index.html.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import { LANGS, PAGES, pageUrl, STATIC_BODY, type Lang } from '../src/lib/seoPages'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const OG_LOCALE: Record<Lang, string> = { az: 'az_AZ', ru: 'ru_RU', en: 'en_GB' }
const NAV: Record<Lang, [string, string][]> = {
  az: [['/join', 'Oyuna qoşul'], ['/start', 'Pulsuz qeydiyyat'], ['/pricing', 'Qiymətlər'], ['/quizzes', 'Quiz kataloqu']],
  ru: [['/join', 'Присоединиться'], ['/start', 'Бесплатная регистрация'], ['/pricing', 'Цены'], ['/quizzes', 'Каталог квизов']],
  en: [['/join', 'Join a game'], ['/start', 'Sign up free'], ['/pricing', 'Pricing'], ['/quizzes', 'Quiz catalogue']],
}
const LANG_NAME: Record<Lang, string> = { az: 'Azərbaycanca', ru: 'Русский', en: 'English' }
const A = 'style="color:#FF7A1A"'
const rel = (u: string) => u.replace('https://jabr.az', '') || '/'
/** kataloq yalnız bir ünvandadır (dil prefiksi yoxdur) */
const navHref = (lang: Lang, r: string) => (r === '/quizzes' ? r : rel(pageUrl(lang, r)))

export function renderPage(tpl: string, route: string, lang: Lang): string {
  const m = PAGES[route][lang]
  const url = pageUrl(lang, route)
  const body = STATIC_BODY[route]?.[lang]
  const swap = (re: RegExp, val: string) => {
    if (!re.test(tpl)) throw new Error(`prerender-seo: ${re} not found in index.html`)
    tpl = tpl.replace(re, val)
  }
  swap(/<html lang="[^"]*">/, `<html lang="${lang}">`)
  swap(/<title>[^<]*<\/title>/, `<title>${esc(m.title)}</title>`)
  swap(/(<meta name="description" content=")[^"]*(")/, `$1${esc(m.desc)}$2`)
  swap(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
  swap(/(<link rel="alternate" hreflang="[^"]*" href="[^"]*" \/>\s*)+/, LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${pageUrl(l, route)}" />\n    `).join('') + `<link rel="alternate" hreflang="x-default" href="${pageUrl('az', route)}" />\n    `)
  swap(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
  swap(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(m.title)}$2`)
  swap(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(m.desc)}$2`)
  swap(/(<meta property="og:locale" content=")[^"]*(")/, `$1${OG_LOCALE[lang]}$2`)
  if (body) {
    const nav = NAV[lang].map(([r, label]) => `<a href="${navHref(lang, r)}" ${A}>${esc(label)}</a>`).join(' · ')
    const langs = LANGS.filter((l) => l !== lang).map((l) => `<a href="${rel(pageUrl(l, route))}" hreflang="${l}" ${A}>${LANG_NAME[l]}</a>`).join(' · ')
    swap(/<!--seo-body-->[\s\S]*?<!--\/seo-body-->/, `<!--seo-body--><h1 style="color:#fff">${esc(body.h1)}</h1>\n${body.html}\n<p>${nav}</p>\n<p>${langs}</p>\n<!--/seo-body-->`)
  }
  return tpl
}

export function sitemap(): string {
  const urls = Object.keys(PAGES).flatMap((route) => LANGS.map((lang) => {
    const alts = LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${pageUrl(l, route)}"/>`).join('') + `<xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl('az', route)}"/>`
    return `  <url><loc>${pageUrl(lang, route)}</loc>${alts}</url>`
  }))
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`
}

export function prerenderSeo(): Plugin {
  let outDir = 'dist'
  return {
    name: 'jabr-prerender-seo',
    apply: 'build',
    configResolved(c) { outDir = path.resolve(c.root, c.build.outDir) },
    closeBundle() {
      const tpl = readFileSync(path.join(outDir, 'index.html'), 'utf8')
      for (const route of Object.keys(PAGES)) {
        for (const lang of LANGS) {
          const dir = path.join(outDir, lang === 'az' ? '' : lang, route)
          mkdirSync(dir, { recursive: true })
          writeFileSync(path.join(dir, 'index.html'), renderPage(tpl, route, lang))
        }
      }
      writeFileSync(path.join(outDir, 'sitemap.xml'), sitemap())
    },
  }
}
