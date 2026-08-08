import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'

/** Ignore scrim pointerdowns this soon after mount — covers synthesized click/pointer timing on touch browsers. */
const SCRIM_GUARD_MS = 250

interface Props {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Optional accessible title for the dialog. */
  label?: string
}

/**
 * Bottom sheet: scrim + spring-in surface, drag-down-to-dismiss, Escape to
 * close. Common region — the sheet is a distinct elevated surface (surface-2)
 * so its contents read as one task context.
 */
export function Sheet({ open, onClose, children, label }: Props) {
  const openedAt = useRef(0)

  useEffect(() => {
    if (!open) return
    openedAt.current = performance.now()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.button
            aria-label="Close"
            className="absolute inset-0 bg-black/65 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onPointerDown={() => {
              if (performance.now() - openedAt.current < SCRIM_GUARD_MS) return
              onClose()
            }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="relative w-full max-w-[34rem] rounded-t-3xl border-t border-x border-hairline bg-surface-2/95 backdrop-blur-xl shadow-[0_-24px_60px_-20px_rgba(0,0,0,.9)] sm:mb-6 sm:rounded-3xl sm:border"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38, mass: 0.9 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 720) onClose()
            }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <span className="h-1 w-10 rounded-full bg-surface-4" />
            </div>
            <div className="max-h-[82vh] overflow-y-auto overscroll-contain pb-safe">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
