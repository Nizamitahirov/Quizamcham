/**
 * Faylı brauzerdə mətnə çevirir (serverə yalnız mətn gedir): PDF, DOCX, PPTX, TXT/MD.
 * Kitabxanalar yalnız fayl seçiləndə yüklənir (əsas paket kiçik qalır).
 */
export const MAX_TEXT = 100_000

const xmlText = (xml: string, tag: string) => {
  // <w:t>…</w:t> (Word) və ya <a:t>…</a:t> (PowerPoint) — paraqraf sonlarında yeni sətir
  const para = tag === 'w:t' ? '</w:p>' : '</a:p>'
  return xml.split(para).map((p) => [...p.matchAll(new RegExp(`<${tag}(?: [^>]*)?>([^<]*)</${tag}>`, 'g'))].map((m) => m[1]).join('')).filter(Boolean).join('\n')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

async function zipText(file: File, kind: 'docx' | 'pptx') {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  if (kind === 'docx') {
    const doc = zip.file('word/document.xml')
    return doc ? xmlText(await doc.async('string'), 'w:t') : ''
  }
  const slides = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))
  const parts: string[] = []
  for (const [i, n] of slides.entries()) parts.push(`— Slayd ${i + 1} —\n${xmlText(await zip.file(n)!.async('string'), 'a:t')}`)
  return parts.join('\n\n')
}

async function pdfText(file: File) {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const out: string[] = []
  let len = 0
  for (let p = 1; p <= pdf.numPages && len < MAX_TEXT; p++) {
    const page = await pdf.getPage(p)
    const tc = await page.getTextContent()
    const s = tc.items.map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : ' ') : '')).join('')
    out.push(s); len += s.length
  }
  return out.join('\n\n')
}

export async function fileToText(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  let text: string
  if (name.endsWith('.pdf')) text = await pdfText(file)
  else if (name.endsWith('.docx')) text = await zipText(file, 'docx')
  else if (name.endsWith('.pptx')) text = await zipText(file, 'pptx')
  else if (/\.(txt|md|csv)$/.test(name)) text = await file.text()
  else throw new Error('unsupported')
  return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_TEXT)
}
