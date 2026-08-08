import type { Tactics } from '../types'

export interface TacticKey {
  key: keyof Tactics
  label: string
  low: string
  high: string
  hint: string
}

export const TACTIC_KEYS: TacticKey[] = [
  {
    key: 'mentality',
    label: 'Mentality',
    low: 'Defensive',
    high: 'Attacking',
    hint: 'How many bodies commit forward when you win the ball.',
  },
  {
    key: 'pressure',
    label: 'Pressure',
    low: 'Contain',
    high: 'Aggressive',
    hint: 'How early the press is triggered. Costs stamina.',
  },
  {
    key: 'width',
    label: 'Width',
    low: 'Narrow',
    high: 'Wide',
    hint: 'Distance between your widest players in possession.',
  },
  {
    key: 'depth',
    label: 'Depth',
    low: 'Deep',
    high: 'Advanced',
    hint: 'Where the block sits when the opponent builds up.',
  },
  {
    key: 'lineHeight',
    label: 'Line Height',
    low: 'Drop off',
    high: 'Offside trap',
    hint: 'Defensive line position. High lines need pace.',
  },
  {
    key: 'tempo',
    label: 'Tempo',
    low: 'Patient',
    high: 'Direct',
    hint: 'Speed of ball progression once you are settled.',
  },
]

export interface Preset {
  id: string
  name: string
  tag: string
  blurb: string
  values: Tactics
}

export const PRESETS: Preset[] = [
  {
    id: 'balanced',
    name: 'Balanced',
    tag: 'Default',
    blurb: 'No strong bias. Safe in every phase, dominant in none.',
    values: { mentality: 50, pressure: 50, width: 50, depth: 50, lineHeight: 50, tempo: 50 },
  },
  {
    id: 'tiki',
    name: 'Tiki-Taka',
    tag: 'Possession',
    blurb: 'Narrow, patient, high rest-defence. Starve them of the ball.',
    values: { mentality: 62, pressure: 72, width: 38, depth: 58, lineHeight: 68, tempo: 34 },
  },
  {
    id: 'counter',
    name: 'Counter',
    tag: 'Transition',
    blurb: 'Sit, absorb, then hit the space behind at speed.',
    values: { mentality: 38, pressure: 32, width: 56, depth: 34, lineHeight: 28, tempo: 84 },
  },
  {
    id: 'bus',
    name: 'Park the Bus',
    tag: 'Ultra defensive',
    blurb: 'Two banks, no risk. Protect a lead, survive a storm.',
    values: { mentality: 14, pressure: 24, width: 30, depth: 18, lineHeight: 14, tempo: 28 },
  },
  {
    id: 'press',
    name: 'High Press',
    tag: 'Aggressive',
    blurb: 'Suffocate the build-up. Brutal on legs — plan your subs.',
    values: { mentality: 74, pressure: 92, width: 60, depth: 72, lineHeight: 84, tempo: 72 },
  },
  {
    id: 'wing',
    name: 'Wing Play',
    tag: 'Crossing',
    blurb: 'Stretch them, isolate the full-backs, deliver early.',
    values: { mentality: 64, pressure: 54, width: 88, depth: 54, lineHeight: 56, tempo: 66 },
  },
]

export const DEFAULT_TACTICS: Tactics = PRESETS[0]!.values

export function matchPreset(t: Tactics): string | null {
  const hit = PRESETS.find((p) =>
    (Object.keys(p.values) as Array<keyof Tactics>).every((k) => p.values[k] === t[k]),
  )
  return hit?.id ?? null
}
