import { memo } from 'react'
import { motion } from 'motion/react'
import { Avatar } from './ui/Avatar'
import { Meter } from './ui/Bars'
import { tierOf } from './ui/OvrBadge'
import { club } from '../data/clubs'
import { shortName } from '../lib/lineup'
import type { PosFit } from '../lib/chemistry'
import type { Player, Pos } from '../types'

const FIT_RING: Record<PosFit, string> = {
  3: 'rgba(46,232,122,.75)',
  2: 'rgba(247,201,72,.8)',
  1: 'rgba(247,201,72,.55)',
  0: 'rgba(255,79,100,.85)',
}

const TIER_EDGE: Record<ReturnType<typeof tierOf>, string> = {
  elite: 'var(--color-gold-300)',
  gold: 'var(--color-lime-400)',
  silver: 'rgba(151,167,188,.9)',
  bronze: 'rgba(203,138,86,.9)',
}

interface Props {
  player: Player | undefined
  slotPos: Pos
  fit: PosFit
  chem: number
  width: number
  /** Team colour — the one cue that says which side this token belongs to. */
  accent?: string
  selected?: boolean
  swapping?: boolean
  targeting?: boolean
  flash?: boolean
  /** The opposing side: readable, but visibly out of the editing loop. */
  muted?: boolean
  /** Shorter card for the versus board, where two halves share one pitch. */
  compact?: boolean
}

/** Height of a token as a multiple of its width — the pitch needs this to
 *  centre a card on a coordinate. */
export const TOKEN_RATIO = { normal: 1.38, compact: 1.16 }

const chemTone = (chem: number) =>
  chem >= 7
    ? 'var(--color-chem-strong)'
    : chem >= 4
      ? 'var(--color-chem-mid)'
      : 'var(--color-chem-weak)'

/**
 * The pitch token. Proximity does the grouping: position tag / rating hug the
 * top edge, identity sits in the middle, condition pins to the bottom — three
 * bands read at a glance without any internal dividers.
 */
function PlayerTokenImpl({
  player,
  slotPos,
  fit,
  chem,
  width,
  accent = 'var(--color-lime-400)',
  selected,
  swapping,
  targeting,
  flash,
  muted,
  compact,
}: Props) {
  const c = player ? club(player.clubId) : null
  const edge = player ? TIER_EDGE[tierOf(player.ovr)] : 'var(--color-hairline)'

  return (
    <motion.div
      className={`glass relative flex flex-col items-center rounded-xl ${
        compact ? 'px-1 pt-0.5 pb-1' : 'px-1 pt-1 pb-1.5'
      }`}
      style={{
        width,
        borderColor: swapping ? accent : undefined,
        filter: muted ? 'saturate(.85) brightness(.9)' : undefined,
        boxShadow: swapping
          ? `0 0 0 2px ${accent}, 0 0 24px -4px ${accent}`
          : selected
            ? '0 0 0 2px var(--color-gold-300)'
            : targeting
              ? '0 0 0 2px var(--color-info), 0 0 22px -6px var(--color-info)'
              : `0 6px 18px -10px #000, 0 0 0 1px ${edge}22`,
      }}
      animate={
        flash
          ? { scale: [1, 1.14, 1], filter: ['brightness(1)', 'brightness(1.9)', 'brightness(1)'] }
          : swapping
            ? { y: [0, -4, 0] }
            : { scale: 1 }
      }
      transition={
        swapping
          ? { repeat: Infinity, duration: 1.1, ease: 'easeInOut' }
          : { duration: 0.55, ease: 'easeOut' }
      }
    >
      {/* club colour wash on the top edge */}
      {c && (
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-6 rounded-t-xl opacity-45"
          style={{ background: `linear-gradient(180deg, ${c.primary}, transparent)` }}
        />
      )}

      {/* team accent on the bottom edge — home lime, away orange */}
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] rounded-b-xl"
        style={{ background: accent, opacity: muted ? 0.55 : 0.95 }}
      />


      <div className="relative flex w-full items-start justify-between gap-0.5">
        <span
          className="display rounded px-1 text-2xs leading-tight tracking-wider"
          style={{
            background: 'rgba(0,0,0,.5)',
            color: player ? FIT_RING[fit] : 'var(--color-ink-faint)',
            border: `1px solid ${player ? FIT_RING[fit] : 'var(--color-hairline)'}`,
          }}
        >
          {slotPos}
        </span>
        {/* Compact tokens promote slot chemistry into the header row so the
            card can lose a whole line of height on the versus board. */}
        {player && compact && (
          <span
            className="display tnum text-2xs leading-tight"
            style={{ color: chemTone(chem), textShadow: '0 1px 4px rgba(0,0,0,.8)' }}
          >
            {chem}
          </span>
        )}
        {player && (
          <span
            className="display tnum text-xs leading-tight"
            style={{ color: edge, textShadow: '0 1px 4px rgba(0,0,0,.8)' }}
          >
            {player.ovr}
          </span>
        )}
      </div>

      {/* Legs gone: a pulsing tick so a tired starter is spotted without
          reading the meter. Redundant with the meter colour, never alone. */}
      {player && player.stamina < 45 && (
        <motion.span
          className="pointer-events-none absolute -top-1 -right-1 size-2.5 rounded-full"
          style={{ background: 'var(--color-chem-weak)', boxShadow: '0 0 8px var(--color-chem-weak)' }}
          animate={muted ? { opacity: 0.8 } : { opacity: [1, 0.25, 1], scale: [1, 1.35, 1] }}
          transition={
            muted ? { duration: 0.2 } : { repeat: Infinity, duration: 1.4, ease: 'easeInOut' }
          }
          aria-hidden
        />
      )}

      {player ? (
        <>
          <Avatar
            player={player}
            size={width * (compact ? 0.48 : 0.52)}
            className={compact ? 'relative' : 'relative mt-0.5'}
          />
          <span
            className="display w-full truncate text-center leading-tight text-ink"
            style={{ fontSize: Math.max(9, width * (compact ? 0.15 : 0.155)) }}
          >
            {shortName(player.name)}
          </span>
          {compact ? (
            <Meter value={player.stamina} height={3} className="mt-0.5 w-full" />
          ) : (
            <div className="mt-1 flex w-full items-center gap-1">
              <Meter value={player.stamina} height={3} />
              <span
                className="display tnum shrink-0 text-2xs leading-none"
                style={{ color: chemTone(chem) }}
              >
                {chem}
              </span>
            </div>
          )}
        </>
      ) : (
        <div
          className="mt-1 grid place-items-center rounded-full border border-dashed border-hairline text-ink-faint"
          style={{ width: width * 0.48, height: width * 0.48 }}
        >
          <span className="display text-lg leading-none">+</span>
        </div>
      )}
    </motion.div>
  )
}

export const PlayerToken = memo(PlayerTokenImpl)
