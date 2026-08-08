import { motion } from 'motion/react'
import { FORMATIONS } from '../data/formations'
import { team } from '../data/teams'
import { useSquad } from '../store/useSquad'
import { Tappable } from './ui/Tappable'
import type { Formation } from '../types'

function MiniShape({ formation, selected }: { formation: Formation; selected: boolean }) {
  return (
    <svg viewBox="0 0 100 130" className="h-9 w-7" aria-hidden>
      <rect
        x="1"
        y="1"
        width="98"
        height="128"
        rx="8"
        fill={selected ? 'rgba(4,7,14,.22)' : 'rgba(255,255,255,.04)'}
        stroke={selected ? 'rgba(4,7,14,.38)' : 'var(--color-hairline)'}
        strokeWidth="2"
      />
      <line
        x1="4"
        y1="65"
        x2="96"
        y2="65"
        stroke={selected ? 'rgba(4,7,14,.28)' : 'rgba(255,255,255,.10)'}
        strokeWidth="2"
      />
      {formation.slots.map((s) => (
        <circle
          key={s.i}
          cx={s.x}
          cy={(s.y / 100) * 130}
          r="7"
          fill={selected ? '#08120a' : 'var(--color-ink-faint)'}
        />
      ))}
    </svg>
  )
}

/**
 * Horizontal chip rail for the ACTIVE side only. Only the active chip deviates
 * (fill + glow + colour) — everything else is uniform, which is what makes the
 * selection pop. The fill takes the active team's colour, so the rail always
 * says which squad it is about to reshape.
 */
export function FormationSelector() {
  const activeSide = useSquad((s) => s.activeSide)
  const formationId = useSquad((s) => s[s.activeSide].formationId)
  const setFormation = useSquad((s) => s.setFormation)
  const meta = team(activeSide)

  return (
    <section aria-label="Formation">
      <div className="mb-2 flex items-baseline justify-between gap-3 px-4">
        <h2 className="label-micro">
          Formation · <span style={{ color: meta.accent }}>{meta.label}</span>
        </h2>
        <span className="truncate text-2xs text-ink-faint">
          {FORMATIONS.find((f) => f.id === formationId)?.blurb}
        </span>
      </div>
      <div className="scroll-x flex gap-2 px-4 pb-1">
        {FORMATIONS.map((f) => {
          const active = f.id === formationId
          return (
            <Tappable
              key={f.id}
              onTap={() => setFormation(activeSide, f.id)}
              ripple={`color-mix(in srgb, ${meta.accent} 42%, transparent)`}
              className={`tap relative flex shrink-0 items-center gap-2 rounded-xl px-2.5 py-2 ${
                active ? '' : 'glass text-ink'
              }`}
              style={active ? { color: meta.onAccent } : undefined}
              ariaLabel={`Formation ${f.name} for ${meta.label}`}
            >
              {active && (
                <motion.span
                  layoutId="formation-active"
                  className="absolute inset-0 -z-10 rounded-xl"
                  style={{
                    background: `linear-gradient(160deg, ${meta.accent}, ${meta.accentDeep})`,
                    boxShadow: `0 6px 22px -8px ${meta.accent}`,
                  }}
                  transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                />
              )}
              <MiniShape formation={f} selected={active} />
              <span className="text-left">
                <span className="display block text-sm leading-none tracking-wide">{f.name}</span>
                <span
                  className={`display mt-1 block text-2xs tracking-widest uppercase ${
                    active ? 'opacity-70' : 'text-ink-faint'
                  }`}
                >
                  {f.shape}
                </span>
              </span>
            </Tappable>
          )
        })}
      </div>
    </section>
  )
}
