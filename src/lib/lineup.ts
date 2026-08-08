import { getFormation } from '../data/formations'
import { effectiveOvr, posFit, resolve, type Roster } from './chemistry'
import type { Player } from '../types'

/**
 * Greedy global assignment: score every (slot, player) pair by position fit
 * first and effective rating second, then take the best pairs until the XI is
 * full. Good enough to always beat a hand-shuffled squad, and instant.
 */
export function autoFit(
  roster: Roster,
  formationId: string,
  lineup: (string | null)[],
): (string | null)[] {
  const slots = getFormation(formationId).slots
  const squad = lineup.filter(Boolean) as string[]

  const pairs: Array<{ slot: number; id: string; score: number }> = []
  for (const slot of slots) {
    for (const id of squad) {
      const p = resolve(roster, id)
      if (!p) continue
      pairs.push({ slot: slot.i, id, score: posFit(p, slot.pos) * 1000 + effectiveOvr(p) })
    }
  }
  pairs.sort((a, b) => b.score - a.score)

  const out: (string | null)[] = Array.from({ length: 11 }, () => null)
  const usedSlots = new Set<number>()
  const usedIds = new Set<string>()
  for (const pair of pairs) {
    if (usedSlots.has(pair.slot) || usedIds.has(pair.id)) continue
    out[pair.slot] = pair.id
    usedSlots.add(pair.slot)
    usedIds.add(pair.id)
  }
  return out
}

/** Index of the starter contributing least — the natural target for a swap-in. */
export function weakestSlot(
  roster: Roster,
  formationId: string,
  lineup: (string | null)[],
): number {
  const slots = getFormation(formationId).slots
  let worst = -1
  let worstScore = Infinity
  for (const slot of slots) {
    const p = resolve(roster, lineup[slot.i])
    if (!p) return slot.i
    const score = posFit(p, slot.pos) * 12 + effectiveOvr(p)
    if (score < worstScore) {
      worstScore = score
      worst = slot.i
    }
  }
  return worst
}

/** Best slot for a specific player, ignoring who is already there. */
export function bestSlotFor(formationId: string, player: Player): number {
  const slots = getFormation(formationId).slots
  let best = 0
  let bestScore = -1
  for (const slot of slots) {
    const score = posFit(player, slot.pos)
    if (score > bestScore) {
      bestScore = score
      best = slot.i
    }
  }
  return best
}

export function initials(name: string): string {
  const parts = name.split(/[\s-]+/).filter(Boolean)
  const first = parts[0]?.[0] ?? '?'
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : (parts[0]?.[1] ?? '')
  return (first + last).toUpperCase()
}

/** "L. Bernardi" — fits a 64px card without truncating to noise. */
export function shortName(name: string): string {
  const parts = name.split(' ')
  if (parts.length === 1) return name
  return `${parts[0]?.[0] ?? ''}. ${parts.slice(1).join(' ')}`
}

export function staminaTone(stamina: number): 'ok' | 'low' | 'critical' {
  if (stamina >= 70) return 'ok'
  if (stamina >= 45) return 'low'
  return 'critical'
}
