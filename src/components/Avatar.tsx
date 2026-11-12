import { memo, useEffect, useState } from 'react'
import type { AvatarData } from '../types'
import { useAvatarThumb } from '../lib/avatar3d'

type StyleMod = Parameters<typeof import('@dicebear/core').createAvatar>[0]

/**
 * DiceBear üslubları tələb olunduqca yüklənir (ana səhifə avatar kodunu ümumiyyətlə yükləmir).
 * 'adventurer' köhnə oyunlarla uyğunluq üçün saxlanılıb, yeni seçimdə yoxdur.
 */
const LOADERS: Record<string, () => Promise<StyleMod>> = {
  'fun-emoji': () => import('@dicebear/fun-emoji') as Promise<StyleMod>,
  'big-smile': () => import('@dicebear/big-smile') as Promise<StyleMod>,
  bottts: () => import('@dicebear/bottts') as Promise<StyleMod>,
  adventurer: () => import('@dicebear/adventurer') as Promise<StyleMod>,
}
export const AVATAR_STYLES = ['fun-emoji', 'big-smile', 'bottts'] as const
export type AvatarStyle = (typeof AVATAR_STYLES)[number]
export const ACCESSORIES = ['👑', '🎧', '🕶️', '🎩', '🌟', '🔥']

const styles = new Map<string, StyleMod>()
const pending = new Map<string, Promise<StyleMod>>()
const cache = new Map<string, string>()
let core: typeof import('@dicebear/core') | null = null
const keyOf = (style: string) => (LOADERS[style] ? style : 'fun-emoji')

export async function loadStyle(style: string) {
  const key = keyOf(style)
  if (!core) core = await import('@dicebear/core')
  if (styles.has(key)) return styles.get(key)!
  if (!pending.has(key)) pending.set(key, LOADERS[key]().then((m) => { styles.set(key, m); return m }))
  return pending.get(key)!
}
export const preloadAvatarStyles = () => Promise.all(AVATAR_STYLES.map(loadStyle))

/** Sinxron: üslub artıq yüklənibsə data-URI, yoxsa null. */
export function avatarUriSync(style: string, seed: string): string | null {
  const key = `${style}:${seed}`
  const hit = cache.get(key)
  if (hit) return hit
  const mod = styles.get(keyOf(style))
  if (!mod || !core) return null
  const uri = core.createAvatar(mod, { seed, radius: 50, backgroundColor: ['ffd5dc', 'ffdfbf', 'c0aede', 'd1d4f9', 'b6e3f4', 'fde68a'] }).toDataUri()
  cache.set(key, uri)
  return uri
}
export async function avatarUri(style: string, seed: string): Promise<string> {
  await loadStyle(style)
  return avatarUriSync(style, seed)!
}

/** 3D avatar (style "3d", seed = istifadəçi uid): saxlanmış portret; tapılmasa adi avatara qayıdır. */
function Avatar3D({ avatar, size, className, dim }: { avatar: AvatarData; size: number; className: string; dim: boolean }) {
  const thumb = useAvatarThumb(avatar.seed)
  if (!thumb) return <Avatar2D avatar={{ style: 'fun-emoji', seed: avatar.seed, accessory: avatar.accessory }} size={size} className={className} dim={dim} />
  return (
    <span className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      <img src={thumb} alt="" width={size} height={size} draggable={false} className={`rounded-full object-cover shadow-md ${dim ? 'opacity-50 grayscale' : ''}`} />
      {avatar.accessory && <span className="absolute -right-1 -top-1 drop-shadow" style={{ fontSize: Math.max(14, size * 0.38) }} aria-hidden>{avatar.accessory}</span>}
    </span>
  )
}

export const Avatar = memo(function Avatar({ avatar, size = 64, className = '', dim = false }: { avatar: AvatarData; size?: number; className?: string; dim?: boolean }) {
  if (avatar.style === '3d') return <Avatar3D avatar={avatar} size={size} className={className} dim={dim} />
  return <Avatar2D avatar={avatar} size={size} className={className} dim={dim} />
})

const Avatar2D = memo(function Avatar2D({ avatar, size = 64, className = '', dim = false }: { avatar: AvatarData; size?: number; className?: string; dim?: boolean }) {
  const [state, setState] = useState(() => ({ key: `${avatar.style}:${avatar.seed}`, uri: avatarUriSync(avatar.style, avatar.seed) }))
  const k = `${avatar.style}:${avatar.seed}`
  const uri = state.key === k ? state.uri : avatarUriSync(avatar.style, avatar.seed)
  useEffect(() => {
    if (avatarUriSync(avatar.style, avatar.seed)) return
    let alive = true
    void avatarUri(avatar.style, avatar.seed).then((u) => { if (alive) setState({ key: `${avatar.style}:${avatar.seed}`, uri: u }) })
    return () => { alive = false }
  }, [avatar.style, avatar.seed])
  return (
    <span className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      {uri ? <img src={uri} alt="" width={size} height={size} draggable={false} className={`rounded-full bg-[#fff] shadow-md ${dim ? 'opacity-50 grayscale' : ''}`} />
        : <span className="block h-full w-full animate-pulse rounded-full bg-white/20" />}
      {avatar.accessory && (
        <span className="absolute -right-1 -top-1 drop-shadow" style={{ fontSize: Math.max(14, size * 0.38) }} aria-hidden>{avatar.accessory}</span>
      )}
    </span>
  )
})
