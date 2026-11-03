export function randomPin(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 900000
  return String(100000 + n)
}
export const isValidPin = (p: string) => /^\d{6}$/.test(p)
