import { getFormation } from '../data/formations'
import { effectiveOvr, lineOf, resolve, type Roster } from './chemistry'
import type { MatchEvent, MatchResult, Player, PlayerRating, Slot, Tactics } from '../types'

const rand = () => Math.random()
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)] as T

const GOAL_LINES = [
  '{p} rifles it into the roof of the net!',
  '{p} ghosts in at the back post and finishes first time!',
  'A one-two on the edge and {p} sweeps it home!',
  '{p} cuts inside, opens the body — bottom corner!',
  'Deflected, but {p} claims it! The keeper never moved.',
  '{p} wins the ball high and buries it. Ruthless.',
]

const CHANCE_LINES = [
  '{p} drags it just wide from the angle.',
  '{p} is played in but the flag goes up.',
  "Half a yard for {p} — and the block comes in.",
  '{p} tries the dink; it lands on the roof of the net.',
  'Corner swung in, {p} rises, header over.',
]

const SAVE_LINES = [
  '{k} is out quickly to smother {p}. Big moment.',
  'Fingertips! {k} turns {p} round the post.',
  '{k} stands tall and blocks {p} with the trailing leg.',
]

const INFO_LINES = [
  'The press is squeezing them into the corners.',
  'Legs are going in midfield — both benches are up.',
  '{o} have changed shape, going long more often.',
  'On a pitch this size the ball never rests. End to end.',
  'The tempo has dropped. Seven a side, chess at walking pace.',
]

export interface SimSide {
  name: string
  roster: Roster
  lineup: (string | null)[]
  formationId: string
  tactics: Tactics
  teamOvr: number
  chem: number
}

interface Unit {
  p: Player
  slot: Slot
}

function unitsOf(side: SimSide): Unit[] {
  const slots = getFormation(side.formationId).slots
  return side.lineup
    .map((id, i) => ({ p: resolve(side.roster, id), slot: slots[i] }))
    .filter((x): x is Unit => Boolean(x.p && x.slot))
}

const attackBias = (t: Tactics) => 0.5 + t.mentality / 200 + t.tempo / 400
const defenceBias = (t: Tactics) => 0.5 + (100 - t.mentality) / 220 + (100 - t.lineHeight) / 400

/** Both sides are real squads now: shape, personnel and instructions of the
 *  opponent push back on every roll. */
