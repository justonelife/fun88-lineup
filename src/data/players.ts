import type { Player, Pos, Stats } from '../types'

/* -----------------------------------------------------------------------------
 * Deterministic, offline player database. Stats are derived from a per-role
 * profile scaled by OVR plus a stable hash jitter, so numbers read as realistic
 * without hand-authoring 300 values (and never change between reloads).
 * All names, clubs and squads are fictional.
 * -------------------------------------------------------------------------- */

type Profile = [pac: number, sho: number, pas: number, dri: number, def: number, phy: number]

const PROFILE: Record<Pos, Profile> = {
  GK: [0.62, 0.32, 0.72, 0.55, 0.4, 0.88],
  CB: [0.82, 0.55, 0.78, 0.7, 1.03, 1.02],
  LB: [1.02, 0.68, 0.9, 0.92, 0.96, 0.88],
  RB: [1.02, 0.68, 0.9, 0.92, 0.96, 0.88],
  LWB: [1.05, 0.72, 0.92, 0.95, 0.92, 0.86],
  RWB: [1.05, 0.72, 0.92, 0.95, 0.92, 0.86],
  CDM: [0.84, 0.74, 0.95, 0.88, 1.0, 0.98],
  CM: [0.9, 0.84, 1.02, 0.98, 0.88, 0.9],
  CAM: [0.95, 0.95, 1.03, 1.05, 0.62, 0.8],
  LM: [1.05, 0.85, 0.97, 1.02, 0.7, 0.8],
  RM: [1.05, 0.85, 0.97, 1.02, 0.7, 0.8],
  LW: [1.08, 0.95, 0.93, 1.06, 0.52, 0.76],
  RW: [1.08, 0.95, 0.93, 1.06, 0.52, 0.76],
  CF: [1.0, 1.04, 0.95, 1.03, 0.55, 0.92],
  ST: [1.03, 1.08, 0.82, 0.98, 0.42, 0.98],
}

