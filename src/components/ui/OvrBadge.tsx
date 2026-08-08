import { memo } from 'react'

export type Tier = 'elite' | 'gold' | 'silver' | 'bronze'

export function tierOf(ovr: number): Tier {
  if (ovr >= 88) return 'elite'
  if (ovr >= 82) return 'gold'
  if (ovr >= 75) return 'silver'
  return 'bronze'
}

/* Von Restorff: only genuinely elite ratings get the gold/glow treatment, so
 * the eye lands on the two or three players that actually carry the team. */
const TIER_STYLE: Record<Tier, { ring: string; text: string; bg: string; glow: string }> = {
  elite: {
    ring: 'var(--color-gold-300)',
    text: 'var(--color-gold-200)',
    bg: 'linear-gradient(160deg, rgba(247,201,72,.28), rgba(219,165,31,.08))',
    glow: '0 0 14px -2px rgba(247,201,72,.75)',
  },
  gold: {
    ring: 'var(--color-lime-400)',
    text: 'var(--color-lime-200)',
    bg: 'linear-gradient(160deg, rgba(184,241,60,.22), rgba(111,174,5,.06))',
    glow: '0 0 12px -4px rgba(184,241,60,.6)',
  },
  silver: {
    ring: 'rgba(151,167,188,.85)',
    text: '#dbe4f0',
    bg: 'linear-gradient(160deg, rgba(151,167,188,.18), rgba(151,167,188,.04))',
    glow: 'none',
  },
  bronze: {
    ring: 'rgba(203,138,86,.8)',
    text: '#f0d5bf',
    bg: 'linear-gradient(160deg, rgba(203,138,86,.18), rgba(203,138,86,.04))',
    glow: 'none',
  },
}

interface Props {
  ovr: number
  size?: number
  label?: string
}

function OvrBadgeImpl({ ovr, size = 28, label }: Props) {
  const s = TIER_STYLE[tierOf(ovr)]
  return (
    <span
      className="display inline-flex flex-col items-center justify-center rounded-full tnum leading-none"
      style={{
        width: size,
        height: size,
        background: s.bg,
        border: `1.5px solid ${s.ring}`,
        color: s.text,
        boxShadow: s.glow,
        fontSize: size * 0.42,
        fontWeight: 700,
      }}
      aria-label={label ?? `Overall ${ovr}`}
    >
      {ovr}
    </span>
  )
}

export const OvrBadge = memo(OvrBadgeImpl)
