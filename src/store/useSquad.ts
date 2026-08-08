import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_BENCH, DEFAULT_XI, PLAYERS } from '../data/players'
import { DEFAULT_TACTICS } from '../data/tactics'
import { autoFit } from '../lib/lineup'
import type { Roster } from '../lib/chemistry'
import type { MatchResult, Player, Tactics } from '../types'

export const MAX_SUBS = 5
export const BENCH_SIZE = 7

function baseRoster(): Roster {
  return Object.fromEntries(PLAYERS.map((p) => [p.id, { ...p }]))
}

interface SquadState {
  roster: Roster
  formationId: string
  lineup: (string | null)[]
  bench: (string | null)[]
  subsLeft: number
  tactics: Tactics
  lastMatch: MatchResult | null
  /** Bumped on every substitution so the pitch can flash the incoming player. */
  subFlash: { slot: number; token: number } | null

  setFormation: (id: string) => void
  swapSlots: (a: number, b: number) => void
  assignToSlot: (playerId: string, slot: number) => void
  clearSlot: (slot: number) => void
  substitute: (benchIndex: number, slot: number) => void
  addToBench: (playerId: string, benchIndex?: number) => void
  removeFromBench: (benchIndex: number) => void
  autoFitLineup: () => void
  setTactic: (key: keyof Tactics, value: number) => void
  applyTactics: (values: Tactics) => void
  recover: () => void
  finishMatch: (result: MatchResult) => void
  resetAll: () => void
}

/** Detach a player id from wherever it currently lives. */
function detach(lineup: (string | null)[], bench: (string | null)[], id: string) {
  return {
    lineup: lineup.map((x) => (x === id ? null : x)),
    bench: bench.map((x) => (x === id ? null : x)),
  }
}

export const useSquad = create<SquadState>()(
  persist(
    (set) => ({
      roster: baseRoster(),
      formationId: '433',
      lineup: [...DEFAULT_XI],
      bench: [...DEFAULT_BENCH],
      subsLeft: MAX_SUBS,
      tactics: { ...DEFAULT_TACTICS },
      lastMatch: null,
      subFlash: null,

      setFormation: (id) => set({ formationId: id }),

      swapSlots: (a, b) =>
        set((s) => {
          const next = [...s.lineup]
          const tmp = next[a] ?? null
          next[a] = next[b] ?? null
          next[b] = tmp
          return { lineup: next }
        }),

      assignToSlot: (playerId, slot) =>
        set((s) => {
          const detached = detach(s.lineup, s.bench, playerId)
          const lineup = [...detached.lineup]
          lineup[slot] = playerId
          return { lineup, bench: detached.bench }
        }),

      clearSlot: (slot) =>
        set((s) => {
          const lineup = [...s.lineup]
          lineup[slot] = null
          return { lineup }
        }),

      substitute: (benchIndex, slot) =>
        set((s) => {
          const incoming = s.bench[benchIndex]
          if (!incoming || s.subsLeft <= 0) return s
          const outgoing = s.lineup[slot] ?? null
          const lineup = [...s.lineup]
          const bench = [...s.bench]
          lineup[slot] = incoming
          bench[benchIndex] = outgoing
          return {
            lineup,
            bench,
            subsLeft: s.subsLeft - 1,
            subFlash: { slot, token: Date.now() },
          }
        }),

      addToBench: (playerId, benchIndex) =>
        set((s) => {
          const detached = detach(s.lineup, s.bench, playerId)
          const bench = [...detached.bench]
          const idx = benchIndex ?? bench.findIndex((x) => x === null)
          bench[idx >= 0 ? idx : bench.length - 1] = playerId
          return { bench, lineup: detached.lineup }
        }),

      removeFromBench: (benchIndex) =>
        set((s) => {
          const bench = [...s.bench]
          bench[benchIndex] = null
          return { bench }
        }),

      autoFitLineup: () =>
        set((s) => ({ lineup: autoFit(s.roster, s.formationId, s.lineup) })),

      setTactic: (key, value) => set((s) => ({ tactics: { ...s.tactics, [key]: value } })),

      applyTactics: (values) => set({ tactics: { ...values } }),

      recover: () =>
        set((s) => {
          const roster: Roster = {}
          for (const [id, p] of Object.entries(s.roster)) {
            roster[id] = { ...p, stamina: Math.min(100, p.stamina + 22) }
          }
          return { roster, subsLeft: MAX_SUBS }
        }),

      finishMatch: (result) =>
        set((s) => {
          const roster: Roster = { ...s.roster }
          for (const r of result.ratings) {
            const p = roster[r.playerId]
            if (!p) continue
            roster[r.playerId] = {
              ...p,
              stamina: Math.max(8, Math.round(p.stamina - r.staminaLost)),
              ovr: Math.max(40, Math.min(99, p.ovr + r.ovrDelta)),
              form: Math.max(1, Math.min(10, Math.round(r.rating))),
            }
          }
          return { roster, lastMatch: result, subsLeft: MAX_SUBS }
        }),

      resetAll: () =>
        set({
          roster: baseRoster(),
          formationId: '433',
          lineup: [...DEFAULT_XI],
          bench: [...DEFAULT_BENCH],
          subsLeft: MAX_SUBS,
          tactics: { ...DEFAULT_TACTICS },
          lastMatch: null,
          subFlash: null,
        }),
    }),
    {
      name: 'ultra-xi:squad',
      version: 1,
      partialize: (s) => ({
        roster: s.roster,
        formationId: s.formationId,
        lineup: s.lineup,
        bench: s.bench,
        subsLeft: s.subsLeft,
        tactics: s.tactics,
        lastMatch: s.lastMatch,
      }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<SquadState>
        // Fold any newly-added players into a previously stored roster so the
        // database can grow without wiping a saved squad.
        const roster: Roster = { ...baseRoster() }
        for (const [id, p] of Object.entries(saved.roster ?? {})) {
          if (roster[id]) roster[id] = { ...roster[id], ...(p as Player) }
        }
        return { ...current, ...saved, roster, subFlash: null }
      },
    },
  ),
)

export const selectXI = (s: SquadState) => s.lineup
export const usePlayer = (id: string | null | undefined): Player | undefined =>
  useSquad((s) => (id ? s.roster[id] : undefined))
