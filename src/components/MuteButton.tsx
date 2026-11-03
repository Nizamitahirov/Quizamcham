import { useSyncExternalStore } from 'react'
import { audio } from '../audio/AudioEngine'

export function useMuted() {
  return useSyncExternalStore((cb) => audio.subscribe(cb), () => audio.muted)
}

export function MuteButton({ className = '' }: { className?: string }) {
  const muted = useMuted()
  return (
    <button
      type="button"
      aria-label={muted ? 'Səsi aç' : 'Səsi bağla'}
      onClick={() => { audio.unlock(); audio.toggleMute() }}
      className={`flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-2xl ${className}`}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  )
}
