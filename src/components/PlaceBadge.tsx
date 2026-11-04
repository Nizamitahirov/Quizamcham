import { motion } from 'framer-motion'
import { placeBadgeSvg, type Place } from '../lib/badge'
import { t } from '../i18n/az'

/** 1-ci / 2-ci / 3-cü yer nişanı (UI). */
export function PlaceBadge({ place, size = 120 }: { place: number; size?: number }) {
  if (place < 1 || place > 3) return null
  const svg = placeBadgeSvg(place as Place, { label: t.cert.badgeLabel })
  return (
    <motion.div initial={{ scale: 0, rotate: -25 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 180, damping: 12, delay: 0.3 }}
      style={{ width: size, height: size * 1.3 }} role="img" aria-label={t.cert.badgeAria(place)}
      dangerouslySetInnerHTML={{ __html: svg.replace('width="200" height="260"', `width="${size}" height="${size * 1.3}"`) }} />
  )
}
