import type { Line, Pos, Stats } from '../types'

/* =============================================================================
   OVERALL RATING  —  derived, never typed in
   -----------------------------------------------------------------------------
   FIFA never lets you set an overall directly: it falls out of the six face
   attributes, weighted by what the position is actually asked to do. The editor
   follows the same rule, which is what makes the stat sliders feel consequential
   — every drag moves the badge.

   Each row sums to exactly 1.00, so a player who is 80 across the board is an 80
   in every position and the numbers stay comparable between roles.
============================================================================= */

export type StatKey = keyof Stats

/** Reading order on every surface in the app: PAC SHO PAS DRI DEF PHY. */
export const STAT_ORDER: readonly StatKey[] = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'] as const

export const STAT_META: Record<StatKey, { label: string; name: string; vi: string }> = {
  pac: { label: 'PAC', name: 'Pace', vi: 'Tốc độ' },
  sho: { label: 'SHO', name: 'Shooting', vi: 'Dứt điểm' },
  pas: { label: 'PAS', name: 'Passing', vi: 'Chuyền bóng' },
  dri: { label: 'DRI', name: 'Dribbling', vi: 'Rê bóng' },
  def: { label: 'DEF', name: 'Defending', vi: 'Phòng ngự' },
  phy: { label: 'PHY', name: 'Physical', vi: 'Thể lực' },
}

/** [pac, sho, pas, dri, def, phy] — same order as STAT_ORDER. */
type Weights = readonly [number, number, number, number, number, number]

/* A keeper's "passing" and "defending" stand in for handling and positioning —
 * the six-stat model has no GK-specific faces, so the weights lean on the two
 * attributes that read closest to shot-stopping and command of the area. */
const GK: Weights = [0.05, 0.02, 0.25, 0.15, 0.25, 0.28]
/** Centre-back and full-back: defending is nearly half the job. */
const BACK: Weights = [0.1, 0.06, 0.14, 0.1, 0.4, 0.2]
/** Wing-back: the same brief with a lung and a first touch bolted on. */
const WING_BACK: Weights = [0.16, 0.08, 0.16, 0.16, 0.3, 0.14]
const CDM: Weights = [0.1, 0.1, 0.2, 0.14, 0.28, 0.18]
const CM: Weights = [0.1, 0.14, 0.24, 0.2, 0.16, 0.16]
const CAM: Weights = [0.12, 0.2, 0.24, 0.24, 0.1, 0.1]
/** Wide attackers live on pace and dribbling; defending barely registers. */
const WIDE: Weights = [0.18, 0.2, 0.16, 0.26, 0.08, 0.12]
const STRIKER: Weights = [0.14, 0.3, 0.14, 0.22, 0.06, 0.14]

export const OVR_WEIGHTS: Record<Pos, Weights> = {
  GK,
  CB: BACK,
  LB: BACK,
  RB: BACK,
  LWB: WING_BACK,
  RWB: WING_BACK,
  CDM,
  CM,
  CAM,
  LM: WIDE,
  RM: WIDE,
  LW: WIDE,
  RW: WIDE,
  CF: STRIKER,
  ST: STRIKER,
}

export const STAT_MIN = 0
export const STAT_MAX = 99

export const clampStat = (v: number): number =>
  Math.max(STAT_MIN, Math.min(STAT_MAX, Math.round(Number.isFinite(v) ? v : 0)))

/** Position-weighted overall, clamped to the same 1-99 band as the seed data. */
export function ovrFromStats(pos: Pos, stats: Stats): number {
  const w = OVR_WEIGHTS[pos] ?? CM
  let sum = 0
  STAT_ORDER.forEach((k, i) => {
    sum += clampStat(stats[k]) * (w[i] as number)
  })
  return Math.max(1, Math.min(99, Math.round(sum)))
}

/** The chip picker, grouped the way the squad filter already groups the pitch. */
export const POS_GROUPS: ReadonlyArray<{ line: Line; list: readonly Pos[] }> = [
  { line: 'GK', list: ['GK'] },
  { line: 'DEF', list: ['CB', 'LB', 'RB', 'LWB', 'RWB'] },
  { line: 'MID', list: ['CDM', 'CM', 'CAM', 'LM', 'RM'] },
  { line: 'FWD', list: ['LW', 'RW', 'CF', 'ST'] },
]

/** Sensible opening hand for a brand-new player: a flat, obviously-editable 70. */
export const BLANK_STATS: Stats = { pac: 70, sho: 70, pas: 70, dri: 70, def: 70, phy: 70 }
