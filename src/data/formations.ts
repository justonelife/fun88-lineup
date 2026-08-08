import type { Formation, Pos, Slot, Vec } from '../types'

/* Seven-a-side shapes. Slots are authored in canonical order: GK, then each band
 * from own goal to opponent goal, left → right inside a band. Switching
 * formation keeps a player's canonical index, so the seven slide into the new
 * shape instead of being rebuilt (see `autoFit` in lib/lineup for optimal
 * re-assignment). Coordinates are team-local: y = 93 is your own goal line,
 * y = 0 the opponent's. The pitch maps them onto its half per side. */
function shape(rows: Array<[Pos, number, number]>): Slot[] {
  return rows.map(([pos, x, y], i) => ({ i, pos, x, y }))
}

export const FORMATIONS: Formation[] = [
  {
    id: '231',
    name: '2-3-1',
    shape: 'Balanced',
    blurb: 'The 7s default. Three across the middle, one runner in behind.',
    slots: shape([
      ['GK', 50, 93],
      ['CB', 30, 74],
      ['CB', 70, 74],
      ['LM', 17, 47],
      ['CM', 50, 52],
      ['RM', 83, 47],
      ['ST', 50, 22],
    ]),
  },
  {
    id: '222',
    name: '2-2-2',
    shape: 'Narrow',
    blurb: 'Two banks and a front pair. Short passing lanes, thin flanks.',
    slots: shape([
      ['GK', 50, 93],
      ['CB', 31, 76],
      ['CB', 69, 76],
      ['CM', 30, 51],
      ['CM', 70, 51],
      ['ST', 34, 23],
      ['ST', 66, 23],
    ]),
  },
  {
    id: '321',
    name: '3-2-1',
    shape: 'Defensive',
    blurb: 'Back three, double pivot, lone striker. Nothing gets through.',
    slots: shape([
      ['GK', 50, 93],
      ['CB', 22, 76],
      ['CB', 50, 80],
      ['CB', 78, 76],
      ['CDM', 33, 52],
      ['CDM', 67, 52],
      ['ST', 50, 23],
    ]),
  },
  {
    id: '132',
    name: '1-3-2',
    shape: 'Attacking',
    blurb: 'One sweeper behind a busy three. Two forwards, all-in.',
    slots: shape([
      ['GK', 50, 93],
      ['CB', 50, 77],
      ['LM', 18, 50],
      ['CAM', 50, 54],
      ['RM', 82, 50],
      ['ST', 33, 22],
      ['ST', 67, 22],
    ]),
  },
  {
    id: '240',
    name: '2-4-0',
    shape: 'Wide press',
    blurb: 'No fixed striker. Four rotate high and hunt the ball in packs.',
    slots: shape([
      ['GK', 50, 93],
      ['CB', 32, 77],
      ['CB', 68, 77],
      ['LM', 16, 45],
      ['CAM', 38, 34],
      ['CAM', 62, 34],
      ['RM', 84, 45],
    ]),
  },
  {
    id: '312',
    name: '3-1-2',
    shape: 'Wing overload',
    blurb: 'Back three, single pivot, two wide forwards stretching the box.',
    slots: shape([
      ['GK', 50, 93],
      ['CB', 24, 77],
      ['CB', 50, 81],
      ['CB', 76, 77],
      ['CM', 50, 53],
      ['LW', 27, 24],
      ['RW', 73, 24],
    ]),
  },
]

export const FORMATION_MAP = new Map(FORMATIONS.map((f) => [f.id, f]))

export function getFormation(id: string): Formation {
  return FORMATION_MAP.get(id) ?? (FORMATIONS[0] as Formation)
}

/** Every shape in the game fields the same number of players. */
export const XI_SIZE = 7

export type Link = readonly [a: number, b: number]

/** Wider than the eleven-a-side radius: seven players spread over the same
 *  half, so the web needs a longer reach to stay legible. */
const LINK_RADIUS = 42

/**
 * Chemistry links are derived from where the players actually stand: every slot
 * connects to its three nearest neighbours inside a radius. Pairs are
 * de-duplicated. Because this takes raw coordinates rather than a formation id,
 * links follow a player dragged to a custom position.
 */
export function linksForPositions(points: Array<Vec | null | undefined>): Link[] {
  const seen = new Set<string>()
  const out: Link[] = []

  points.forEach((a, ai) => {
    if (!a) return
    const near = points
      .map((b, bi) => ({ b, bi }))
      .filter((n): n is { b: Vec; bi: number } => Boolean(n.b) && n.bi !== ai)
      .map(({ b, bi }) => ({ bi, d: Math.hypot(a.x - b.x, (a.y - b.y) * 1.15) }))
      .sort((p, q) => p.d - q.d)
      .slice(0, 3)
      .filter((n) => n.d < LINK_RADIUS)

    for (const { bi } of near) {
      const key = ai < bi ? `${ai}-${bi}` : `${bi}-${ai}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(ai < bi ? [ai, bi] : [bi, ai])
    }
  })

  return out
}

/** Where slot `i` actually stands: its custom position, else the shape default. */
export function slotPoints(
  formationId: string,
  positions?: Array<Vec | null> | null,
): Vec[] {
  return getFormation(formationId).slots.map((s) => {
    const custom = positions?.[s.i]
    return custom ? { x: custom.x, y: custom.y } : { x: s.x, y: s.y }
  })
}
