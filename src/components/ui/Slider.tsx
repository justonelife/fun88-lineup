import { motion } from 'motion/react'
import { Tappable } from './Tappable'

interface Props {
  label: string
  low: string
  high: string
  hint?: string
  value: number
  onChange: (v: number) => void
  step?: number
}

/**
 * Slider + steppers. The native range input stays in the DOM (keyboard, screen
 * readers, drag) but is rendered transparent over a custom track; the ± buttons
 * give thumb-reachable 44px targets for precise tuning on a phone.
 */
export function Slider({ label, low, high, hint, value, onChange, step = 5 }: Props) {
  const clamp = (v: number) => Math.max(0, Math.min(100, v))

  return (
    <div className="panel-inset px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="display text-sm tracking-wide text-ink uppercase">{label}</span>
        <span className="display tnum text-lg text-lime-300">{value}</span>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <Tappable
          ariaLabel={`Decrease ${label}`}
          className="tap grid size-9 place-items-center rounded-lg btn-ghost text-ink-muted"
          onTap={() => onChange(clamp(value - step))}
        >
          <span className="display text-lg leading-none">−</span>
        </Tappable>

        <div className="relative h-9 flex-1">
          <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-surface-4/80">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-lime-600 to-lime-400"
              initial={false}
              animate={{ width: `${value}%` }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            />
          </div>
          <motion.div
            className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-lime-200 bg-base shadow-[0_0_10px_-1px_var(--color-lime-500)]"
            initial={false}
            animate={{ left: `${value}%` }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          />
          <input
            type="range"
            min={0}
            max={100}
            step={step}
            value={value}
            aria-label={label}
            onChange={(e) => onChange(clamp(Number(e.target.value)))}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>

        <Tappable
          ariaLabel={`Increase ${label}`}
          className="tap grid size-9 place-items-center rounded-lg btn-ghost text-ink-muted"
          onTap={() => onChange(clamp(value + step))}
        >
          <span className="display text-lg leading-none">+</span>
        </Tappable>
      </div>

      <div className="mt-1.5 flex justify-between">
        <span className="label-micro">{low}</span>
        <span className="label-micro">{high}</span>
      </div>
      {hint && <p className="measure mt-2 text-xs text-ink-faint">{hint}</p>}
    </div>
  )
}
