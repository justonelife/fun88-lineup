import { useCallback, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Pitch, type PitchMode } from '../components/Pitch'
import { BenchStrip } from '../components/BenchStrip'
import { FormationSelector } from '../components/FormationSelector'
import { PlayerSheet, type SheetAction } from '../components/PlayerSheet'
import { Sheet } from '../components/ui/Sheet'
import { Tappable } from '../components/ui/Tappable'
import { Avatar } from '../components/ui/Avatar'
import { OvrBadge } from '../components/ui/OvrBadge'
import { resolve } from '../lib/chemistry'
import { shortName } from '../lib/lineup'
import { useDerived } from '../store/derived'
import { useSquad } from '../store/useSquad'
import type { Player } from '../types'

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

export function LineupScreen() {
  const { formation, chem, roster, lineup } = useDerived()
  const bench = useSquad((s) => s.bench)
  const subsLeft = useSquad((s) => s.subsLeft)
  const swapSlots = useSquad((s) => s.swapSlots)
  const substitute = useSquad((s) => s.substitute)
  const assignToSlot = useSquad((s) => s.assignToSlot)
  const clearSlot = useSquad((s) => s.clearSlot)
  const addToBench = useSquad((s) => s.addToBench)
  const autoFitLineup = useSquad((s) => s.autoFitLineup)

  const [mode, setMode] = useState<PitchMode>({ kind: 'idle' })
  const [sheetSlot, setSheetSlot] = useState<number | null>(null)
  const [pickerSlot, setPickerSlot] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const flash = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast((t) => (t === message ? null : t)), 1900)
  }, [])

  const idle = () => setMode({ kind: 'idle' })

  const onTapSlot = (slot: number) => {
    if (mode.kind === 'sub') {
      const incoming = resolve(roster, bench[mode.benchIndex])
      const outgoing = resolve(roster, lineup[slot])
      if (incoming && subsLeft > 0) {
        substitute(mode.benchIndex, slot)
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
      swapSlots(mode.slot, slot)
      flash('Positions swapped')
      idle()
      return
    }
    if (!lineup[slot]) {
      setPickerSlot(slot)
      return
    }
    setSheetSlot(slot)
  }

  const onLongPressSlot = (slot: number) => {
    if (!lineup[slot]) return
    setMode({ kind: 'swap', slot })
  }

  const onDropSwap = (a: number, b: number) => {
    swapSlots(a, b)
    idle()
  }

  const onSelectBench = (index: number) => {
    setMode((m) =>
      m.kind === 'sub' && m.benchIndex === index ? { kind: 'idle' } : { kind: 'sub', benchIndex: index },
    )
  }

  // ── sheets ────────────────────────────────────────────────────────────────
  const sheetPlayer = sheetSlot === null ? undefined : resolve(roster, lineup[sheetSlot])
  const sheetSlotDef = sheetSlot === null ? undefined : formation.slots[sheetSlot]

  const actions: SheetAction[] = useMemo(() => {
    if (sheetSlot === null || !sheetPlayer) return []
    return [
      {
        label: 'Swap with…',
        hint: 'then tap another starter',
        primary: true,
        onTap: () => {
          setMode({ kind: 'swap', slot: sheetSlot })
          setSheetSlot(null)
        },
      },
      {
        label: 'To bench',
        hint: 'frees the slot',
        onTap: () => {
          clearSlot(sheetSlot)
          addToBench(sheetPlayer.id)
          setSheetSlot(null)
          flash(`${shortName(sheetPlayer.name)} to the bench`)
        },
      },
      {
        label: 'Auto-fit the XI',
        hint: 'best slot for everyone',
        onTap: () => {
          autoFitLineup()
          setSheetSlot(null)
          flash('Lineup auto-fitted')
        },
      },
    ]
  }, [sheetSlot, sheetPlayer, clearSlot, addToBench, autoFitLineup, flash])

  const pickerOptions = useMemo(
    () => bench.map((id) => resolve(roster, id)).filter((p): p is Player => Boolean(p)),
    [bench, roster],
  )

  const banner =
    mode.kind === 'swap'
      ? 'Swap mode — tap another starter, or drag a token onto one'
      : mode.kind === 'sub'
        ? 'Substitution armed — tap the starter coming off'
        : null

  return (
    <div className="pb-4">
      <FormationSelector />

      <div className="mt-3 px-4">
        <Pitch
          mode={mode}
          onTapSlot={onTapSlot}
          onLongPressSlot={onLongPressSlot}
          onDropSwap={onDropSwap}
        />
      </div>

      {/* mode banner — one live region, never two competing hints */}
      <div className="mt-3 px-4">
        <AnimatePresence mode="wait">
          {banner ? (
            <motion.button
              key={mode.kind}
              onClick={idle}
              className="tap flex w-full items-center justify-between gap-3 rounded-xl bg-lime-500/12 px-3 py-2.5 text-left ring-1 ring-lime-500/35"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              <span className="text-xs text-lime-200">{banner}</span>
              <span className="label-micro shrink-0 text-lime-300">Cancel</span>
            </motion.button>
          ) : (
            <motion.div
              key="hints"
              className="flex items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Tappable
                onTap={autoFitLineup}
                ariaLabel="Auto-fit lineup"
                className="tap btn-ghost display flex-1 rounded-xl px-3 py-2 text-xs tracking-wide"
              >
                Auto-fit XI
              </Tappable>
              <span className="measure flex-[2] text-2xs text-ink-faint">
                Tap a player for detail · long-press to swap · drag onto another slot ·
                {chem.outOfPosition > 0
                  ? ` ${chem.outOfPosition} out of position`
                  : ' every starter in position'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BenchStrip mode={mode} onSelectBench={onSelectBench} />

      <PlayerSheet
        open={sheetSlot !== null}
        onClose={() => setSheetSlot(null)}
        player={sheetPlayer}
        slotPos={sheetSlotDef?.pos}
        fit={sheetSlot === null ? undefined : chem.fits[sheetSlot]}
        chem={sheetSlot === null ? undefined : chem.perSlot[sheetSlot]}
        membership="xi"
        actions={actions}
      />

      {/* empty-slot picker */}
      <Sheet open={pickerSlot !== null} onClose={() => setPickerSlot(null)} label="Fill slot">
        <div className="px-4 pb-6">
          <h2 className="display text-lg text-ink">
            Fill {pickerSlot !== null ? formation.slots[pickerSlot]?.pos : ''}
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
                  assignToSlot(p.id, pickerSlot)
                  setPickerSlot(null)
                  flash(`${shortName(p.name)} into the XI`)
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
