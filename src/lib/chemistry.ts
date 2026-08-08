import { linksFor, getFormation } from '../data/formations'
import type { Player, Pos, Tactics } from '../types'

export type Roster = Record<string, Player>

export function resolve(roster: Roster, id: string | null | undefined): Player | undefined {
  return id ? roster[id] : undefined
}

/** Positions a player can cover without a chemistry hit beyond one step. */
const RELATED: Record<Pos, Pos[]> = {
  GK: [],
  CB: ['CDM', 'LB', 'RB'],
  LB: ['LWB', 'LM', 'CB'],
  RB: ['RWB', 'RM', 'CB'],
  LWB: ['LB', 'LM', 'LW'],
  RWB: ['RB', 'RM', 'RW'],
  CDM: ['CM', 'CB'],
  CM: ['CDM', 'CAM'],
  CAM: ['CM', 'CF', 'LM', 'RM'],
  LM: ['LW', 'LWB', 'LB', 'CM'],
  RM: ['RW', 'RWB', 'RB', 'CM'],
  LW: ['LM', 'ST', 'CF'],
  RW: ['RM', 'ST', 'CF'],
  CF: ['ST', 'CAM'],
  ST: ['CF', 'LW', 'RW'],
}

export type PosFit = 3 | 2 | 1 | 0

/** 3 = natural, 2 = secondary, 1 = related, 0 = out of position. */
export function posFit(player: Player, slotPos: Pos): PosFit {
  if (player.pos === slotPos) return 3
  if (player.alt.includes(slotPos)) return 2
  if ((RELATED[player.pos] ?? []).includes(slotPos)) return 1
  return 0
}

export type LinkStrength = 3 | 2 | 1 | 0

export function linkStrength(a: Player, b: Player, fitA: PosFit, fitB: PosFit): LinkStrength {
  if (fitA === 0 || fitB === 0) return 0
  let score = 1 // two players who understand their roles always connect a little
  if (a.clubId === b.clubId) score += 2
  if (a.nation === b.nation) score += 1
  return Math.min(3, score) as LinkStrength
}

export const LINK_COLOR: Record<LinkStrength, string> = {
  3: 'var(--color-chem-strong)',
  2: 'var(--color-chem-mid)',
  1: 'var(--color-chem-weak)',
  0: 'var(--color-chem-weak)',
}

export interface ChemLink {
  a: number
  b: number
  strength: LinkStrength
}

export interface ChemistryReport {
  /** 0-100 team chemistry. */
  team: number
  links: ChemLink[]
  /** Per-slot chemistry 0-10, FIFA-style. */
  perSlot: number[]
  fits: PosFit[]
  outOfPosition: number
}

export function computeChemistry(
  roster: Roster,
  formationId: string,
  lineup: (string | null)[],
): ChemistryReport {
  const formation = getFormation(formationId)
  const links = linksFor(formationId)

  const fits: PosFit[] = formation.slots.map((slot) => {
    const p = resolve(roster, lineup[slot.i])
    return p ? posFit(p, slot.pos) : 0
  })

  const chemLinks: ChemLink[] = links.map(([a, b]) => {
    const pa = resolve(roster, lineup[a])
    const pb = resolve(roster, lineup[b])
    if (!pa || !pb) return { a, b, strength: 0 as LinkStrength }
    return { a, b, strength: linkStrength(pa, pb, fits[a] ?? 0, fits[b] ?? 0) }
  })

  // Per-slot chemistry: position fit is worth 4, the slot's own links worth 6.
  const perSlot = formation.slots.map((slot) => {
    const mine = chemLinks.filter((l) => l.a === slot.i || l.b === slot.i)
    const linkAvg = mine.length ? mine.reduce((s, l) => s + l.strength, 0) / (mine.length * 3) : 0
    const fitPart = ((fits[slot.i] ?? 0) / 3) * 4
    return Math.round(fitPart + linkAvg * 6)
  })

  const filled = lineup.filter(Boolean).length
  const team = filled === 0 ? 0 : Math.round((perSlot.reduce((s, v) => s + v, 0) / (11 * 10)) * 100)

  return {
    team: Math.max(0, Math.min(100, team)),
    links: chemLinks,
    perSlot,
    fits,
    outOfPosition: fits.filter((f, i) => lineup[i] && f === 0).length,
  }
}

