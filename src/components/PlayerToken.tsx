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
  selected?: boolean
  swapping?: boolean
  targeting?: boolean
  flash?: boolean
}

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
  selected,
  swapping,
  targeting,
  flash,
}: Props) {
  const c = player ? club(player.clubId) : null
  const edge = player ? TIER_EDGE[tierOf(player.ovr)] : 'var(--color-hairline)'

  return (
    <motion.div
      className="glass relative flex flex-col items-center rounded-xl px-1 pt-1 pb-1.5"
      style={{
        width,
        borderColor: swapping ? 'var(--color-lime-300)' : undefined,
        boxShadow: swapping
          ? '0 0 0 2px var(--color-lime-400), 0 0 24px -4px var(--color-lime-400)'
          : selected
            ? '0 0 0 2px var(--color-gold-300)'
            : targeting
              ? '0 0 0 2px var(--color-info)'
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

      <div className="relative flex w-full items-start justify-between">
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
          animate={{ opacity: [1, 0.25, 1], scale: [1, 1.35, 1] }}
          transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
          aria-hidden
        />
      )}

      {player ? (
        <>
          <Avatar player={player} size={width * 0.52} className="relative mt-0.5" />
          <span
            className="display mt-0.5 w-full truncate text-center leading-tight text-ink"
            style={{ fontSize: Math.max(9, width * 0.155) }}
          >
            {shortName(player.name)}
          </span>
          <div className="mt-1 flex w-full items-center gap-1">
            <Meter value={player.stamina} height={3} />
            <span
              className="display tnum shrink-0 text-2xs leading-none"
              style={{ color: chem >= 7 ? 'var(--color-chem-strong)' : chem >= 4 ? 'var(--color-chem-mid)' : 'var(--color-chem-weak)' }}
            >
              {chem}
            </span>
          </div>
        </>
      ) : (
        <div
          className="mt-1 grid place-items-center rounded-full border border-dashed border-hairline text-ink-faint"
          style={{ width: width * 0.52, height: width * 0.52 }}
        >
          <span className="display text-lg leading-none">+</span>
        </div>
      )}
    </motion.div>
  )
}

export const PlayerToken = memo(PlayerTokenImpl)
