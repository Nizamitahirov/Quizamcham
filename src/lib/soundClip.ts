/** Yüklənmiş audio faylın seçilmiş hissəsini kəsib kiçik WAV (mono, 16 kHz) data-URL-ə çevirir. */
export const MAX_CLIP_SEC = 8
const RATE = 16000

export async function decodeFile(file: File): Promise<AudioBuffer> {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new AC()
  try { return await ctx.decodeAudioData(await file.arrayBuffer()) } finally { void ctx.close() }
}

export async function cutClip(buf: AudioBuffer, start: number, duration: number): Promise<string> {
  const dur = Math.max(0.3, Math.min(MAX_CLIP_SEC, duration, buf.duration - start))
  const off = new OfflineAudioContext(1, Math.ceil(dur * RATE), RATE)
  const src = off.createBufferSource()
  src.buffer = buf
  const g = off.createGain()
  // yumşaq giriş/çıxış (klik səsi olmasın)
  g.gain.setValueAtTime(0, 0)
  g.gain.linearRampToValueAtTime(1, 0.04)
  g.gain.setValueAtTime(1, Math.max(0.05, dur - 0.25))
  g.gain.linearRampToValueAtTime(0, dur)
  src.connect(g)
  g.connect(off.destination)
  src.start(0, start, dur)
  const out = await off.startRendering()
  return toWavDataUrl(out.getChannelData(0), RATE)
}

function toWavDataUrl(samples: Float32Array, rate: number): string {
  const buf = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(buf)
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  w(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true)
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, samples.length * 2, true)
  let peak = 0
  for (const x of samples) peak = Math.max(peak, Math.abs(x))
  const norm = peak > 0 ? Math.min(1 / peak, 4) * 0.95 : 1
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i] * norm)) * 0x7fff, true)
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:audio/wav;base64,${btoa(bin)}`
}

/** Dalğa forması üçün sadə pik massivi. */
export function peaks(buf: AudioBuffer, n = 200): number[] {
  const d = buf.getChannelData(0)
  const step = Math.floor(d.length / n) || 1
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    let m = 0
    for (let j = i * step; j < Math.min(d.length, (i + 1) * step); j += 16) m = Math.max(m, Math.abs(d[j]))
    out.push(m)
  }
  return out
}
