import { useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Sheet } from './ui/Sheet'
import { Tappable } from './ui/Tappable'
import { ConfirmDialog } from './ui/ConfirmDialog'
import { CLOUD_STATUS_META, useCloud } from '../store/useCloud'
import { useActiveVersionName, useVersions } from '../store/useVersions'
import { formatCodeGrouped } from '../lib/cloud'
import { exportSquad } from '../lib/squadFile'
import { toast } from '../store/useToast'
import type { VersionMeta } from '../lib/versionStore'

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

function StatusPill() {
  const status = useCloud((s) => s.status)
  const meta = CLOUD_STATUS_META[status]
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span
        className={`size-1.5 rounded-full ${meta.pulse ? 'animate-pulse' : ''}`}
        style={
          status === 'local'
            ? { boxShadow: 'inset 0 0 0 1px var(--color-ink-faint)' }
            : { background: meta.dot }
        }
      />
      <span className="label-micro">{meta.label}</span>
    </span>
  )
}

/* ── icons ─────────────────────────────────────────────────────────────────
 * 14px stroke glyphs, currentColor — the row actions have to read at a glance
 * beside a name without stealing weight from it. */
const ICON = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

function PencilIcon() {
  return (
    <svg {...ICON} aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg {...ICON} aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg {...ICON} aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg {...ICON} aria-hidden="true">
      <path d="m20 6-11 11-5-5" />
    </svg>
  )
}

function IconButton({
  label,
  onTap,
  danger,
  children,
}: {
  label: string
  onTap: () => void
  danger?: boolean
  children: ReactNode
}) {
  return (
    <Tappable
      as="div"
      ariaLabel={label}
      onTap={onTap}
      ripple={danger ? 'rgba(255,79,100,.42)' : undefined}
      className="tap grid size-8 shrink-0 place-items-center rounded-lg"
      style={{ color: danger ? 'var(--color-danger)' : 'var(--color-ink-faint)' }}
    >
      {children}
    </Tappable>
  )
}

/* ── version list ──────────────────────────────────────────────────────────*/

function VersionRow({ v, active, onDelete }: { v: VersionMeta; active: boolean; onDelete: () => void }) {
  const selectVersion = useVersions((s) => s.selectVersion)
  const renameVersion = useVersions((s) => s.renameVersion)
  const exportVersion = useVersions((s) => s.exportVersion)
  const [draft, setDraft] = useState<string | null>(null)

  const commit = () => {
    if (draft !== null) renameVersion(v.id, draft)
    setDraft(null)
  }

  return (
    <div
      className="panel-inset mt-2 flex items-center gap-1 py-1.5 pr-1.5 pl-2"
      style={
        active
          ? {
              borderColor: 'color-mix(in srgb, var(--color-gold-400) 55%, transparent)',
              background: 'color-mix(in srgb, var(--color-gold-400) 7%, transparent)',
            }
          : undefined
      }
    >
      {draft === null ? (
        <Tappable
          as="div"
          role="option"
          ariaSelected={active}
          ariaLabel={`Open ${v.name}`}
          onTap={() => selectVersion(v.id)}
          className="tap min-w-0 flex-1 rounded-lg px-1.5 py-1.5 text-left"
        >
          <span className="flex items-center gap-2">
            <span
              className="grid size-4 shrink-0 place-items-center rounded-full"
              style={{
                boxShadow: active
                  ? 'inset 0 0 0 1px var(--color-gold-400)'
                  : 'inset 0 0 0 1px var(--color-surface-4)',
                color: 'var(--color-gold-300)',
              }}
            >
              {active && <span className="size-2 rounded-full bg-gold-400" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="display block truncate text-sm text-ink">{v.name}</span>
              <span className="block text-2xs text-ink-faint">
                {active ? 'Open now' : `Saved ${timeAgo(v.updatedAt)}`}
              </span>
            </span>
          </span>
        </Tappable>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <input
            autoFocus
            value={draft}
            aria-label={`Rename ${v.name}`}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') setDraft(null)
            }}
            className="display min-w-0 flex-1 rounded-lg bg-transparent px-2 py-2 text-sm text-ink outline-none placeholder:text-ink-faint"
            style={{ boxShadow: 'inset 0 0 0 1px var(--color-hairline)' }}
          />
          <IconButton label="Save name" onTap={commit}>
            <CheckIcon />
          </IconButton>
        </div>
      )}

      {draft === null && (
        <>
          <IconButton label={`Rename ${v.name}`} onTap={() => setDraft(v.name)}>
            <PencilIcon />
          </IconButton>
          <IconButton label={`Export ${v.name}`} onTap={() => exportVersion(v.id)}>
            <DownloadIcon />
          </IconButton>
          <IconButton label={`Delete ${v.name}`} onTap={onDelete} danger>
            <TrashIcon />
          </IconButton>
        </>
      )}
    </div>
  )
}

