import { AnimatePresence, motion } from 'motion/react'
import { useToast } from '../../store/useToast'
import type { ToastTone } from '../../store/useToast'

const TONE: Record<ToastTone, { ink: string; edge: string }> = {
  ok: { ink: 'var(--color-lime-200)', edge: 'var(--color-lime-500)' },
  warn: { ink: 'var(--color-gold-200)', edge: 'var(--color-gold-500)' },
  danger: { ink: '#ffd7dd', edge: 'var(--color-danger)' },
}

/**
 * One transient feedback channel for the whole app, parked just above the tab
 * bar so it never covers the thumb zone. Stacked newest-last, three at most.
 * Deliberately inert: a toast that floats over a sheet must never swallow the
 * tap meant for the button underneath it, so it times itself out instead of
 * offering a dismiss target.
 */
export function Toaster() {
  const toasts = useToast((s) => s.toasts)

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[70] flex flex-col items-center gap-1.5 px-4"
      style={{ bottom: 'calc(var(--app-tabbar-h) + var(--safe-bottom) + 0.75rem)' }}
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className="panel max-w-[28rem] px-4 py-2.5 text-center text-sm"
            style={{
              color: TONE[t.tone].ink,
              borderColor: `color-mix(in srgb, ${TONE[t.tone].edge} 55%, transparent)`,
              boxShadow: `0 12px 34px -14px ${TONE[t.tone].edge}`,
            }}
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 460, damping: 34 }}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
