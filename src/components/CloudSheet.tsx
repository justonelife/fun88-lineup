import { useRef, useState } from 'react'
import { Sheet } from './ui/Sheet'
import { Tappable } from './ui/Tappable'
import { CLOUD_STATUS_META, useCloud } from '../store/useCloud'
import { formatCodeGrouped } from '../lib/cloud'
import { exportSquad, importSquad } from '../lib/squadFile'
import { toast } from '../store/useToast'

interface Props {
  open: boolean
  onClose: () => void
}

function timeAgo(ts: number | null): string {
  if (!ts) return 'never'
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

function Divider({ text }: { text: string }) {
  return (
    <div className="my-3 flex items-center gap-2 text-2xs text-ink-faint">
      <span className="h-px flex-1 bg-hairline" />
      {text}
      <span className="h-px flex-1 bg-hairline" />
    </div>
  )
}

function FileButtons({ onImported }: { onImported?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <div className="grid grid-cols-2 gap-2">
      <Tappable ariaLabel="Export JSON" onTap={exportSquad} className="tap btn-ghost rounded-xl px-3 py-2.5">
        <span className="display text-xs tracking-wide">Export JSON</span>
      </Tappable>
      <Tappable
        ariaLabel="Import JSON"
        onTap={() => fileRef.current?.click()}
        className="tap btn-ghost rounded-xl px-3 py-2.5"
      >
        <span className="display text-xs tracking-wide">Import JSON</span>
      </Tappable>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          void importSquad(file).then((ok) => {
            if (ok) onImported?.()
          })
        }}
      />
    </div>
  )
}

function ConflictPanel() {
  const { keepMine, takeTheirs, conflictEnvelope } = useCloud((s) => ({
    keepMine: s.keepMine,
    takeTheirs: s.takeTheirs,
    conflictEnvelope: s.conflictEnvelope,
  }))
  return (
    <div className="panel mt-3 px-3.5 py-3" style={{ borderColor: 'color-mix(in srgb, var(--color-away-400) 50%, transparent)' }}>
      <p className="text-xs text-ink-muted">
        Someone else saved from another device{conflictEnvelope?.device ? ` (${conflictEnvelope.device})` : ''}.
        Choose which squad to keep.
      </p>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <Tappable ariaLabel="Keep mine" onTap={() => void keepMine()} className="tap btn-primary rounded-xl px-3 py-2.5">
          <span className="display text-xs tracking-wide">Keep mine</span>
        </Tappable>
        <Tappable
          ariaLabel="Take theirs"
          onTap={() => void takeTheirs()}
          className="tap btn-ghost rounded-xl px-3 py-2.5"
        >
          <span className="display text-xs tracking-wide">Take theirs</span>
        </Tappable>
      </div>
    </div>
  )
}

function NotLinked() {
  const createCode = useCloud((s) => s.createCode)
  const joinCode = useCloud((s) => s.joinCode)
  const [joining, setJoining] = useState(false)
  const [input, setInput] = useState('')

  return (
    <div className="px-4 pb-6">
      <h2 className="display text-lg text-ink">Cloud sync</h2>
      <p className="measure mt-1 text-xs text-ink-muted">Keep this squad on every phone.</p>

      <div className="mt-4 grid gap-2">
        <Tappable
          ariaLabel="Create team code"
          onTap={() => void createCode()}
          className="tap btn-primary rounded-xl px-4 py-3"
        >
          <span className="display text-sm tracking-wide">Create team code</span>
        </Tappable>

        {!joining ? (
          <Tappable
            ariaLabel="Join with a code"
            onTap={() => setJoining(true)}
            className="tap btn-ghost rounded-xl px-4 py-3"
          >
            <span className="display text-sm tracking-wide">Join with a code</span>
          </Tappable>
        ) : (
          <div className="panel-inset flex flex-col gap-2 p-2.5">
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="fun88-7K3M-QP9X"
              className="display w-full rounded-lg bg-transparent px-2 py-2 text-sm tracking-wider text-ink uppercase outline-none placeholder:text-ink-faint placeholder:normal-case"
            />
            <Tappable
              ariaLabel="Join"
              onTap={() => void joinCode(input).then((ok) => ok && setJoining(false))}
              className="tap btn-primary rounded-lg px-3 py-2.5"
            >
              <span className="display text-xs tracking-wide">Join</span>
            </Tappable>
          </div>
        )}
      </div>

      <Divider text="or" />
      <FileButtons />
    </div>
  )
}

