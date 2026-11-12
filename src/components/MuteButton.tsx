import { useSyncExternalStore } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { audio } from '../audio/AudioEngine'
import { t } from '../i18n/az'

export function useMuted() {
  return useSyncExternalStore((cb) => audio.subscribe(cb), () => audio.muted)
}

export function MuteButton({ className = '' }: { className?: string }) {
  const muted = useMuted()
  return (
    <button type="button" aria-label={muted ? t.a11y.soundOn : t.a11y.soundOff} onClick={() => { audio.unlock(); audio.toggleMute() }}
      className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/8 text-[#fff] backdrop-blur transition hover:bg-white/15 ${className}`}
      style={{ background: 'rgba(255,255,255,.08)' }}>
      {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
    </button>
  )
}
