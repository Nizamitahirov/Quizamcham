import { useRef } from 'react'
import { t } from '../i18n/az'

export const REACTIONS = ['👏', '🔥', '😂', '😎', '🎉', '💡']

/** Oyunçu başına 2 saniyədə 1 reaksiya (bölmə 12). */
export function ReactionBar({ onReact }: { onReact: (emoji: string) => void }) {
  const last = useRef(0)
  return (
    <div className="flex justify-center gap-2" role="group" aria-label={t.lobby.react}>
      {REACTIONS.map((e) => (
        <button
          key={e}
          type="button"
          aria-label={e}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-2xl transition active:scale-90"
          onClick={() => {
            const now = Date.now()
            if (now - last.current < 2000) return
            last.current = now
            onReact(e)
          }}
        >
          {e}
        </button>
      ))}
    </div>
  )
}
