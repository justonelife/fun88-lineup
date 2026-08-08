# Lightweight database for fun88-lineup — design plan

**Status:** design only. No app code changes in this pass.
**Date:** 2026-08-08
**Target:** `fun88-lineup.netlify.app` (Netlify **Free** plan, direct CLI deploys)
**Recommendation:** **Netlify Blobs + one Netlify Function**, shipped behind a team code, with **export/import JSON** as the always-there escape hatch.

---

## 0. Ground truth (what exists today)

| Fact | Where |
| --- | --- |
| State lives in zustand `persist`, key `ultra-xi:squad`, **version 2**, localStorage only | `src/store/useSquad.ts:342-344` |
| Persisted shape = `partialize` → `{ roster, home, away, activeSide, lastMatch }` | `src/store/useSquad.ts:345-351` |
| `merge()` re-folds seeds into a saved roster and keeps user-created players | `src/store/useSquad.ts:353-371` |
| `normaliseTeam()` already defends against half-written payloads (7 slots / 7 bench) | `src/store/useSquad.ts:394-407` |
| `migrate()` v1→v2 exists, with a try/catch fallback that never bricks the app | `src/store/useSquad.ts:424-501` |
| localStorage writes are quota-guarded and best-effort (toast, no crash) | `src/store/useSquad.ts:122-140` |
| Photos: `photo?: string` — "256px JPEG **data URL**" or a `lh3.googleusercontent.com` URL | `src/types.ts` (`Player.photo`), `src/components/PhotoPicker.tsx` |
| Toast entry point usable from stores, not just components | `src/store/useToast.ts` (`toast()`) |
| Build/publish + SPA catch-all only, no functions dir | `netlify.toml` |
| Site is linked, siteId `43c14082-…` | `.netlify/state.json` |

**Payload size, measured-ish:** 50 seeded players ≈ 9.7 KB of TS source → ~15-20 KB as JSON; both `TeamSlice`s + `lastMatch` add ~5-10 KB. **Baseline ≈ 25-35 KB.** That is tiny.
The one thing that blows it up is **data-URL photos**: a 256px JPEG is 10-40 KB base64 *each*. 20 uploaded portraits = +0.4-0.8 MB. This is the single sizing risk in the whole design — see §2.4.

---

## 1. Options comparison

### Free-tier numbers (verified 2026-08-08 from docs.netlify.com)

Netlify is now **credit-based**, not quota-based. This changes the arithmetic:

| Metered thing | Rate | Source |
| --- | --- | --- |
| Free plan allowance | **300 credits/month, hard limit**, no top-up, no auto-recharge | `docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/` |
| Over budget | **all projects paused** — visitors get "Site not available" | same, "how-credits-work" |
| Bandwidth | **20 credits / GB** | same |
| Web requests | **2 credits / 10,000 requests** | same |
| Compute (Functions, DB) | **10 credits / GB-hour** | same |
| **Production deploy** | **15 credits each** | same |
| Blobs storage $/GB-month | **NOT PUBLISHED — UNCERTAIN.** Only unofficial staff word (June 2024, forum): "customers get 100 GB for free, additional GB 9 cents/month", explicitly hedged as non-final | `answers.netlify.com/t/blobs-pricing-and-limits/119907` |
| Blobs read/write op pricing | **NOT PUBLISHED — UNCERTAIN.** Blob ops appear to be billed as function compute + web requests, not separately | absence in both billing docs |
| Blobs hard limits | object ≤ **5 GB**, key ≤ **600 bytes**, metadata ≤ **2 KB**, store name ≤ 64 bytes | `docs.netlify.com/build/data-and-storage/netlify-blobs/` |
| Blobs consistency | **eventual by default**, propagates ≤ **60 s**; opt-in `consistency: "strong"` per store or per call | same |
| Netlify Database (Neon) free | 3 DBs, **5 GB storage**, **48 compute units/period**, 5 GB written, 5 GB egress, **sleeps after 5 min idle (fixed)**, max 1 compute unit. Storage free **until 2026-07-01** — that date has **passed**, so storage is now billed | `docs.netlify.com/build/data-and-storage/netlify-database/billing-and-usage/` |

