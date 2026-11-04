/** Telefon titrəməsi (dəstəklənirsə). iOS Safari dəstəkləmir — səssizcə heç nə etmir. */
const vib = (p: number | number[]) => { try { navigator.vibrate?.(p) } catch { /* noop */ } }
export const haptic = {
  tap: () => vib(12),
  correct: () => vib([30, 50, 30]),
  wrong: () => vib(180),
  start: () => vib([20, 40, 20, 40, 60]),
}
