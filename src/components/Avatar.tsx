import { memo, useMemo } from 'react'
import { createAvatar } from '@dicebear/core'
import { adventurer, bottts, funEmoji } from '@dicebear/collection'
import type { AvatarData } from '../types'

export const AVATAR_STYLES = { 'fun-emoji': funEmoji, adventurer, bottts } as const
export type AvatarStyle = keyof typeof AVATAR_STYLES
export const ACCESSORIES = ['👑', '🎧', '🕶️', '🎩', '🌟', '🔥']

const cache = new Map<string, string>()
export function avatarUri(style: string, seed: string): string {
  const key = `${style}:${seed}`
  let uri = cache.get(key)
  if (!uri) {
    const s = AVATAR_STYLES[style as AvatarStyle] ?? funEmoji
    uri = createAvatar(s as typeof funEmoji, { seed, radius: 50, backgroundColor: ['ffd5dc', 'ffdfbf', 'c0aede', 'd1d4f9', 'b6e3f4', 'fde68a'] }).toDataUri()
    cache.set(key, uri)
  }
  return uri
}

export const Avatar = memo(function Avatar({ avatar, size = 64, className = '', dim = false }: { avatar: AvatarData; size?: number; className?: string; dim?: boolean }) {
  const uri = useMemo(() => avatarUri(avatar.style, avatar.seed), [avatar.style, avatar.seed])
  return (
    <span className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      <img src={uri} alt="" width={size} height={size} draggable={false} className={`rounded-full bg-white shadow-md ${dim ? 'grayscale opacity-50' : ''}`} />
      {avatar.accessory && (
        <span className="absolute -right-1 -top-1 drop-shadow" style={{ fontSize: Math.max(14, size * 0.38) }} aria-hidden>
          {avatar.accessory}
        </span>
      )}
    </span>
  )
})
