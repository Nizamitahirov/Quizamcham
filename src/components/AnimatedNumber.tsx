import { animate, useMotionValue, useTransform, motion } from 'framer-motion'
import { useEffect } from 'react'

export function AnimatedNumber({ value, from, duration = 1.2 }: { value: number; from?: number; duration?: number }) {
  const mv = useMotionValue(from ?? 0)
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString('az-AZ'))
  useEffect(() => {
    const c = animate(mv, value, { duration, ease: 'easeOut' })
    return () => c.stop()
  }, [value, duration, mv])
  return <motion.span>{text}</motion.span>
}