function Linked({ code }: { code: string }) {
  const { status, auto, setAuto, lastPushedAt, device, pushNow, pullNow, unlink, deleteRemote, hasBackup, restoreBackup } =
    useCloud((s) => ({
      status: s.status,
      auto: s.auto,
      setAuto: s.setAuto,
      lastPushedAt: s.lastPushedAt,
      device: s.device,
      pushNow: s.pushNow,
      pullNow: s.pullNow,
      unlink: s.unlink,
      deleteRemote: s.deleteRemote,
      hasBackup: s.hasBackup,
      restoreBackup: s.restoreBackup,
    }))
  const meta = CLOUD_STATUS_META[status]
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const lastFour = code.slice(-4)

  return (
    <div className="px-4 pb-6">
      <div className="flex items-center justify-between">
        <h2 className="display text-lg text-ink">Cloud sync</h2>
        <span className="flex items-center gap-1.5">
          <span
            className={`size-1.5 rounded-full ${meta.pulse ? 'animate-pulse' : ''}`}
            style={{ background: meta.dot }}
          />
          <span className="label-micro">{meta.label}</span>
        </span>
      </div>

      {status === 'conflict' && <ConflictPanel />}

      <div className="panel-inset mt-3 flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0">
          <p className="label-micro">Team code</p>
          <p className="display truncate text-sm tracking-wider text-ink">{formatCodeGrouped(code)}</p>
        </div>
        <Tappable
          ariaLabel="Copy code"
          onTap={() => {
            void navigator.clipboard.writeText(code)
            toast('Code copied.', 'ok')
          }}
          className="tap btn-ghost shrink-0 rounded-lg px-3 py-2"
        >
          <span className="display text-2xs tracking-wide">Copy</span>
        </Tappable>
      </div>
      <p className="mt-1.5 text-2xs text-ink-faint">
        Last saved {timeAgo(lastPushedAt)} · from {device}
      </p>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="display text-sm text-ink">Auto-save</span>
        <Tappable
          ariaLabel={auto ? 'Turn off auto-save' : 'Turn on auto-save'}
          ariaPressed={auto}
          onTap={() => setAuto(!auto)}
          className="tap relative h-7 w-12 shrink-0 rounded-full"
          style={{ background: auto ? 'var(--color-chem-strong)' : 'var(--color-surface-4)' }}
        >
          <span
            className="absolute top-1 size-5 rounded-full bg-white transition-all"
            style={{ left: auto ? '1.6rem' : '0.25rem' }}
          />
        </Tappable>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Tappable ariaLabel="Save now" onTap={() => void pushNow()} className="tap btn-ghost rounded-xl px-3 py-2.5">
          <span className="display text-xs tracking-wide">Save now</span>
        </Tappable>
        <Tappable
          ariaLabel="Load from cloud"
          onTap={() => void pullNow()}
          className="tap btn-ghost rounded-xl px-3 py-2.5"
        >
          <span className="display text-xs tracking-wide">Load from cloud</span>
        </Tappable>
      </div>

      <Divider text="backup" />
      <FileButtons />
      {hasBackup && (
        <Tappable
          ariaLabel="Restore previous squad"
          onTap={restoreBackup}
          className="tap mt-2 w-full rounded-xl px-3 py-2 text-center"
        >
          <span className="text-2xs text-ink-faint underline">Restore previous squad</span>
        </Tappable>
      )}

      <Divider text="danger zone" />
      <div className="grid gap-2">
        <Tappable ariaLabel="Unlink this device" onTap={unlink} className="tap btn-ghost rounded-xl px-4 py-3">
          <span className="display text-sm tracking-wide">Unlink this device</span>
        </Tappable>

        {!confirmDelete ? (
          <Tappable
            ariaLabel="Delete cloud copy"
            onTap={() => setConfirmDelete(true)}
            className="tap rounded-xl px-4 py-3 text-center"
            style={{ color: 'var(--color-danger)' }}
          >
            <span className="display text-sm tracking-wide">Delete cloud copy</span>
          </Tappable>
        ) : (
          <div className="panel-inset flex flex-col gap-2 p-3">
            <p className="text-2xs text-ink-muted">
              Type <span className="text-ink">{lastFour}</span> to permanently delete the cloud copy.
            </p>
            <input
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              className="display w-full rounded-lg bg-transparent px-2 py-2 text-sm tracking-wider text-ink uppercase outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <Tappable
                ariaLabel="Cancel delete"
                onTap={() => {
                  setConfirmDelete(false)
                  setConfirmText('')
                }}
                className="tap btn-ghost rounded-lg px-3 py-2"
              >
                <span className="display text-xs tracking-wide">Cancel</span>
              </Tappable>
              <Tappable
                ariaLabel="Confirm delete"
                disabled={confirmText !== lastFour}
                onTap={() => {
                  void deleteRemote()
                  setConfirmDelete(false)
                  setConfirmText('')
                }}
                className="tap rounded-lg px-3 py-2 disabled:opacity-40"
                style={{ background: 'var(--color-danger)', color: '#fff4f6' }}
              >
                <span className="display text-xs tracking-wide">Delete</span>
              </Tappable>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Bottom sheet for cloud sync — the entry point is the Header status pill.
 *  Not linked ⇒ create/join + export/import. Linked ⇒ status, auto-save,
 *  manual save/load, conflict resolution, unlink/delete. */
export function CloudSheet({ open, onClose }: Props) {
  const code = useCloud((s) => s.code)
  return (
    <Sheet open={open} onClose={onClose} label="Cloud sync">
      {code ? <Linked code={code} /> : <NotLinked />}
    </Sheet>
  )
}
