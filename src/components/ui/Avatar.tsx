import { memo } from 'react'
import { club } from '../../data/clubs'
import { initials } from '../../lib/lineup'
import type { Player } from '../../types'

/* Illustration style: flat, geometric, two-tone. Every avatar is the same
 * silhouette — a shoulders-up jersey block — so identity comes only from club
 * colour + initials. Generated locally, no network, scales to any size. */

interface Props {
  player: Player
  size?: number
  className?: string
}

function AvatarImpl({ player, size = 40, className }: Props) {
  const c = club(player.clubId)
  const gid = `av-${player.id}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label={`${player.name}, ${c.name}`}
    >
      <defs>
        <linearGradient id={`${gid}-bg`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor={c.primary} stopOpacity="0.95" />
          <stop offset="100%" stopColor={c.secondary} stopOpacity="0.98" />
        </linearGradient>
        <clipPath id={`${gid}-clip`}>
          <circle cx="32" cy="32" r="31" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${gid}-clip)`}>
        <circle cx="32" cy="32" r="31" fill={`url(#${gid}-bg)`} />
        {/* diagonal club sash */}
        <path d="M-10 52 L52 -10 L68 6 L6 68 Z" fill={c.primary} opacity="0.35" />
        {/* shoulders */}
        <path
          d="M32 36c11 0 20 7.5 22 18v14H10V54c2-10.5 11-18 22-18Z"
          fill="rgba(0,0,0,0.34)"
        />
        {/* head */}
        <circle cx="32" cy="26" r="12" fill="rgba(0,0,0,0.34)" />
      </g>

      <text
        x="32"
        y="38"
        textAnchor="middle"
        fontFamily="Oswald Variable, Oswald, sans-serif"
        fontSize="21"
        fontWeight="600"
        letterSpacing="0.5"
        fill="#F4F8FF"
        opacity="0.96"
      >
        {initials(player.name)}
      </text>

      <circle cx="32" cy="32" r="30.5" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.4" />
    </svg>
  )
}

export const Avatar = memo(AvatarImpl)
