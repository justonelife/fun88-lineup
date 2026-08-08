import { memo } from 'react'
import { motion } from 'motion/react'
import { Avatar } from './ui/Avatar'
import { Meter } from './ui/Bars'
import { club } from '../data/clubs'
import { shortName, staminaTone } from '../lib/lineup'
import { skinOf } from '../lib/tiers'
import type { PosFit } from '../lib/chemistry'
import type { Player, Pos } from '../types'

/* =============================================================================
   THE PLAYER CARD  (khung thẻ)
   -----------------------------------------------------------------------------
   One component, one silhouette, used on the 3D pitch, on the bench and in the
   picker — aesthetic-usability: the same object everywhere is what makes the
   screen read as a system rather than a pile of widgets.

   Reading order is fixed by proximity, top to bottom, exactly like FIFA Online:

     rating + role    hug the top-left corner as one block
     portrait         owns the middle, the only large shape on the card
     name plate       a dark bar welded to the bottom edge
     condition        a 3px meter on the very last row

   The frame carries the tier (lib/tiers), the wash carries the club, the foot
   rail carries the side. Nothing else is allowed to use colour.
============================================================================= */

const FIT_INK: Record<PosFit, string> = {
  3: 'rgba(46,232,122,.92)',
  2: 'rgba(247,201,72,.92)',
  1: 'rgba(247,201,72,.66)',
  0: 'rgba(255,79,100,.95)',
}

/** Card height as a multiple of its width. The pitch needs this to plant a card
 *  on a coordinate; the bench needs it to reserve a row. */
export const TOKEN_RATIO = { normal: 1.36, compact: 1.3 }

const chemTone = (chem: number) =>
  chem >= 7
    ? 'var(--color-chem-strong)'
    : chem >= 4
      ? 'var(--color-chem-mid)'
      : 'var(--color-chem-weak)'

interface Props {
  player: Player | undefined
  /** Role the card is filling. Falls back to the player's natural position. */
  slotPos?: Pos
  fit?: PosFit
  chem?: number
  width: number
  /** Team colour — the one cue that says which side this card belongs to. */
  accent?: string
  selected?: boolean
  swapping?: boolean
  targeting?: boolean
  flash?: boolean
  /** The opposing side: readable, but visibly out of the editing loop. */
  muted?: boolean
  /** Slightly shorter card, for the versus board where two halves share a pitch. */
  compact?: boolean
  /** Suppress the hover/press micro-interaction (bench cards get it from Tappable). */
  still?: boolean
}

