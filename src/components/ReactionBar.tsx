import { useRef } from 'react'
import { t } from '../i18n/az'

export const REACTIONS = ['👏', '🔥', '😂', '😎', '🎉', '💡']

/** Oyunçu başına 2 saniyədə 1 reaksiya (bölmə 12). */
export function ReactionBar({ onReact }: { onReact: (emoji: string) => void }) {
  const last = useRef(0)
  return (
    <div className="glass flex justify-between gap-1 p-1.5" role="group" aria-label={t.lobby.react}>
      {REACTIONS.map((e) => (
        <button key={e} type="button" aria-label={e}
          className="flex h-12 flex-1 items-center justify-center rounded-2xl text-2xl transition hover:bg-white/10 active:scale-75"
          onClick={() => { const now = Date.now(); if (now - last.current < 2000) return; last.current = now; onReact(e) }}>
          {e}
        </button>
      ))}
    </div>
  )
}
