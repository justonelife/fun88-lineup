import { Suspense, lazy, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Avatar } from '../components/ui/Avatar'
import { OvrBadge } from '../components/ui/OvrBadge'
import { Meter } from '../components/ui/Bars'
import { Tappable } from '../components/ui/Tappable'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { PlayerSheet, type SheetAction } from '../components/PlayerSheet'
import { SideToggle } from '../components/SideToggle'
import { club } from '../data/clubs'
import { team, otherSide } from '../data/teams'
import { lineOf } from '../lib/chemistry'
import { bestSlotFor, weakestSlot } from '../lib/lineup'
import { useSquad, BENCH_SIZE, XI_SIZE } from '../store/useSquad'
import { toast } from '../store/useToast'
import type { Line, Player } from '../types'

/* The editor is a secondary surface with its own canvas/photo machinery — it
 * loads the first time you open it, never on the app's critical path. */
const PlayerEditor = lazy(() => import('../components/PlayerEditor'))

type EditorTarget = { mode: 'create' } | { mode: 'edit'; id: string }

type Filter = 'ALL' | Line
type Sort = 'ovr' | 'name' | 'pos'

const FILTERS: Filter[] = ['ALL', 'GK', 'DEF', 'MID', 'FWD']
const SORTS: Array<{ id: Sort; label: string }> = [
  { id: 'ovr', label: 'Rating' },
  { id: 'name', label: 'Name' },
  { id: 'pos', label: 'Position' },
]

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" strokeLinecap="round" />
    </svg>
  )
}

/**
 * The database — one shared pool, two teams drawing from it. Filter chips +
 * search narrow the list; membership tags on the right say who is already in
 * the active squad, and who the opposition has taken.
 */
