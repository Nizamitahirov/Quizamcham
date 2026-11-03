/**
 * Web Audio API ilə kodla yaradılan musiqi və səs effektləri.
 * Fayl və lisenziya tələb etmir. public/audio/{lobby,question,podium}.mp3 varsa, onlar üstünlük alır.
 */
type Theme = 'energetic' | 'chill' | 'retro'
type Track = 'lobby' | 'question' | null

const MUTE_KEY = 'qz.muted'

const THEMES: Record<Theme, { bpm: number; wave: OscillatorType; lead: OscillatorType; chords: number[][]; bass: number[]; melody: (number | null)[] }> = {
  energetic: {
    bpm: 122, wave: 'sawtooth', lead: 'square',
    chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
    bass: [45, 41, 36, 43],
    melody: [69, null, 72, 71, 69, null, 67, 69, 65, null, 69, 67, 64, null, 67, 71],
  },
  chill: {
    bpm: 116, wave: 'triangle', lead: 'sine',
    chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]],
    bass: [48, 45, 41, 43],
    melody: [76, null, null, 74, 72, null, 71, null, 72, null, null, 69, 67, null, null, null],
  },
  retro: {
    bpm: 124, wave: 'square', lead: 'square',
    chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]],
    bass: [36, 33, 29, 31],
    melody: [72, 76, 79, 76, 72, 76, 79, 84, 81, 77, 74, 77, 79, 74, 71, 74],
  },
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

class Engine {
  ctx: AudioContext | null = null
  master: GainNode | null = null
  musicGain: GainNode | null = null
  sfxGain: GainNode | null = null
  muted = false
  volume = 0.6
  theme: Theme = 'energetic'
  track: Track = null
  private timer: number | null = null
  private step = 0
  private nextTime = 0
  private tension = 0
  private fileEl: HTMLAudioElement | null = null
  private fileAvailable: Record<string, boolean | undefined> = {}
  private listeners = new Set<() => void>()

  constructor() {
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1' } catch { /* noop */ }
  }

  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private emit() { this.listeners.forEach((f) => f()) }

