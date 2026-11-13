/**
 * Build-dən sonra: hər ictimai səhifə üçün öz HTML faylı (dist/<yol>/index.html) — başlıq, təsvir, canonical,
 * og:* və görünən mətn həmin səhifəyə uyğun olur. Beləliklə Google və link önizləmə botları JS işləmədən də düzgün məlumat görür.
 * Caddy: try_files {path} {path}/index.html /index.html.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import { PAGES, SITE, STATIC_BODY } from '../src/lib/seoPages'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function renderPage(tpl: string, route: string): string {
  const m = PAGES[route].az
  const url = SITE + (route === '/' ? '/' : route)
  const body = STATIC_BODY[route]
  const swap = (re: RegExp, val: string) => {
    if (!re.test(tpl)) throw new Error(`prerender-seo: ${re} not found in index.html`)
    tpl = tpl.replace(re, val)
  }
  swap(/<title>[^<]*<\/title>/, `<title>${esc(m.title)}</title>`)
  swap(/(<meta name="description" content=")[^"]*(")/, `$1${esc(m.desc)}$2`)
  swap(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
  swap(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
  swap(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(m.title)}$2`)
  swap(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(m.desc)}$2`)
  if (body) swap(/<!--seo-body-->[\s\S]*?<!--\/seo-body-->/, `<!--seo-body--><h1 style="color:#fff">${esc(body.h1)}</h1>\n${body.html}\n<!--/seo-body-->`)
  return tpl
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
        if (route === '/') continue
        const dir = path.join(outDir, route)
        mkdirSync(dir, { recursive: true })
        writeFileSync(path.join(dir, 'index.html'), renderPage(tpl, route))
      }
    },
  }
}
