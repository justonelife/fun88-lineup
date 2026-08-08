import { migrate as migrateSquadState, useSquad, type PersistedSquad } from '../store/useSquad'
import { toast } from '../store/useToast'
import { isCloudVersion, readFile, readIndex, type VersionMeta } from './versionStore'

/** Cloud envelope + file-export version. v4 added the version set (`versions`,
 *  `activeVersionId`, `files`); v3 and older carry a single squad in `state`
 *  and still read cleanly — see `resolveState`. */
export const ENVELOPE_VERSION = 4
export const APP_ID = 'fun88-lineup'

/**
 * The JSON shape written by export, read by import, and stored in the cloud
 * blob.
 *
 * `state` is the ACTIVE version's content and is byte-identical to what the
 * persist middleware ships — kept at the top level so a v3 reader (and the
 * Netlify function's envelope check, which only validates `v`/`app`/`state`)
 * keeps working untouched.
 *
 * `files` holds every NON-active version keyed by version id. The active one
 * lives in `state` and is never duplicated, so one blob per team code carries
 * the whole set at ~N × one squad.
 */
export interface SquadEnvelope {
  v: number
  app: string
  updatedAt: number
  device?: string
  state: PersistedSquad
  activeVersionId?: string
  versions?: VersionMeta[]
  files?: Record<string, PersistedSquad>
}

export function currentPersisted(): PersistedSquad {
  const s = useSquad.getState()
  return { roster: s.roster, home: s.home, away: s.away, activeSide: s.activeSide, lastMatch: s.lastMatch }
}

/** A single-version envelope — what one `fun88:version:<id>` file holds. */
export function makeEnvelope(state: PersistedSquad, updatedAt?: number): SquadEnvelope {
  return { v: ENVELOPE_VERSION, app: APP_ID, updatedAt: updatedAt ?? Date.now(), state }
}

/** The whole version set in one envelope: live state as the active version,
 *  every other version read back from its file. This is what gets pushed to
 *  the cloud and what "Export all" writes. Temporary (local-only) versions
 *  never leave the device — they are filtered out entirely, and if the
 *  version open on THIS device is temporary, the newest synced version
 *  stands in as the envelope's active version instead. */
export function buildEnvelope(device?: string): SquadEnvelope {
  const now = Date.now()
  const base: SquadEnvelope = { v: ENVELOPE_VERSION, app: APP_ID, updatedAt: now, device, state: currentPersisted() }
  const index = readIndex()
  if (!index) return base

  const cloudVersions = index.versions.filter(isCloudVersion)
  if (!cloudVersions.length) return base

  const localActiveIsCloud = cloudVersions.some((m) => m.id === index.activeVersionId)
  const activeMeta = localActiveIsCloud
    ? cloudVersions.find((m) => m.id === index.activeVersionId)!
    : cloudVersions.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a))

  const activeState = activeMeta.id === index.activeVersionId ? currentPersisted() : readFile(activeMeta.id)?.state
  if (!activeState) return base

  const files: Record<string, PersistedSquad> = {}
  for (const meta of cloudVersions) {
    if (meta.id === activeMeta.id) continue
    const file = readFile(meta.id)
    if (file) files[meta.id] = file.state
  }

  return {
    v: ENVELOPE_VERSION,
    app: APP_ID,
    updatedAt: now,
    device,
    state: activeState,
    activeVersionId: activeMeta.id,
    versions: cloudVersions,
    files,
  }
}

/** Resolves one squad payload against the client's known schema version —
 *  refuses anything newer than we understand, migrates anything older, per
 *  plans/database.md §6.2. */
export function resolveState(v: number, state: PersistedSquad): PersistedSquad | 'too-new' {
  if (v > ENVELOPE_VERSION) return 'too-new'
  if (v < ENVELOPE_VERSION) return migrateSquadState(state, v) as unknown as PersistedSquad
  return state
}

const pad = (n: number) => String(n).padStart(2, '0')

export function dateStamp(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** ASCII filename slug — "Trận K3" → "tran-k3", so the download name survives
 *  every filesystem the phone might hand it to. */
export function slug(name: string): string {
  const ascii = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
  return (
    ascii
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'squad'
  )
}

export function downloadEnvelope(envelope: SquadEnvelope, filename: string): void {
  const json = JSON.stringify(envelope, null, 2)
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Downloads every version in one file — `fun88-squad-YYYY-MM-DD.json`. */
export function exportSquad(): void {
  downloadEnvelope(buildEnvelope(), `fun88-squad-${dateStamp()}.json`)
  toast('All versions exported.', 'ok')
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

/** Reads and validates a dropped-in JSON file. Toasts and resolves null on
 *  anything that is not a fun88 export; the caller decides what to do with a
 *  good envelope. */
export async function parseEnvelopeFile(file: File): Promise<SquadEnvelope | null> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    toast('That file is not valid JSON.', 'danger')
    return null
  }
  if (!isEnvelopeish(parsed)) {
    toast('That file is not a fun88 squad export.', 'danger')
    return null
  }
  return parsed
}
