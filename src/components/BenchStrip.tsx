import { motion } from 'motion/react'
import { Avatar } from './ui/Avatar'
import { Meter } from './ui/Bars'
import { Tappable } from './ui/Tappable'
import { resolve } from '../lib/chemistry'
import { shortName, staminaTone } from '../lib/lineup'
import { team } from '../data/teams'
import { useSquad } from '../store/useSquad'
import type { PitchMode } from './Pitch'

interface Props {
  mode: PitchMode
  onSelectBench: (index: number) => void
}

/** Bench rail for the active side. Common region: one bordered strip holds all
 *  substitutes, so the eye never confuses a bench card with a pitch token. */
export function BenchStrip({ mode, onSelectBench }: Props) {
  const activeSide = useSquad((s) => s.activeSide)
  const bench = useSquad((s) => s[s.activeSide].bench)
  const subsLeft = useSquad((s) => s[s.activeSide].subsLeft)
  const roster = useSquad((s) => s.roster)
  const meta = team(activeSide)
  const armed = mode.kind === 'sub' ? mode.benchIndex : null

  return (
    <section aria-label="Substitutes" className="panel mx-4 mt-4 overflow-hidden">
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
        <h2 className="label-micro">
          Bench · <span style={{ color: meta.accent }}>{meta.label}</span>
        </h2>
        <span className="text-2xs text-ink-faint">
          {subsLeft > 0 ? `${subsLeft} subs left` : 'no subs left'}
        </span>
        {armed !== null && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className="display ml-auto rounded-full px-2 py-0.5 text-2xs tracking-wider uppercase"
            style={{
              background: `color-mix(in srgb, ${meta.accent} 16%, transparent)`,
              color: meta.accentSoft,
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${meta.accent} 42%, transparent)`,
            }}
          >
            Tap a starter
          </motion.span>
        )}
      </div>

      <div className="scroll-x flex gap-2 px-3 pb-3">
        {bench.map((id, i) => {
          const p = resolve(roster, id)
          const isArmed = armed === i
          const disabled = !p || subsLeft <= 0

          if (!p) {
            return (
              <div
                key={`empty-${i}`}
                className="flex w-[4.75rem] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-hairline py-3 text-ink-faint"
              >
                <span className="display text-lg leading-none">+</span>
                <span className="label-micro">Empty</span>
              </div>
            )
          }

          return (
            <Tappable
              key={`${p.id}-${i}`}
              disabled={disabled}
              onTap={() => onSelectBench(i)}
              ripple={`color-mix(in srgb, ${meta.accent} 42%, transparent)`}
              ariaLabel={`Substitute ${p.name} on for ${meta.label}`}
              className={`glass tap w-[4.75rem] shrink-0 rounded-xl px-1.5 pt-1.5 pb-2 ${
                disabled ? 'opacity-45' : ''
              }`}
              style={
                isArmed
                  ? { boxShadow: `0 0 0 2px ${meta.accent}, 0 0 26px -6px ${meta.accent}` }
                  : undefined
              }
            >
              <div className="flex items-center justify-between">
                <span className="label-micro">{p.pos}</span>
                <span className="display tnum text-2xs text-gold-300">{p.ovr}</span>
              </div>
              <Avatar player={p} size={30} className="mx-auto mt-1" />
              <span className="display mt-1 block truncate text-center text-2xs leading-tight text-ink">
                {shortName(p.name)}
              </span>
              <Meter
                value={p.stamina}
                height={3}
                className="mt-1.5"
                tone={
                  staminaTone(p.stamina) === 'ok'
                    ? 'var(--color-chem-strong)'
                    : staminaTone(p.stamina) === 'low'
                      ? 'var(--color-chem-mid)'
                      : 'var(--color-chem-weak)'
                }
              />
            </Tappable>
          )
        })}
      </div>
    </section>
  )
}
