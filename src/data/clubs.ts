import type { Club } from '../types'

/** Fictional clubs — each contributes a two-tone identity used by avatars,
 *  card edges and chemistry links. */
export const CLUBS: Club[] = [
  { id: 'arden', name: 'Arden City', short: 'ARD', primary: '#e11d48', secondary: '#12060c' },
  { id: 'norvik', name: 'Norvik United', short: 'NOR', primary: '#2f6bf0', secondary: '#e8edf5' },
  { id: 'solheim', name: 'Solheim FK', short: 'SOL', primary: '#f7c948', secondary: '#16204a' },
  { id: 'valdor', name: "Val d'Or SC", short: 'VDO', primary: '#8b5cf6', secondary: '#1b1030' },
  { id: 'rioverde', name: 'Rio Verde CF', short: 'RIV', primary: '#10b981', secondary: '#04231a' },
  { id: 'kestrel', name: 'Kestrel Rovers', short: 'KES', primary: '#f97316', secondary: '#161314' },
  { id: 'marston', name: 'Marston Athletic', short: 'MAR', primary: '#38bdf8', secondary: '#0b1c33' },
  { id: 'ostmark', name: 'Ostmark SV', short: 'OST', primary: '#dc2626', secondary: '#f2f2f2' },
]

const BY_ID = new Map(CLUBS.map((c) => [c.id, c]))

const FALLBACK: Club = {
  id: 'free',
  name: 'Free Agent',
  short: 'FA',
  primary: '#64768c',
  secondary: '#0a1018',
}

export function club(id: string): Club {
  return BY_ID.get(id) ?? FALLBACK
}
