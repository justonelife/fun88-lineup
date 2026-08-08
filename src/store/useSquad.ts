import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { AWAY_BENCH, AWAY_XI, DEFAULT_BENCH, DEFAULT_XI, PLAYERS } from '../data/players'
import { toast } from './useToast'
import { DEFAULT_TACTICS, PRESETS } from '../data/tactics'
import { XI_SIZE } from '../data/formations'
import { autoFit } from '../lib/lineup'
import type { Roster } from '../lib/chemistry'
import type { MatchResult, Player, Side, Tactics, Vec } from '../types'

export { XI_SIZE }
/** Seven-a-side: three changes, not five. */
export const MAX_SUBS = 3
export const BENCH_SIZE = 7

export const DEFAULT_FORMATION = '231'
const AWAY_TACTICS: Tactics =
  PRESETS.find((p) => p.id === 'counter')?.values ?? DEFAULT_TACTICS

/** A dragged token may drift a little past halfway but never off the board. */
const X_MIN = 5
const X_MAX = 95
const Y_MIN = -14
const Y_MAX = 98

export function clampLocal(p: Vec): Vec {
  return {
    x: Math.round(Math.max(X_MIN, Math.min(X_MAX, p.x)) * 10) / 10,
    y: Math.round(Math.max(Y_MIN, Math.min(Y_MAX, p.y)) * 10) / 10,
  }
}

function baseRoster(): Roster {
  return Object.fromEntries(PLAYERS.map((p) => [p.id, { ...p }]))
}

const emptyPositions = (): (Vec | null)[] => Array.from({ length: XI_SIZE }, () => null)

/** One editable team. Both sides pick from the same shared roster. */
export interface TeamSlice {
  formationId: string
  /** Seven entries, index = canonical formation slot. */
  lineup: (string | null)[]
  /** Per-slot free-drag overrides in team-local coordinates; null = shape default. */
  positions: (Vec | null)[]
  bench: (string | null)[]
  subsLeft: number
  tactics: Tactics
  /** Bumped on every substitution so the pitch can flash the incoming player. */
  subFlash: { slot: number; token: number } | null
}

function makeTeam(
  lineup: string[],
  bench: string[],
  formationId: string,
  tactics: Tactics,
): TeamSlice {
  return {
    formationId,
    lineup: [...lineup],
    positions: emptyPositions(),
    bench: [...bench],
    subsLeft: MAX_SUBS,
    tactics: { ...tactics },
    subFlash: null,
  }
}

const defaultHome = () => makeTeam(DEFAULT_XI, DEFAULT_BENCH, DEFAULT_FORMATION, DEFAULT_TACTICS)
const defaultAway = () => makeTeam(AWAY_XI, AWAY_BENCH, DEFAULT_FORMATION, AWAY_TACTICS)

interface SquadState {
  /** Shared player pool — one database, two teams drawing from it. */
  roster: Roster
  home: TeamSlice
  away: TeamSlice
  /** The side every editing control currently targets. */
  activeSide: Side
  lastMatch: MatchResult | null

  addPlayer: (player: Player) => void
  updatePlayer: (id: string, patch: Partial<Omit<Player, 'id'>>) => void
  /** Removes from the pool and detaches from both teams in one transaction. */
  deletePlayer: (id: string) => void
  setActiveSide: (side: Side) => void
  setFormation: (side: Side, id: string) => void
  swapSlots: (side: Side, a: number, b: number) => void
  assignToSlot: (side: Side, playerId: string, slot: number) => void
  clearSlot: (side: Side, slot: number) => void
  substitute: (side: Side, benchIndex: number, slot: number) => void
  addToBench: (side: Side, playerId: string, benchIndex?: number) => void
  removeFromBench: (side: Side, benchIndex: number) => void
  autoFitLineup: (side: Side) => void
  setPosition: (side: Side, slot: number, at: Vec) => void
  resetPositions: (side: Side) => void
  setTactic: (side: Side, key: keyof Tactics, value: number) => void
  applyTactics: (side: Side, values: Tactics) => void
  recover: () => void
  finishMatch: (result: MatchResult) => void
  resetAll: () => void
}

/** Detach a player id from wherever it currently lives inside one team. */
function detach(team: TeamSlice, id: string) {
  return {
    lineup: team.lineup.map((x) => (x === id ? null : x)),
    bench: team.bench.map((x) => (x === id ? null : x)),
  }
}

/** Every mutation is "patch one side" — the two slices never interact. */
const patch =
  (side: Side, fn: (t: TeamSlice) => Partial<TeamSlice>) =>
  (s: SquadState): Partial<SquadState> => ({ [side]: { ...s[side], ...fn(s[side]) } }) as
    Partial<SquadState>