export function SquadScreen() {
  const roster = useSquad((s) => s.roster)
  const activeSide = useSquad((s) => s.activeSide)
  const lineup = useSquad((s) => s[s.activeSide].lineup)
  const bench = useSquad((s) => s[s.activeSide].bench)
  const formationId = useSquad((s) => s[s.activeSide].formationId)
  const rivalLineup = useSquad((s) => s[s.activeSide === 'home' ? 'away' : 'home'].lineup)
  const rivalBench = useSquad((s) => s[s.activeSide === 'home' ? 'away' : 'home'].bench)
  const assignToSlot = useSquad((s) => s.assignToSlot)
  const addToBench = useSquad((s) => s.addToBench)
  const removeFromBench = useSquad((s) => s.removeFromBench)
  const deletePlayer = useSquad((s) => s.deletePlayer)
  const meta = team(activeSide)
  const rival = team(otherSide(activeSide))

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('ALL')
  const [sort, setSort] = useState<Sort>('ovr')
  const [openId, setOpenId] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorTarget | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const inXI = useMemo(() => new Set(lineup.filter(Boolean) as string[]), [lineup])
  const onBench = useMemo(() => new Set(bench.filter(Boolean) as string[]), [bench])
  const withRival = useMemo(
    () => new Set([...rivalLineup, ...rivalBench].filter(Boolean) as string[]),
    [rivalLineup, rivalBench],
  )

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = Object.values(roster).filter((p) => {
      if (filter !== 'ALL' && lineOf(p.pos) !== filter) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.pos.toLowerCase().includes(q) ||
        p.nation.toLowerCase().includes(q) ||
        club(p.clubId).name.toLowerCase().includes(q)
      )
    })
    list.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'pos') return a.pos.localeCompare(b.pos) || b.ovr - a.ovr
      return b.ovr - a.ovr
    })
    return list
  }, [roster, query, filter, sort])

  const open = openId ? roster[openId] : undefined
  const benchIndexOf = (id: string) => bench.findIndex((x) => x === id)

  const actionsFor = (p: Player): SheetAction[] => {
    const starting = inXI.has(p.id)
    const benched = onBench.has(p.id)
    const benchFull = bench.every(Boolean) && !benched
    const target = starting ? bestSlotFor(formationId, p) : weakestSlot(roster, formationId, lineup)

    const out: SheetAction[] = [
      {
        label: starting ? 'Move to best slot' : `To ${meta.label.toLowerCase()} seven`,
        hint: starting ? 'reshuffle in place' : 'replaces the weakest starter',
        primary: true,
        onTap: () => {
          assignToSlot(activeSide, p.id, target)
          setOpenId(null)
        },
      },
      {
        label: benched ? 'Off the bench' : `To ${meta.label.toLowerCase()} bench`,
        hint: benched ? 'back to reserves' : benchFull ? `bench is full (${BENCH_SIZE})` : undefined,
        disabled: benchFull,
        onTap: () => {
          if (benched) removeFromBench(activeSide, benchIndexOf(p.id))
          else addToBench(activeSide, p.id)
          setOpenId(null)
        },
      },
      {
        label: 'Edit player',
        hint: 'name, position, attributes',
        onTap: () => {
          setOpenId(null)
          setEditor({ mode: 'edit', id: p.id })
        },
      },
      {
        label: 'Delete player',
        hint: 'removes from the database',
        danger: true,
        onTap: () => {
          setOpenId(null)
          setPendingDelete(p.id)
        },
      },
    ]
    return out
  }

  const doomed = pendingDelete ? roster[pendingDelete] : undefined
  const doomedPlaces = useMemo(() => {
    if (!doomed) return ''
    const where: string[] = []
    if (inXI.has(doomed.id)) where.push(`the ${meta.label.toLowerCase()} seven`)
    if (onBench.has(doomed.id)) where.push('the bench')
    if (withRival.has(doomed.id)) where.push(`the ${rival.name} squad`)
    return where.length ? ` He is currently in ${where.join(' and ')}; those slots are emptied.` : ''
  }, [doomed, inXI, onBench, withRival, meta, rival])

  return (
    <div className="px-4 pb-6">
      <SideToggle
        className="pb-3"
        hint={`Everything on this screen moves players in and out of ${meta.name}.`}
      />

      {/* controls */}
      <div className="panel sticky top-[7.25rem] z-20 space-y-2.5 px-3 py-3">
        <label className="flex items-center gap-2 rounded-xl border border-hairline bg-base/60 px-3 py-2 focus-within:border-lime-500/60">
          <span className="text-ink-faint">
            <SearchIcon />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, club, nation, position"
            aria-label="Search players"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="label-micro shrink-0 text-lime-300"
            >
              Clear
            </button>
          )}
        </label>

        <div className="scroll-x flex gap-1.5">
          {FILTERS.map((f) => {
            const active = f === filter
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={active}
                className={`display relative shrink-0 rounded-full px-3 py-1.5 text-2xs tracking-widest uppercase ${
                  active ? 'text-base' : 'text-ink-muted ring-1 ring-hairline'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="squad-filter"
                    className="absolute inset-0 -z-10 rounded-full bg-lime-400"
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  />
                )}
                {f === 'ALL' ? 'All' : f}
              </button>
            )
          })}
          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            <span className="label-micro">Sort</span>
            {SORTS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSort(s.id)}
                aria-pressed={sort === s.id}
                className={`display rounded-full px-2 py-1 text-2xs tracking-widest uppercase ${
                  sort === s.id ? 'bg-surface-3 text-lime-200 ring-1 ring-lime-500/40' : 'text-ink-faint'
                }`}
              >
                {s.label}
              </button>
            ))}
          </span>
        </div>

        {/* Von Restorff: the only saturated fill on the screen is the one thing
            this list cannot do by itself — grow. */}
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 text-2xs text-ink-faint">
            {rows.length} players ·{' '}
            <span style={{ color: meta.accent }}>
              {inXI.size}/{XI_SIZE} starting
            </span>{' '}
            · {onBench.size}/{BENCH_SIZE} on the {meta.label.toLowerCase()} bench
          </p>
          <Tappable
            ariaLabel="Add player"
            onTap={() => setEditor({ mode: 'create' })}
            className="tap btn-primary flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2"
          >
            <span className="display text-base leading-none">+</span>
            <span className="display text-2xs tracking-widest uppercase">Add player</span>
          </Tappable>
        </div>
      </div>

      {/* rows */}
      <div className="mt-3 grid gap-1.5">
        {rows.map((p, i) => {
          const starting = inXI.has(p.id)
          const benched = onBench.has(p.id)
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: Math.min(i, 12) * 0.012 }}
            >
              <Tappable
                ariaLabel={`Open ${p.name}`}
                onTap={() => setOpenId(p.id)}
                ripple={`color-mix(in srgb, ${meta.accent} 42%, transparent)`}
                className="glass tap flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left"
                style={
                  starting
                    ? { borderColor: `color-mix(in srgb, ${meta.accent} 55%, transparent)` }
                    : undefined
                }
              >
                <Avatar player={p} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="display block truncate text-sm leading-tight text-ink">
                    {p.name}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="label-micro">{p.pos}</span>
                    <span className="truncate text-2xs text-ink-faint">{club(p.clubId).short}</span>
                    <span className="w-10">
                      <Meter value={p.stamina} height={3} />
                    </span>
                  </span>
                </span>

                {starting && (
                  <span
                    className="display shrink-0 rounded px-1.5 text-2xs tracking-wider uppercase"
                    style={{
                      background: `color-mix(in srgb, ${meta.accent} 16%, transparent)`,
                      color: meta.accentSoft,
                      boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${meta.accent} 45%, transparent)`,
                    }}
                  >
                    {meta.label}
                  </span>
                )}
                {!starting && benched && (
                  <span className="display shrink-0 rounded bg-surface-3 px-1.5 text-2xs tracking-wider text-ink-muted uppercase ring-1 ring-hairline">
                    Sub
                  </span>
                )}
                {!starting && !benched && withRival.has(p.id) && (
                  <span
                    className="display shrink-0 rounded px-1.5 text-2xs tracking-wider uppercase"
                    style={{ color: rival.accent, opacity: 0.85 }}
                  >
                    {rival.label}
                  </span>
                )}
                <OvrBadge ovr={p.ovr} size={32} />
              </Tappable>
            </motion.div>
          )
        })}
        {rows.length === 0 && (
          <p className="panel px-4 py-6 text-center text-sm text-ink-muted">
            Nobody matches “{query}”.
          </p>
        )}
      </div>

      <PlayerSheet
        open={openId !== null}
        onClose={() => setOpenId(null)}
        player={open}
        membership={
          open && inXI.has(open.id) ? 'xi' : open && onBench.has(open.id) ? 'bench' : 'reserve'
        }
        note={
          open && withRival.has(open.id)
            ? `Both teams draw from one pool — ${open.name} is currently in the ${rival.name} squad. Naming him here leaves him in both.`
            : undefined
        }
        actions={open ? actionsFor(open) : []}
      />

      <ConfirmDialog
        open={Boolean(doomed)}
        title={`Delete ${doomed?.name ?? 'player'}?`}
        body={`He leaves the shared database for good and cannot be recovered — only "Reset everything" brings the original squad back.${doomedPlaces}`}
        confirmLabel="Delete player"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const name = doomed?.name ?? 'Player'
          if (pendingDelete) deletePlayer(pendingDelete)
          setPendingDelete(null)
          toast(`${name} deleted`, 'danger')
        }}
      />

      <AnimatePresence>
        {editor && (
          <Suspense fallback={null}>
            <PlayerEditor
              key={editor.mode === 'edit' ? editor.id : 'create'}
              mode={editor.mode}
              player={editor.mode === 'edit' ? roster[editor.id] : undefined}
              onClose={() => setEditor(null)}
              onSaved={(id) => {
                if (editor.mode === 'create') {
                  setQuery('')
                  setFilter('ALL')
                  setOpenId(id)
                }
              }}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  )
}
