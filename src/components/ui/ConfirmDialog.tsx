import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Tappable } from './Tappable'

/** Ignore scrim pointerdowns this soon after mount — covers synthesized click/pointer timing on touch browsers. */
const SCRIM_GUARD_MS = 250

interface Props {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * In-app destructive confirmation. Centred rather than bottom-anchored so it
 * reads as a stop, not as another sheet you can flick away — and the danger
 * action never sits under the thumb that just opened it.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Keep player',
  onConfirm,
  onCancel,
}: Props) {
  const openedAt = useRef(0)

  useEffect(() => {
    if (!open) return
    openedAt.current = performance.now()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  // Portalled for the same reason as `Sheet` — see the note there.
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[65] grid place-items-center px-5">
          <motion.button
            aria-label="Cancel"
            className="absolute inset-0 bg-black/72 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onPointerDown={() => {
              if (performance.now() - openedAt.current < SCRIM_GUARD_MS) return
              onCancel()
            }}
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-label={title}
            className="panel relative w-full max-w-[24rem] px-5 py-5"
            style={{ borderColor: 'color-mix(in srgb, var(--color-danger) 45%, transparent)' }}
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 460, damping: 34 }}
          >
            <h2 className="display text-lg leading-tight text-ink">{title}</h2>
            <p className="measure mt-2 text-sm text-ink-muted">{body}</p>

            <div className="mt-5 grid gap-2">
              <Tappable
                ariaLabel={confirmLabel}
                onTap={onConfirm}
                ripple="rgba(255,79,100,.42)"
                className="tap w-full rounded-xl px-4 py-3"
                style={{
                  background: 'linear-gradient(180deg, #ff5c70, #c3253c)',
                  color: '#fff4f6',
                  boxShadow: '0 8px 26px -10px rgba(255,79,100,.8)',
                }}
              >
                <span className="display text-sm tracking-widest uppercase">{confirmLabel}</span>
              </Tappable>
              <Tappable
                ariaLabel={cancelLabel}
                onTap={onCancel}
                className="tap btn-ghost w-full rounded-xl px-4 py-3"
              >
                <span className="display text-sm tracking-wide">{cancelLabel}</span>
              </Tappable>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
