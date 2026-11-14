import { Copy, GraduationCap, Mail, MessageCircle, Send, Share2, Users } from 'lucide-react'
import { t } from '../i18n/az'
import { DropMenu, type MenuItem } from './kit'
import { toast } from './dialogs'

const S = t.share
const enc = encodeURIComponent
/** Classroom və Teams üçün rəsmi "paylaş" keçidləri (API açarı tələb etmir). */
export const shareTargets = (url: string, title: string, text = '') => ({
  classroom: `https://classroom.google.com/share?url=${enc(url)}&title=${enc(title)}${text ? `&body=${enc(text)}` : ''}`,
  teams: `https://teams.microsoft.com/share?href=${enc(url)}&msgText=${enc(text || title)}&preview=true`,
  whatsapp: `https://wa.me/?text=${enc(`${text || title}\n${url}`)}`,
  telegram: `https://t.me/share/url?url=${enc(url)}&text=${enc(text || title)}`,
  email: `mailto:?subject=${enc(title)}&body=${enc(`${text ? `${text}\n\n` : ''}${url}`)}`,
})
const open = (href: string) => window.open(href, '_blank', 'noopener,noreferrer,width=720,height=640')

/** Keçidi paylaşma menyusu: Google Classroom, Microsoft Teams, WhatsApp, Telegram, e-poçt, kopyala. */
export function ShareMenu({ url, title, text, label = S.share, btnClass = 'btn btn-secondary btn-sm', compact }: { url: string; title: string; text?: string; label?: string; btnClass?: string; compact?: boolean }) {
  const x = shareTargets(url, title, text)
  const items: MenuItem[] = [
    { label: 'Google Classroom', icon: GraduationCap, onClick: () => open(x.classroom) },
    { label: 'Microsoft Teams', icon: Users, onClick: () => open(x.teams) },
    { label: 'WhatsApp', icon: MessageCircle, onClick: () => open(x.whatsapp) },
    { label: 'Telegram', icon: Send, onClick: () => open(x.telegram) },
    { label: S.email, icon: Mail, onClick: () => { location.href = x.email } },
    { label: S.copy, icon: Copy, onClick: () => void navigator.clipboard.writeText(url).then(() => toast(S.copied), () => {}) },
    { label: S.more, icon: Share2, hidden: typeof navigator.share !== 'function', onClick: () => void navigator.share({ title, text, url }).catch(() => {}) },
  ]
  return <DropMenu items={items} label={label} btnClass={btnClass}>{compact ? <Share2 /> : <><Share2 />{label}</>}</DropMenu>
}

