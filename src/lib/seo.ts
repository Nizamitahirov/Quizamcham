/**
 * Səhifə meta məlumatı (SPA): başlıq, təsvir, canonical və indeksləmə — marşrut dəyişəndə yenilənir.
 * İctimai səhifələr indekslənir; şəxsi/oyun səhifələri "noindex".
 */
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { currentLang } from '../i18n/az'
import { PAGES, SITE } from './seoPages'

const PUBLIC = new Set([...Object.keys(PAGES), '/consent', '/marketing-consent'])

function setMeta(sel: string, attr: string, value: string, create: () => HTMLElement) {
  let el = document.head.querySelector(sel) as HTMLElement | null
  if (!el) { el = create(); document.head.appendChild(el) }
  el.setAttribute(attr, value)
}

/** App-də bir dəfə çağırılır. */
export function useSeo() {
  const { pathname } = useLocation()
  useEffect(() => {
    const path = pathname.replace(/\/+$/, '') || '/'
    const m = PAGES[path]?.[currentLang()] ?? PAGES[path]?.az
    const idx = PUBLIC.has(path)
    document.title = m?.title ?? (idx ? 'Jabr' : 'Jabr — canlı quiz platforması')
    if (m) {
      setMeta('meta[name="description"]', 'content', m.desc, () => Object.assign(document.createElement('meta'), { name: 'description' }))
      setMeta('meta[property="og:title"]', 'content', m.title, () => { const e = document.createElement('meta'); e.setAttribute('property', 'og:title'); return e })
      setMeta('meta[property="og:description"]', 'content', m.desc, () => { const e = document.createElement('meta'); e.setAttribute('property', 'og:description'); return e })
    }
    setMeta('link[rel="canonical"]', 'href', SITE + (path === '/' ? '/' : path), () => Object.assign(document.createElement('link'), { rel: 'canonical' }))
    setMeta('meta[property="og:url"]', 'content', SITE + (path === '/' ? '/' : path), () => { const e = document.createElement('meta'); e.setAttribute('property', 'og:url'); return e })
    // şəxsi səhifələr (panel, oyun, hesab) axtarışa düşməsin
    setMeta('meta[name="robots"]', 'content', idx ? 'index, follow, max-image-preview:large' : 'noindex, nofollow', () => Object.assign(document.createElement('meta'), { name: 'robots' }))
  }, [pathname])
}
