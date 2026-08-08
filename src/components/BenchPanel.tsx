import { useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { PlayerToken, TOKEN_RATIO } from './PlayerToken'
import { Tappable } from './ui/Tappable'
import { resolve } from '../lib/chemistry'
import { MAX_SUBS, useSquad } from '../store/useSquad'
import type { TeamDerived } from '../store/derived'
import type { PitchMode } from './Pitch'

interface Props {
  team: TeamDerived
  mode: PitchMode
  onSelectBench: (index: number) => void
  onInspectBench: (index: number) => void
  /** `column` = the desktop side panel; `rail` = the mobile strip under the pitch. */
  layout: 'column' | 'rail'
}

const RAIL_CARD = 68
const GAP = 8

function Pips({ n, accent }: { n: number; accent: string }) {
  return (
    <span className="flex gap-1" aria-label={`${n} substitutions remaining`}>
      {Array.from({ length: MAX_SUBS }, (_, i) => (
        <span
          key={i}
          className="h-1 w-3.5 rounded-full transition-colors"
          style={{ background: i < n ? accent : 'var(--color-surface-4)' }}
        />
      ))}
    </span>
  )
}

/**
 * The substitutes panel. Common region: one bordered surface holds every reserve,
 * so a bench card can never be mistaken for a starter standing on the grass —
 * they share a design language but never a container.
 *
 * On desktop it is a scrolling column beside the pitch; on a phone the same
 * component becomes a horizontal rail directly under the pitch, which keeps both
 * halves of the job (who is on, who is waiting) on screen at once.
 */
export function BenchPanel({ team, mode, onSelectBench, onInspectBench, layout }: Props) {
  const subsLeft = useSquad((s) => s[team.side].subsLeft)
  const gridRef = useRef<HTMLDivElement>(null)
  const [gridW, setGridW] = useState(0)

  useLayoutEffect(() => {
    const el = gridRef.current
    if (!el || layout !== 'column') return
    const ro = new ResizeObserver(([entry]) => {
      const w = entry?.contentRect.width
      if (w) setGridW((prev) => (Math.abs(prev - w) < 0.5 ? prev : w))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [layout])

  const cols = layout === 'column' ? (gridW >= 300 ? 3 : 2) : 1
  const cardW =
    layout === 'rail'
      ? RAIL_CARD
      : Math.max(56, Math.min(132, Math.floor((gridW - GAP * (cols - 1)) / cols)))
  const cardH = Math.round(cardW * TOKEN_RATIO.normal)

  const armed = mode.kind === 'sub' ? mode.benchIndex : null
  const accent = team.meta.accent

  return (
    <section
      aria-label={`Substitutes — ${team.meta.label}`}
      className={`panel flex min-h-0 flex-col overflow-hidden ${
        layout === 'column' ? 'h-full' : ''
      }`}
      style={{ background: 'color-mix(in srgb, var(--color-navy-800) 78%, transparent)' }}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-hairline/70 px-3 py-2">
        <h2 className="label-micro">
          Bench · <span style={{ color: accent }}>{team.meta.label}</span>
        </h2>
        <Pips n={subsLeft} accent={accent} />
        <span className="ml-auto text-2xs text-ink-faint">
          {subsLeft > 0 ? `${subsLeft} of ${MAX_SUBS} left` : 'no subs left'}
        </span>
      </header>

      {armed !== null && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="display shrink-0 px-3 py-1.5 text-2xs tracking-wider uppercase"
          style={{
            background: `color-mix(in srgb, ${accent} 14%, transparent)`,
            color: team.meta.accentSoft,
          }}
        >
          Now tap the starter coming off
        </motion.p>
      )}

      <div
        ref={gridRef}
        className={
          layout === 'column'
            ? 'grid min-h-0 flex-1 content-start justify-items-center gap-2 overflow-y-auto p-3'
            : 'scroll-x flex gap-2 p-3'
        }
        style={
          layout === 'column'
            ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }
            : undefined
        }
      >
        {team.bench.map((id, i) => {
          const p = resolve(team.roster, id)
          const isArmed = armed === i

          if (!p) {
            return (
              <div
                key={`empty-${i}`}
                className="flex shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-hairline text-ink-faint"
                style={{ width: layout === 'rail' ? cardW : undefined, height: cardH }}
              >
                <span className="display text-lg leading-none">+</span>
                <span className="label-micro">Empty</span>
              </div>
            )
          }

          return (
            <Tappable
              key={`${p.id}-${i}`}
              disabled={subsLeft <= 0}
              onTap={() => onSelectBench(i)}
              onLongPress={() => onInspectBench(i)}
              ripple={`color-mix(in srgb, ${accent} 42%, transparent)`}
              ariaLabel={`Bring ${p.name} on for ${team.meta.label}`}
              className={`shrink-0 rounded-xl ${subsLeft <= 0 ? 'opacity-45' : ''}`}
              style={{
                width: layout === 'rail' ? cardW : undefined,
                boxShadow: isArmed ? `0 0 0 2px ${accent}, 0 0 26px -6px ${accent}` : undefined,
              }}
            >
              <PlayerToken
                player={p}
                width={cardW}
                accent={accent}
                selected={isArmed}
                still
              />
            </Tappable>
          )
        })}
      </div>

      <p className="shrink-0 border-t border-hairline/60 px-3 py-2 text-2xs text-ink-faint">
        Tap a reserve to arm the change, then tap the starter coming off · long-press for detail
      </p>
    </section>
  )
}
