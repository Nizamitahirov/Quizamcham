/**
 * Web Audio API ilə kodla yaradılan musiqi (14 mövzu) və səs effektləri.
 * Düz/səhv cavab üçün admin yüklədiyi səs parçası varsa, o çalınır.
 */
import type { MusicTheme, SoundSettings } from '../types'
import { THEMES } from './themes'

type Track = 'lobby' | 'question' | null
const MUTE_KEY = 'qz.muted'
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

class Engine {
  ctx: AudioContext | null = null
  master: GainNode | null = null
  musicGain: GainNode | null = null
  sfxGain: GainNode | null = null
  muted = false
  volume = 0.6
  theme: MusicTheme = 'energetic'
  track: Track = null
  private timer: number | null = null
  private step = 0
  private nextTime = 0
  private tension = 0
  private listeners = new Set<() => void>()
  private clips: { correct?: AudioBuffer; wrong?: AudioBuffer } = {}
  private clipSrc: AudioBufferSourceNode | null = null
  private pendingClips: SoundSettings | null = null
  private previewTimer: number | null = null

  constructor() {
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1' } catch { /* noop */ }
  }

  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private emit() { this.listeners.forEach((f) => f()) }

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
      if (this.pendingClips) void this.loadClips(this.pendingClips)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  get unlocked() { return !!this.ctx && this.ctx.state === 'running' }

  private applyGain() {
    if (this.master) this.master.gain.value = this.muted ? 0 : 1
    if (this.musicGain) this.musicGain.gain.value = 0.35 * this.volume
  }
  setVolume(v0to100: number) { this.volume = Math.max(0, Math.min(1, v0to100 / 100)); this.applyGain() }
  setTheme(t: MusicTheme) { this.theme = THEMES[t] ? t : 'energetic' }
  setMuted(m: boolean) {
    this.muted = m
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0') } catch { /* noop */ }
    this.applyGain()
    this.emit()
  }
  toggleMute() { this.setMuted(!this.muted) }
  setTension(t: number) { this.tension = t }

  /** Admin yüklədiyi düz/səhv cavab parçaları. */
  async loadClips(s: SoundSettings | null) {
    this.pendingClips = s
    this.clips = {}
    if (!s || !s.enabled || !this.ctx) return
    for (const k of ['correct', 'wrong'] as const) {
      const c = s[k]
      if (!c?.data) continue
      try {
        const buf = await fetch(c.data).then((r) => r.arrayBuffer())
        this.clips[k] = await this.ctx.decodeAudioData(buf)
      } catch { /* yararsız fayl */ }
    }
  }

  play(track: Exclude<Track, null>) {
    if (this.track === track) return
    this.stopMusic()
    this.track = track
    if (!this.ctx) return
    this.step = 0
    this.nextTime = this.ctx.currentTime + 0.05
    this.timer = window.setInterval(() => this.schedule(), 25)
  }

  stopMusic() {
    this.track = null
    if (this.timer) { clearInterval(this.timer); this.timer = null }
    if (this.previewTimer) { clearTimeout(this.previewTimer); this.previewTimer = null }
  }

  /** Admin panelində mövzunu 8 saniyəlik dinləmək. */
  preview(theme: MusicTheme) {
    this.unlock()
    this.setTheme(theme)
    this.track = null
    this.play('lobby')
    this.previewTimer = window.setTimeout(() => this.stopMusic(), 8000)
  }