> ⚠️ **The real free-tier constraint for this project is not storage — it is deploys.**
> 15 credits/deploy × 300 credits = **~20 production deploys per month before the site is paused.** The owner deploys directly from the CLI. Whatever database we pick, *deploy frequency* costs more than *data*. Budget accordingly (batch changes, use deploy previews sparingly).

### Cost of this app's sync traffic, priced out

Assume 300 KB worst-case payload, 1 000 saves + 500 loads per month (generous for one team):

- bandwidth: 1 500 × 300 KB = 0.45 GB → **9 credits**
- web requests: 1 500 → **0.3 credits**
- function compute: 1 500 × ~150 ms × 1 GB ≈ 0.06 GB-h → **0.6 credits**
- **≈ 10 credits/month ≈ 3 % of the free allowance.** Less than one deploy.

At the realistic 35 KB payload it is **~1 credit/month**. Sync is free in practice; deploys are not.

### Scorecard (1-5, higher = better for *this* app)

| Criterion | A. Netlify Blobs | B. Netlify DB (Postgres) | C. Supabase | D. localStorage + export/import |
| --- | --- | --- | --- | --- |
| Fit for ~30-300 KB single JSON doc | **5** — a doc store is exactly this | 2 — a relational engine for one row | 3 — same, plus a `state` jsonb column | **5** |
| Free-tier headroom | **5** (~10 credits/mo) | 3 (compute units + storage now billed) | 4 (generous, but a separate account) | **5** (zero) |
| Setup friction | **4** — `npm i @netlify/blobs`, 1 function, already linked | 2 — `netlify db init`, driver, migrations | 2 — new account, project, keys, env vars, RLS | **5** |
| Maintenance / things that can break | **4** — one key, LWW, no schema | 2 — schema, migrations, cold starts (5-min sleep) | 3 — vendor dashboard, key rotation, project pausing | **5** |
| Multi-device sync value | **5** | 5 | 5 | **1** — manual file passing |
| Offline-first behaviour | 4 (cache in localStorage) | 4 | 4 | **5** |
| Auth story needed | 4 — capability code is enough | 3 | 2 — real auth exists but is overkill and must be wired | **5** |
| Reversibility | **5** — delete a blob key, delete a file | 3 | 2 | **5** |
| Cold-start latency | **5** — no sleep | 2 — **DB sleeps after 5 min, fixed on Free** | 4 | **5** |
| **Total (of 45)** | **41** | 26 | 29 | **41** |

### Verdict

**A and D tie on score, and that is the honest result** — so ship **both, in that order of dependency**:

1. **D is not a fallback, it is a feature.** Export/import JSON is ~60 lines, needs no server, gives the owner a real backup, and is the disaster recovery path when anything about the cloud misbehaves. Build it first. It is genuinely enough if the owner is the *only* person who ever edits, on *one* device.
2. **A is the recommendation** because the stated use case is "the owner **+ teammates** manage ONE squad". The moment a second phone exists, D means emailing JSON files around, and that is worse UX than a 6-character code. Blobs costs one function file and one npm dep.

**B is overturned explicitly:** the Free-plan database **sleeps after 5 minutes of inactivity and that is not configurable**. A pickup-football app is used in bursts — every session would eat a cold start to read 30 KB. Postgres for a single JSON document is the wrong shape twice over.

**C is overturned** on friction: a second vendor account, keys in env vars, RLS policies, and a project that can be paused for inactivity — to store one document that Netlify will hold for free inside the deploy we already have.

---

## 2. Data model & schema

### 2.1 Team code

```
fun88-<8 chars from Crockford base32, no ambiguous 0/O/1/I/L/U>
e.g. fun88-7K3MQP9X
```

