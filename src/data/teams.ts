import type { Side } from '../types'

export interface TeamMeta {
  side: Side
  name: string
  short: string
  label: string
  /** Primary accent — the colour that identifies the team everywhere. */
  accent: string
  /** Softer tint for text on dark surfaces. */
  accentSoft: string
  /** Deep tone for fills and gradients. */
  accentDeep: string
  /** Readable ink on top of a solid `accent` fill. */
  onAccent: string
}

/** Home keeps the app's lime identity; away takes the warm red/orange side of
 *  the palette. Both sit >= 4.5:1 against the dark surfaces they label. */
export const TEAMS: Record<Side, TeamMeta> = {
  home: {
    side: 'home',
    name: 'Ultra 7s',
    short: 'ULT',
    label: 'Home',
    accent: 'var(--color-lime-400)',
    accentSoft: 'var(--color-lime-200)',
    accentDeep: 'var(--color-lime-600)',
    onAccent: '#08120a',
  },
  away: {
    side: 'away',
    name: 'Vantage 7s',
    short: 'VAN',
    label: 'Away',
    accent: 'var(--color-away-400)',
    accentSoft: 'var(--color-away-200)',
    accentDeep: 'var(--color-away-600)',
    onAccent: '#1a0703',
  },
}

export const SIDES: Side[] = ['home', 'away']

export function team(side: Side): TeamMeta {
  return TEAMS[side]
}

export const otherSide = (side: Side): Side => (side === 'home' ? 'away' : 'home')