export function simulateMatch(home: SimSide, away: SimSide): MatchResult {
  const homeXI = unitsOf(home)
  const awayXI = unitsOf(away)

  const band = (xi: Unit[]) => ({
    attackers: xi.filter((x) => lineOf(x.slot.pos) === 'FWD' || x.slot.pos === 'CAM'),
    creators: xi.filter((x) => lineOf(x.slot.pos) === 'MID'),
    defenders: xi.filter((x) => lineOf(x.slot.pos) === 'DEF'),
    keeper: xi.find((x) => x.slot.pos === 'GK'),
  })
  const H = band(homeXI)
  const A = band(awayXI)

  const edge = (home.teamOvr - away.teamOvr) / 8 + (home.chem - away.chem) / 40

  const events: MatchEvent[] = []
  let homeGoals = 0
  let awayGoals = 0
  let shots = 0
  let shotsAgainst = 0

  const scorers = new Map<string, number>()
  const assisters = new Map<string, number>()

  events.push({
    minute: 0,
    kind: 'whistle',
    text: `Kick off. ${home.name} versus ${away.name}, seven a side.`,
    team: 'neutral',
  })

  const beats = 16 + Math.floor(rand() * 5)
  const minutes = Array.from({ length: beats }, () => 1 + Math.floor(rand() * 89)).sort(
    (a, b) => a - b,
  )

  const attack = (
    bands: ReturnType<typeof band>,
    against: ReturnType<typeof band>,
    xi: Unit[],
    minute: number,
    team: 'home' | 'away',
    chance: number,
  ) => {
    const scorer = pick(bands.attackers.length ? bands.attackers : xi).p
    if (rand() < chance) {
      scorers.set(scorer.id, (scorers.get(scorer.id) ?? 0) + 1)
      const helper = pick(bands.creators.length ? bands.creators : xi).p
      if (helper.id !== scorer.id) assisters.set(helper.id, (assisters.get(helper.id) ?? 0) + 1)
      events.push({
        minute,
        kind: 'goal',
        text: pick(GOAL_LINES).replace('{p}', scorer.name),
        team,
      })
      return true
    }
    const stopper = against.keeper?.p ?? pick(against.defenders.length ? against.defenders : xi).p
    if (rand() < 0.45) {
      events.push({
        minute,
        kind: 'save',
        text: pick(SAVE_LINES).replace('{k}', stopper.name).replace('{p}', scorer.name),
        team: team === 'home' ? 'away' : 'home',
      })
    } else {
      events.push({
        minute,
        kind: 'chance',
        text: pick(CHANCE_LINES).replace('{p}', scorer.name),
        team,
      })
    }
    return false
  }

  for (const minute of minutes) {
    // Late-game fatigue: whoever pressed hardest fades first.
    const fatigueH = minute > 70 ? (home.tactics.pressure / 100) * 0.35 : 0
    const fatigueA = minute > 70 ? (away.tactics.pressure / 100) * 0.35 : 0

    const homeShare = Math.max(
      0.1,
      0.42 +
        edge * 0.05 +
        (attackBias(home.tactics) - defenceBias(away.tactics)) * 0.3 -
        fatigueH * 0.5,
    )
    const awayShare = Math.max(
      0.1,
      0.4 -
        edge * 0.05 +
        (attackBias(away.tactics) - defenceBias(home.tactics)) * 0.3 -
        fatigueA * 0.5,
    )

    const roll = rand()
    if (roll < homeShare) {
      shots++
      const chance = Math.max(
        0.08,
        0.3 + edge * 0.02 + (home.chem - 55) / 400 - (defenceBias(away.tactics) - 0.5) * 0.25 + fatigueA * 0.3,
      )
      if (attack(H, A, homeXI, minute, 'home', chance)) homeGoals++
    } else if (roll < homeShare + awayShare) {
      shotsAgainst++
      const chance = Math.max(
        0.08,
        0.28 - edge * 0.02 + (away.chem - 55) / 400 - (defenceBias(home.tactics) - 0.5) * 0.25 + fatigueH * 0.3,
      )
      if (attack(A, H, awayXI, minute, 'away', chance)) awayGoals++
    } else {
      events.push({
        minute,
        kind: 'info',
        text: pick(INFO_LINES).replace('{o}', away.name),
        team: 'neutral',
      })
    }
  }

  events.push({
    minute: 90,
    kind: 'whistle',
    text: `Full time. ${home.name} ${homeGoals} - ${awayGoals} ${away.name}.`,
    team: 'neutral',
  })

  // ── Ratings ─────────────────────────────────────────────────────────────────
  const rate = (xi: Unit[], tactics: Tactics, scored: number, conceded: number): PlayerRating[] =>
    xi.map(({ p, slot }) => {
      const goals = scorers.get(p.id) ?? 0
      const assists = assisters.get(p.id) ?? 0
      const line = lineOf(slot.pos)

      let rating = 6.1 + (effectiveOvr(p) - 80) / 22
      rating += goals * 1.1 + assists * 0.6
      if (line === 'DEF' || line === 'GK') rating += conceded === 0 ? 0.8 : -0.22 * conceded
      if (line === 'MID') rating += (scored - conceded) * 0.16
      rating += (rand() - 0.45) * 1.1
      rating = Math.max(3.4, Math.min(10, Math.round(rating * 10) / 10))

      // Seven a side: fewer bodies, more ground each. Everyone runs harder.
      const effort = 0.62 + tactics.pressure / 200 + tactics.tempo / 300
      const positional = line === 'MID' ? 1.15 : line === 'GK' ? 0.28 : 1.02
      const staminaLost = Math.round(
        Math.max(4, 26 * effort * positional * (1 - (p.stats.phy - 60) / 220)),
      )

      const ovrDelta = rating >= 8.6 ? 1 : rating <= 5.2 ? -1 : 0

      return { playerId: p.id, rating, goals, assists, staminaLost, ovrDelta }
    })

  const possession = Math.max(
    28,
    Math.min(
      74,
      Math.round(
        50 +
          edge * 1.6 +
          (home.tactics.tempo < 45 ? 6 : -2) +
          (home.tactics.pressure - away.tactics.pressure) / 8,
      ),
    ),
  )

  return {
    homeName: home.name,
    awayName: away.name,
    homeGoals,
    awayGoals,
    events,
    ratings: rate(homeXI, home.tactics, homeGoals, awayGoals),
    awayRatings: rate(awayXI, away.tactics, awayGoals, homeGoals),
    possession,
    shots: Math.max(shots, homeGoals),
    shotsAgainst: Math.max(shotsAgainst, awayGoals),
    playedAt: Date.now(),
  }
}
