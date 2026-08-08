import { getStore } from '@netlify/blobs'
import type { Context } from '@netlify/functions'

// Same-store, site-wide (see plans/database.md §4.1) — a *deploy* store would
// vanish on every `netlify deploy`. Strong consistency: op volume is
// negligible and correctness-of-what-you-see beats the eventual-consistency
// latency window.
const STORE_NAME = 'squads'
const CODE_RE = /^fun88-[0-9A-HJ-NP-TV-Z]{8}$/
const APP_ID = 'fun88-lineup'
const HARD_CAP_BYTES = 4 * 1024 * 1024

interface Envelope {
  v: number
  app: string
  updatedAt: number
  device?: string
  state: { roster: unknown; [k: string]: unknown }
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

export default async (req: Request, _ctx: Context) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code') ?? ''

  // Format check first: cheap DoS guard and the only "auth" this API has.
  if (!CODE_RE.test(code)) {
    return json({ error: 'Malformed team code.' }, 400)
  }

  const store = getStore({ name: STORE_NAME, consistency: 'strong' })

  if (req.method === 'GET') {
    if (url.searchParams.has('head')) {
      const meta = await store.getMetadata(code)
      if (!meta) return json({ error: 'Not found.' }, 404)
      return json(meta.metadata)
    }
    const entry = await store.getWithMetadata(code, { type: 'json' })
    if (!entry) return json({ error: 'Not found.' }, 404)
    return json(entry.data)
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
      const meta = await store.getMetadata(code)
      const currentUpdatedAt = (meta?.metadata as { updatedAt?: number } | undefined)?.updatedAt
      if (typeof currentUpdatedAt === 'number' && currentUpdatedAt > guard) {
        return json({ error: 'Squad changed on the server.' }, 409)
      }
    }

    const updatedAt = parsed.updatedAt
    const metadata = { updatedAt, device: parsed.device, v: parsed.v, bytes: text.length }
    await store.setJSON(code, parsed, { metadata })
    return json({ updatedAt })
  }

  if (req.method === 'DELETE') {
    await store.delete(code)
    return new Response(null, { status: 204 })
  }

  return json({ error: 'Method not allowed.' }, 405)
}

export const config = { path: '/api/state' }
