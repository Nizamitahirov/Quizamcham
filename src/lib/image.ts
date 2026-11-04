/** Şəkli brauzerdə sıxır (maks. 1024 px, WebP) → data-URL. Firebase Storage tələb etmir. */
export async function compressImage(file: File, maxSide = 1024, maxBytes = 280_000): Promise<string> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  for (const q of [0.82, 0.7, 0.58, 0.45, 0.35]) {
    const url = c.toDataURL('image/webp', q)
    if (url.length * 0.75 <= maxBytes) return url
  }
  // hələ də böyükdürsə, ölçünü azalt
  if (maxSide > 480) return compressImage(file, Math.round(maxSide * 0.7), maxBytes)
  throw new Error('too-big')
}
