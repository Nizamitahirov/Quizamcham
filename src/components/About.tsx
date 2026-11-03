import { useState } from 'react'
import { t } from '../i18n/az'
import { Modal } from './ui'

const CREDITS = [
  { title: 'Fun Emoji', by: 'Davis Uche', license: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
  { title: 'Adventurer', by: 'Lisa Wischofsky', license: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
  { title: 'Bottts', by: 'Pablo Stanley', license: 'Free for personal and commercial use', url: 'https://bottts.com/' },
]

export function AboutButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={`text-sm underline opacity-80 ${className}`} onClick={() => setOpen(true)}>{t.app.about}</button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.about.title}>
        <p className="mb-3">{t.about.text}</p>
        <p className="mb-2 font-extrabold">{t.about.avatars}</p>
        <ul className="mb-3 list-disc pl-5 text-sm">
          {CREDITS.map((c) => (
            <li key={c.title}>“{c.title}” — {c.by}, <a className="underline" href={c.url} target="_blank" rel="noreferrer">{c.license}</a> (DiceBear)</li>
          ))}
        </ul>
        <p className="text-sm">{t.about.music}</p>
      </Modal>
    </>
  )
}