/* A 256px portrait is 10-40KB of base64 per player; a big enough custom squad
 * can still walk into the ~5MB localStorage ceiling. The write is best-effort:
 * the session keeps working in memory and the user is told once, rather than the
 * whole app dying inside a setState. */
let quotaWarned = false
const quotaSafeStorage = createJSONStorage(() => ({
  getItem: (name: string) => localStorage.getItem(name),
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value)
      quotaWarned = false
    } catch {
      if (!quotaWarned) {
        quotaWarned = true
        toast(
          'Storage is full — changes stay for this session only. Remove a photo to free space.',
          'warn',
        )
      }
    }
  },
  removeItem: (name: string) => localStorage.removeItem(name),
}))

export const useSquad = create<SquadState>()(
  persist(
    (set) => ({
      roster: baseRoster(),
      home: defaultHome(),
      away: defaultAway(),
      activeSide: 'home',
      lastMatch: null,

      addPlayer: (player) => set((s) => ({ roster: { ...s.roster, [player.id]: player } })),

      updatePlayer: (id, patch) =>
        set((s) => {
          const current = s.roster[id]
          if (!current) return {}
          // `id` is deliberately not patchable: it keys the photo drop-in and
          // every lineup/bench reference held by both teams.
          return { roster: { ...s.roster, [id]: { ...current, ...patch, id } } }
        }),

      deletePlayer: (id) =>
        set((s) => {
          if (!s.roster[id]) return {}
          const roster = { ...s.roster }
          delete roster[id]
          // A deleted player leaves no ghost shirt behind: the slot empties and
          // its hand-placed coordinate goes with it.
          const strip = (t: TeamSlice): TeamSlice => ({
            ...t,
            lineup: t.lineup.map((x) => (x === id ? null : x)),
            positions: t.positions.map((p, i) => (t.lineup[i] === id ? null : p)),
            bench: t.bench.map((x) => (x === id ? null : x)),
          })
          return { roster, home: strip(s.home), away: strip(s.away) }
        }),

      setActiveSide: (side) => set({ activeSide: side }),

      /* Custom positions are keyed by slot index and deliberately survive a
       * formation change — a player you placed by hand stays where you put him.
       * "Reset positions" is the way back to the pristine shape. */
      setFormation: (side, id) => set(patch(side, () => ({ formationId: id }))),

      /* Free-drag overrides are keyed by SLOT, never by player: swapping two
       * starters exchanges the spots they stand on, which is the whole point of
       * a swap. Only a drag or "Reset positions" moves the geometry itself. */
      swapSlots: (side, a, b) =>
        set(
          patch(side, (t) => {
            const lineup = [...t.lineup]
            const tmpId = lineup[a] ?? null
            lineup[a] = lineup[b] ?? null
            lineup[b] = tmpId
            return { lineup }
          }),
        ),

      assignToSlot: (side, playerId, slot) =>
        set(
          patch(side, (t) => {
            const detached = detach(t, playerId)
            const lineup = [...detached.lineup]
            lineup[slot] = playerId
            return { lineup, bench: detached.bench }
          }),
        ),

      clearSlot: (side, slot) =>
        set(
          patch(side, (t) => {
            const lineup = [...t.lineup]
            lineup[slot] = null
            const positions = [...t.positions]
            positions[slot] = null
            return { lineup, positions }
          }),
        ),

      substitute: (side, benchIndex, slot) =>
        set(
          patch(side, (t) => {
            const incoming = t.bench[benchIndex]
            if (!incoming || t.subsLeft <= 0) return {}
            const outgoing = t.lineup[slot] ?? null
            const lineup = [...t.lineup]
            const bench = [...t.bench]
            lineup[slot] = incoming
            bench[benchIndex] = outgoing
            return {
              lineup,
              bench,
              subsLeft: t.subsLeft - 1,
              subFlash: { slot, token: Date.now() },
            }
          }),
        ),

      addToBench: (side, playerId, benchIndex) =>
        set(
          patch(side, (t) => {
            const detached = detach(t, playerId)
            const bench = [...detached.bench]
            const idx = benchIndex ?? bench.findIndex((x) => x === null)
            bench[idx >= 0 ? idx : bench.length - 1] = playerId
            return { bench, lineup: detached.lineup }
          }),
        ),

      removeFromBench: (side, benchIndex) =>
        set(
          patch(side, (t) => {
            const bench = [...t.bench]
            bench[benchIndex] = null
            return { bench }
          }),
        ),

      // Personnel only — the shape you dragged out is yours until you reset it.
      autoFitLineup: (side) =>
        set((s) => ({
          [side]: {
            ...s[side],
            lineup: autoFit(s.roster, s[side].formationId, s[side].lineup),
          },
        }) as Partial<SquadState>),

      setPosition: (side, slot, at) =>
        set(
          patch(side, (t) => {
            const positions = [...t.positions]
            positions[slot] = clampLocal(at)
            return { positions }
          }),
        ),

      resetPositions: (side) => set(patch(side, () => ({ positions: emptyPositions() }))),

      setTactic: (side, key, value) =>
        set(patch(side, (t) => ({ tactics: { ...t.tactics, [key]: value } }))),

      applyTactics: (side, values) => set(patch(side, () => ({ tactics: { ...values } }))),

      recover: () =>
        set((s) => {
          const roster: Roster = {}
          for (const [id, p] of Object.entries(s.roster)) {
            roster[id] = { ...p, stamina: Math.min(100, p.stamina + 22) }
          }
          return {
            roster,
            home: { ...s.home, subsLeft: MAX_SUBS },
            away: { ...s.away, subsLeft: MAX_SUBS },
          }
        }),

      finishMatch: (result) =>
        set((s) => {
          const roster: Roster = { ...s.roster }
          const touched = new Set<string>()
          // Home carries the full consequence set; the away seven only lose
          // legs (and the same cheap ovr nudge) so both squads age together.
          for (const r of result.ratings) {
            const p = roster[r.playerId]
            if (!p) continue
            touched.add(r.playerId)
            roster[r.playerId] = {
              ...p,
              stamina: Math.max(8, Math.round(p.stamina - r.staminaLost)),
              ovr: Math.max(40, Math.min(99, p.ovr + r.ovrDelta)),
              form: Math.max(1, Math.min(10, Math.round(r.rating))),
            }
          }
          for (const r of result.awayRatings) {
            const p = roster[r.playerId]
            // A player fielded by both teams is only drained once.
            if (!p || touched.has(r.playerId)) continue
            roster[r.playerId] = {
              ...p,
              stamina: Math.max(8, Math.round(p.stamina - r.staminaLost)),
              ovr: Math.max(40, Math.min(99, p.ovr + r.ovrDelta)),
            }
          }
          return {
            roster,
            lastMatch: result,
            home: { ...s.home, subsLeft: MAX_SUBS },
            away: { ...s.away, subsLeft: MAX_SUBS },
          }
        }),

      resetAll: () =>
        set({
          roster: baseRoster(),
          home: defaultHome(),
          away: defaultAway(),
          activeSide: 'home',
          lastMatch: null,
        }),
    }),
    {
      name: 'ultra-xi:squad',
      version: 2,
      storage: quotaSafeStorage,
      partialize: (s) => ({
        roster: s.roster,
        home: s.home,
        away: s.away,
        activeSide: s.activeSide,
        lastMatch: s.lastMatch,
      }),
      migrate: (persisted, version) => migrate(persisted, version),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<SquadState>
        // Fold any newly-added seeds into a previously stored roster so the
        // shipped database can grow without wiping a saved squad — and keep
        // every player the user created, whose id is in no seed list at all.
        const roster: Roster = { ...baseRoster() }
        for (const [id, p] of Object.entries(saved.roster ?? {})) {
          const base = roster[id]
          if (base) roster[id] = { ...base, ...(p as Player) }
          else if (isPlayerish(p)) roster[id] = { ...(p as Player), id }
        }
        return {
          ...current,
          ...saved,
          roster,
          home: normaliseTeam(saved.home, defaultHome()),
          away: normaliseTeam(saved.away, defaultAway()),
        }
      },
    },
  ),
)