function PlayerTokenImpl({
  player,
  slotPos,
  fit = 0,
  chem,
  width,
  accent = 'var(--color-lime-400)',
  selected,
  swapping,
  targeting,
  flash,
  muted,
  compact,
  still,
}: Props) {
  const w = width
  const h = w * (compact ? TOKEN_RATIO.compact : TOKEN_RATIO.normal)
  const skin = player ? skinOf(player.ovr) : null
  const c = player ? club(player.clubId) : null
  const role = slotPos ?? player?.pos

  // Type sizes are derived from the card width so a 48px pitch card and a 96px
  // bench card stay the same design rather than the same stylesheet.
  const pad = Math.max(3, w * 0.07)
  const radius = Math.max(7, Math.min(14, w * 0.13))
  const ovrSize = Math.max(13, w * 0.3)
  const tagSize = Math.max(8, w * 0.15)
  const nameSize = Math.max(9, w * 0.16)
  const plateH = Math.max(14, w * 0.27)
  // The portrait sits low in the frame so the rating/role block owns the top-left
  // corner outright — same reading order as a real FIFA card.
  const avatarSize = w * 0.5

  const rim = swapping
    ? accent
    : targeting
      ? 'var(--color-info)'
      : selected
        ? 'var(--color-gold-300)'
        : (skin?.edge ?? 'var(--color-hairline)')

  const lift = swapping
    ? `0 0 0 2px ${accent}, 0 0 26px -6px ${accent}`
    : targeting
      ? '0 0 0 2px var(--color-info), 0 0 24px -6px var(--color-info)'
      : selected
        ? '0 0 0 2px var(--color-gold-300)'
        : (skin?.glow ?? '0 8px 20px -14px #000')

  return (
    <motion.div
      className={`relative flex flex-col overflow-hidden ${
        skin?.shimmer && !muted ? 'card-shimmer' : ''
      }`}
      style={{
        width: w,
        height: h,
        borderRadius: radius,
        background: skin?.frame ?? 'linear-gradient(168deg, rgba(26,38,52,.7), rgba(4,7,14,.9))',
        border: `1px solid ${rim}`,
        boxShadow: lift,
        filter: muted ? 'saturate(.8) brightness(.86)' : undefined,
        transformPerspective: 460,
        // Stagger the tier sweep so a row of gold cards never flashes in unison.
        animationDelay: player ? `${(player.ovr % 7) * 0.55}s` : undefined,
      }}
      whileHover={still ? undefined : { y: -3, rotateX: -6 }}
      whileTap={still ? undefined : { scale: 0.965, rotateX: 8 }}
      animate={
        flash
          ? { scale: [1, 1.14, 1], filter: ['brightness(1)', 'brightness(1.9)', 'brightness(1)'] }
          : swapping
            ? { y: [0, -5, 0] }
            : { scale: 1 }
      }
      transition={
        swapping
          ? { repeat: Infinity, duration: 1.1, ease: 'easeInOut' }
          : { type: 'spring', stiffness: 480, damping: 30 }
      }
    >
      {/* club colour wash — identity without a crest */}
      {c && (
        <span
          className="pointer-events-none absolute inset-x-0 top-0"
          style={{
            height: '46%',
            background: `linear-gradient(180deg, ${c.primary}4d, transparent 88%)`,
          }}
          aria-hidden
        />
      )}

      {/* metallic top edge — the tell that says "this is a card, not a chip" */}
      {skin && (
        <span
          className="pointer-events-none absolute inset-x-0 top-0"
          style={{ height: 1.5, background: skin.sheen }}
          aria-hidden
        />
      )}

      {/* ── portrait zone ──────────────────────────────────────────────────── */}
      <div
        className="relative flex min-h-0 flex-1 items-end justify-center"
        style={{ paddingBottom: pad * 0.5 }}
      >
        {player ? (
          <Avatar player={player} size={avatarSize} className="relative" />
        ) : (
          <span
            className="grid place-items-center rounded-full border border-dashed border-hairline text-ink-faint"
            style={{ width: avatarSize, height: avatarSize, fontSize: ovrSize * 0.8 }}
          >
            <span className="display leading-none">+</span>
          </span>
        )}

        {/* rating + role: one block in the corner, read as a unit */}
        <span
          className="pointer-events-none absolute flex flex-col items-start"
          style={{ top: pad * 0.6, left: pad, lineHeight: 1 }}
        >
          {player && (
            <span
              className="display tnum"
              style={{
                fontSize: ovrSize,
                color: skin?.ink,
                textShadow: '0 1px 5px rgba(0,0,0,.9)',
                letterSpacing: '-0.03em',
              }}
            >
              {player.ovr}
            </span>
          )}
          {role && (
            <span
              className="display"
              style={{
                marginTop: player ? 1 : 0,
                fontSize: tagSize,
                letterSpacing: '0.08em',
                color: player ? FIT_INK[fit] : 'var(--color-ink-faint)',
                textShadow: '0 1px 4px rgba(0,0,0,.9)',
              }}
            >
              {role}
            </span>
          )}
        </span>

        {/* slot chemistry, opposite corner so it never crowds the rating */}
        {player && typeof chem === 'number' && (
          <span
            className="display tnum pointer-events-none absolute"
            style={{
              top: pad * 0.7,
              right: pad,
              fontSize: tagSize,
              lineHeight: 1,
              color: chemTone(chem),
              textShadow: '0 1px 4px rgba(0,0,0,.9)',
            }}
          >
            {chem}
          </span>
        )}

        {/* legs gone — redundant with the meter colour, never the only cue */}
        {player && player.stamina < 45 && (
          <motion.span
            className="pointer-events-none absolute rounded-full"
            style={{
              top: pad * 0.7,
              right: pad + tagSize * 1.4,
              width: Math.max(5, w * 0.1),
              height: Math.max(5, w * 0.1),
              background: 'var(--color-chem-weak)',
              boxShadow: '0 0 8px var(--color-chem-weak)',
            }}
            animate={muted ? { opacity: 0.8 } : { opacity: [1, 0.25, 1], scale: [1, 1.3, 1] }}
            transition={
              muted ? { duration: 0.2 } : { repeat: Infinity, duration: 1.4, ease: 'easeInOut' }
            }
            aria-hidden
          />
        )}
      </div>

      {/* ── name plate ─────────────────────────────────────────────────────── */}
      <div
        className="relative flex shrink-0 items-center justify-center"
        style={{
          height: plateH,
          paddingInline: pad * 0.6,
          background:
            'linear-gradient(180deg, rgba(3,6,12,.62), rgba(3,6,12,.95) 55%, rgba(3,6,12,.98))',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.07)',
        }}
      >
        <span
          className="display block w-full truncate text-center leading-none text-ink"
          style={{ fontSize: nameSize }}
        >
          {player ? shortName(player.name) : 'Empty'}
        </span>
      </div>

      {/* ── condition, then the side rail on the very last row ─────────────── */}
      {player ? (
        <Meter
          value={player.stamina}
          height={3}
          className="shrink-0"
          tone={
            staminaTone(player.stamina) === 'ok'
              ? 'var(--color-chem-strong)'
              : staminaTone(player.stamina) === 'low'
                ? 'var(--color-chem-mid)'
                : 'var(--color-chem-weak)'
          }
        />
      ) : (
        <span className="block h-[3px] shrink-0 bg-black/55" />
      )}
      <span
        className="block shrink-0"
        style={{ height: 2, background: accent, opacity: muted ? 0.5 : 0.95 }}
        aria-hidden
      />
    </motion.div>
  )
}

export const PlayerToken = memo(PlayerTokenImpl)
