import { QRCodeCanvas } from 'qrcode.react'
import { useRef } from 'react'

export function QRBlock({ url, size = 420, id }: { url: string; size?: number; id?: string }) {
  return (
    <div className="inline-block rounded-3xl bg-white p-5 shadow-2xl">
      <QRCodeCanvas id={id} value={url} size={size} level="M" marginSize={2} bgColor="#FFFFFF" fgColor="#0F1129" />
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