/** A stored id that matches no seed is a user-created player. Accept it only if
 *  the payload still looks like a Player — a hand-mangled localStorage entry
 *  must not reach the pitch as `undefined.stats`. */
function isPlayerish(p: unknown): p is Player {
  if (!p || typeof p !== 'object') return false
  const c = p as Partial<Player>
  return (
    typeof c.name === 'string' &&
    typeof c.pos === 'string' &&
    typeof c.ovr === 'number' &&
    typeof c.clubId === 'string' &&
    Boolean(c.stats) &&
    typeof c.stats?.pac === 'number'
  )
}

/** Defend against a half-written or hand-edited payload: every team slice that
 *  reaches the app has exactly seven slots, seven bench seats and no subFlash. */
function normaliseTeam(saved: Partial<TeamSlice> | undefined, fallback: TeamSlice): TeamSlice {
  if (!saved) return fallback
  const fit = <T,>(arr: unknown, length: number, fill: T): T[] =>
    Array.from({ length }, (_, i) => ((Array.isArray(arr) ? arr[i] : undefined) ?? fill) as T)
  return {
    formationId: saved.formationId ?? fallback.formationId,
    lineup: fit<string | null>(saved.lineup, XI_SIZE, null),
    positions: fit<Vec | null>(saved.positions, XI_SIZE, null),
    bench: fit<string | null>(saved.bench, BENCH_SIZE, null),
    subsLeft: Math.max(0, Math.min(MAX_SUBS, saved.subsLeft ?? MAX_SUBS)),
    tactics: { ...fallback.tactics, ...(saved.tactics ?? {}) },
    subFlash: null,
  }
}