/** Stable string hash → 0..1 */
function hash01(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

const clamp = (n: number, lo = 32, hi = 99) => Math.max(lo, Math.min(hi, Math.round(n)))

function statsFor(id: string, pos: Pos, ovr: number): Stats {
  const p = PROFILE[pos]
  const keys = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'] as const
  const out = {} as Stats
  keys.forEach((k, idx) => {
    const jitter = (hash01(id + k) - 0.5) * 7
    out[k] = clamp(ovr * (p[idx] as number) + jitter)
  })
  return out
}

interface Seed {
  n: string
  p: Pos
  a?: Pos[]
  o: number
  c: string
  nat: string
  sk?: number
}

const SEEDS: Seed[] = [
  // ── Goalkeepers ────────────────────────────────────────────────────────────
  { n: 'Ivan Petrescu', p: 'GK', o: 87, c: 'norvik', nat: 'Romania', sk: 2 },
  { n: 'Marek Dolny', p: 'GK', o: 84, c: 'ostmark', nat: 'Poland', sk: 2 },
  { n: 'Théo Vasseur', p: 'GK', o: 82, c: 'valdor', nat: 'France', sk: 3 },
  { n: 'Kenji Arakawa', p: 'GK', o: 79, c: 'marston', nat: 'Japan', sk: 2 },
  { n: 'Samir Aouad', p: 'GK', o: 77, c: 'arden', nat: 'Morocco', sk: 2 },
  { n: 'Ollie Brackenridge', p: 'GK', o: 74, c: 'kestrel', nat: 'England', sk: 1 },

  // ── Defenders ──────────────────────────────────────────────────────────────
  { n: 'Anton Reidel', p: 'CB', a: ['CDM'], o: 88, c: 'ostmark', nat: 'Germany', sk: 2 },
  { n: 'Bruno Salvatti', p: 'CB', o: 86, c: 'arden', nat: 'Italy', sk: 2 },
  { n: 'Kwame Osafo', p: 'CB', a: ['RB'], o: 85, c: 'norvik', nat: 'Ghana', sk: 3 },
  { n: 'Elias Nordvik', p: 'CB', a: ['CDM'], o: 84, c: 'solheim', nat: 'Norway', sk: 2 },
  { n: 'Lars Vindheim', p: 'CB', o: 83, c: 'marston', nat: 'Denmark', sk: 2 },
  { n: 'Diego Márquez', p: 'CB', a: ['LB'], o: 81, c: 'valdor', nat: 'Mexico', sk: 2 },
  { n: 'Ruben Kohl', p: 'CB', o: 79, c: 'kestrel', nat: 'Austria', sk: 1 },
  { n: 'Tomáš Havel', p: 'CB', o: 76, c: 'rioverde', nat: 'Czechia', sk: 2 },
  { n: 'Yannick Bastin', p: 'LB', a: ['LWB'], o: 85, c: 'valdor', nat: 'Belgium', sk: 3 },
  { n: 'Marco Illia', p: 'LB', a: ['LM'], o: 82, c: 'arden', nat: 'Italy', sk: 3 },
  { n: 'Sunday Okafor', p: 'LB', a: ['LWB', 'CB'], o: 79, c: 'kestrel', nat: 'Nigeria', sk: 2 },
  { n: 'Rafael Cardoso', p: 'RB', a: ['RWB'], o: 86, c: 'rioverde', nat: 'Brazil', sk: 4 },
  { n: 'Jonas Ekeblad', p: 'RB', o: 82, c: 'solheim', nat: 'Sweden', sk: 2 },
  { n: 'Idris Bello', p: 'RB', a: ['RWB', 'RM'], o: 78, c: 'norvik', nat: 'Nigeria', sk: 3 },
  { n: 'Nico Ferrante', p: 'LWB', a: ['LB', 'LM'], o: 80, c: 'marston', nat: 'Argentina', sk: 3 },
  { n: 'Hugo Sanmartí', p: 'RWB', a: ['RB', 'RM'], o: 80, c: 'ostmark', nat: 'Spain', sk: 3 },

  // ── Midfielders ────────────────────────────────────────────────────────────
  { n: 'Sergio Valcárcel', p: 'CDM', a: ['CM'], o: 87, c: 'arden', nat: 'Spain', sk: 3 },
  { n: 'Paul Bergström', p: 'CDM', a: ['CM'], o: 84, c: 'solheim', nat: 'Sweden', sk: 2 },
  { n: 'Musa Diakité', p: 'CDM', a: ['CB'], o: 81, c: 'valdor', nat: 'Senegal', sk: 2 },
  { n: 'Andrés Quintero', p: 'CM', a: ['CAM'], o: 89, c: 'rioverde', nat: 'Colombia', sk: 4 },
  { n: 'Fabien Roux', p: 'CM', a: ['CAM'], o: 86, c: 'valdor', nat: 'France', sk: 4 },
  { n: 'Tobias Lindqvist', p: 'CM', a: ['CDM'], o: 83, c: 'norvik', nat: 'Sweden', sk: 3 },
  { n: 'Stefan Vukić', p: 'CM', a: ['CDM'], o: 82, c: 'ostmark', nat: 'Serbia', sk: 3 },
  { n: 'Hiroshi Nakamura', p: 'CM', a: ['CAM'], o: 80, c: 'marston', nat: 'Japan', sk: 4 },
  { n: 'Danny Whitcombe', p: 'CM', o: 77, c: 'kestrel', nat: 'England', sk: 2 },
  { n: 'Luca Bernardi', p: 'CAM', a: ['CF', 'CM'], o: 90, c: 'arden', nat: 'Italy', sk: 5 },
  { n: 'Emre Solak', p: 'CAM', a: ['CM'], o: 85, c: 'ostmark', nat: 'Türkiye', sk: 4 },
  { n: 'Kai Vermeulen', p: 'CAM', a: ['CF'], o: 82, c: 'norvik', nat: 'Netherlands', sk: 4 },
  { n: 'Amadou Sarr', p: 'LM', a: ['LW'], o: 84, c: 'valdor', nat: 'Senegal', sk: 4 },
  { n: 'Mateo Ferreira', p: 'LM', a: ['LWB'], o: 79, c: 'rioverde', nat: 'Uruguay', sk: 3 },
  { n: 'Ilias Bouzid', p: 'RM', a: ['RW'], o: 84, c: 'marston', nat: 'Morocco', sk: 4 },
  { n: 'Owen Traeger', p: 'RM', a: ['RWB'], o: 78, c: 'kestrel', nat: 'USA', sk: 3 },

  // ── Forwards ───────────────────────────────────────────────────────────────
  { n: 'Vinícius Rocha', p: 'LW', a: ['ST'], o: 88, c: 'rioverde', nat: 'Brazil', sk: 5 },
  { n: 'Jamal Ekwueme', p: 'LW', a: ['LM'], o: 83, c: 'kestrel', nat: 'Nigeria', sk: 4 },
  { n: 'Nikola Radev', p: 'LW', a: ['CAM'], o: 79, c: 'solheim', nat: 'Croatia', sk: 4 },
  { n: 'Gabriel Moreau', p: 'RW', a: ['ST'], o: 87, c: 'valdor', nat: 'France', sk: 5 },
  { n: 'Seo-jun Park', p: 'RW', a: ['CAM'], o: 82, c: 'marston', nat: 'South Korea', sk: 4 },
  { n: 'Tariq Benali', p: 'RW', a: ['RM'], o: 78, c: 'arden', nat: 'Algeria', sk: 3 },
  { n: 'Viktor Halvorsen', p: 'ST', a: ['CF'], o: 91, c: 'solheim', nat: 'Norway', sk: 4 },
  { n: 'Leandro Bastos', p: 'ST', a: ['CF'], o: 88, c: 'rioverde', nat: 'Brazil', sk: 4 },
  { n: 'Karl Weissmann', p: 'ST', o: 85, c: 'ostmark', nat: 'Germany', sk: 3 },
  { n: 'Matteo Rossi', p: 'CF', a: ['ST', 'CAM'], o: 84, c: 'arden', nat: 'Italy', sk: 4 },
  { n: 'Ade Balogun', p: 'ST', a: ['LW'], o: 83, c: 'norvik', nat: 'Nigeria', sk: 3 },
  { n: 'Dylan Prescott', p: 'ST', o: 76, c: 'kestrel', nat: 'England', sk: 2 },
]

function slug(name: string, i: number): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${base}-${i}`
}

export const PLAYERS: Player[] = SEEDS.map((s, i) => {
  const id = slug(s.n, i)
  return {
    id,
    name: s.n,
    pos: s.p,
    alt: s.a ?? [],
    ovr: s.o,
    stats: statsFor(id, s.p, s.o),
    clubId: s.c,
    nation: s.nat,
    // A handful start tired on purpose — the squad should tempt you into subs.
    stamina: 62 + Math.round(hash01(id + 'stam') * 38),
    skill: s.sk ?? 3,
    form: 4 + Math.round(hash01(id + 'form') * 6),
  }
})

export const PLAYER_MAP = new Map(PLAYERS.map((p) => [p.id, p]))

export function getPlayer(id: string | null | undefined): Player | undefined {
  return id ? PLAYER_MAP.get(id) : undefined
}

const BY_NAME = new Map(PLAYERS.map((p) => [p.name, p.id]))

/** Resolve by display name so the default squad can never drift out of sync
 *  with the seed ordering. */
function ids(...names: string[]): string[] {
  return names.map((n) => {
    const id = BY_NAME.get(n)
    if (!id) throw new Error(`Unknown default squad player: ${n}`)
    return id
  })
}

/** Home seven in canonical slot order for 2-3-1 (GK, CB, CB, LM, CM, RM, ST).
 *  Deliberately imperfect: a couple of tired legs and a link or two that can be
 *  improved, so chemistry is something you actually tune. */
export const DEFAULT_XI: string[] = ids(
  'Ivan Petrescu',
  'Anton Reidel',
  'Bruno Salvatti',
  'Amadou Sarr',
  'Andrés Quintero',
  'Ilias Bouzid',
  'Viktor Halvorsen',
)

export const DEFAULT_BENCH: string[] = ids(
  'Marek Dolny',
  'Kwame Osafo',
  'Yannick Bastin',
  'Fabien Roux',
  'Luca Bernardi',
  'Vinícius Rocha',
  'Leandro Bastos',
)

/** Away seven — same 2-3-1, no overlap with the home squad, slightly leaner on
 *  paper so the default board is a contest rather than a mismatch. */
export const AWAY_XI: string[] = ids(
  'Théo Vasseur',
  'Elias Nordvik',
  'Lars Vindheim',
  'Mateo Ferreira',
  'Stefan Vukić',
  'Owen Traeger',
  'Karl Weissmann',
)

export const AWAY_BENCH: string[] = ids(
  'Kenji Arakawa',
  'Diego Márquez',
  'Rafael Cardoso',
  'Tobias Lindqvist',
  'Emre Solak',
  'Seo-jun Park',
  'Gabriel Moreau',
)
