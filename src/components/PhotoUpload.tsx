import { useRef, useState } from 'react'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import { t } from '../i18n/az'
import { isUploaded, MediaError, removeMedia, uploadMedia } from '../lib/media'
import { toast } from './dialogs'

const P = t.photo
/** Profil şəkli: üzərinə klikləyib şəkil seçmək (kvadrat kəsilir və kiçildilir), yüklənmiş şəkli silmək. */
export function PhotoUpload({ value, onChange, size = 72, children }: { value?: string | null; onChange: (url: string) => Promise<void> | void; size?: number; children: React.ReactNode }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const pick = async (f?: File) => {
    if (!f) return
    setBusy(true)
    try { await onChange(await uploadMedia('photo', f)); toast(P.saved) }
    catch (e) { toast(P.errors[e instanceof MediaError ? e.code : 'failed'], 'error') } finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true)
    try { await removeMedia('photo'); await onChange(''); toast(P.removed) } catch { toast(P.errors.failed, 'error') } finally { setBusy(false) }
  }
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => input.current?.click()} disabled={busy} aria-label={P.upload} title={P.upload}
        className="group relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-orange-400" style={{ width: size, height: size }}>
        {children}
        <span className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-[#fff] transition ${busy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'}`}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
        </span>
        <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-panel text-fg shadow"><Camera className="h-3.5 w-3.5" /></span>
      </button>
      <div className="flex min-w-0 flex-col items-start gap-1">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => input.current?.click()}><Camera />{isUploaded(value) ? P.change : P.upload}</button>
          {isUploaded(value) && <button type="button" className="btn btn-ghost-dark btn-sm hover:text-red-300" disabled={busy} onClick={() => void remove()}><Trash2 />{P.remove}</button>}
        </div>
        <span className="text-xs text-muted">{P.hint}</span>
      </div>
      <input ref={input} type="file" hidden accept="image/png,image/jpeg,image/webp,image/heic" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
    </div>
  )
}
