import { foldPersisted, migrate as migrateSquadState, useSquad, type PersistedSquad } from '../store/useSquad'
import { ENVELOPE_VERSION, type SquadEnvelope } from './squadFile'

/** Excludes ambiguous glyphs 0/O and 1/I/L/U per the server-side format check
 *  in `netlify/functions/state.mts` — 33 symbols, 8 chars ≈ 41 bits. */
const CODE_ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTVWXYZ'
const CODE_RE = /^fun88-[0-9A-HJ-NP-TV-Z]{8}$/

export function generateCode(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  const body = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
  return `fun88-${body}`
}

/** Uppercase, strip separators/prefix, keep only alphabet chars, cap at 8 — so
 *  a pasted `fun88-7k3m-qp9x` or bare `7K3MQP9X` both normalise the same way. */
export function normaliseCode(input: string): string {
  let s = input.trim().toUpperCase().replace(/[\s-]/g, '')
  if (s.startsWith('FUN88')) s = s.slice(5)
  s = s.replace(/[^0-9A-Z]/g, '').slice(0, 8)
  return `fun88-${s}`
}

export function isValidCode(code: string): boolean {
  return CODE_RE.test(code)
}

export function formatCodeGrouped(code: string): string {
  const body = code.replace(/^fun88-/, '')
  return `fun88-${body.slice(0, 4)}-${body.slice(4, 8)}`
}

function platformLabel(): string {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iphone'
  if (/iPad/.test(ua)) return 'ipad'
  if (/Android/.test(ua)) return 'android'
  if (/Macintosh/.test(ua)) return 'mac'
  if (/Windows/.test(ua)) return 'windows'
  return 'device'
}

export function randomDeviceId(): string {
  const bytes = new Uint8Array(2)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${platformLabel()}-${hex}`
}

/** Cheap 32-bit hash — good enough to notice "nothing changed" and skip a PUT,
 *  not a security or dedup primitive. */
export function fnv1a(str: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

export function hashState(state: PersistedSquad): string {
  const json = JSON.stringify(state)
  return `${json.length}:${fnv1a(json)}`
}

export const SOFT_CAP_BYTES = 1_000_000
export const HARD_CAP_BYTES = 4_000_000

export function checkEnvelopeSize(envelope: SquadEnvelope): {
  bytes: number
  overSoft: boolean
  overHard: boolean
} {
  const bytes = new Blob([JSON.stringify(envelope)]).size
  return { bytes, overSoft: bytes > SOFT_CAP_BYTES, overHard: bytes > HARD_CAP_BYTES }
}

export class CloudError extends Error {
  status: number
  constructor(status: number) {
    super(`cloud request failed (${status})`)
    this.status = status
  }
}

export class CloudConflictError extends CloudError {
  constructor() {
    super(409)
  }
}

const endpoint = (code: string, extra?: string) =>
  `/api/state?code=${encodeURIComponent(code)}${extra ?? ''}`

export async function getState(code: string): Promise<SquadEnvelope | null> {
  const res = await fetch(endpoint(code))
  if (res.status === 404) return null
  if (!res.ok) throw new CloudError(res.status)
  return (await res.json()) as SquadEnvelope
}

export interface HeadInfo {
  updatedAt: number
  device?: string
  v: number
  bytes: number
}

export async function headState(code: string): Promise<HeadInfo | null> {
  const res = await fetch(endpoint(code, '&head=1'))
  if (res.status === 404) return null
  if (!res.ok) throw new CloudError(res.status)
  return (await res.json()) as HeadInfo
}

export async function putState(
  code: string,
  envelope: SquadEnvelope,
  ifUnmodifiedSince?: number,
): Promise<{ updatedAt: number }> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (ifUnmodifiedSince != null) headers['if-unmodified-since'] = String(ifUnmodifiedSince)
  const res = await fetch(endpoint(code), { method: 'PUT', headers, body: JSON.stringify(envelope) })
  if (res.status === 409) throw new CloudConflictError()
  if (!res.ok) throw new CloudError(res.status)
  return (await res.json()) as { updatedAt: number }
}

export async function deleteState(code: string): Promise<void> {
  const res = await fetch(endpoint(code), { method: 'DELETE' })
  if (!res.ok && res.status !== 404) throw new CloudError(res.status)
}

/** Resolves an envelope's `state` against the client's known schema version —
 *  refuses anything newer than we understand, migrates anything older, per
 *  plans/database.md §6.2. */
export function resolveEnvelopeState(envelope: SquadEnvelope): PersistedSquad | 'too-new' {
  if (envelope.v > ENVELOPE_VERSION) return 'too-new'
  if (envelope.v < ENVELOPE_VERSION) {
    return migrateSquadState(envelope.state, envelope.v) as unknown as PersistedSquad
  }
  return envelope.state
}

/** Folds a cloud envelope onto the live store through the same defences a
 *  persist rehydrate takes — never a raw `setState(envelope.state)`. */
export function adoptEnvelope(envelope: SquadEnvelope): 'ok' | 'too-new' {
  const state = resolveEnvelopeState(envelope)
  if (state === 'too-new') return 'too-new'
  useSquad.setState(foldPersisted(state, useSquad.getState()), true)
  return 'ok'
}