function FileButtons() {
  const importFile = useVersions((s) => s.importFile)
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <div className="grid grid-cols-2 gap-2">
      <Tappable ariaLabel="Export all versions" onTap={exportSquad} className="tap btn-ghost rounded-xl px-3 py-2.5">
        <span className="display text-xs tracking-wide">Export all</span>
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
          if (file) void importFile(file)
        }}
      />
    </div>
  )
}

/* ── sync (secondary) ──────────────────────────────────────────────────────*/

function ConflictPanel() {
  const keepMine = useCloud((s) => s.keepMine)
  const takeTheirs = useCloud((s) => s.takeTheirs)
  const conflictDevice = useCloud((s) => s.conflictEnvelope?.device)
  return (
    <div
      className="panel mt-3 px-3.5 py-3"
      style={{ borderColor: 'color-mix(in srgb, var(--color-away-400) 50%, transparent)' }}
    >
      <p className="text-xs text-ink-muted">
        Someone else saved from another device{conflictDevice ? ` (${conflictDevice})` : ''}.
        Choose which set of versions to keep.
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
    <div className="grid gap-2">
      <Tappable
        ariaLabel="Create team code"
        onTap={() => void createCode()}
        className="tap btn-ghost rounded-xl px-4 py-3"
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
            aria-label="Team code"
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
  )
}

