import { getFormation } from '../data/formations'
import { effectiveOvr, lineOf, resolve, type Roster } from './chemistry'
import type { MatchEvent, MatchResult, Player, PlayerRating, Tactics } from '../types'

const OPPONENTS = [
  { name: 'Halberd FC', ovr: 84 },
  { name: 'Verdant Bay', ovr: 82 },
  { name: 'Iron Harbour', ovr: 86 },
  { name: 'Sable Rangers', ovr: 80 },
  { name: 'Crown Meridian', ovr: 88 },
  { name: 'Northgate SC', ovr: 83 },
  { name: 'Aurelia Sporting', ovr: 87 },
]

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
  '{p} is out quickly to smother it. Big moment.',
  'Fingertips! {p} turns it round the post.',
  '{p} stands tall and blocks it with the trailing leg.',
]

const AWAY_LINES = [
  '{o} break at pace down the left — dragged wide.',
  '{o} work it across the box but the final ball is heavy.',
  'A warning from {o} — the offside flag saves you.',
  '{o} force a corner. Cleared at the near post.',
]

const AWAY_GOAL_LINES = [
  '{o} punish the space in behind. Level again.',
  'Turned in at the back post — {o} score.',
  'A deflection loops in. Nothing anyone could do. {o} strike.',
]

const INFO_LINES = [
  'Your press is squeezing them into the corners.',
  'The midfield is starting to sit deeper — legs are going.',
  '{o} have changed shape, going long more often.',
  'Possession swinging your way now.',
  'The tempo has dropped. This is a chess match.',
]

interface Sim {
  roster: Roster
  lineup: (string | null)[]
  formationId: string
  tactics: Tactics
  teamOvr: number
  chem: number
}

export function simulateMatch({
  roster,
  lineup,
  formationId,
  tactics,
  teamOvr,
  chem,
}: Sim): MatchResult {
  const opponent = pick(OPPONENTS)
  const slots = getFormation(formationId).slots
  const xi = lineup
    .map((id, i) => ({ p: resolve(roster, id), slot: slots[i] }))
    .filter((x): x is { p: Player; slot: (typeof slots)[number] } => Boolean(x.p && x.slot))

  const attackers = xi.filter((x) => lineOf(x.slot.pos) === 'FWD' || x.slot.pos === 'CAM')
  const creators = xi.filter((x) => lineOf(x.slot.pos) === 'MID')
  const defenders = xi.filter((x) => lineOf(x.slot.pos) === 'DEF')
  const keeper = xi.find((x) => x.slot.pos === 'GK')

  // Strength model: rating + chemistry + tactical bias, versus opponent rating.
  const attackBias = 0.5 + tactics.mentality / 200 + tactics.tempo / 400
  const defenceBias = 0.5 + (100 - tactics.mentality) / 220 + (100 - tactics.lineHeight) / 400
  const edge = (teamOvr - opponent.ovr) / 8 + (chem - 55) / 40

  const events: MatchEvent[] = []
  let homeGoals = 0
  let awayGoals = 0
  let shots = 0
  let shotsAgainst = 0

  const scorers = new Map<string, number>()
  const assisters = new Map<string, number>()

  events.push({ minute: 0, kind: 'whistle', text: `Kick off against ${opponent.name}.`, team: 'neutral' })

  const beats = 16 + Math.floor(rand() * 5)
  const minutes = Array.from({ length: beats }, () => 1 + Math.floor(rand() * 89)).sort(
    (a, b) => a - b,
  )

  for (const minute of minutes) {
    // Late-game fatigue: pressing sides fade after 70'
    const fatigue = minute > 70 ? (tactics.pressure / 100) * 0.35 : 0
    const homeMomentum = 0.5 + edge * 0.06 + (attackBias - 0.5) * 0.5 - fatigue
    const roll = rand()

    if (roll < homeMomentum) {
      shots++
      const scorerPool = attackers.length ? attackers : xi
      const scorer = pick(scorerPool).p
      const goalChance = 0.3 + edge * 0.02 + (chem - 55) / 400
      if (rand() < goalChance) {
        homeGoals++
        scorers.set(scorer.id, (scorers.get(scorer.id) ?? 0) + 1)
        const helperPool = creators.length ? creators : xi
        const helper = pick(helperPool).p
        if (helper.id !== scorer.id) assisters.set(helper.id, (assisters.get(helper.id) ?? 0) + 1)
        events.push({
          minute,
          kind: 'goal',
          text: pick(GOAL_LINES).replace('{p}', scorer.name),
          team: 'home',
        })
      } else {
        events.push({
          minute,
          kind: 'chance',
          text: pick(CHANCE_LINES).replace('{p}', scorer.name),
          team: 'home',
        })
      }
    } else if (roll < homeMomentum + 0.28) {
      shotsAgainst++
      const concedeChance = 0.26 - edge * 0.015 + (60 - tactics.pressure) / 900 + fatigue * 0.4
      const stopper = keeper?.p ?? pick(defenders.length ? defenders : xi).p
      if (rand() < Math.max(0.05, concedeChance) * (1 - defenceBias * 0.3)) {
        awayGoals++
        events.push({
          minute,
          kind: 'goal',
          text: pick(AWAY_GOAL_LINES).replace('{o}', opponent.name),
          team: 'away',
        })
      } else if (rand() < 0.5) {
        events.push({
          minute,
          kind: 'save',
          text: pick(SAVE_LINES).replace('{p}', stopper.name),
          team: 'home',
        })
      } else {
        events.push({
          minute,
          kind: 'chance',
          text: pick(AWAY_LINES).replace('{o}', opponent.name),
          team: 'away',
        })
      }
    } else {
      events.push({
        minute,
        kind: 'info',
        text: pick(INFO_LINES).replace('{o}', opponent.name),
        team: 'neutral',
      })
    }
  }

  events.push({
    minute: 90,
    kind: 'whistle',
    text: `Full time. ${homeGoals} - ${awayGoals}.`,
    team: 'neutral',
  })

  // ── Ratings ───────────────────────────────────────────────────────────────
  const ratings: PlayerRating[] = xi.map(({ p, slot }) => {
    const goals = scorers.get(p.id) ?? 0
    const assists = assisters.get(p.id) ?? 0
    const line = lineOf(slot.pos)

    let rating = 6.1 + (effectiveOvr(p) - 80) / 22
    rating += goals * 1.1 + assists * 0.6
    if (line === 'DEF' || line === 'GK') rating += awayGoals === 0 ? 0.8 : -0.22 * awayGoals
    if (line === 'MID') rating += (homeGoals - awayGoals) * 0.16
    rating += (rand() - 0.45) * 1.1
    rating = Math.max(3.4, Math.min(10, Math.round(rating * 10) / 10))

    const effort = 0.55 + tactics.pressure / 220 + tactics.tempo / 320
    const positional = line === 'MID' ? 1.15 : line === 'GK' ? 0.28 : 1
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
      Math.round(50 + edge * 1.6 + (tactics.tempo < 45 ? 6 : -2) + (tactics.pressure - 50) / 6),
    ),
  )

  return {
    opponent: opponent.name,
    homeGoals,
    awayGoals,
    events,
    ratings,
    possession,
    shots: Math.max(shots, homeGoals),
    shotsAgainst: Math.max(shotsAgainst, awayGoals),
    playedAt: Date.now(),
  }
}
