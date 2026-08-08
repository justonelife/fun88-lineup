import { useCallback, useRef, useState, type ReactNode, type PointerEvent } from 'react'
import { motion, AnimatePresence } from 'motion/react'

interface Ripple {
  id: number
  x: number
  y: number
}

interface Props {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
  onTap?: () => void
  onLongPress?: () => void
  disabled?: boolean
  /** Scale applied while pressed. */
  press?: number
  ariaLabel?: string
  as?: 'button' | 'div'
}

const LONG_PRESS_MS = 420

/**
 * Every interactive surface in the app funnels through this: press-scale,
 * material-style ripple from the touch point, and an optional long-press
 * gesture with a light haptic tick where the platform supports it.
 */
export function Tappable({
  children,
  className = '',
  style,
  onTap,
  onLongPress,
  disabled,
  press = 0.955,
  ariaLabel,
  as = 'button',
}: Props) {
  const [ripples, setRipples] = useState<Ripple[]>([])
  const timer = useRef<number | null>(null)
  const fired = useRef(false)
  const seq = useRef(0)

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const down = (e: PointerEvent<HTMLElement>) => {
    if (disabled) return
    const rect = e.currentTarget.getBoundingClientRect()
    const id = ++seq.current
    setRipples((r) => [...r, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }])
    window.setTimeout(() => setRipples((r) => r.filter((x) => x.id !== id)), 520)

    fired.current = false
    if (onLongPress) {
      timer.current = window.setTimeout(() => {
        fired.current = true
        navigator.vibrate?.(12)
        onLongPress()
      }, LONG_PRESS_MS)
    }
  }

  const up = () => {
    clear()
    if (disabled || fired.current) return
    navigator.vibrate?.(6)
    onTap?.()
  }

  const Comp = as === 'button' ? motion.button : motion.div

  return (
    <Comp
      type={as === 'button' ? 'button' : undefined}
      aria-label={ariaLabel}
      disabled={as === 'button' ? disabled : undefined}
      className={`relative overflow-hidden select-none ${className}`}
      style={style}
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={clear}
      onPointerCancel={clear}
      whileTap={disabled ? undefined : { scale: press }}
      transition={{ type: 'spring', stiffness: 620, damping: 30 }}
    >
      {children}
      <AnimatePresence>
        {ripples.map((r) => (
          <motion.span
            key={r.id}
            className="pointer-events-none absolute rounded-full"
            style={{
              left: r.x,
              top: r.y,
              background:
                'radial-gradient(circle, rgba(184,241,60,.42) 0%, rgba(184,241,60,0) 70%)',
            }}
            initial={{ width: 0, height: 0, x: 0, y: 0, opacity: 0.9 }}
            animate={{ width: 220, height: 220, x: -110, y: -110, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </AnimatePresence>
    </Comp>
  )
}
