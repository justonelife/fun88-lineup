import { motion } from 'motion/react'
import { SIDES } from '../data/teams'
import { useSquad } from '../store/useSquad'
import { useVersus } from '../store/derived'
import { Tappable } from './ui/Tappable'

interface Props {
  className?: string
  /** Copy under the control — what "active" means on this screen. */
  hint?: string
}

/**
 * The board's mode switch: every editing control on every screen targets the
 * side selected here. Von Restorff — only the active half carries colour, so
 * "who am I editing" is answered before you read a single word.
 */
export function SideToggle({ className = '', hint }: Props) {
  const activeSide = useSquad((s) => s.activeSide)
  const setActiveSide = useSquad((s) => s.setActiveSide)
  const versus = useVersus()

  return (
    <section aria-label="Team being edited" className={className}>
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="panel-inset grid grid-cols-2 gap-1 p-1"
      >
        {SIDES.map((side) => {
          const t = versus[side]
          const active = side === activeSide
          return (
            <Tappable
              key={side}
              role="tab"
              ariaSelected={active}
              ariaLabel={`Edit ${t.meta.label} — ${t.meta.name}`}
              onTap={() => setActiveSide(side)}
              className="tap relative flex items-center gap-2 rounded-xl px-3 py-2 text-left"
              style={{ color: active ? t.meta.onAccent : 'var(--color-ink)' }}
            >
              {active && (
                <motion.span
                  layoutId="side-active"
                  className="absolute inset-0 -z-10 rounded-xl"
                  style={{
                    background: `linear-gradient(150deg, ${t.meta.accent}, ${t.meta.accentDeep})`,
                    boxShadow: `0 8px 26px -10px ${t.meta.accent}`,
                  }}
                  transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                />
              )}
              <span
                className="display grid size-7 shrink-0 place-items-center rounded-lg text-2xs tracking-wider"
                style={{
                  background: active ? 'rgba(0,0,0,.22)' : 'var(--color-surface-3)',
                  color: active ? t.meta.onAccent : t.meta.accent,
                }}
              >
                {t.meta.short}
              </span>
              {/* On a phone this control shares its row with the view switch, so
                  the club name — already the largest thing in the header — drops
                  out and only the job of the control (which side) survives. */}
              <span className="min-w-0 flex-1">
                <span
                  className="display block text-2xs tracking-widest uppercase sm:text-2xs"
                  style={{ opacity: active ? 0.72 : 1, color: active ? undefined : 'var(--color-ink-faint)' }}
                >
                  {t.meta.label}
                </span>
                <span className="display hidden truncate text-sm leading-none sm:block">
                  {t.meta.name}
                </span>
              </span>
              {/* `text-base` would resolve to the --color-base swatch, not the
                  16px step — the theme owns both names. Ask for the size. */}
              <span className="display tnum shrink-0 text-[1rem] leading-none">{t.ovr.total}</span>
            </Tappable>
          )
        })}
      </div>
      {hint && <p className="mt-1.5 px-1 text-2xs text-ink-faint">{hint}</p>}
    </section>
  )
}