  private schedule() {
    if (!this.ctx) return
    const th = THEMES[this.theme]
    const bpm = this.track === 'question' ? th.bpm + 6 + this.tension * 30 : th.bpm
    const sixteenth = 60 / bpm / 4
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      const swing = this.step % 2 === 1 ? th.swing * sixteenth : 0
      this.scheduleStep(this.step, this.nextTime + swing, sixteenth)
      this.nextTime += sixteenth
      this.step = (this.step + 1) % 128
    }
  }

  private scheduleStep(step: number, t: number, dur: number) {
    const th = THEMES[this.theme]
    const s16 = step % 16
    const bar = Math.floor(step / 16) % 8
    const chord = th.chords[Math.floor(bar / 2) % th.chords.length]
    const root = chord[0] - 12
    const out = this.musicGain!
    const on = (pat: string) => pat[s16] === 'x'
    if (this.track === 'lobby') {
      if (on(th.kick)) this.kick(t, out)
      if (on(th.snare)) this.snare(t, out)
      if (on(th.hat)) this.hat(t, out, th.hatGain)
      const b = th.bass[s16]
      if (b && b !== '.') this.tone(midi(root + (b === 'o' ? 12 : Number(b) || 0)), t, dur * 1.6, th.bassWave, 0.18, out, 900)
      if (th.pad && (s16 === 0 || s16 === 8)) chord.forEach((n) => this.tone(midi(n), t, dur * 7.5, th.pad!, th.padGain, out, th.cutoff))
      const m = th.melody[s16]
      if (m && bar % th.leadEvery === th.leadEvery - 1) this.tone(midi(m), t, dur * 1.7, th.lead, 0.055, out, th.cutoff * 1.6)
    } else if (this.track === 'question') {
      if (s16 % 4 === 0) this.kick(t, out, 0.6)
      if (s16 % 2 === 0) this.hat(t, out, 0.035 + this.tension * 0.05)
      if (s16 === 0 || s16 === 6 || s16 === 10) this.tone(midi(root - 12 + (this.tension > 0.6 ? 1 : 0)), t, dur * 1.5, 'sawtooth', 0.12, out, 600)
      if (s16 === 0 && bar % 2 === 0) this.tone(midi(chord[0] + 12), t, dur * 8, th.pad ?? 'sine', 0.03, out, th.cutoff)
    }
  }

  private tone(freq: number, t: number, dur: number, type: OscillatorType, gain: number, out: AudioNode, cutoff?: number, vibrato = 0) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (vibrato) {
      const lfo = ctx.createOscillator(); const lg = ctx.createGain()
      lfo.frequency.value = 5.5; lg.gain.value = vibrato
      lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.1)
    }
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012)
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
    return o
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
    src.connect(f); f.connect(g); g.connect(out)
    src.start(t)
  }
  private kick(t: number, out: AudioNode, gain = 0.8) {
    const ctx = this.ctx!
    const o = ctx.createOscillator(); const g = ctx.createGain()
    o.frequency.setValueAtTime(150, t)
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12)
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.2)
  }
  private snare(t: number, out: AudioNode) { this.noise(t, 0.15, 0.22, out, 1500) }
  private hat(t: number, out: AudioNode, gain: number) { if (gain > 0) this.noise(t, 0.04, gain, out, 7000) }

  // ---------- Effektlər ----------
  private sfx(fn: (t: number, out: AudioNode) => void) {
    if (!this.ctx || !this.sfxGain) return
    fn(this.ctx.currentTime + 0.01, this.sfxGain)
  }
  private playClip(k: 'correct' | 'wrong') {
    const buf = this.clips[k]
    if (!buf || !this.ctx || !this.sfxGain) return false
    this.clipSrc?.stop()
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.connect(this.sfxGain)
    src.start()
    this.clipSrc = src
    return true
  }
  pop() { this.sfx((t, o) => { this.tone(midi(84), t, 0.08, 'sine', 0.3, o); this.tone(midi(91), t + 0.05, 0.1, 'sine', 0.25, o) }) }
  click() { this.sfx((t, o) => this.tone(1200, t, 0.05, 'square', 0.12, o, 4000)) }

  /** Qələbə: orijinal diskofank fanfarı (oktava bas + akkord ştabı + yüksələn arpecio). */
  correct() {
    if (this.playClip('correct')) return
    this.sfx((t, o) => {
      const b = 60 / 116 / 2
      ;[0, 1, 2, 3].forEach((i) => { this.kick(t + i * b, o, 0.7); this.tone(midi(i % 2 ? 50 : 38), t + i * b, b * 0.9, 'sawtooth', 0.22, o, 900) })
      ;[[62, 66, 69, 73], [64, 68, 71, 74]].forEach((ch, k) => ch.forEach((n) => this.tone(midi(n), t + b * (1 + k * 2), b * 0.7, 'square', 0.06, o, 3200)))
      ;[74, 78, 81, 86].forEach((n, i) => this.tone(midi(n), t + b * 2 + i * 0.07, 0.35, 'triangle', 0.16, o))
      this.noise(t + b * 3.5, 0.5, 0.08, o, 5000)
    })
  }
  /** Məyus: orijinal enən "vah-vah" melodiyası, vibrato ilə. */
  wrong() {
    if (this.playClip('wrong')) return
    this.sfx((t, o) => {
      const seq = [[55, 0, 0.32], [54, 0.36, 0.32], [53, 0.72, 0.32], [52, 1.08, 1.1]] as const
      seq.forEach(([n, d, l]) => this.tone(midi(n), t + d, l, 'sawtooth', 0.16, o, 700, d > 1 ? 9 : 2.5))
    })
  }
  beep(high = false) { this.sfx((t, o) => this.tone(high ? 1320 : 880, t, 0.14, 'sine', 0.3, o)) }
  tick() { this.sfx((t, o) => this.tone(2000, t, 0.03, 'square', 0.12, o, 5000)) }
  whoosh() { this.sfx((t, o) => this.noise(t, 0.3, 0.15, o, 2500)) }
  fanfare() {
    this.stopMusic()
    this.sfx((t, o) => {
      const seq = [[60, 0], [64, 0.15], [67, 0.3], [72, 0.45], [67, 0.75], [72, 0.9]]
      seq.forEach(([n, d]) => this.tone(midi(n), t + d, d >= 0.9 ? 1.0 : 0.25, 'square', 0.18, o, 3500))
      ;[60, 64, 67, 72].forEach((n) => this.tone(midi(n), t + 0.9, 1.2, 'sawtooth', 0.06, o, 2500))
    })
  }
}

export const audio = new Engine()
