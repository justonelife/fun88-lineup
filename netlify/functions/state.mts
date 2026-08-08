import type { Context } from '@netlify/functions'
import { sql, transaction } from '../lib/db.ts'

const CODE_RE = /^fun88-[0-9A-HJ-NP-TV-Z]{8}$/
const APP_ID = 'fun88-lineup'
const HARD_CAP_BYTES = 4 * 1024 * 1024

// Sentinel version id for the (legacy / defensive) case where an incoming
// envelope carries no `activeVersionId`/`versions` of its own — a v3 blob or
// any single-squad payload. Real ids come from the client's `newVersionId()`
// (12 lowercase hex chars) and can never collide with this.
const FALLBACK_VERSION_ID = '__active__'

interface VersionMetaIn {
  id: string
  name: string
  updatedAt: number
}

interface Envelope {
  v: number
  app: string
  updatedAt: number
  device?: string
  state: { roster: unknown; [k: string]: unknown }
  activeVersionId?: string
  versions?: VersionMetaIn[]
  files?: Record<string, unknown>
}

interface TeamRow {
  active_version_id: string
  v: number
  device: string | null
  bytes: number
  updated_at: string
}

interface VersionRow {
  version_id: string
  name: string
  state: unknown
  updated_at: string
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function isEnvelope(v: unknown): v is Envelope {
  if (!v || typeof v !== 'object') return false
  const e = v as Partial<Envelope>
  return (
    typeof e.v === 'number' &&
    typeof e.updatedAt === 'number' &&
    e.app === APP_ID &&
    Boolean(e.state) &&
    typeof e.state === 'object' &&
    Boolean((e.state as { roster?: unknown }).roster) &&
    typeof (e.state as { roster?: unknown }).roster === 'object'
  )
}

function isVersionMeta(v: unknown): v is VersionMetaIn {
  if (!v || typeof v !== 'object') return false
  const m = v as Partial<VersionMetaIn>
  return typeof m.id === 'string' && typeof m.name === 'string' && typeof m.updatedAt === 'number'
}

interface VersionEntry {
  id: string
  name: string
  updatedAt: number
  position: number
  state: unknown
}

/** Flattens the envelope's version set (active version's `state` + every
 *  other version's `files[id]`) into the rows `versions` needs, preserving
 *  array order in `position`. Falls back to a single synthetic version when
 *  the envelope carries none — always includes the active state, since
 *  `isEnvelope` already guarantees it exists. */
function flattenVersions(envelope: Envelope): { activeId: string; entries: VersionEntry[] } {
  const suppliedMetas = envelope.versions?.filter(isVersionMeta) ?? []
  const activeId = envelope.activeVersionId ?? suppliedMetas[0]?.id ?? FALLBACK_VERSION_ID
  const metas = suppliedMetas.length ? suppliedMetas : [{ id: activeId, name: 'Version 1', updatedAt: envelope.updatedAt }]

  const entries: VersionEntry[] = []
  metas.forEach((meta, i) => {
    const state = meta.id === activeId ? envelope.state : envelope.files?.[meta.id]
    if (state === undefined) return
    entries.push({ id: meta.id, name: meta.name, updatedAt: meta.updatedAt, position: i, state })
  })
  if (!entries.some((e) => e.id === activeId)) {
    entries.push({ id: activeId, name: 'Version 1', updatedAt: envelope.updatedAt, position: entries.length, state: envelope.state })
  }
  return { activeId, entries }
}

export default async (req: Request, _ctx: Context) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code') ?? ''

  // Format check first: cheap DoS guard and the only "auth" this API has.
  if (!CODE_RE.test(code)) {
    return json({ error: 'Malformed team code.' }, 400)
  }

  if (req.method === 'GET') {
    const teamRows = await sql<TeamRow>`
      select active_version_id, v, device, bytes, updated_at
      from teams where team_code = ${code}
    `
    const team = teamRows[0]
    if (!team) return json({ error: 'Not found.' }, 404)

    if (url.searchParams.has('head')) {
      return json({
        updatedAt: Number(team.updated_at),
        device: team.device ?? undefined,
        v: team.v,
        bytes: team.bytes,
      })
    }

    const versionRows = await sql<VersionRow>`
      select version_id, name, state, updated_at
      from versions where team_code = ${code}
      order by position asc
    `
    const active = versionRows.find((r) => r.version_id === team.active_version_id)
    if (!active) return json({ error: 'Not found.' }, 404)

    const files: Record<string, unknown> = {}
    for (const row of versionRows) {
      if (row.version_id === team.active_version_id) continue
      files[row.version_id] = row.state
    }

    return json({
      v: team.v,
      app: APP_ID,
      updatedAt: Number(team.updated_at),
      device: team.device ?? undefined,
      state: active.state,
      activeVersionId: team.active_version_id,
      versions: versionRows.map((r) => ({ id: r.version_id, name: r.name, updatedAt: Number(r.updated_at) })),
      files,
    })
  }

  if (req.method === 'PUT') {
    const contentLength = Number(req.headers.get('content-length') ?? '0')
    if (contentLength > HARD_CAP_BYTES) {
      return json({ error: 'Squad is too big to sync.' }, 413)
    }
    const text = await req.text()
    if (text.length > HARD_CAP_BYTES) {
      return json({ error: 'Squad is too big to sync.' }, 413)
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return json({ error: 'Malformed JSON body.' }, 400)
    }
    if (!isEnvelope(parsed)) {
      return json({ error: 'Malformed envelope.' }, 400)
    }

    const ifUnmodifiedSince = req.headers.get('if-unmodified-since')
    if (ifUnmodifiedSince) {
      const guard = Number(ifUnmodifiedSince)
      const existing = await sql<Pick<TeamRow, 'updated_at'>>`
        select updated_at from teams where team_code = ${code}
      `
      const currentUpdatedAt = existing[0] ? Number(existing[0].updated_at) : undefined
      if (typeof currentUpdatedAt === 'number' && currentUpdatedAt > guard) {
        return json({ error: 'Squad changed on the server.' }, 409)
      }
    }

    const updatedAt = parsed.updatedAt
    const { activeId, entries } = flattenVersions(parsed)
    const versionIds = entries.map((e) => e.id)

    await transaction(async (client) => {
      await client.query(
        `insert into teams (team_code, active_version_id, v, device, bytes, updated_at)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (team_code) do update set
           active_version_id = excluded.active_version_id,
           v = excluded.v,
           device = excluded.device,
           bytes = excluded.bytes,
           updated_at = excluded.updated_at`,
        [code, activeId, parsed.v, parsed.device ?? null, text.length, updatedAt],
      )

      // The envelope always carries the whole version set, so anything not in
      // it was deleted on the client and must go here too.
      await client.query(`delete from versions where team_code = $1 and version_id <> all($2::text[])`, [
        code,
        versionIds,
      ])

      for (const entry of entries) {
        await client.query(
          `insert into versions (team_code, version_id, name, state, position, updated_at)
           values ($1, $2, $3, $4, $5, $6)
           on conflict (team_code, version_id) do update set
             name = excluded.name,
             state = excluded.state,
             position = excluded.position,
             updated_at = excluded.updated_at`,
          [code, entry.id, entry.name, entry.state, entry.position, entry.updatedAt],
        )
      }
    })

    return json({ updatedAt })
  }

  if (req.method === 'DELETE') {
    const deleted = await sql`delete from teams where team_code = ${code} returning team_code`
    if (!deleted.length) return json({ error: 'Not found.' }, 404)
    return new Response(null, { status: 204 })
  }

  return json({ error: 'Method not allowed.' }, 405)
}

export const config = { path: '/api/state' }