  /** İstifadəçi toxunuşundan sonra çağırılmalıdır. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.connect(this.ctx.destination)
      this.musicGain = this.ctx.createGain()
      this.musicGain.connect(this.master)
      this.sfxGain = this.ctx.createGain()
      this.sfxGain.gain.value = 0.9
      this.sfxGain.connect(this.master)
      this.applyGain()
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  get unlocked() { return !!this.ctx && this.ctx.state === 'running' }

  private applyGain() {
    if (this.master) this.master.gain.value = this.muted ? 0 : 1
    if (this.musicGain) this.musicGain.gain.value = 0.35 * this.volume
    if (this.fileEl) this.fileEl.volume = this.muted ? 0 : this.volume
  }

  setVolume(v0to100: number) { this.volume = Math.max(0, Math.min(1, v0to100 / 100)); this.applyGain() }
  setTheme(t: Theme) { this.theme = t }
  setMuted(m: boolean) {
    this.muted = m
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0') } catch { /* noop */ }
    this.applyGain()
    this.emit()
  }
  toggleMute() { this.setMuted(!this.muted) }

  setTension(t: number) { this.tension = t }

  async play(track: Exclude<Track, null>) {
    if (this.track === track) return
    this.stopMusic()
    this.track = track
    if (await this.tryFile(track)) return
    if (this.track !== track || !this.ctx) return
    this.step = 0
    this.nextTime = this.ctx.currentTime + 0.05
    this.timer = window.setInterval(() => this.schedule(), 25)
  }

  stopMusic() {
    this.track = null
    if (this.timer) { clearInterval(this.timer); this.timer = null }
    if (this.fileEl) { this.fileEl.pause(); this.fileEl = null }
  }

  private async tryFile(name: string): Promise<boolean> {
    if (this.fileAvailable[name] === false) return false
    try {
      if (this.fileAvailable[name] === undefined) {
        const res = await fetch(`/audio/${name}.mp3`, { method: 'HEAD' })
        this.fileAvailable[name] = res.ok && (res.headers.get('content-type') ?? '').includes('audio')
      }
      if (!this.fileAvailable[name]) return false
      const el = new Audio(`/audio/${name}.mp3`)
      el.loop = name !== 'podium'
      el.volume = this.muted ? 0 : this.volume
      this.fileEl = el
      await el.play()
      return true
    } catch {
      this.fileAvailable[name] = false
      return false
    }
  }

  private schedule() {
    if (!this.ctx) return
    const th = THEMES[this.theme]
    const bpm = this.track === 'question' ? th.bpm + 8 + this.tension * 30 : th.bpm
    const sixteenth = 60 / bpm / 4
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this.scheduleStep(this.step, this.nextTime, sixteenth)
      this.nextTime += sixteenth
      this.step = (this.step + 1) % 128 // 8 takt × 16
    }
  }

  private scheduleStep(step: number, t: number, dur: number) {
    const th = THEMES[this.theme]
    const s16 = step % 16
    const bar = Math.floor(step / 16) % 8
    const chordIdx = Math.floor(bar / 2) % th.chords.length
    const out = this.musicGain!
    if (this.track === 'lobby') {
      if (s16 % 4 === 0) this.kick(t, out)
      if (s16 === 4 || s16 === 12) this.snare(t, out)
      if (s16 % 2 === 1) this.hat(t, out, 0.05)
      if (s16 % 4 === 2) this.tone(midi(th.bass[chordIdx]), t, dur * 1.8, th.wave === 'square' ? 'square' : 'triangle', 0.22, out)
      if (s16 === 0 || s16 === 8) th.chords[chordIdx].forEach((n) => this.tone(midi(n), t, dur * 6, th.wave, 0.045, out, 1800))
      const m = th.melody[s16]
      if (m && bar % 2 === 1) this.tone(midi(m), t, dur * 1.6, th.lead, 0.06, out, 3000)
    } else if (this.track === 'question') {
      if (s16 % 4 === 0) this.kick(t, out, 0.6)
      if (s16 % 2 === 0) this.hat(t, out, 0.04 + this.tension * 0.05)
      if (s16 === 0 || s16 === 6 || s16 === 10) this.tone(midi(th.bass[chordIdx] - 12 + (this.tension > 0.6 ? 1 : 0)), t, dur * 1.5, 'sawtooth', 0.12, out, 600)
      if (s16 === 0 && bar % 2 === 0) this.tone(midi(th.chords[chordIdx][0] + 12), t, dur * 8, 'sine', 0.03, out)
    }
  }

  private tone(freq: number, t: number, dur: number, type: OscillatorType, gain: number, out: AudioNode, cutoff?: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    let node: AudioNode = o
    if (cutoff) {
      const f = ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = cutoff
      o.connect(f)
      node = f
    }
    node.connect(g)
    g.connect(out)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  private noise(t: number, dur: number, gain: number, out: AudioNode, hp = 6000) {
    const ctx = this.ctx!
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur))
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = hp
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f)
    f.connect(g)
    g.connect(out)
    src.start(t)
  }

  private kick(t: number, out: AudioNode, gain = 0.8) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.setValueAtTime(150, t)
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12)
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    o.connect(g)
    g.connect(out)
    o.start(t)
    o.stop(t + 0.2)
  }
  private snare(t: number, out: AudioNode) { this.noise(t, 0.15, 0.25, out, 1500) }
  private hat(t: number, out: AudioNode, gain: number) { this.noise(t, 0.04, gain, out, 7000) }

  // ---------- Effektlər ----------
  private sfx(fn: (t: number, out: AudioNode) => void) {
    if (!this.ctx || !this.sfxGain) return
    fn(this.ctx.currentTime + 0.01, this.sfxGain)
  }
  pop() { this.sfx((t, o) => { this.tone(midi(84), t, 0.08, 'sine', 0.3, o); this.tone(midi(91), t + 0.05, 0.1, 'sine', 0.25, o) }) }
  click() { this.sfx((t, o) => this.tone(1200, t, 0.05, 'square', 0.12, o, 4000)) }
  correct() { this.sfx((t, o) => { this.tone(midi(76), t, 0.15, 'triangle', 0.35, o); this.tone(midi(84), t + 0.12, 0.35, 'triangle', 0.35, o) }) }
  wrong() { this.sfx((t, o) => { this.tone(midi(43), t, 0.35, 'sawtooth', 0.25, o, 500); this.tone(midi(38), t + 0.15, 0.45, 'sawtooth', 0.25, o, 400) }) }
  beep(high = false) { this.sfx((t, o) => this.tone(high ? 1320 : 880, t, 0.14, 'sine', 0.3, o)) }
  tick() { this.sfx((t, o) => this.tone(2000, t, 0.03, 'square', 0.12, o, 5000)) }
  whoosh() { this.sfx((t, o) => this.noise(t, 0.3, 0.15, o, 2500)) }
  fanfare() {
    this.stopMusic()
    void this.tryFile('podium').then((ok) => {
      if (ok) return
      this.sfx((t, o) => {
        const seq = [[60, 0], [64, 0.15], [67, 0.3], [72, 0.45], [67, 0.75], [72, 0.9]]
        seq.forEach(([n, d]) => this.tone(midi(n), t + d, d >= 0.9 ? 1.0 : 0.25, 'square', 0.18, o, 3500))
        ;[60, 64, 67, 72].forEach((n) => this.tone(midi(n), t + 0.9, 1.2, 'sawtooth', 0.06, o, 2500))
      })
    })
  }
}

export const audio = new Engine()