- 8 chars × 32 symbols = **40 bits ≈ 1.1 × 10¹²** — unguessable by brute force against a rate-limited function.
- Generated client-side with `crypto.getRandomValues`. No server round-trip to "register" it; the first PUT creates the blob.
- Displayed **grouped** (`fun88-7K3M-QP9X`) and normalised on input: uppercase, strip dashes/spaces, reject anything outside the alphabet **before** it reaches the network.
- Well under the 600-byte key limit.

### 2.2 Blob layout

One store, one key per team. Store name `squads` (≤ 64 bytes, no `/` or `:` — fine).

```
store "squads"
 └── key "fun88-7K3MQP9X"   → the envelope below
```

Blob **metadata** (≤ 2 KB) carries the cheap header so a poll can decide "do I even need the body":

```jsonc
{ "updatedAt": 1786000000000, "device": "iphone-3f2a", "v": 3, "bytes": 34210 }
```

### 2.3 Envelope (the stored JSON)

```jsonc
{
  "v": 3,                       // cloud envelope version — see §6
  "updatedAt": 1786000000000,   // ms epoch, set by the CLIENT that wrote it
  "device": "iphone-3f2a",      // random per-install id, for "saved from another device"
  "app": "fun88-lineup",
  "state": {                    // === exactly zustand's partialize output ===
    "roster":     { "<id>": { /* Player */ } },
    "home":       { /* TeamSlice */ },
    "away":       { /* TeamSlice */ },
    "activeSide": "home",
    "lastMatch":  null
  }
}
```

**`state` is byte-identical to what `partialize` already produces** (`useSquad.ts:345-351`). That is the whole trick: the cloud stores the same object localStorage stores, so `merge()`/`normaliseTeam()`/`migrate()` already defend the cloud path for free. No second schema, no second validator.

`subFlash` is deliberately excluded (it is not in `partialize`) — it is ephemeral animation state and must never travel.

### 2.4 Photos — the one sizing decision

`Player.photo` is either an `https://lh3.googleusercontent.com/...` URL (cheap, ~100 bytes) or a **data URL** (10-40 KB each).

**Recommendation: photos stay inside the envelope as strings — but with a client-side guard.**