/** Stamina drags a player's effective rating — tired legs cost you real OVR. */
export function effectiveOvr(p: Player): number {
  const fatigue = p.stamina < 70 ? (70 - p.stamina) * 0.09 : 0
  return p.ovr - fatigue
}

const LINE_WEIGHT: Record<string, number> = { GK: 1, DEF: 1, MID: 1.1, FWD: 1.05 }

export function lineOf(pos: Pos): 'GK' | 'DEF' | 'MID' | 'FWD' {
  if (pos === 'GK') return 'GK'
  if (['LB', 'CB', 'RB', 'LWB', 'RWB'].includes(pos)) return 'DEF'
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(pos)) return 'MID'
  return 'FWD'
}

export interface OvrReport {
  base: number
  chemBonus: number
  tacticsBonus: number
  total: number
}

/** Coherence of the custom tactics against the shape and the personnel. */
export function tacticsFit(tactics: Tactics, formationId: string, xi: Player[]): number {
  if (xi.length === 0) return 50
  const avgPace = xi.reduce((s, p) => s + p.stats.pac, 0) / xi.length
  const avgDef = xi.reduce((s, p) => s + p.stats.def, 0) / xi.length
  const avgPhy = xi.reduce((s, p) => s + p.stats.phy, 0) / xi.length

  let score = 50
  // High line needs pace at the back; a slow squad pushed up gets punished.
  score -= Math.max(0, (tactics.lineHeight - 55) * (72 - avgPace)) / 45
  // Heavy pressing needs physicality and stamina.
  const avgStam = xi.reduce((s, p) => s + p.stamina, 0) / xi.length
  score -= Math.max(0, (tactics.pressure - 60) * (78 - (avgPhy + avgStam) / 2)) / 55
  // Attacking mentality without defensive cover is a risk.
  score -= Math.max(0, (tactics.mentality - 60) * (72 - avgDef)) / 60
  // Extreme width in a narrow shape (or the reverse) is incoherent.
  const wide = ['433', '442', '343', '541', '451'].includes(formationId)
  score += wide ? (tactics.width - 45) / 6 : (55 - tactics.width) / 6
  // Reward decisiveness — a fully neutral setup is a plan-less plan.
  const spread =
    Math.abs(tactics.mentality - 50) + Math.abs(tactics.pressure - 50) + Math.abs(tactics.tempo - 50)
  score += Math.min(12, spread / 6)

  return Math.max(0, Math.min(100, Math.round(score)))
}

export function computeOvr(
  roster: Roster,
  lineup: (string | null)[],
  chem: number,
  tactics: Tactics,
  formationId: string,
): OvrReport {
  const xi = lineup.map((id) => resolve(roster, id)).filter((p): p is Player => Boolean(p))
  if (xi.length === 0) return { base: 0, chemBonus: 0, tacticsBonus: 0, total: 0 }

  let sum = 0
  let weight = 0
  for (const p of xi) {
    const w = LINE_WEIGHT[lineOf(p.pos)] ?? 1
    sum += effectiveOvr(p) * w
    weight += w
  }
  const base = sum / weight

  const chemBonus = Math.max(-3, Math.min(3, Math.round((chem - 55) / 15)))
  const fit = tacticsFit(tactics, formationId, xi)
  const tacticsBonus = Math.max(-1, Math.min(2, Math.round((fit - 50) / 22)))

  return {
    base: Math.round(base),
    chemBonus,
    tacticsBonus,
    total: Math.round(base) + chemBonus + tacticsBonus,
  }
}
