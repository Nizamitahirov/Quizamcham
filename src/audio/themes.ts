import type { MusicTheme } from '../types'

/** 16 addımlıq naxış: 'x' = vur, '.' = boş */
export interface ThemeDef {
  bpm: number
  swing: number
  chords: number[][] // hər 2 takt üçün akkord (MIDI)
  bass: string // 16 addım: rəqəm = kökdən interval (yarımton), 'o' = oktava, '.' = boş
  bassWave: OscillatorType
  pad: OscillatorType | null
  padGain: number
  lead: OscillatorType
  melody: (number | null)[] // 16 addım, MIDI
  kick: string
  snare: string
  hat: string
  hatGain: number
  cutoff: number
  leadEvery: number // melodiya neçə taktdan bir
}

const P = (s: string) => s.replace(/\s/g, '')

export const THEMES: Record<MusicTheme, ThemeDef> = {
  energetic: { bpm: 124, swing: 0, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], bass: P('0.0. 0.0. 0.0. 0.o.'), bassWave: 'sawtooth', pad: 'sawtooth', padGain: 0.04, lead: 'square', melody: [69, null, 72, 71, 69, null, 67, 69, 65, null, 69, 67, 64, null, 67, 71], kick: P('x...x...x...x...'), snare: P('....x.......x...'), hat: P('..x...x...x...x.'), hatGain: 0.05, cutoff: 2200, leadEvery: 2 },
  chill: { bpm: 96, swing: 0.12, chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]], bass: P('0....... 7..0....'), bassWave: 'triangle', pad: 'triangle', padGain: 0.05, lead: 'sine', melody: [76, null, null, 74, 72, null, 71, null, 72, null, null, 69, 67, null, null, null], kick: P('x.........x.....'), snare: P('....x.......x...'), hat: P('x.x.x.x.x.x.x.x.'), hatGain: 0.03, cutoff: 1400, leadEvery: 2 },
  retro: { bpm: 128, swing: 0, chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], bass: P('0.o.0.o.0.o.0.o.'), bassWave: 'square', pad: null, padGain: 0, lead: 'square', melody: [72, 76, 79, 76, 72, 76, 79, 84, 81, 77, 74, 77, 79, 74, 71, 74], kick: P('x...x...x...x...'), snare: P('....x.......x...'), hat: P('x.x.x.x.x.x.x.x.'), hatGain: 0.03, cutoff: 5000, leadEvery: 1 },
  synthwave: { bpm: 110, swing: 0, chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]], bass: P('0000000000000000'), bassWave: 'sawtooth', pad: 'sawtooth', padGain: 0.05, lead: 'sawtooth', melody: [81, null, null, 79, 76, null, null, 74, 76, null, 79, null, 76, null, null, null], kick: P('x...x...x...x...'), snare: P('....x.......x...'), hat: P('..x...x...x...x.'), hatGain: 0.04, cutoff: 1600, leadEvery: 2 },
  lofi: { bpm: 84, swing: 0.18, chords: [[62, 65, 69, 72], [55, 59, 62, 65], [60, 64, 67, 71], [57, 60, 64, 67]], bass: P('0.....0...7.....'), bassWave: 'sine', pad: 'triangle', padGain: 0.06, lead: 'triangle', melody: [74, null, 72, null, null, 69, null, null, 72, null, null, null, 67, null, null, null], kick: P('x......x..x.....'), snare: P('....x.......x...'), hat: P('x.x.x.x.x.x.x.x.'), hatGain: 0.025, cutoff: 900, leadEvery: 2 },
  house: { bpm: 124, swing: 0.05, chords: [[57, 60, 64, 67], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]], bass: P('..0...0...0...0.'), bassWave: 'square', pad: 'square', padGain: 0.035, lead: 'triangle', melody: [null, null, 76, null, null, 76, null, 74, null, null, 72, null, 74, null, null, null], kick: P('x...x...x...x...'), snare: P('....x.......x...'), hat: P('..x...x...x...x.'), hatGain: 0.07, cutoff: 1800, leadEvery: 1 },
  funk: { bpm: 112, swing: 0.1, chords: [[52, 55, 59, 62], [52, 55, 59, 62], [57, 60, 64, 67], [55, 59, 62, 65]], bass: P('0..0.0o...0.7.o0'), bassWave: 'sawtooth', pad: null, padGain: 0, lead: 'square', melody: [76, null, 79, 76, null, 74, null, 76, null, null, 71, null, 74, 76, null, null], kick: P('x..x..x...x..x..'), snare: P('....x.......x...'), hat: P('xxxxxxxxxxxxxxxx'), hatGain: 0.03, cutoff: 2600, leadEvery: 2 },
  arcade: { bpm: 140, swing: 0, chords: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]], bass: P('0.0.7.7.0.0.7.7.'), bassWave: 'square', pad: null, padGain: 0, lead: 'square', melody: [84, 83, 84, 79, 76, 79, 72, null, 74, 76, 77, 79, 81, 79, 77, 76], kick: P('x.......x.......'), snare: P('....x.......x...'), hat: P('x.x.x.x.x.x.x.x.'), hatGain: 0.03, cutoff: 6000, leadEvery: 1 },
  epic: { bpm: 100, swing: 0, chords: [[50, 57, 62, 65], [46, 53, 58, 62], [48, 55, 60, 64], [45, 52, 57, 61]], bass: P('0.......0...0...'), bassWave: 'sawtooth', pad: 'sawtooth', padGain: 0.06, lead: 'sawtooth', melody: [74, null, null, null, 77, null, 76, null, 74, null, null, 72, 74, null, null, null], kick: P('x.....x.x.......'), snare: P('....x.......x.xx'), hat: P('................'), hatGain: 0, cutoff: 1300, leadEvery: 2 },
  jazz: { bpm: 104, swing: 0.22, chords: [[62, 65, 69, 72], [55, 59, 62, 65], [60, 64, 67, 71], [57, 61, 64, 67]], bass: P('0...4...7...9...'), bassWave: 'triangle', pad: 'sine', padGain: 0.05, lead: 'sine', melody: [74, null, 77, 76, null, 74, 72, null, 71, null, 72, null, 69, null, null, null], kick: P('x.........x.....'), snare: P('........x.......'), hat: P('x..xx..xx..xx..x'), hatGain: 0.035, cutoff: 2000, leadEvery: 2 },
  latin: { bpm: 100, swing: 0, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [52, 56, 59]], bass: P('0..0..7.0..0..7.'), bassWave: 'sawtooth', pad: null, padGain: 0, lead: 'triangle', melody: [76, null, 76, 77, null, 76, 74, null, 72, null, 74, 76, null, null, null, null], kick: P('x..x..x.x..x..x.'), snare: P('...x..x....x..x.'), hat: P('x.xxx.xxx.xxx.xx'), hatGain: 0.03, cutoff: 2400, leadEvery: 2 },
  techno: { bpm: 130, swing: 0, chords: [[45, 48, 52], [45, 48, 52], [43, 46, 50], [43, 46, 50]], bass: P('.0.0.0.0.0.0.0.0'), bassWave: 'sawtooth', pad: null, padGain: 0, lead: 'square', melody: [69, null, null, 72, null, null, 69, null, null, 67, null, null, 69, null, null, null], kick: P('x...x...x...x...'), snare: P('....x.......x...'), hat: P('..x...x...x...x.'), hatGain: 0.08, cutoff: 1100, leadEvery: 1 },
  bossa: { bpm: 92, swing: 0.08, chords: [[60, 64, 67, 71], [62, 65, 69, 72], [55, 59, 62, 65], [60, 64, 67, 71]], bass: P('0..7..0.0..7..0.'), bassWave: 'triangle', pad: 'sine', padGain: 0.05, lead: 'triangle', melody: [79, null, 76, null, 77, null, 74, null, 76, null, null, 72, null, null, null, null], kick: P('x..x..x.x..x..x.'), snare: P('..x..x...x..x...'), hat: P('xxxxxxxxxxxxxxxx'), hatGain: 0.018, cutoff: 1700, leadEvery: 2 },
  space: { bpm: 90, swing: 0, chords: [[48, 55, 62, 67], [46, 53, 60, 65], [44, 51, 58, 63], [46, 53, 60, 65]], bass: P('0...............'), bassWave: 'sine', pad: 'sine', padGain: 0.08, lead: 'sine', melody: [79, null, null, null, null, null, 82, null, null, null, 77, null, null, null, null, null], kick: P('x.......x.......'), snare: P('................'), hat: P('....x.......x...'), hatGain: 0.02, cutoff: 1200, leadEvery: 1 },
}

export const THEME_LIST = Object.keys(THEMES) as MusicTheme[]