- Before PUT, compute `JSON.stringify(envelope).length`.
- **Soft cap 1 MB**: warn via toast ("Squad is 1.2 MB — cloud saves are getting slow; consider gallery photos instead of uploads").
- **Hard cap 4 MB**: refuse to save, toast, tell the user which players carry the biggest data URLs. (Blobs allows 5 GB; the cap is about *bandwidth credits* and mobile upload time, not the store.)
- Do **not** build a separate per-photo blob store in v1. It doubles the op count, adds orphan cleanup, and the realistic squad is 15-25 players. Revisit only if the hard cap actually gets hit.
- Nudge the existing `PhotoPicker` toward the Google-CDN hotlink path in the UI copy, since it is ~400× smaller. (Copy change only, no logic change — and out of scope for this plan's code phase.)

### 2.5 What lives where

| | localStorage (`ultra-xi:squad`) | Blob (`squads/<code>`) |
| --- | --- | --- |
| Role | **offline cache + instant boot** | **durable source of truth** |
| Written | every state change (existing persist) | debounced, ~3 s after last change |
| Read | synchronously at boot, before paint | async after boot, may overwrite |
| Survives | until the browser evicts it | until the key is deleted |
| Contains | full `partialize` state | envelope wrapping the same state |

Plus a **separate, small** localStorage key — never inside the squad blob:

```jsonc
// key: "fun88:cloud"
{ "code": "fun88-7K3MQP9X", "auto": true, "device": "iphone-3f2a",
  "lastPulledAt": 1786000000000, "lastPushedAt": 1786000000000 }
```

Keeping the link config out of the synced document means "which team am I" is per-device and can never be clobbered by a pull.

---

## 3. Sync strategy

### 3.1 Conflict resolution: **last-write-wins on `updatedAt`. Explicitly. No CRDT, no merge.**

This is stated as a decision, not a compromise. One team, a handful of trusted editors, a document that is fully re-derivable by hand in two minutes. Anything smarter costs more code than the problem is worth, and Netlify Blobs itself is documented as "last write wins; no built-in concurrency control" — fighting that would mean building a lock.

The one place LWW hurts (two people editing simultaneously on match day) is mitigated by *visibility*, not by merging — see the conflict banner in §3.3.

### 3.2 Boot sequence

```
1. localStorage rehydrates (existing persist)      → UI paints immediately, offline-capable
2. if (!cloud.code) → done. App behaves exactly as today.
3. GET /api/state?code=…                            → envelope | 404
4. compare cloud.updatedAt vs local lastPushedAt / local updatedAt
   ├─ cloud newer  → adopt cloud (see below), toast "Squad updated from cloud"
   ├─ cloud older  → schedule a push (local wins, we are the newer writer)
   ├─ equal        → nothing
   └─ 404          → first-run push (§6)
5. offline / 5xx → keep local, status = Offline, retry on `online` + on next change
```

**"Adopt cloud" must not bypass the existing defences.** Feed the envelope's `state` through the same path a rehydrate takes:

```
useSquad.setState(mergeLikePersist(cloudState), true)
```

i.e. reuse `merge()`'s roster-folding and `normaliseTeam()` rather than `setState(raw)`. Practically: extract the body of `merge()` into an exported `foldPersisted(saved, current)` and call it from both places. This is the only refactor the store needs.

### 3.3 Write path

- **Debounce 3 s** after the last mutation, plus a **hard flush** on `visibilitychange → hidden` and `pagehide` (mobile users background the app mid-edit; use `navigator.sendBeacon` or `fetch(..., {keepalive:true})` for that flush).
- **Coalesce**: one in-flight PUT at a time; if changes land during a PUT, mark dirty and re-PUT once it returns.
- **Skip no-ops**: hash (`JSON.stringify` length + a cheap FNV-1a) the payload; identical → no request. Kills the "drag a token 2 px, burn a request" pattern.
- Every PUT stamps a fresh `updatedAt = Date.now()` client-side and stores it as `lastPushedAt`.
- **Stale-write guard (optional, cheap):** send `If-Unmodified-Since: <lastPulledAt>`; function compares against the stored `updatedAt` and returns **409** if the cloud moved underneath us. Client then shows the **Conflict** state: "Someone else saved from another device. [Keep mine] [Take theirs]". Two buttons, no merge. If this proves annoying, drop it and let LWW run silently — the fallback is safe.
- **Never auto-save when the app is not linked.** No code → no network at all.

### 3.4 Read path / multi-device

- Manual **"Load from code"**: enter the code on device 2 → GET → adopt → the local persist takes over.
- On `visibilitychange → visible` after > 60 s hidden, do a **cheap freshness check** (GET; the function returns only metadata when `?head=1`). If `updatedAt` is newer, adopt. Note Blobs' **eventual consistency: an update may take up to 60 s to appear at another edge**. Two mitigations, pick one:
  - accept it (a 60 s lag between two phones is fine for this app), **or**
  - use `consistency: "strong"` on the store — recommended here, since the total op volume is negligible and correctness-of-what-you-see beats latency. **Recommend strong.**
- **No polling loop.** No websockets. No realtime. Focus-based refresh + manual pull covers the actual usage (people open the app, edit, close it).

### 3.5 Offline-first

The app already works fully offline today and must keep doing so. Cloud sync is **strictly additive**: every failure mode degrades to "exactly the app as it is now, plus a status pill saying Offline". Never block the UI on a network call, never show a spinner over the pitch, never lose a local edit because a PUT failed.

---

## 4. API & security

### 4.1 Endpoint

One function, two methods.

`netlify/functions/state.mts`

```ts
import { getStore } from '@netlify/blobs'
import type { Context } from '@netlify/functions'

export default async (req: Request, _ctx: Context) => { /* … */ }

export const config = { path: '/api/state' }   // Functions v2 routing
```

| Method | Request | Response |
| --- | --- | --- |
| `GET /api/state?code=…` | — | `200` envelope · `404` unknown code · `400` malformed code |
| `GET /api/state?code=…&head=1` | — | `200 { updatedAt, device, v, bytes }` (metadata only, no body read) |
| `PUT /api/state?code=…` | envelope JSON | `200 { updatedAt }` · `409` stale (if guard on) · `413` too large · `400` malformed |
| `DELETE /api/state?code=…` | — | `204` (used by "Unlink & delete cloud copy") |

Implementation notes:

- `getStore({ name: 'squads', consistency: 'strong' })` — site-wide store, **not** `getDeployStore`: a deploy store is scoped to one deploy and the data would vanish on the next `netlify deploy`. **This is the single most important line in the whole design.**
- `store.setJSON(code, envelope, { metadata: { updatedAt, device, v, bytes } })`, read with `store.getWithMetadata(code, { type: 'json' })`.
- Validate the code server-side against `/^fun88-[0-9A-HJ-NP-TV-Z]{8}$/` **before** touching the store — this is also the cheap DoS guard.
- Reject bodies over ~4 MB (`content-length` check first, then actual length) with `413`.
- Reject envelopes whose `app !== 'fun88-lineup'` or whose `state.roster` is not an object — a 5-line sanity check, so a garbage PUT cannot make every future GET throw.

### 4.2 Security model — say it plainly

**The team code is a capability, exactly like a Google Docs "anyone with the link" URL.** Anyone who has it can read *and overwrite* the squad. There is no auth, no accounts, no per-user identity. That is a deliberate trade:

| | |
| --- | --- |
| **What is protected** | Guessing: 40 bits, plus a server-side format check and Netlify's own edge rate limiting. Nobody stumbles onto the squad. |
| **What is not protected** | Anyone the code is shared with — or anyone who screenshots it in a group chat — has full write access. A malicious holder can wipe the squad. |
| **Blast radius** | Player names, made-up ratings, and photos of amateur footballers. No PII of consequence, no money, nothing regulated. Worst case is "someone messed up our lineup" — recoverable from any teammate's localStorage or an exported JSON. |
| **Data at rest** | Blobs are documented as encrypted at rest and in transit. |

**Hardening — recommended: only #1.**

1. **Export/import JSON (option D) is the backup.** This is the real mitigation and it is free. Ship it. Also: auto-`localStorage` snapshot of the last-adopted cloud envelope under `fun88:cloud:backup` so "Take theirs" is undoable.
2. *Optional, cheap-ish:* **owner PIN**. 4 digits, client hashes `sha256(code + pin)` and sends it as `x-fun88-pin`; the function compares against a hash stored in blob metadata. Blocks writes, not reads. ~25 lines. **Ship only if the owner asks** — it adds a "I forgot the PIN" support path that is worse than the risk it removes.
3. *Rejected as not cheap:* separate owner-code / viewer-code. Needs two keys or an index blob, a share UI, and a mental model ("which code did I give them?"). The app has no read-only mode to give a viewer anyway.

Also: **do not log the code** in function logs.

### 4.3 CORS & the SPA catch-all

Same-origin only — the app and the function share `fun88-lineup.netlify.app`, so **no CORS headers are needed**. If the owner ever wants to hit the API from `localhost:5173` against production, add `Access-Control-Allow-Origin` for that origin explicitly rather than `*`. (Normal dev uses `netlify dev`, which proxies both on one origin — no CORS either.)

**Redirect ordering matters.** `netlify.toml` currently ends with `/* → /index.html 200`. A catch-all that runs before function routing turns `/api/state` into the HTML shell, and the client gets `Unexpected token '<'`. Two belts:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"

# Declared BEFORE the SPA catch-all.
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/state"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

…**and** keep `export const config = { path: '/api/state' }` in the function (Functions v2 path routing, the pattern used in the time-tracker project). Either alone should work; both together means the ordering bug simply cannot happen. Verify with `curl -i https://fun88-lineup.netlify.app/api/state?code=fun88-AAAAAAAA` → expect `404` JSON, **not** `200 text/html`.

---

## 5. UI plan

There is no settings screen and one should not be invented for this. Two touch points:

### 5.1 Entry point — a status pill in the `Header`

`src/components/Header.tsx` already has a centre column (`VS` + `Play`). Add a **fourth, tiny element**: a status dot + label under the `Play` button, or at the far right of the second row next to `7 a side` (that row is the quieter one — prefer it).

```
[ ●  Saved ]      ← tap opens the Cloud sheet
```

States (dot colour + label):

| State | Dot | Label |
| --- | --- | --- |
| not linked | grey, hollow | `Local` |
| idle, synced | `--color-chem-strong` | `Saved` |
| pending / in flight | gold, pulsing | `Saving…` |
| offline / last push failed | `--color-chem-weak` | `Offline` |
| stale-write 409 | amber, pulsing | `Conflict` |

When not linked, the pill is nearly invisible — the app must not nag.

### 5.2 The Cloud sheet

A bottom sheet in the existing modal idiom (`PlayerSheet.tsx` / `PhotoPicker.tsx` are the templates — reuse their overlay, spring, and the **touch-close fix** from commit `9c34e43`; do not hand-roll a new modal).

**Not linked:**

```
Cloud sync
Keep this squad on every phone.

  [ Create team code ]      ← generates + first push
  [ Join with a code   ]    ← input, normalised, GET, adopt

  ── or ──
  [ Export JSON ]  [ Import JSON ]
```

**Linked:**

```
Cloud sync                          ● Saved
Team code   fun88-7K3M-QP9X   [Copy]
Last saved  2 min ago · from iPhone

  Auto-save   [====O]  on
  [ Save now ]     [ Load from cloud ]

  [ Export JSON ]  [ Import JSON ]
  [ Unlink this device ]            ← local only, blob untouched
  [ Delete cloud copy ]             ← destructive, confirm dialog
```

- **Auto-save toggle** persists in `fun88:cloud.auto`. Off ⇒ manual `Save now` only, and the pill shows `Unsaved` when local is ahead.
- **`Load from cloud`** and **`Take theirs`** both snapshot the current local state to `fun88:cloud:backup` first and offer an **Undo** in the toast for the toast's lifetime.
- **`Delete cloud copy`** requires typing the last 4 characters of the code. It is the only irreversible button in the sheet.

### 5.3 Errors

All through the existing `toast()` (`src/store/useToast.ts`) — no new surface:

| Situation | Tone | Copy |
| --- | --- | --- |
| PUT failed, will retry | `warn` | `Couldn't save to cloud — will retry.` |
| Offline | `warn` | `Offline — changes are saved on this device.` |
| Code not found | `danger` | `No squad found for that code.` |
| Payload > hard cap | `danger` | `Squad is too big to sync (4.2 MB). Remove some uploaded photos.` |
| Adopted a newer cloud state | `ok` | `Squad updated from cloud.` |
| Conflict | `warn` | `Someone else saved. Keep yours or take theirs.` → opens the sheet |

### 5.4 First-run flow for a *new* teammate

1. Owner taps **Copy**, pastes `fun88-7K3M-QP9X` into the group chat.
2. Teammate opens the site → sees `Local` → taps → **Join with a code** → pastes.
3. GET → adopt → persist writes it locally → done. Their default seeded squad is replaced (with a backup snapshot kept, per §5.2).

*Nice-to-have, not v1:* deep link `https://fun88-lineup.netlify.app/#/join/fun88-7K3MQP9X` that pre-fills the sheet. The SPA catch-all already serves any path, so this costs ~10 lines — but it also means the code ends up in browser history and link previews. **Recommend hash-based (`#/join/…`) if built at all**, since fragments are not sent to the server or CDN logs.

---

## 6. Migration

Three separate versionings; keep them separate on purpose.

### 6.1 zustand persist: v2 → **v3**

The persisted *shape* does not change. The bump exists to give the migration a home and to mark "this build knows about the cloud".

```ts
version: 3,
migrate: (persisted, version) => {
  const s = migrate(persisted, version)   // existing v1→v2 logic, unchanged
  return s                                 // v2→v3 is a no-op today
}
```

Because the current `migrate()` already ends with `if (version >= 2) return state`, the change is one line plus a `version: 3`. Existing users' state passes straight through. **The v1→v2 path must not be touched.**

### 6.2 Cloud envelope: `v: 3`

Independent counter. The function stores it and never interprets it. The **client** handles it on read:

```
envelope.v > CURRENT  → refuse to adopt; toast "This squad was saved by a newer
                        version of the app. Refresh the page."   (safety valve:
                        never let an old client overwrite a new schema)
envelope.v < CURRENT  → run the same migrate() chain over envelope.state, adopt,
                        then push back at CURRENT
envelope.v = CURRENT  → adopt
```

Keep `CURRENT` numerically aligned with the persist version so there is exactly one number to reason about.

### 6.3 One-time push of an existing local squad

When an existing localStorage-only user taps **Create team code**:

1. Generate the code, write `fun88:cloud`.
2. PUT the *current* local state as the initial envelope (**not** a fresh default squad — this is the whole point).
3. Toast `Squad saved to the cloud.`

No implicit/automatic push ever. A user who never opens the sheet **never talks to the network**, and their app is byte-for-byte what it is today. That is the compatibility guarantee: **cloud sync is opt-in per device, forever.**

Edge case: a code exists in `fun88:cloud` but GET returns 404 (blob deleted from another device). Treat as "not linked, but remember the code": show `Local`, and offer **`Re-create in cloud`** rather than silently re-pushing.

---

## 7. Implementation order & effort

### Phase 0 — export/import (ship alone, no infra) · ~1.5 h

| File | Change |
| --- | --- |
| `src/lib/squadFile.ts` **(new)** | `exportSquad()` → `Blob` download `fun88-squad-YYYY-MM-DD.json` (envelope shape, `v`, `updatedAt`); `importSquad(file)` → parse, validate, fold through `foldPersisted`, `setState` |
| `src/store/useSquad.ts` | export `foldPersisted(saved, current)` — lift the body of the existing `merge` (`:353-371`) so both persist and import use one code path. **Behaviour-neutral refactor.** |
| `src/components/CloudSheet.tsx` **(new)** | sheet shell + the two file buttons only |
| `src/components/Header.tsx` | pill + sheet mount |

Independently useful, and it is the recovery path for everything below.

### Phase 1 — the function · ~1.5 h

| File | Change |
| --- | --- |
| `package.json` | `+ @netlify/blobs`, `+ @netlify/functions` (types) |
| `netlify/functions/state.mts` **(new)** | GET / GET?head / PUT / DELETE, `getStore({name:'squads',consistency:'strong'})`, code regex, size cap, `export const config = { path: '/api/state' }` |
| `netlify.toml` | `[functions] directory`, `/api/*` redirect **above** the catch-all |
| `tsconfig.node.json` | include `netlify/**` (or give the functions dir its own tsconfig so `tsc -b` covers it) |

Verify with `netlify dev` + `curl` before any UI exists.

### Phase 2 — the sync client · ~3 h

| File | Change |
| --- | --- |
| `src/lib/cloud.ts` **(new)** | `getState(code)`, `putState(code, env)`, `headState(code)`, `del(code)`; code generate/normalise/validate; envelope build/parse |
| `src/store/useCloud.ts` **(new)** | zustand store: `{ code, auto, status, lastPushedAt, lastPulledAt, device }`, own tiny persist under `fun88:cloud`; actions `link/join/pushNow/pullNow/unlink/deleteRemote`; debounce + coalesce + dirty flag lives here |
| `src/store/useSquad.ts` | `version: 3`; **one** `subscribe` hook (outside the store, in `useCloud`) → `useSquad.subscribe(markDirty)`. Do **not** put network code in the persist middleware — it makes the store untestable and couples save-to-disk with save-to-cloud. |
| `src/main.tsx` | boot: `useCloud.getState().bootSync()` after mount; `visibilitychange` / `online` / `pagehide` listeners |

**Explicit design decision: no custom zustand middleware.** An external `subscribe` + a separate store is less clever and much easier to disable.

### Phase 3 — UI polish · ~2 h

Full sheet (§5.2), status pill states, conflict flow, toasts, size-cap warnings.

**Total ≈ 8 h**, of which phases 0-1 (≈ 3 h) are independently shippable.

### Test plan

Manual, headless-verifiable — no test framework exists in this repo and this plan does not add one.

1. **Round-trip (the acceptance test).** Link → make a distinctive edit (rename a player `ZZTEST`) → wait for `Saved` → `localStorage.clear()` → reload → enter the code → **`ZZTEST` is back**.
2. **Function contract, no browser:**
   ```bash
   netlify dev &
   curl -s -X PUT 'http://localhost:8888/api/state?code=fun88-TESTTEST' \
        -H 'content-type: application/json' \
        -d '{"v":3,"app":"fun88-lineup","updatedAt":1,"state":{"roster":{}}}'
   curl -s 'http://localhost:8888/api/state?code=fun88-TESTTEST' | head -c 200
   curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:8888/api/state?code=nope'      # 400
   curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:8888/api/state?code=fun88-AAAAAAAA'  # 404
   ```
   Note: `netlify dev` uses a **sandboxed local blob store** — local data is not production data. Re-run test 1 against the deployed URL once.
3. **Routing regression:** deployed `curl -i /api/state?code=…` returns `application/json`, not `text/html`. This is the failure mode of the catch-all redirect and must be checked *after every* `netlify.toml` change.
4. **Offline:** DevTools → Offline → edit → pill shows `Offline`, no console errors, edits survive reload. Back online → auto-push, pill returns to `Saved`.
5. **Two devices:** same code on desktop + phone; edit on A, foreground B → B adopts within one focus event. (With `consistency: 'strong'`, immediately.)
6. **LWW/conflict:** edit both while B is offline → bring B online → verify the 409 banner (or, with the guard off, that the later `updatedAt` wins and nothing crashes).
7. **Size cap:** upload 30 data-URL photos → warning at 1 MB, refusal at 4 MB, app still fully usable.
8. **Not-linked users:** with `fun88:cloud` absent, open DevTools Network and confirm **zero** requests to `/api/*` across a full session.
9. **Migration:** hand-write a v1 payload into `ultra-xi:squad`, load, confirm the existing v1→v2 path still runs and the result pushes cleanly at `v: 3`.

### Reversibility

Every layer unwinds independently, which is why this design is worth doing at all:

- **Per device:** *Unlink* → back to today's app, local data untouched.
- **Per team:** *Delete cloud copy* (or `netlify blobs:delete squads fun88-…` from the CLI) → the key is gone; every device keeps its localStorage.
- **Per build:** delete `netlify/functions/state.mts` + the two `netlify.toml` blocks + the `CloudSheet` mount. `useSquad.ts` is left with a `version: 3` no-op migration and an exported `foldPersisted` — both harmless.
- **Cost:** at zero traffic the feature costs zero credits. It cannot quietly drain the 300-credit budget; only deploys can (§1).

---

## 8. Decisions to confirm before coding

1. **Ship phase 0 alone first?** (export/import in one sitting, then decide whether the cloud is even wanted) — **recommended yes.**
2. **PIN or no PIN** (§4.2 hardening #2). Default: **no**.
3. **Stale-write 409 guard on or off** (§3.3). Default: **on**, easy to drop.
4. **Deep link `#/join/<code>`** in v1? Default: **no**.

## 9. Open / uncertain

- **Blobs storage and operation pricing is not published.** The only figure found is an explicitly-hedged June 2024 forum post (100 GB free, $0.09/GB after). At ~35 KB-3 MB total this is irrelevant either way, but it is not a documented guarantee. Re-check before storing anything large.
- Whether blob ops are additionally metered as **web requests** beyond the function invocation itself is not documented. Assume yes; the math in §1 already counts the request.
- The Netlify Database "storage free until 2026-07-01" line is now **past**, so option B has a live storage bill of unspecified size — another reason it is not the pick.
