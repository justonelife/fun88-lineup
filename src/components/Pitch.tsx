import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion, type PanInfo } from 'motion/react'
import { PlayerToken, TOKEN_RATIO } from './PlayerToken'
import { LINK_COLOR, resolve } from '../lib/chemistry'
import { toLocal, toPitch } from '../lib/pitch'
import { useVersus, type TeamDerived } from '../store/derived'
import { useSquad } from '../store/useSquad'
import type { Side, Vec } from '../types'

export type PitchMode =
  | { kind: 'idle' }
  | { kind: 'swap'; slot: number }
  | { kind: 'sub'; benchIndex: number }

interface Props {
  mode: PitchMode
  onTapToken: (side: Side, slot: number) => void
  onLongPressSlot: (slot: number) => void
  onDropSwap: (a: number, b: number) => void
  /** Dropped on open grass — free positioning, in team-local coordinates. */
  onDropFree: (slot: number, at: Vec) => void
}

const LONG_PRESS_MS = 380
/** Normalised drop tolerance: inside this ellipse around another token, the
 *  drop is read as "swap with him" rather than "stand here". */
const SWAP_RX = 11
const SWAP_RY = 8.5

/** Seven-a-side markings: half the furniture of an eleven-a-side pitch — one
 *  small area per goal, a tight centre circle, and a tinted end for each team. */
function Markings() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, var(--color-pitch-800), var(--color-pitch-700) 50%, var(--color-pitch-900))',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          background:
            'repeating-linear-gradient(180deg, rgba(255,255,255,.035) 0 7.14%, rgba(0,0,0,.05) 7.14% 14.28%)',
        }}
      />
      {/* end tints: each team owns a half by colour before a single token lands */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(90% 34% at 50% 100%, rgba(184,241,60,.13), transparent 70%), radial-gradient(90% 34% at 50% 0%, rgba(255,106,61,.13), transparent 70%)',
        }}
      />
      {/* touchlines */}
      <div className="absolute inset-2 rounded-[10px] border border-[var(--color-pitch-line)]" />
      {/* halfway */}
      <div className="absolute inset-x-2 top-1/2 h-px bg-[var(--color-pitch-line)]" />
      {/* centre circle — 7s pitches use a tighter one */}
      <div className="absolute top-1/2 left-1/2 aspect-square w-[26%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--color-pitch-line)]" />
      <div className="absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-pitch-line)]" />
      {/* one shooting area per goal, no full-size box */}
      <div className="absolute bottom-2 left-1/2 h-[9.5%] w-[46%] -translate-x-1/2 rounded-t-[3px] border border-b-0 border-[var(--color-pitch-line)]" />
      <div className="absolute top-2 left-1/2 h-[9.5%] w-[46%] -translate-x-1/2 rounded-b-[3px] border border-t-0 border-[var(--color-pitch-line)]" />
      {/* penalty spots */}
      <div className="absolute bottom-[7.5%] left-1/2 size-1 -translate-x-1/2 rounded-full bg-[var(--color-pitch-line)]" />
      <div className="absolute top-[7.5%] left-1/2 size-1 -translate-x-1/2 rounded-full bg-[var(--color-pitch-line)]" />
      {/* goals */}
      <div
        className="absolute bottom-1 left-1/2 h-1 w-[22%] -translate-x-1/2 rounded-sm"
        style={{ background: 'color-mix(in srgb, var(--color-lime-300) 55%, transparent)' }}
      />
      <div
        className="absolute top-1 left-1/2 h-1 w-[22%] -translate-x-1/2 rounded-sm"
        style={{ background: 'color-mix(in srgb, var(--color-away-300) 55%, transparent)' }}
      />
    </div>
  )
}

interface LayerProps {
  team: TeamDerived
  active: boolean
  mode: PitchMode
  box: { w: number; h: number }
  tokenW: number
  hoverSlot: number | null
  flashSlot: number | null
  handlers: {
    onTapToken: (side: Side, slot: number) => void
    onLongPressSlot: (slot: number) => void
    onDragMove: (slot: number, info: PanInfo) => void
    onDragDrop: (slot: number, info: PanInfo) => void
  }
  wrapRef: React.RefObject<HTMLDivElement | null>
}

