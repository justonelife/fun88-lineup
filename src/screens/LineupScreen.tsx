import { useCallback, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Pitch, type PitchMode } from '../components/Pitch'
import { BenchStrip } from '../components/BenchStrip'
import { FormationSelector } from '../components/FormationSelector'
import { SideToggle } from '../components/SideToggle'
import { PlayerSheet, type SheetAction } from '../components/PlayerSheet'
import { Sheet } from '../components/ui/Sheet'
import { Tappable } from '../components/ui/Tappable'
import { Avatar } from '../components/ui/Avatar'
import { OvrBadge } from '../components/ui/OvrBadge'
import { resolve } from '../lib/chemistry'
import { shortName } from '../lib/lineup'
import { useVersus } from '../store/derived'
import { useSquad } from '../store/useSquad'
import type { Player, Side, Vec } from '../types'

/** Transient bottom toast — confirms a mutation without stealing focus. */
function Toast({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4"
          initial={{ opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 460, damping: 34 }}
        >
          <span className="panel display px-3.5 py-2 text-xs tracking-wide text-ink shadow-[0_16px_40px_-18px_#000]">
            {message}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * The versus board. One pitch, two squads, one active side: every control on
 * this screen edits whichever team the HOME | AWAY switch points at, and the
 * opposing seven stay on screen for comparison.
 */
export function LineupScreen() {
  const { home, away, activeSide } = useVersus()
  const active = activeSide === 'home' ? home : away

  const setActiveSide = useSquad((s) => s.setActiveSide)
  const swapSlots = useSquad((s) => s.swapSlots)
  const substitute = useSquad((s) => s.substitute)
  const assignToSlot = useSquad((s) => s.assignToSlot)
  const clearSlot = useSquad((s) => s.clearSlot)
  const addToBench = useSquad((s) => s.addToBench)
  const autoFitLineup = useSquad((s) => s.autoFitLineup)
  const setPosition = useSquad((s) => s.setPosition)
  const resetPositions = useSquad((s) => s.resetPositions)

  const [mode, setMode] = useState<PitchMode>({ kind: 'idle' })
  const [sheet, setSheet] = useState<{ side: Side; slot: number } | null>(null)
  const [pickerSlot, setPickerSlot] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const flash = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast((t) => (t === message ? null : t)), 1900)
  }, [])

  const idle = () => setMode({ kind: 'idle' })

  const onTapToken = (side: Side, slot: number) => {
    // The opposing side is inspectable but never editable — one tap opens the
    // read-only sheet, the switch above is the way in.
    if (side !== activeSide) {
      const other = side === 'home' ? home : away
      if (other.lineup[slot]) setSheet({ side, slot })
      else flash(`Switch to ${other.meta.label} to edit that side`)
      return
    }

    if (mode.kind === 'sub') {
      const incoming = resolve(active.roster, active.bench[mode.benchIndex])
      const outgoing = resolve(active.roster, active.lineup[slot])
      if (incoming && active.subsLeft > 0) {
        substitute(activeSide, mode.benchIndex, slot)
        flash(
          outgoing
            ? `${shortName(outgoing.name)} off · ${shortName(incoming.name)} on`
            : `${shortName(incoming.name)} on`,
        )
      }
      idle()
      return
    }
    if (mode.kind === 'swap') {
      if (mode.slot === slot) {
        idle()
        return
      }
      swapSlots(activeSide, mode.slot, slot)
      flash('Positions swapped')
      idle()
      return
    }
    if (!active.lineup[slot]) {
      setPickerSlot(slot)
      return
    }
    setSheet({ side, slot })
  }

  const onLongPressSlot = (slot: number) => {
    if (!active.lineup[slot]) return
    setMode({ kind: 'swap', slot })
  }

  const onDropSwap = (a: number, b: number) => {
    swapSlots(activeSide, a, b)
    idle()
  }

  const onDropFree = (slot: number, at: Vec) => {
    if (!active.lineup[slot]) return
    setPosition(activeSide, slot, at)
    idle()
  }

  const onSelectBench = (index: number) => {
    setMode((m) =>
      m.kind === 'sub' && m.benchIndex === index
        ? { kind: 'idle' }
        : { kind: 'sub', benchIndex: index },
    )
  }

  // ── sheets ────────────────────────────────────────────────────────────────
  const sheetTeam = sheet ? (sheet.side === 'home' ? home : away) : undefined
  const sheetPlayer = sheet && sheetTeam ? resolve(sheetTeam.roster, sheetTeam.lineup[sheet.slot]) : undefined
  const sheetSlotDef = sheet && sheetTeam ? sheetTeam.formation.slots[sheet.slot] : undefined
  const sheetEditable = sheet?.side === activeSide

  const actions: SheetAction[] = useMemo(() => {
    if (!sheet || !sheetPlayer || !sheetEditable) return []
    const slot = sheet.slot
    return [
      {
        label: 'Swap with…',
        hint: 'then tap another starter',
        primary: true,
        onTap: () => {
          setMode({ kind: 'swap', slot })
          setSheet(null)
        },
      },
      {
        label: 'To bench',
        hint: 'frees the slot',
        onTap: () => {
          clearSlot(activeSide, slot)
          addToBench(activeSide, sheetPlayer.id)
          setSheet(null)
          flash(`${shortName(sheetPlayer.name)} to the bench`)
        },
      },
      {
        label: 'Auto-fit the seven',
        hint: 'best slot for everyone',
        onTap: () => {
          autoFitLineup(activeSide)
          setSheet(null)
          flash('Lineup auto-fitted')
        },
      },
    ]
  }, [sheet, sheetPlayer, sheetEditable, activeSide, clearSlot, addToBench, autoFitLineup, flash])

  const pickerOptions = useMemo(
    () => active.bench.map((id) => resolve(active.roster, id)).filter((p): p is Player => Boolean(p)),
    [active.bench, active.roster],
  )

  const moved = active.positions.filter(Boolean).length

  const banner =
    mode.kind === 'swap'
      ? `Swap mode — tap another ${active.meta.label.toLowerCase()} starter, or drag a token onto one`
      : mode.kind === 'sub'
        ? 'Substitution armed — tap the starter coming off'
        : null

  return (
    <div className="pb-4">
      <SideToggle
        className="px-4 pb-3"
        hint={`Editing ${active.meta.name} — the ${
          activeSide === 'home' ? away.meta.name : home.meta.name
        } seven are tap-to-inspect only.`}
      />

      <FormationSelector />

      <div className="mt-3 px-4">
        <Pitch
          mode={mode}
          onTapToken={onTapToken}
          onLongPressSlot={onLongPressSlot}
          onDropSwap={onDropSwap}
          onDropFree={onDropFree}
        />
      </div>

      {/* mode banner — one live region, never two competing hints */}
      <div className="mt-3 px-4">
        <AnimatePresence mode="wait">
          {banner ? (
            <motion.button
              key={mode.kind}
              onClick={idle}
              className="tap flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left"
              style={{
                background: `color-mix(in srgb, ${active.meta.accent} 12%, transparent)`,
                boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${active.meta.accent} 35%, transparent)`,
              }}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              <span className="text-xs" style={{ color: active.meta.accentSoft }}>
                {banner}
              </span>
              <span className="label-micro shrink-0" style={{ color: active.meta.accent }}>
                Cancel
              </span>
            </motion.button>
          ) : (
            <motion.div
              key="hints"
              className="space-y-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex items-center gap-2">
                <Tappable
                  onTap={() => {
                    autoFitLineup(activeSide)
                    flash(`${active.meta.name} auto-fitted`)
                  }}
                  ripple={`color-mix(in srgb, ${active.meta.accent} 42%, transparent)`}
                  ariaLabel={`Auto-fit ${active.meta.label} lineup`}
                  className="tap btn-ghost display flex-1 rounded-xl px-3 py-2 text-xs tracking-wide"
                >
                  Auto-fit seven
                </Tappable>
                <Tappable
                  onTap={() => {
                    resetPositions(activeSide)
                    flash('Back to formation shape')
                  }}
                  disabled={moved === 0}
                  ripple={`color-mix(in srgb, ${active.meta.accent} 42%, transparent)`}
                  ariaLabel="Reset custom positions"
                  className={`tap btn-ghost display flex-1 rounded-xl px-3 py-2 text-xs tracking-wide ${
                    moved === 0 ? 'opacity-40' : ''
                  }`}
                >
                  Reset positions{moved > 0 ? ` (${moved})` : ''}
                </Tappable>
              </div>
              <p className="measure text-2xs text-ink-faint">
                Tap for detail · long-press to swap · drag onto a team-mate to swap, or onto open
                grass to stand there ·
                {active.chem.outOfPosition > 0
                  ? ` ${active.chem.outOfPosition} out of position`
                  : ' every starter in position'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BenchStrip mode={mode} onSelectBench={onSelectBench} />

      <PlayerSheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        player={sheetPlayer}
        slotPos={sheetSlotDef?.pos}
        fit={sheet && sheetTeam ? sheetTeam.chem.fits[sheet.slot] : undefined}
        chem={sheet && sheetTeam ? sheetTeam.chem.perSlot[sheet.slot] : undefined}
        membership="xi"
        note={
          sheetEditable
            ? undefined
            : `Starting for ${sheetTeam?.meta.name}. Switch the board to ${sheetTeam?.meta.label} to change this side.`
        }
        actions={
          sheetEditable
            ? actions
            : [
                {
                  label: `Edit ${sheetTeam?.meta.label ?? ''}`,
                  hint: 'switch the active side',
                  primary: true,
                  onTap: () => {
                    if (sheet) setActiveSide(sheet.side)
                    setSheet(null)
                  },
                },
              ]
        }
      />

      {/* empty-slot picker */}
      <Sheet open={pickerSlot !== null} onClose={() => setPickerSlot(null)} label="Fill slot">
        <div className="px-4 pb-6">
          <h2 className="display text-lg text-ink">
            Fill {pickerSlot !== null ? active.formation.slots[pickerSlot]?.pos : ''} ·{' '}
            <span style={{ color: active.meta.accent }}>{active.meta.label}</span>
          </h2>
          <p className="measure mt-1 text-xs text-ink-faint">
            Pick a substitute to drop straight into the empty slot, or head to the Squad tab for
            the full database.
          </p>
          <div className="mt-3 grid gap-2">
            {pickerOptions.length === 0 && (
              <p className="text-xs text-ink-muted">The bench is empty.</p>
            )}
            {pickerOptions.map((p) => (
              <Tappable
                key={p.id}
                ariaLabel={`Put ${p.name} in`}
                className="glass tap flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left"
                onTap={() => {
                  if (pickerSlot === null) return
                  assignToSlot(activeSide, p.id, pickerSlot)
                  setPickerSlot(null)
                  flash(`${shortName(p.name)} into the seven`)
                }}
              >
                <Avatar player={p} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="display block truncate text-sm text-ink">{p.name}</span>
                  <span className="label-micro">{p.pos}</span>
                </span>
                <OvrBadge ovr={p.ovr} size={30} />
              </Tappable>
            ))}
          </div>
        </div>
      </Sheet>

      <Toast message={toast} />
    </div>
  )
}
