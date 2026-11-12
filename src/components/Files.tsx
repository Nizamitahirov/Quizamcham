import { useRef, useState } from 'react'
import { Download, File as FileIcon, FileArchive, FileAudio, FileImage, FileSpreadsheet, FileText, FileVideo, Loader2, Paperclip, Presentation, UploadCloud, X } from 'lucide-react'
import { t } from '../i18n/az'
import { FileError, FILE_ACCEPT, fmtSize, MAX_FILE_MB, openFile, uploadFile, type FileRef } from '../lib/classes'
import { toast } from './dialogs'

const ICON: Record<string, typeof FileIcon> = {
  pdf: FileText, doc: FileText, docx: FileText, odt: FileText, txt: FileText, md: FileText, rtf: FileText,
  xls: FileSpreadsheet, xlsx: FileSpreadsheet, ods: FileSpreadsheet, csv: FileSpreadsheet,
  ppt: Presentation, pptx: Presentation, odp: Presentation,
  png: FileImage, jpg: FileImage, jpeg: FileImage, gif: FileImage, webp: FileImage, heic: FileImage,
  mp3: FileAudio, m4a: FileAudio, wav: FileAudio, mp4: FileVideo, mov: FileVideo, webm: FileVideo, zip: FileArchive, '7z': FileArchive, rar: FileArchive,
}
const TINT: Record<string, string> = { pdf: '#EF4444', doc: '#3B82F6', docx: '#3B82F6', xls: '#10B981', xlsx: '#10B981', csv: '#10B981', ppt: '#F97316', pptx: '#F97316' }
const errText = (e: unknown) => t.asg.errors[e instanceof FileError ? e.code : 'file-failed'] ?? t.asg.errors['file-failed']

/** Fayl kartları: açmaq (şəkil/PDF yeni tabda), endirmək, istəyə görə silmək. */
export function FileList({ files, onRemove, compact }: { files: FileRef[]; onRemove?: (f: FileRef) => void; compact?: boolean }) {
  if (!files.length) return null
  const open = (f: FileRef, dl = false) => void openFile(f, dl).catch((e) => toast(errText(e), 'error'))
  return (
    <ul className={`grid gap-2 ${compact ? '' : 'sm:grid-cols-2'}`}>
      {files.map((f) => {
        const Icon = ICON[f.type] ?? FileIcon
        return (
          <li key={f.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-white/[.03] p-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-panel" style={{ color: TINT[f.type] ?? 'var(--fg-2)' }}><Icon className="h-5 w-5" /></span>
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => open(f)} title={f.name}>
              <span className="block truncate text-sm font-semibold hover:underline">{f.name}</span>
              <span className="text-xs uppercase text-muted">{f.type} · {fmtSize(f.size)}</span>
            </button>
            <button type="button" className="btn btn-ghost-dark btn-icon btn-sm" aria-label="Download" title="Download" onClick={() => open(f, true)}><Download /></button>
            {onRemove && <button type="button" className="btn btn-ghost-dark btn-icon btn-sm hover:text-red-300" aria-label={t.asg.remove} title={t.asg.remove} onClick={() => onRemove(f)}><X /></button>}
          </li>
        )
      })}
    </ul>
  )
}

/** Yükləmə sahəsi: düymə + sürüklə-burax; hər fayl ayrıca yüklənir, gedişat göstərilir. */
export function FileDrop({ classId, kind, taskId, count, max = 10, onUploaded }: { classId: string; kind: 'resource' | 'submission'; taskId?: string; count: number; max?: number; onUploaded: (f: FileRef) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string[]>([])
  const [over, setOver] = useState(false)
  const take = async (list: FileList | File[]) => {
    const files = [...list].slice(0, Math.max(0, max - count))
    for (const f of files) {
      setBusy((b) => [...b, f.name])
      try { onUploaded(await uploadFile(f, classId, kind, taskId)) } catch (e) { toast(`${f.name}: ${errText(e)}`, 'error') } finally { setBusy((b) => b.filter((x) => x !== f.name)) }
    }
  }
  const full = count >= max
  return (
    <div>
      <button type="button" disabled={full} onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); void take(e.dataTransfer.files) }}
        className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 text-center transition disabled:opacity-50 ${over ? 'border-orange-400 bg-orange-500/10' : 'border-line-strong hover:border-orange-400/60 hover:bg-white/[.03]'}`}>
        <UploadCloud className="h-6 w-6 text-orange-300" />
        <span className="text-sm font-semibold">{t.asg.drop}</span>
        <span className="text-xs text-muted">{t.asg.limits(MAX_FILE_MB)}</span>
      </button>
      <input ref={input} type="file" multiple hidden accept={FILE_ACCEPT} onChange={(e) => { if (e.target.files) void take(e.target.files); e.target.value = '' }} />
      {busy.length > 0 && <ul className="mt-2 flex flex-col gap-1">{busy.map((n) => <li key={n} className="flex items-center gap-2 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /><Paperclip className="h-3.5 w-3.5" /><span className="truncate">{n}</span>{t.asg.uploading}</li>)}</ul>}
    </div>
  )
}
