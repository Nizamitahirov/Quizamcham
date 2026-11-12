import { useEffect, useId, useRef, useState } from 'react'
import type { Timestamp } from 'firebase/firestore'
import { Pause } from 'lucide-react'
import { serverNow } from '../lib/timeSync'
import { audio } from '../audio/AudioEngine'

/** Server vaxtına sinxron dairəvi taymer (brend qradiyenti). */
export function TimerRing({ endsAt, total, size = 72, pausedMs, sound = true, onTick }: { endsAt: Timestamp | null; total: number; size?: number; pausedMs?: number | null; sound?: boolean; onTick?: (remainingMs: number) => void }) {
  const [now, setNow] = useState(serverNow())
  const lastSec = useRef<number | null>(null)
  const gid = useId().replace(/:/g, '')
  useEffect(() => {
    let raf = 0
    const loop = () => { setNow(serverNow()); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  const totalMs = total * 1000
  const remaining = pausedMs != null ? pausedMs : endsAt ? Math.max(0, endsAt.toMillis() - now) : totalMs
  const sec = Math.ceil(remaining / 1000)
  const frac = Math.max(0, Math.min(1, remaining / totalMs))
  const danger = sec <= 5 && endsAt != null

  useEffect(() => {
    onTick?.(remaining)
    if (!endsAt || pausedMs != null) return
    if (sec !== lastSec.current) {
      lastSec.current = sec
      if (sound && sec <= 5 && sec > 0) audio.tick()
      audio.setTension(Math.max(0, 1 - remaining / Math.min(totalMs, 10000)))
    }
  }, [sec, endsAt, pausedMs, sound, remaining, totalMs, onTick])

  const r = 44
  const c = 2 * Math.PI * r
  return (
    <div className={`relative shrink-0 ${danger ? 'pulse-red' : ''}`} style={{ width: size, height: size }} role="timer" aria-label={`${sec}`}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FFB020" /><stop offset="100%" stopColor="#FF4D1F" /></linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="rgba(10,11,22,.55)" stroke="rgba(255,255,255,.12)" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={danger ? '#ef4444' : `url(#${gid})`} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ filter: `drop-shadow(0 0 6px ${danger ? '#ef4444' : '#FF7A1A'})` }} />
      </svg>
      <span className="font-display absolute inset-0 flex items-center justify-center font-black tabular-nums text-[#fff]" style={{ fontSize: size * 0.34 }}>
        {pausedMs != null ? <Pause style={{ width: size * 0.34, height: size * 0.34 }} /> : sec}
      </span>
    </div>
  )
}
