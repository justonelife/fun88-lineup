import { toast } from '../store/useToast'
import type { SquadEnvelope } from './squadFile'

/* One squad = one named version = one JSON file in localStorage.
 *
 *   fun88:versions          → the index  { activeVersionId, versions[] }
 *   fun88:version:<id>      → that version's file (a whole SquadEnvelope)
 *
 * This module is the storage layer only: no zustand, no React, no network — so
 * both the versions store and the cloud adopt path can drive it without a
 * circular import. */

export const INDEX_KEY = 'fun88:versions'
export const FILE_PREFIX = 'fun88:version:'

export const fileKey = (id: string) => `${FILE_PREFIX}${id}`

export interface VersionMeta {
  id: string
  name: string
  updatedAt: number
  note?: string
}

export interface VersionsIndex {
  activeVersionId: string
  /** Creation order, newest first — deliberately NOT sorted by `updatedAt`, or
   *  the list would reshuffle under the thumb on every edit. */
  versions: VersionMeta[]
}

export function newVersionId(): string {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/* Same best-effort contract as the squad persist middleware: a full disk keeps
 * the session alive in memory and warns once, rather than throwing inside a
 * setState. N versions cost roughly N × one squad, so this is reachable. */
let quotaWarned = false
function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    quotaWarned = false
    return true
  } catch {
    if (!quotaWarned) {
      quotaWarned = true
      toast('Storage is full — delete a version or a photo to free space.', 'warn')
    }
    return false
  }
}

function isMeta(v: unknown): v is VersionMeta {
  if (!v || typeof v !== 'object') return false
  const m = v as Partial<VersionMeta>
  return typeof m.id === 'string' && typeof m.name === 'string' && typeof m.updatedAt === 'number'
}

/** Reads the index, repairing anything a hand-edit or half-write could break:
 *  junk entries are dropped and a dangling `activeVersionId` falls back to the
 *  first surviving version. Returns null when there is nothing usable. */
export function readIndex(): VersionsIndex | null {
  const raw = readJSON<Partial<VersionsIndex>>(INDEX_KEY)
  if (!raw || !Array.isArray(raw.versions)) return null
  const versions = raw.versions.filter(isMeta)
  if (!versions.length) return null
  const activeVersionId = versions.some((v) => v.id === raw.activeVersionId)
    ? (raw.activeVersionId as string)
    : versions[0].id
  return { activeVersionId, versions }
}

export function writeIndex(index: VersionsIndex): boolean {
  return writeJSON(INDEX_KEY, index)
}

export function readFile(id: string): SquadEnvelope | null {
  const env = readJSON<SquadEnvelope>(fileKey(id))
  if (!env || typeof env.v !== 'number' || !env.state || typeof env.state !== 'object') return null
  return env
}

export function writeFile(id: string, envelope: SquadEnvelope): boolean {
  return writeJSON(fileKey(id), envelope)
}

export function deleteFile(id: string): void {
  try {
    localStorage.removeItem(fileKey(id))
  } catch {
    /* nothing to do — a removal that fails leaves a harmless orphan */
  }
}
