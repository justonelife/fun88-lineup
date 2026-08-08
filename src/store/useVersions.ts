import { create } from 'zustand'
import { foldPersisted, useSquad, type PersistedSquad } from './useSquad'
import { toast } from './useToast'
import {
  ENVELOPE_VERSION,
  currentPersisted,
  dateStamp,
  downloadEnvelope,
  makeEnvelope,
  parseEnvelopeFile,
  resolveState,
  slug,
  type SquadEnvelope,
} from '../lib/squadFile'
import {
  deleteFile,
  isCloudVersion,
  MAX_CLOUD_VERSIONS,
  newVersionId,
  readFile,
  readIndex,
  writeFile,
  writeIndex,
  type VersionMeta,
  type VersionsIndex,
} from '../lib/versionStore'

/** Long enough that a drag or a slider sweep is one write, short enough that a
 *  tab kill after a tap loses nothing — `pagehide` flushes synchronously too. */
const FLUSH_MS = 700

const TOO_NEW_MSG = 'That squad was saved by a newer version of the app. Refresh the page.'

interface VersionsState {
  activeVersionId: string
  versions: VersionMeta[]

  /** Name a "New version" button would suggest — `Version N`, never a dupe. */
  nextName: () => string
  createVersion: (name?: string) => void
  selectVersion: (id: string) => void
  renameVersion: (id: string, name: string) => void
  deleteVersion: (id: string) => void
  exportVersion: (id: string) => void
  importFile: (file: File) => Promise<boolean>
  /** Installs a cloud envelope's whole version set over this device's. */
  adoptEnvelope: (envelope: SquadEnvelope, activeState: PersistedSquad) => void
  /** Debounced write of the live squad into the active version's file. */
  markDirty: () => void
  flushActive: () => void
}

/** Promotes the newest temporary version to `cloud: true` if a cloud slot is
 *  free, so deleting a synced version backfills the cap from local-only ones. */
function promoteTemporary(versions: VersionMeta[]): VersionMeta[] {
  const cloudCount = versions.filter(isCloudVersion).length
  if (cloudCount >= MAX_CLOUD_VERSIONS) return versions
  const temps = versions.filter((v) => !isCloudVersion(v))
  if (!temps.length) return versions
  const winner = temps.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a))
  toast(`Version ${winner.name} is now in the cloud.`, 'ok')
  return versions.map((v) => (v.id === winner.id ? { ...v, cloud: true } : v))
}

function uniqueName(want: string, taken: Set<string>): string {
  const base = want.trim() || 'Version'
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) {
    const candidate = `${base} (${n})`
    if (!taken.has(candidate)) return candidate
  }
}

/* First run — including the first run after this feature shipped — turns
 * whatever the persist middleware just rehydrated into "Version 1", so an
 * existing squad becomes a version instead of being replaced by one. */
function ensureSeed(): VersionsIndex {
  const existing = readIndex()
  if (existing) {
    if (!readFile(existing.activeVersionId)) {
      writeFile(existing.activeVersionId, makeEnvelope(currentPersisted()))
    }
    return existing
  }
  const id = newVersionId()
  const now = Date.now()
  writeFile(id, makeEnvelope(currentPersisted(), now))
  const index: VersionsIndex = { activeVersionId: id, versions: [{ id, name: 'Version 1', updatedAt: now }] }
  writeIndex(index)
  return index
}

const seed = ensureSeed()

