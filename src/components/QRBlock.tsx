import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react'
import { useRef } from 'react'

/** Vektor (SVG) QR — istənilən ekranda (proyektor, retina, telefon) kəskin görünür, ölçüsü konteynerə sığır. */
export function QRBlock({ url, size = 420, id }: { url: string; size?: number; id?: string }) {
  return (
    <div className="inline-block max-w-full shrink-0 rounded-3xl bg-white p-3 shadow-2xl sm:p-4" style={{ width: size + 32 }}>
      <QRCodeSVG id={id} value={url} size={size} level="M" marginSize={2} bgColor="#FFFFFF" fgColor="#0F1129" className="block h-auto w-full" />
    </div>
  )
}

/** QR-ı PNG kimi yükləmək üçün düymə (gizli canvas ilə). */
export function QRDownload({ url, filename, label, className = 'btn btn-ghost-dark' }: { url: string; filename: string; label: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const go = () => {
    const canvas = ref.current?.querySelector('canvas')
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = filename
    a.click()
  }
  return (
    <>
      <div ref={ref} className="hidden"><QRCodeCanvas value={url} size={1024} level="M" marginSize={4} /></div>
      <button type="button" className={className} onClick={go}>{label}</button>
    </>
  )
}
