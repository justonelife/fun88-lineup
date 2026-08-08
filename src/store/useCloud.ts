import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useSquad } from './useSquad'
import { toast } from './useToast'
import { buildEnvelope, type SquadEnvelope } from '../lib/squadFile'
import {
  CloudConflictError,
  adoptEnvelope,
  checkEnvelopeSize,
  deleteState,
  formatCodeGrouped,
  generateCode,
  getState,
  hashState,
  headState,
  isValidCode,
  normaliseCode,
  putState,
  randomDeviceId,
} from '../lib/cloud'

export type CloudStatus = 'local' | 'saved' | 'saving' | 'offline' | 'conflict' | 'error'

/** Status pill styling shared by the Header dot and the Cloud sheet header —
 *  per plans/database.md §5.1. `local` renders as a hollow ring, not a fill. */
export const CLOUD_STATUS_META: Record<CloudStatus, { label: string; dot: string; pulse?: boolean }> = {
  local: { label: 'Local', dot: 'transparent' },
  saved: { label: 'Saved', dot: 'var(--color-chem-strong)' },
  saving: { label: 'Saving…', dot: 'var(--color-gold-400)', pulse: true },
  offline: { label: 'Offline', dot: 'var(--color-chem-weak)' },
  error: { label: 'Offline', dot: 'var(--color-chem-weak)' },
  conflict: { label: 'Conflict', dot: 'var(--color-away-400)', pulse: true },
}

const DEBOUNCE_MS = 3000
const BACKUP_KEY = 'fun88:cloud:backup'
const TOO_NEW_MSG = 'This squad was saved by a newer version of the app. Refresh the page.'

function snapshotBackup() {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(buildEnvelope()))
  } catch {
    /* best-effort — a failed snapshot must not block the adopt */
  }
}

function hasBackup(): boolean {
  try {
    return Boolean(localStorage.getItem(BACKUP_KEY))
  } catch {
    return false
  }
}

interface CloudState {
  code: string | null
  auto: boolean
  device: string
  lastPushedAt: number | null
  lastPulledAt: number | null
  status: CloudStatus
  conflictEnvelope: SquadEnvelope | null
  hasBackup: boolean

  displayCode: () => string | null
  setAuto: (on: boolean) => void
  createCode: () => Promise<void>
  joinCode: (raw: string) => Promise<boolean>
  pushNow: () => Promise<void>
  pullNow: () => Promise<void>
  unlink: () => void
  deleteRemote: () => Promise<void>
  keepMine: () => Promise<void>
  takeTheirs: () => Promise<void>
  restoreBackup: () => void
  bootSync: () => Promise<void>
  markDirty: () => void
  onVisible: () => void
  onOnline: () => void
  flushBeacon: () => void
}

