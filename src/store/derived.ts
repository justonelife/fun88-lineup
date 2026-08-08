import { useMemo } from 'react'
import { useSquad } from './useSquad'
import {
  computeChemistry,
  computeOvr,
  tacticsFit,
  resolve,
  type ChemistryReport,
  type OvrReport,
  type Roster,
} from '../lib/chemistry'
import { getFormation } from '../data/formations'
import { team, type TeamMeta } from '../data/teams'
import type { Formation, Player, Side, Tactics, Vec } from '../types'

export interface TeamDerived {
  side: Side
  meta: TeamMeta
  formation: Formation
  chem: ChemistryReport
  ovr: OvrReport
  /** Tactical coherence 0-100. */
  fit: number
  xi: Player[]
  avgStamina: number
  lineup: (string | null)[]
  positions: (Vec | null)[]
  bench: (string | null)[]
  subsLeft: number
  tactics: Tactics
  /** Starters actually filled in. */
  filled: number
  roster: Roster
}

/** Everything one side of the board needs, recomputed only when it changes. */
export function useTeam(side: Side): TeamDerived {
  const roster = useSquad((s) => s.roster)
  const slice = useSquad((s) => s[side])

  return useMemo(() => {
    const { formationId, lineup, positions, bench, subsLeft, tactics } = slice
    const formation = getFormation(formationId)
    const chem = computeChemistry(roster, formationId, lineup, positions)
    const ovr = computeOvr(roster, lineup, chem.team, tactics, formationId)
    const xi = lineup.map((id) => resolve(roster, id)).filter((p): p is Player => Boolean(p))
    const fit = tacticsFit(tactics, formationId, xi)
    const avgStamina = xi.length
      ? Math.round(xi.reduce((s, p) => s + p.stamina, 0) / xi.length)
      : 0
    return {
      side,
      meta: team(side),
      formation,
      chem,
      ovr,
      fit,
      xi,
      avgStamina,
      lineup,
      positions,
      bench,
      subsLeft,
      tactics,
      filled: xi.length,
      roster,
    }
  }, [side, roster, slice])
}

/** The side every editing control currently targets. */
export function useActiveTeam(): TeamDerived {
  const activeSide = useSquad((s) => s.activeSide)
  return useTeam(activeSide)
}

export function useVersus(): { home: TeamDerived; away: TeamDerived; activeSide: Side } {
  const activeSide = useSquad((s) => s.activeSide)
  const home = useTeam('home')
  const away = useTeam('away')
  return { home, away, activeSide }
}