export const useVersions = create<VersionsState>()((set, get) => {
  let timer: number | null = null

  const cancel = () => {
    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }
  }

  /** The one write path into a version file. */
  const flush = () => {
    cancel()
    const { activeVersionId, versions } = get()
    const now = Date.now()
    writeFile(activeVersionId, makeEnvelope(currentPersisted(), now))
    const next = versions.map((v) => (v.id === activeVersionId ? { ...v, updatedAt: now } : v))
    writeIndex({ activeVersionId, versions: next })
    set({ versions: next })
  }

  /** Swaps the live store over to another version's content. Callers set the
   *  new `activeVersionId` FIRST, so the flush this setState schedules can only
   *  ever target the right file — then we cancel it anyway, because the file we
   *  just read from is already identical. */
  const load = (state: PersistedSquad) => {
    useSquad.setState(foldPersisted(state, useSquad.getState()), true)
    cancel()
  }

  const commit = (index: VersionsIndex) => {
    writeIndex(index)
    set({ activeVersionId: index.activeVersionId, versions: index.versions })
  }

  return {
    activeVersionId: seed.activeVersionId,
    versions: seed.versions,

    nextName: () => {
      const taken = new Set(get().versions.map((v) => v.name))
      let n = get().versions.length + 1
      while (taken.has(`Version ${n}`)) n++
      return `Version ${n}`
    },

    // "Save as…": the live board stays exactly where it is and becomes the
    // seed of a new file, so nothing on screen moves when you branch.
    createVersion: (name) => {
      flush()
      const { versions } = get()
      const id = newVersionId()
      const now = Date.now()
      const label = uniqueName(name?.trim() || get().nextName(), new Set(versions.map((v) => v.name)))
      const cloudCount = versions.filter(isCloudVersion).length
      const cloud = cloudCount < MAX_CLOUD_VERSIONS
      writeFile(id, makeEnvelope(currentPersisted(), now))
      commit({ activeVersionId: id, versions: [{ id, name: label, updatedAt: now, cloud }, ...versions] })
      if (cloud) {
        toast(`"${label}" created.`, 'ok')
      } else {
        toast(
          `Cloud limit reached (${MAX_CLOUD_VERSIONS}) — this version is temporary and stays on this device. Export/import to share it.`,
          'danger',
        )
      }
    },

    selectVersion: (id) => {
      const { activeVersionId, versions } = get()
      if (id === activeVersionId) return
      if (!versions.some((v) => v.id === id)) return
      // Whatever is on screen belongs to the version you are leaving.
      flush()
      const file = readFile(id)
      if (!file) {
        toast('That version could not be loaded.', 'danger')
        return
      }
      const state = resolveState(file.v, file.state)
      if (state === 'too-new') {
        toast(TOO_NEW_MSG, 'danger')
        return
      }
      commit({ activeVersionId: id, versions: get().versions })
      load(state)
    },

    renameVersion: (id, name) => {
      const trimmed = name.trim()
      if (!trimmed) return
      const { activeVersionId, versions } = get()
      if (!versions.some((v) => v.id === id)) return
      const taken = new Set(versions.filter((v) => v.id !== id).map((v) => v.name))
      const label = uniqueName(trimmed, taken)
      commit({ activeVersionId, versions: versions.map((v) => (v.id === id ? { ...v, name: label } : v)) })
    },

    deleteVersion: (id) => {
      const { activeVersionId, versions } = get()
      if (!versions.some((v) => v.id === id)) return
      const remaining = versions.filter((v) => v.id !== id)
      deleteFile(id)

      // Freed cloud slot: the newest temporary version claims it, so the cap
      // never sits under 10 while a local-only version is waiting.
      const promoted = promoteTemporary(remaining)

      if (id !== activeVersionId) {
        commit({ activeVersionId, versions: promoted })
        return
      }
      cancel()

      // Deleting the last version leaves a fresh board rather than no app.
      if (!remaining.length) {
        useSquad.getState().resetAll()
        const fresh = newVersionId()
        const now = Date.now()
        writeFile(fresh, makeEnvelope(currentPersisted(), now))
        commit({ activeVersionId: fresh, versions: [{ id: fresh, name: 'Version 1', updatedAt: now, cloud: true }] })
        cancel()
        toast('All versions deleted — started a fresh Version 1.', 'warn')
        return
      }

      const next = promoted.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a))
      const file = readFile(next.id)
      commit({ activeVersionId: next.id, versions: promoted })
      const state = file ? resolveState(file.v, file.state) : null
      if (state && state !== 'too-new') load(state)
      toast(`Switched to "${next.name}".`, 'ok')
    },

    exportVersion: (id) => {
      const { activeVersionId, versions } = get()
      const meta = versions.find((v) => v.id === id)
      if (!meta) return
      // The active version's truth is the live store, not its (debounced) file.
      const envelope = id === activeVersionId ? makeEnvelope(currentPersisted()) : readFile(id)
      if (!envelope) {
        toast('That version could not be read.', 'danger')
        return
      }
      downloadEnvelope(
        { ...envelope, activeVersionId: id, versions: [meta] },
        `fun88-${slug(meta.name)}-${dateStamp()}.json`,
      )
      toast(`"${meta.name}" exported.`, 'ok')
    },

    /* Import ADDS versions and never overwrites one: every squad in the file
     * lands under a fresh id, so re-importing your own backup can't silently
     * eat the board you are standing on. */
    importFile: async (file) => {
      const envelope = await parseEnvelopeFile(file)
      if (!envelope) return false
      if (envelope.v > ENVELOPE_VERSION) {
        toast(TOO_NEW_MSG, 'danger')
        return false
      }
      flush()

      const sourceActive = envelope.activeVersionId ?? envelope.versions?.[0]?.id ?? 'imported'
      const sources: VersionMeta[] = envelope.versions?.length
        ? envelope.versions
        : [{ id: sourceActive, name: `Imported ${dateStamp()}`, updatedAt: envelope.updatedAt }]

      const taken = new Set(get().versions.map((v) => v.name))
      const added: VersionMeta[] = []
      let activeId: string | null = null

      for (const source of sources) {
        const raw = source.id === sourceActive ? envelope.state : envelope.files?.[source.id]
        if (!raw) continue
        const state = resolveState(envelope.v, raw)
        if (state === 'too-new') continue
        const id = newVersionId()
        const updatedAt = source.updatedAt || envelope.updatedAt
        if (!writeFile(id, makeEnvelope(state, updatedAt))) continue
        const name = uniqueName(source.name, taken)
        taken.add(name)
        added.push({ id, name, updatedAt })
        if (source.id === sourceActive) activeId = id
      }

      if (!added.length) {
        toast('That file has no squad data.', 'danger')
        return false
      }

      const target = added.find((v) => v.id === activeId) ?? added[0]
      commit({ activeVersionId: target.id, versions: [...added, ...get().versions] })
      const file2 = readFile(target.id)
      if (file2) load(file2.state)
      toast(added.length > 1 ? `${added.length} versions imported.` : `"${target.name}" imported.`, 'ok')
      return true
    },

    adoptEnvelope: (envelope, activeState) => {
      cancel()
      const metas = envelope.versions?.filter((m) => m.id)

      // A v3 blob (or any single-squad envelope) carries no set: it replaces
      // the content of the version this device is standing on, nothing else.
      if (!metas?.length) {
        const { activeVersionId, versions } = get()
        writeFile(activeVersionId, makeEnvelope(activeState, envelope.updatedAt))
        commit({
          activeVersionId,
          versions: versions.map((v) =>
            v.id === activeVersionId ? { ...v, updatedAt: envelope.updatedAt } : v,
          ),
        })
        load(activeState)
        return
      }

      // Full set: the remote ids win outright, so two devices converge on one
      // id space instead of accumulating renamed duplicates of each other.
      const activeId = metas.some((m) => m.id === envelope.activeVersionId)
        ? (envelope.activeVersionId as string)
        : metas[0].id
      for (const local of get().versions) deleteFile(local.id)
      for (const meta of metas) {
        const raw = meta.id === activeId ? activeState : envelope.files?.[meta.id]
        if (raw) writeFile(meta.id, makeEnvelope(raw, meta.updatedAt))
      }
      const kept = metas.filter((m) => readFile(m.id))
      if (!kept.length) return
      commit({ activeVersionId: kept.some((m) => m.id === activeId) ? activeId : kept[0].id, versions: kept })
      load(activeState)
    },

    markDirty: () => {
      cancel()
      timer = window.setTimeout(flush, FLUSH_MS)
    },

    flushActive: flush,
  }
})

/** Reactive active-version name — the Header label and the sheet title. */
export const useActiveVersionName = () =>
  useVersions((s) => s.versions.find((v) => v.id === s.activeVersionId)?.name ?? 'Version 1')

// Every squad mutation belongs to the version that is currently open.
useSquad.subscribe(() => useVersions.getState().markDirty())
