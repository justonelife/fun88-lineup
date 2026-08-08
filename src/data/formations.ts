import type { Formation, Pos, Slot } from '../types'

/* Slots are authored in canonical order: GK, then each band from own goal to
 * opponent goal, left → right inside a band. Switching formation keeps a
 * player's canonical index, so the XI slides into the new shape instead of
 * being rebuilt (see `autoFit` in lib/lineup for optimal re-assignment). */
function shape(rows: Array<[Pos, number, number]>): Slot[] {
  return rows.map(([pos, x, y], i) => ({ i, pos, x, y }))
}

export const FORMATIONS: Formation[] = [
  {
    id: '433',
    name: '4-3-3',
    shape: 'Attack',
    blurb: 'Wide front three, single pivot. Best with quick wingers.',
    slots: shape([
      ['GK', 50, 93],
      ['LB', 12, 73],
      ['CB', 35, 79],
      ['CB', 65, 79],
      ['RB', 88, 73],
      ['CDM', 50, 58],
      ['CM', 27, 45],
      ['CM', 73, 45],
      ['LW', 15, 22],
      ['ST', 50, 13],
      ['RW', 85, 22],
    ]),
  },
  {
    id: '442',
    name: '4-4-2',
    shape: 'Balanced',
    blurb: 'Two flat banks of four. Reliable shape, strong out of possession.',
    slots: shape([
      ['GK', 50, 93],
      ['LB', 11, 73],
      ['CB', 36, 79],
      ['CB', 64, 79],
      ['RB', 89, 73],
      ['LM', 11, 48],
      ['CM', 36, 53],
      ['CM', 64, 53],
      ['RM', 89, 48],
      ['ST', 37, 16],
      ['ST', 63, 16],
    ]),
  },
  {
    id: '4231',
    name: '4-2-3-1',
    shape: 'Control',
    blurb: 'Double pivot behind a free number 10. The modern default.',
    slots: shape([
      ['GK', 50, 93],
      ['LB', 11, 73],
      ['CB', 36, 79],
      ['CB', 64, 79],
      ['RB', 89, 73],
      ['CDM', 34, 60],
      ['CDM', 66, 60],
      ['LM', 14, 38],
      ['CAM', 50, 34],
      ['RM', 86, 38],
      ['ST', 50, 13],
    ]),
  },
  {
    id: '41212',
    name: '4-1-2-1-2',
    shape: 'Narrow',
    blurb: 'Midfield diamond. Overloads the centre, concedes the flanks.',
    slots: shape([
      ['GK', 50, 93],
      ['LB', 11, 73],
      ['CB', 36, 79],
      ['CB', 64, 79],
      ['RB', 89, 73],
      ['CDM', 50, 62],
      ['CM', 24, 47],
      ['CM', 76, 47],
      ['CAM', 50, 33],
      ['ST', 37, 14],
      ['ST', 63, 14],
    ]),
  },
  {
    id: '352',
    name: '3-5-2',
    shape: 'Wing-backs',
    blurb: 'Back three with flying wing-backs. Demands stamina on the flanks.',
    slots: shape([
      ['GK', 50, 93],
      ['CB', 26, 79],
      ['CB', 50, 81],
      ['CB', 74, 79],
      ['LWB', 8, 52],
      ['CM', 30, 46],
      ['CDM', 50, 62],
      ['CM', 70, 46],
      ['RWB', 92, 52],
      ['ST', 37, 15],
      ['ST', 63, 15],
    ]),
  },
  {
    id: '343',
    name: '3-4-3',
    shape: 'High risk',
    blurb: 'Three at the back, three up top. Maximum press, maximum exposure.',
    slots: shape([
      ['GK', 50, 93],
      ['CB', 26, 79],
      ['CB', 50, 81],
      ['CB', 74, 79],
      ['LM', 12, 50],
      ['CM', 36, 54],
      ['CM', 64, 54],
      ['RM', 88, 50],
      ['LW', 17, 20],
      ['ST', 50, 13],
      ['RW', 83, 20],
    ]),
  },
  {
    id: '541',
    name: '5-4-1',
    shape: 'Low block',
    blurb: 'Five across the back. Absorb pressure, break on the counter.',
    slots: shape([
      ['GK', 50, 93],
      ['LWB', 8, 68],
      ['CB', 27, 80],
      ['CB', 50, 82],
      ['CB', 73, 80],
      ['RWB', 92, 68],
      ['LM', 13, 48],
      ['CM', 37, 52],
      ['CM', 63, 52],
      ['RM', 87, 48],
      ['ST', 50, 14],
    ]),
  },
  {
    id: '451',
    name: '4-5-1',
    shape: 'Congest',
    blurb: 'Packed midfield five. Wins the second ball, isolates the striker.',
    slots: shape([
      ['GK', 50, 93],
      ['LB', 11, 73],
      ['CB', 36, 79],
      ['CB', 64, 79],
      ['RB', 89, 73],
      ['CDM', 50, 60],
      ['LM', 12, 46],
      ['CM', 35, 48],
      ['CM', 65, 48],
      ['RM', 88, 46],
      ['ST', 50, 14],
    ]),
  },
]

export const FORMATION_MAP = new Map(FORMATIONS.map((f) => [f.id, f]))

export function getFormation(id: string): Formation {
  return FORMATION_MAP.get(id) ?? (FORMATIONS[0] as Formation)
}

export type Link = readonly [a: number, b: number]

const LINK_CACHE = new Map<string, Link[]>()

/**
 * Chemistry links are derived from the shape itself: every slot connects to its
 * three nearest neighbours inside a radius. Pairs are de-duplicated, so a shape
 * yields ~18-22 links — dense enough to read as a web, sparse enough to trace.
 */
export function linksFor(formationId: string): Link[] {
  const cached = LINK_CACHE.get(formationId)
  if (cached) return cached

  const { slots } = getFormation(formationId)
  const seen = new Set<string>()
  const out: Link[] = []

  for (const a of slots) {
    const near = slots
      .filter((b) => b.i !== a.i)
      .map((b) => ({ b, d: Math.hypot(a.x - b.x, (a.y - b.y) * 1.15) }))
      .sort((p, q) => p.d - q.d)
      .slice(0, 3)
      .filter((n) => n.d < 36)

    for (const { b } of near) {
      const key = a.i < b.i ? `${a.i}-${b.i}` : `${b.i}-${a.i}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(a.i < b.i ? [a.i, b.i] : [b.i, a.i])
    }
  }

  LINK_CACHE.set(formationId, out)
  return out
}
