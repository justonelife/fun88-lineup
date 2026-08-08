import { motion } from 'motion/react'

/* Data-visualisation rules applied to the small stuff: value encoded by length
 * first, colour second (never colour alone), always paired with a number so the
 * chart survives greyscale and colour-blindness. */

export function statTone(v: number): string {
  if (v >= 85) return 'var(--color-lime-400)'
  if (v >= 72) return 'var(--color-lime-600)'
  if (v >= 58) return 'var(--color-gold-500)'
  return 'var(--color-danger)'
}

export function staminaTone(v: number): string {
  if (v >= 70) return 'var(--color-chem-strong)'
  if (v >= 45) return 'var(--color-chem-mid)'
  return 'var(--color-chem-weak)'
}

interface StatBarProps {
  label: string
  value: number
  tone?: string
  delay?: number
}

export function StatBar({ label, value, tone, delay = 0 }: StatBarProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="label-micro w-8 shrink-0">{label}</span>
      <span className="display tnum w-7 shrink-0 text-sm text-ink">{value}</span>
      <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-4/70">
        <motion.span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: tone ?? statTone(value) }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20, delay }}
        />
      </span>
    </div>
  )
}

interface MeterProps {
  value: number
  tone?: string
  height?: number
  className?: string
}

/** Thin condition/stamina meter used inside player tokens. */
export function Meter({ value, tone, height = 3, className = '' }: MeterProps) {
  return (
    <span
      className={`relative block w-full overflow-hidden rounded-full bg-black/55 ${className}`}
      style={{ height }}
    >
      <motion.span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ background: tone ?? staminaTone(value) }}
        initial={false}
        animate={{ width: `${Math.max(2, value)}%` }}
        transition={{ type: 'spring', stiffness: 180, damping: 24 }}
      />
    </span>
  )
}