/* ── persistence migration ────────────────────────────────────────────────────
 * v1 was a single eleven-a-side team stored flat. v2 keeps the roster (that is
 * where real progress lives — stamina, form, earned ovr) and folds the saved
 * squad into the home side: `autoFit` picks the best seven of the stored eleven
 * for the 2-3-1, the rest fall back onto the bench. The away side is seeded
 * from its defaults. Nothing the user built is thrown away. */
interface LegacyState {
  roster?: Roster
  formationId?: string
  lineup?: (string | null)[]
  bench?: (string | null)[]
  tactics?: Tactics
  lastMatch?: MatchResult | null
}

function migrate(persisted: unknown, version: number): SquadState {
  const state = persisted as Partial<SquadState> & LegacyState
  if (version >= 2) return state as SquadState

  try {
    const roster: Roster = { ...baseRoster(), ...(state.roster ?? {}) }
    const savedXI = (state.lineup ?? []).filter((x): x is string => Boolean(x))
    const savedBench = (state.bench ?? []).filter((x): x is string => Boolean(x))

    const lineup = savedXI.length
      ? autoFit(roster, DEFAULT_FORMATION, savedXI)
      : [...DEFAULT_XI]
    const starting = new Set(lineup.filter(Boolean) as string[])
    // The four who lost their shirt in the shrink to seven go to the bench
    // first, ahead of whoever was already there.
    const benchPool = [...savedXI.filter((id) => !starting.has(id)), ...savedBench].filter(
      (id, i, all) => all.indexOf(id) === i && !starting.has(id),
    )
    const bench = Array.from({ length: BENCH_SIZE }, (_, i) => benchPool[i] ?? null)

    const home: TeamSlice = {
      formationId: DEFAULT_FORMATION,
      lineup,
      positions: emptyPositions(),
      bench,
      subsLeft: MAX_SUBS,
      tactics: { ...DEFAULT_TACTICS, ...(state.tactics ?? {}) },
      subFlash: null,
    }

    // Keep the away seven clear of anyone the migrated home squad now uses.
    const taken = new Set([...(lineup.filter(Boolean) as string[]), ...(bench.filter(Boolean) as string[])])
    const spare = Object.keys(roster).filter((id) => !taken.has(id))
    const pickAway = (preferred: string[]) => {
      const out = preferred.filter((id) => !taken.has(id))
      for (const id of spare) {
        if (out.length >= XI_SIZE) break
        if (!out.includes(id)) out.push(id)
      }
      return out.slice(0, XI_SIZE)
    }
    const awayPool = pickAway([...AWAY_XI, ...AWAY_BENCH])
    const awayLineup = autoFit(roster, DEFAULT_FORMATION, awayPool)
    const used = new Set([...taken, ...(awayLineup.filter(Boolean) as string[])])
    const awayBench = [...AWAY_BENCH, ...spare].filter(
      (id, i, all) => !used.has(id) && all.indexOf(id) === i,
    )
    const away: TeamSlice = {
      formationId: DEFAULT_FORMATION,
      lineup: awayLineup,
      positions: emptyPositions(),
      bench: Array.from({ length: BENCH_SIZE }, (_, i) => awayBench[i] ?? null),
      subsLeft: MAX_SUBS,
      tactics: { ...AWAY_TACTICS },
      subFlash: null,
    }

    return {
      ...(state as SquadState),
      roster,
      home,
      away,
      activeSide: 'home',
      lastMatch: null, // an eleven-a-side report cannot be read by the 7s UI
    }
  } catch {
    // A broken payload must never brick the app; fall back to a fresh board but
    // keep whatever roster progress could still be read.
    return {
      ...(state as SquadState),
      roster: { ...baseRoster(), ...(state.roster ?? {}) },
      home: defaultHome(),
      away: defaultAway(),
      activeSide: 'home',
      lastMatch: null,
    }
  }
}

export const useActiveSide = () => useSquad((s) => s.activeSide)
export const useTeamSlice = (side: Side) => useSquad((s) => s[side])
export const usePlayer = (id: string | null | undefined): Player | undefined =>
  useSquad((s) => (id ? s.roster[id] : undefined))
