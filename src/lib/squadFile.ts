import { foldPersisted, useSquad, type PersistedSquad } from '../store/useSquad'
import { toast } from '../store/useToast'

/** Cloud envelope + file-export version — kept numerically aligned with the
 *  zustand persist version (see useSquad.ts) so there is one number to reason
 *  about, per plans/database.md §6. */
export const ENVELOPE_VERSION = 3
export const APP_ID = 'fun88-lineup'

/** The JSON shape written by export, read by import, and stored in the cloud
 *  blob — `state` is byte-identical to what the persist middleware ships. */
export interface SquadEnvelope {
  v: number
  app: string
  updatedAt: number
  device?: string
  state: PersistedSquad
}

function currentPersisted(): PersistedSquad {
  const s = useSquad.getState()
  return { roster: s.roster, home: s.home, away: s.away, activeSide: s.activeSide, lastMatch: s.lastMatch }
}

export function buildEnvelope(device?: string): SquadEnvelope {
  return { v: ENVELOPE_VERSION, app: APP_ID, updatedAt: Date.now(), device, state: currentPersisted() }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Downloads the current squad as `fun88-squad-YYYY-MM-DD.json`. */
export function exportSquad(): void {
  const envelope = buildEnvelope()
  const json = JSON.stringify(envelope, null, 2)
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const d = new Date()
  const a = document.createElement('a')
  a.href = url
  a.download = `fun88-squad-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  toast('Squad exported.', 'ok')
}

function isEnvelopeish(v: unknown): v is SquadEnvelope {
  if (!v || typeof v !== 'object') return false
  const e = v as Partial<SquadEnvelope>
  return (
    typeof e.v === 'number' &&
    typeof e.updatedAt === 'number' &&
    Boolean(e.state) &&
    typeof e.state === 'object' &&
    Boolean((e.state as Partial<PersistedSquad>).roster) &&
    typeof (e.state as Partial<PersistedSquad>).roster === 'object'
  )
}

/** Parses, validates and folds a dropped-in JSON file through the same path
 *  a persist rehydrate takes, then replaces the live store. */
export async function importSquad(file: File): Promise<boolean> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    toast('That file is not valid JSON.', 'danger')
    return false
  }
  if (!isEnvelopeish(parsed)) {
    toast('That file is not a fun88 squad export.', 'danger')
    return false
  }
  useSquad.setState(foldPersisted(parsed.state, useSquad.getState()), true)
  toast('Squad imported.', 'ok')
  return true
}