export const useCloud = create<CloudState>()(
  persist(
    (set, get) => {
      let pushTimer: number | null = null
      let inFlight = false
      let dirtyDuringFlight = false
      let lastHash = ''

      const clearTimer = () => {
        if (pushTimer !== null) {
          window.clearTimeout(pushTimer)
          pushTimer = null
        }
      }

      const scheduleDirty = () => {
        const s = get()
        if (!s.code || !s.auto) return
        clearTimer()
        pushTimer = window.setTimeout(() => void doPush(), DEBOUNCE_MS)
      }

      /** The one write path: debounced from `markDirty`, and reused (with the
       *  stale-write guard dropped) by "Save now" and "Keep mine". */
      const doPush = async (opts?: { guard?: boolean }) => {
        const s = get()
        if (!s.code) return
        if (inFlight) {
          dirtyDuringFlight = true
          return
        }
        if (!navigator.onLine) {
          set({ status: 'offline' })
          return
        }
        const envelope = buildEnvelope(s.device)
        const size = checkEnvelopeSize(envelope)
        if (size.overHard) {
          toast(
            `Squad is too big to sync (${(size.bytes / 1e6).toFixed(1)} MB). Remove some uploaded photos.`,
            'danger',
          )
          return
        }
        const hash = hashState(envelope.state)
        if (hash === lastHash) {
          set({ status: 'saved' })
          return
        }
        if (size.overSoft) {
          toast(
            `Squad is ${(size.bytes / 1e6).toFixed(1)} MB — cloud saves are getting slow; consider gallery photos instead of uploads.`,
            'warn',
          )
        }
        inFlight = true
        set({ status: 'saving' })
        try {
          const guardTs = opts?.guard === false ? undefined : (s.lastPulledAt ?? undefined)
          const res = await putState(s.code, envelope, guardTs)
          lastHash = hash
          set({ status: 'saved', lastPushedAt: res.updatedAt, lastPulledAt: res.updatedAt })
        } catch (err) {
          if (err instanceof CloudConflictError) {
            try {
              const server = await getState(s.code)
              set({ status: 'conflict', conflictEnvelope: server })
              toast('Someone else saved. Keep yours or take theirs.', 'warn')
            } catch {
              set({ status: 'error' })
            }
          } else {
            set({ status: 'offline' })
            toast("Couldn't save to cloud — will retry.", 'warn')
          }
        } finally {
          inFlight = false
          if (dirtyDuringFlight) {
            dirtyDuringFlight = false
            scheduleDirty()
          }
        }
      }

      const adopt = (envelope: SquadEnvelope): boolean => {
        const result = adoptEnvelope(envelope)
        if (result === 'too-new') {
          toast(TOO_NEW_MSG, 'danger')
          set({ status: 'error' })
          return false
        }
        lastHash = hashState(envelope.state)
        return true
      }

      return {
        code: null,
        auto: true,
        device: randomDeviceId(),
        lastPushedAt: null,
        lastPulledAt: null,
        status: 'local',
        conflictEnvelope: null,
        hasBackup: hasBackup(),

        displayCode: () => {
          const code = get().code
          return code ? formatCodeGrouped(code) : null
        },

        setAuto: (on) => {
          set({ auto: on })
          if (on) scheduleDirty()
          else clearTimer()
        },

        createCode: async () => {
          const code = generateCode()
          set({ code, status: 'saving' })
          try {
            const envelope = buildEnvelope(get().device)
            const res = await putState(code, envelope)
            lastHash = hashState(envelope.state)
            set({ lastPushedAt: res.updatedAt, lastPulledAt: res.updatedAt, status: 'saved' })
            toast('Squad saved to the cloud.', 'ok')
          } catch {
            set({ status: 'error' })
            toast("Couldn't save to cloud — will retry.", 'warn')
          }
        },

        joinCode: async (raw) => {
          const code = normaliseCode(raw)
          if (!isValidCode(code)) {
            toast('That code looks wrong — check and try again.', 'danger')
            return false
          }
          set({ status: 'saving' })
          try {
            const envelope = await getState(code)
            if (!envelope) {
              toast('No squad found for that code.', 'danger')
              set({ status: 'local' })
              return false
            }
            snapshotBackup()
            if (!adopt(envelope)) return false
            set({
              code,
              lastPulledAt: envelope.updatedAt,
              lastPushedAt: envelope.updatedAt,
              status: 'saved',
              hasBackup: true,
            })
            toast('Squad updated from cloud.', 'ok')
            return true
          } catch {
            set({ status: 'offline' })
            toast('Offline — changes are saved on this device.', 'warn')
            return false
          }
        },

        pushNow: () => doPush(),

        pullNow: async () => {
          const s = get()
          if (!s.code) return
          try {
            const envelope = await getState(s.code)
            if (!envelope) {
              toast('No squad found for that code.', 'danger')
              return
            }
            snapshotBackup()
            if (!adopt(envelope)) return
            set({
              lastPulledAt: envelope.updatedAt,
              lastPushedAt: envelope.updatedAt,
              status: 'saved',
              hasBackup: true,
            })
            toast('Squad updated from cloud.', 'ok')
          } catch {
            set({ status: 'offline' })
            toast('Offline — changes are saved on this device.', 'warn')
          }
        },

        unlink: () => {
          clearTimer()
          set({ code: null, status: 'local', conflictEnvelope: null })
        },

        deleteRemote: async () => {
          const s = get()
          if (!s.code) return
          try {
            await deleteState(s.code)
            toast('Cloud copy deleted.', 'ok')
          } catch {
            toast("Couldn't reach the cloud — try again.", 'danger')
            return
          }
          clearTimer()
          set({ code: null, status: 'local', conflictEnvelope: null })
        },

        keepMine: async () => {
          set({ conflictEnvelope: null })
          await doPush({ guard: false })
        },

        takeTheirs: async () => {
          const envelope = get().conflictEnvelope
          if (!envelope) return
          snapshotBackup()
          if (!adopt(envelope)) {
            set({ conflictEnvelope: null })
            return
          }
          set({
            conflictEnvelope: null,
            status: 'saved',
            lastPulledAt: envelope.updatedAt,
            lastPushedAt: envelope.updatedAt,
            hasBackup: true,
          })
        },

        restoreBackup: () => {
          try {
            const raw = localStorage.getItem(BACKUP_KEY)
            if (!raw) return
            adoptEnvelope(JSON.parse(raw) as SquadEnvelope)
            toast('Restored previous squad.', 'ok')
          } catch {
            toast('Could not restore backup.', 'danger')
          }
        },

        // Boot sequence per plans/database.md §3.2 — local persist has already
        // rehydrated and painted by the time this runs.
        bootSync: async () => {
          const s = get()
          if (!s.code) return
          if (!navigator.onLine) {
            set({ status: 'offline' })
            return
          }
          try {
            const envelope = await getState(s.code)
            if (!envelope) {
              set({ status: 'local' })
              toast('Cloud copy for this code was removed. Re-create in cloud from the sheet.', 'warn')
              return
            }
            const pushed = s.lastPushedAt ?? 0
            if (envelope.updatedAt > pushed) {
              if (!adopt(envelope)) return
              set({ lastPulledAt: envelope.updatedAt, lastPushedAt: envelope.updatedAt, status: 'saved' })
              toast('Squad updated from cloud.', 'ok')
            } else if (envelope.updatedAt < pushed) {
              set({ status: 'saved' })
              scheduleDirty()
            } else {
              set({ status: 'saved' })
            }
          } catch {
            set({ status: 'offline' })
          }
        },

        markDirty: () => scheduleDirty(),

        // Cheap freshness check on refocus — metadata only, no body fetch.
        onVisible: () => {
          const s = get()
          if (!s.code || !s.auto || !navigator.onLine) return
          void headState(s.code)
            .then((head) => {
              if (head && head.updatedAt > (get().lastPushedAt ?? 0)) {
                void get().pullNow()
              }
            })
            .catch(() => {})
        },

        onOnline: () => {
          if (get().code) void get().bootSync()
        },

        // Best-effort flush for `pagehide` / `visibilitychange → hidden`; a
        // background tab may be killed before a normal fetch resolves.
        flushBeacon: () => {
          const s = get()
          if (!s.code || !s.auto) return
          const envelope = buildEnvelope(s.device)
          const size = checkEnvelopeSize(envelope)
          if (size.overHard) return
          const hash = hashState(envelope.state)
          if (hash === lastHash) return
          clearTimer()
          void fetch(`/api/state?code=${encodeURIComponent(s.code)}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            keepalive: true,
            body: JSON.stringify(envelope),
          }).catch(() => {})
        },
      }
    },
    {
      name: 'fun88:cloud',
      partialize: (s) => ({
        code: s.code,
        auto: s.auto,
        device: s.device,
        lastPushedAt: s.lastPushedAt,
        lastPulledAt: s.lastPulledAt,
      }),
    },
  ),
)

// The only network trigger in the app: every squad mutation marks the cloud
// link dirty. No code linked ⇒ `markDirty` no-ops ⇒ zero requests.
useSquad.subscribe(() => useCloud.getState().markDirty())
