export type Pos =
  | 'GK'
  | 'LB'
  | 'CB'
  | 'RB'
  | 'LWB'
  | 'RWB'
  | 'CDM'
  | 'CM'
  | 'CAM'
  | 'LM'
  | 'RM'
  | 'LW'
  | 'RW'
  | 'CF'
  | 'ST'

export type Line = 'GK' | 'DEF' | 'MID' | 'FWD'

export interface Stats {
  pac: number
  sho: number
  pas: number
  dri: number
  def: number
  phy: number
}

export interface Club {
  id: string
  name: string
  short: string
  primary: string
  secondary: string
}

export interface Player {
  id: string
  name: string
  /** Natural position. */
  pos: Pos
  /** Secondary positions the player is comfortable in. */
  alt: Pos[]
  ovr: number
  stats: Stats
  clubId: string
  nation: string
  /** 0-100, drains during matches. */
  stamina: number
  /** 1-5 star weak foot / skill flourish, purely cosmetic. */
  skill: number
  form: number
}

export interface Slot {
  /** Canonical index 0..10 — 0 is always the goalkeeper. */
  i: number
  pos: Pos
  /** Normalised pitch coordinates, 0-100. x: left→right, y: 0 = attacking end. */
  x: number
  y: number
}

export interface Formation {
  id: string
  name: string
  shape: string
  blurb: string
  slots: Slot[]
}

export interface Tactics {
  mentality: number // 0 ultra defensive .. 100 ultra attacking
  pressure: number
  width: number
  depth: number
  lineHeight: number
  tempo: number
}

export interface MatchEvent {
  minute: number
  kind: 'goal' | 'chance' | 'save' | 'card' | 'sub' | 'info' | 'whistle'
  text: string
  team: 'home' | 'away' | 'neutral'
}

export interface PlayerRating {
  playerId: string
  rating: number
  goals: number
  assists: number
  staminaLost: number
  ovrDelta: number
}

export interface MatchResult {
  opponent: string
  homeGoals: number
  awayGoals: number
  events: MatchEvent[]
  ratings: PlayerRating[]
  possession: number
  shots: number
  shotsAgainst: number
  playedAt: number
}