function TeamLayer({
  team,
  active,
  mode,
  box,
  tokenW,
  hoverSlot,
  flashSlot,
  handlers,
  wrapRef,
}: LayerProps) {
  const pressTimer = useRef<number | null>(null)
  const longFired = useRef(false)
  const dragging = useRef(false)

  const scale = active ? 1 : 0.9
  const w = tokenW * scale
  const h = w * TOKEN_RATIO.compact

  return (
    <>
      {team.chem.points.map((point, i) => {
        const p = toPitch(team.side, point)
        const isSwapSource = active && mode.kind === 'swap' && mode.slot === i
        const isTargetable =
          active && ((mode.kind === 'swap' && mode.slot !== i) || mode.kind === 'sub')
        const player = resolve(team.roster, team.lineup[i])
        const slot = team.formation.slots[i]
        if (!slot) return null

        return (
          <motion.div
            key={`${team.side}-${i}`}
            className={active ? 'absolute top-0 left-0 cursor-grab' : 'absolute top-0 left-0'}
            style={{
              // Lower on screen = nearer the viewer, so overlapping tokens
              // stack like depth instead of like a bug.
              zIndex: isSwapSource ? 130 : (active ? 100 : 0) + Math.round(p.y),
              opacity: active ? 1 : 0.82,
            }}
            initial={false}
            animate={{ x: (p.x / 100) * box.w - w / 2, y: (p.y / 100) * box.h - h / 2 }}
            transition={{ type: 'spring', stiffness: 210, damping: 24, mass: 0.7 }}
            drag={active}
            dragSnapToOrigin
            dragMomentum={false}
            dragElastic={0.08}
            dragConstraints={wrapRef}
            whileDrag={{ scale: 1.12, zIndex: 200 }}
            onDragStart={() => {
              dragging.current = true
              if (pressTimer.current) window.clearTimeout(pressTimer.current)
            }}
            onDrag={(_, info) => handlers.onDragMove(i, info)}
            onDragEnd={(_, info) => {
              dragging.current = false
              handlers.onDragDrop(i, info)
            }}
            onPointerDown={() => {
              longFired.current = false
              if (!active) return
              pressTimer.current = window.setTimeout(() => {
                longFired.current = true
                navigator.vibrate?.(14)
                handlers.onLongPressSlot(i)
              }, LONG_PRESS_MS)
            }}
            onPointerUp={() => {
              if (pressTimer.current) window.clearTimeout(pressTimer.current)
              if (longFired.current || dragging.current) return
              handlers.onTapToken(team.side, i)
            }}
            onPointerCancel={() => {
              if (pressTimer.current) window.clearTimeout(pressTimer.current)
            }}
          >
            <PlayerToken
              player={player}
              slotPos={slot.pos}
              fit={team.chem.fits[i] ?? 0}
              chem={team.chem.perSlot[i] ?? 0}
              width={w}
              compact
              accent={team.meta.accent}
              swapping={isSwapSource}
              targeting={isTargetable || hoverSlot === i}
              flash={flashSlot === i}
              muted={!active}
            />
          </motion.div>
        )
      })}
    </>
  )
}

/** Chemistry web for one side, drawn from the coordinates the tokens actually
 *  occupy — drag a player and his links come with him. */
function Web({ team, active }: { team: TeamDerived; active: boolean }) {
  return (
    <>
      {team.chem.links.map((l) => {
        const a = team.chem.points[l.a]
        const b = team.chem.points[l.b]
        if (!a || !b) return null
        const pa = toPitch(team.side, a)
        const pb = toPitch(team.side, b)
        return (
          <motion.line
            key={`${team.side}-${l.a}-${l.b}`}
            initial={false}
            animate={{ x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y }}
            transition={{ type: 'spring', stiffness: 190, damping: 26 }}
            stroke={LINK_COLOR[l.strength]}
            strokeWidth={l.strength === 3 ? 1.6 : 1.2}
            strokeDasharray={l.strength <= 1 ? '3 3' : undefined}
            strokeOpacity={(l.strength === 3 ? 0.55 : l.strength === 2 ? 0.42 : 0.5) * (active ? 1 : 0.45)}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )
      })}
    </>
  )
}

/**
 * One board, two squads. The active side sits on top and takes every gesture;
 * the opposing seven stay readable but recede (smaller, dimmer, tap-to-inspect
 * only) so there is never a question about what a drag is going to change.
 */
