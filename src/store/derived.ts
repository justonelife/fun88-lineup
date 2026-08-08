import { useMemo } from 'react'
import { useSquad } from './useSquad'
import { computeChemistry, computeOvr, tacticsFit, resolve } from '../lib/chemistry'
import { getFormation } from '../data/formations'
import type { Player } from '../types'

export function useDerived() {
  const roster = useSquad((s) => s.roster)
  const formationId = useSquad((s) => s.formationId)
  const lineup = useSquad((s) => s.lineup)
  const tactics = useSquad((s) => s.tactics)

  return useMemo(() => {
    const formation = getFormation(formationId)
    const chem = computeChemistry(roster, formationId, lineup)
    const ovr = computeOvr(roster, lineup, chem.team, tactics, formationId)
    const xi = lineup.map((id) => resolve(roster, id)).filter((p): p is Player => Boolean(p))
    const fit = tacticsFit(tactics, formationId, xi)
    const avgStamina = xi.length
      ? Math.round(xi.reduce((s, p) => s + p.stamina, 0) / xi.length)
      : 0
    return { formation, chem, ovr, fit, xi, avgStamina, roster, lineup, tactics }
  }, [roster, formationId, lineup, tactics])
}