function Linked({ code }: { code: string }) {
  const auto = useCloud((s) => s.auto)
  const setAuto = useCloud((s) => s.setAuto)
  const lastPushedAt = useCloud((s) => s.lastPushedAt)
  const device = useCloud((s) => s.device)
  const pushNow = useCloud((s) => s.pushNow)
  const pullNow = useCloud((s) => s.pullNow)
  const unlink = useCloud((s) => s.unlink)
  const deleteRemote = useCloud((s) => s.deleteRemote)
  const hasBackup = useCloud((s) => s.hasBackup)
  const restoreBackup = useCloud((s) => s.restoreBackup)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const lastFour = code.slice(-4)

  return (
    <div>
      <div className="panel-inset flex items-center justify-between gap-2 px-3 py-2.5">
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

      {hasBackup && (
        <Tappable
          ariaLabel="Restore previous versions"
          onTap={restoreBackup}
          className="tap mt-2 w-full rounded-xl px-3 py-2 text-center"
        >
          <span className="text-2xs text-ink-faint underline">Restore previous versions</span>
        </Tappable>
      )}

      <div className="mt-3 grid gap-2">
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
              aria-label="Confirmation text"
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

/** Secondary by design: versions are the model, a team code is only the pipe
 *  that carries the whole set to another phone. Collapsed until asked for. */
function SyncSection() {
  const code = useCloud((s) => s.code)
  const status = useCloud((s) => s.status)
  const [open, setOpen] = useState(status === 'conflict')

  return (
    <div className="mt-1">
      <Tappable
        as="div"
        ariaLabel={open ? 'Hide sync options' : 'Show sync options'}
        ariaPressed={open}
        onTap={() => setOpen(!open)}
        className="tap flex w-full items-center justify-between rounded-xl px-1 py-2"
      >
        <span className="min-w-0 text-left">
          <span className="display block text-sm text-ink">Sync across devices</span>
          <span className="block truncate text-2xs text-ink-faint">
            {code ? `Linked · ${formatCodeGrouped(code)}` : 'Not linked — versions stay on this phone'}
          </span>
        </span>
        <span
          className="shrink-0 text-ink-faint transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        >
          <svg {...ICON} aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </Tappable>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-2">
              <p className="measure text-xs text-ink-muted">
                Link a team code and every version — the whole list, not just the open one — rides along to your
                other phones.
              </p>
              {status === 'conflict' && <ConflictPanel />}
              <div className="mt-3">{code ? <Linked code={code} /> : <NotLinked />}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── sheet ─────────────────────────────────────────────────────────────────*/

/**
 * Versions are the app's save-game model: one named JSON snapshot each, one of
 * them open at a time. Everything the owner asked for lives on this one screen
 * — create, pick, rename, delete, export — and the cloud is folded underneath
 * as the mechanism that carries the set, not as the headline.
 */
export function VersionsSheet({ open, onClose }: Props) {
  const versions = useVersions((s) => s.versions)
  const activeVersionId = useVersions((s) => s.activeVersionId)
  const createVersion = useVersions((s) => s.createVersion)
  const deleteVersion = useVersions((s) => s.deleteVersion)
  const nextName = useVersions((s) => s.nextName)
  const activeName = useActiveVersionName()
  const [draft, setDraft] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<VersionMeta | null>(null)

  const startCreate = () => setDraft(nextName())
  const confirmCreate = () => {
    createVersion(draft ?? '')
    setDraft(null)
  }

  return (
    <Sheet open={open} onClose={onClose} label="Versions">
      <div className="px-4 pb-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="display text-lg text-ink">Versions</h2>
          <StatusPill />
        </div>
        <p className="measure mt-1 text-xs text-ink-muted">
          Each version is its own saved squad. <span className="text-ink">{activeName}</span> is open — changes go
          straight into it.
        </p>

        {draft === null ? (
          <Tappable
            ariaLabel="New version"
            onTap={startCreate}
            className="tap btn-primary mt-4 w-full rounded-xl px-4 py-3"
          >
            <span className="display text-sm tracking-wide">+ New version</span>
          </Tappable>
        ) : (
          <div className="panel-inset mt-4 flex flex-col gap-2 p-2.5">
            <p className="label-micro">Name this version</p>
            <input
              autoFocus
              value={draft}
              aria-label="New version name"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmCreate()
                if (e.key === 'Escape') setDraft(null)
              }}
              placeholder="Đội hình K3"
              className="display w-full rounded-lg bg-transparent px-2 py-2 text-sm text-ink outline-none placeholder:text-ink-faint"
              style={{ boxShadow: 'inset 0 0 0 1px var(--color-hairline)' }}
            />
            <div className="grid grid-cols-2 gap-2">
              <Tappable
                ariaLabel="Cancel new version"
                onTap={() => setDraft(null)}
                className="tap btn-ghost rounded-lg px-3 py-2.5"
              >
                <span className="display text-xs tracking-wide">Cancel</span>
              </Tappable>
              <Tappable ariaLabel="Create version" onTap={confirmCreate} className="tap btn-primary rounded-lg px-3 py-2.5">
                <span className="display text-xs tracking-wide">Create</span>
              </Tappable>
            </div>
            <p className="text-2xs text-ink-faint">Copies the squad you have open right now.</p>
          </div>
        )}

        <div className="mt-3" role="listbox" aria-label="Saved versions">
          {versions.map((v) => (
            <VersionRow
              key={v.id}
              v={v}
              active={v.id === activeVersionId}
              onDelete={() => setPendingDelete(v)}
            />
          ))}
        </div>

        <Divider text="backup" />
        <FileButtons />

        <Divider text="sync" />
        <SyncSection />
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete "${pendingDelete?.name ?? ''}"?`}
        body={
          pendingDelete?.id === activeVersionId
            ? 'This version is open. Deleting it switches you to the most recently saved version left.'
            : 'That saved squad is removed from this device. This cannot be undone.'
        }
        confirmLabel="Delete version"
        cancelLabel="Keep version"
        onConfirm={() => {
          if (pendingDelete) deleteVersion(pendingDelete.id)
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </Sheet>
  )
}