export function Pitch({ mode, onTapToken, onLongPressSlot, onDropSwap, onDropFree }: Props) {
  const { home, away, activeSide } = useVersus()
  const homeFlash = useSquad((s) => s.home.subFlash)
  const awayFlash = useSquad((s) => s.away.subFlash)

  const wrapRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [hoverSlot, setHoverSlot] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const r = entry?.contentRect
      if (r) setBox({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const [flash, setFlash] = useState<{ side: Side; slot: number } | null>(null)
  const subFlash = activeSide === 'home' ? homeFlash : awayFlash
  useEffect(() => {
    if (!subFlash) return
    setFlash({ side: activeSide, slot: subFlash.slot })
    const t = window.setTimeout(() => setFlash(null), 900)
    return () => window.clearTimeout(t)
  }, [subFlash, activeSide])

  const activeTeam = activeSide === 'home' ? home : away
  const tokenW = Math.max(42, Math.min(66, box.w * 0.158))

  /** Where a dragged token's centre has ended up, in pitch coordinates. */
  const droppedAt = (slot: number, info: PanInfo): Vec | null => {
    const rect = wrapRef.current?.getBoundingClientRect()
    const origin = activeTeam.chem.points[slot]
    if (!rect || !origin || rect.width === 0) return null
    const start = toPitch(activeSide, origin)
    return {
      x: start.x + (info.offset.x / rect.width) * 100,
      y: start.y + (info.offset.y / rect.height) * 100,
    }
  }

  /** Nearest own-team token to a drop point, or null for open grass. */
  const tokenUnder = (slot: number, at: Vec): number | null => {
    let best: number | null = null
    let bestD = Infinity
    activeTeam.chem.points.forEach((point, i) => {
      if (i === slot) return
      const p = toPitch(activeSide, point)
      const d = Math.hypot((p.x - at.x) / SWAP_RX, (p.y - at.y) / SWAP_RY)
      if (d < 1 && d < bestD) {
        bestD = d
        best = i
      }
    })
    return best
  }

  const onDragMove = (slot: number, info: PanInfo) => {
    const at = droppedAt(slot, info)
    const hit = at ? tokenUnder(slot, at) : null
    setHoverSlot((prev) => (prev === hit ? prev : hit))
  }

  const onDragDrop = (slot: number, info: PanInfo) => {
    setHoverSlot(null)
    const at = droppedAt(slot, info)
    if (!at) return
    const hit = tokenUnder(slot, at)
    navigator.vibrate?.(14)
    if (hit !== null) onDropSwap(slot, hit)
    else onDropFree(slot, toLocal(activeSide, at))
  }

  const handlers = { onTapToken, onLongPressSlot, onDragMove, onDragDrop }
  const layers: Array<{ team: TeamDerived; active: boolean }> = [
    { team: activeSide === 'home' ? away : home, active: false },
    { team: activeTeam, active: true },
  ]

  return (
    <div
      ref={wrapRef}
      className="relative mx-auto aspect-[10/14.4] w-full max-w-[32rem] touch-pan-y rounded-2xl border border-hairline/70 shadow-[0_24px_60px_-24px_rgba(0,0,0,.95)]"
    >
      <Markings />

      {/* end labels — which half belongs to whom, without reading a legend */}
      <span
        className="display pointer-events-none absolute inset-x-0 top-[2.5%] text-center text-2xs tracking-[0.3em] uppercase"
        style={{ color: 'var(--color-away-300)', opacity: 0.5 }}
      >
        {away.meta.name}
      </span>
      <span
        className="display pointer-events-none absolute inset-x-0 bottom-[2.5%] text-center text-2xs tracking-[0.3em] uppercase"
        style={{ color: 'var(--color-lime-300)', opacity: 0.5 }}
      >
        {home.meta.name}
      </span>

      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        {layers.map(({ team, active }) => (
          <Web key={team.side} team={team} active={active} />
        ))}
      </svg>

      {box.w > 0 &&
        layers.map(({ team, active }) => (
          <TeamLayer
            key={team.side}
            team={team}
            active={active}
            mode={mode}
            box={box}
            tokenW={tokenW}
            hoverSlot={active ? hoverSlot : null}
            flashSlot={flash && flash.side === team.side ? flash.slot : null}
            handlers={handlers}
            wrapRef={wrapRef}
          />
        ))}
    </div>
  )
}
