import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { animate, motion, useMotionValue } from 'motion/react'
import { PlayerToken, TOKEN_RATIO } from './PlayerToken'
import { LINK_COLOR, resolve } from '../lib/chemistry'
import {
  MARK,
  cardScale,
  fromUV,
  planeFor,
  planeStyle,
  project,
  stageStyle,
  toUV,
  unproject,
  type Plane,
  type Projected,
} from '../lib/projection'
import type { TeamDerived } from '../store/derived'
import { useSquad } from '../store/useSquad'
import type { Vec } from '../types'
import type { PitchMode } from './Pitch'

const LONG_PRESS_MS = 380
const DRAG_THRESHOLD_PX = 4
const SPRING = { type: 'spring', stiffness: 220, damping: 25, mass: 0.7 } as const

/** How far a card has been dragged from where the finger went down, in screen px. */
interface Delta {
  x: number
  y: number
}

interface Props {
  team: TeamDerived
  mode: PitchMode
  onTapSlot: (slot: number) => void
  onLongPressSlot: (slot: number) => void
  onDropSwap: (a: number, b: number) => void
  /** Dropped on open grass — free positioning, in team-local coordinates. */
  onDropFree: (slot: number, at: Vec) => void
}

/* ── the grass ───────────────────────────────────────────────────────────────
 * Everything here is painted in the plane's own flat coordinate space and then
 * mapped onto the tilted quad by the browser, so stripes, grid and markings all
 * foreshorten with a single rotateX and nothing has to be pre-distorted. */

const LINE = 'var(--color-grass-line)'
/** Pitch length from goal line to goal line, as a fraction of the plane. */
const LEN = MARK.nearGoal - MARK.farGoal
const BOX_D = LEN * 0.157 // 16.5m penalty box on a 105m pitch
const SIX_D = LEN * 0.052
const SPOT_D = LEN * 0.105

/** A penalty / goal area: an open-ended box hanging off one of the goal lines. */
function AreaBox({ near, width, depth }: { near: boolean; width: string; depth: number }) {
  const offset = `${(near ? 1 - MARK.nearGoal : MARK.farGoal) * 100}%`
  return (
    <div
      className="absolute -translate-x-1/2"
      style={{
        left: '50%',
        width,
        height: `${depth * 100}%`,
        top: near ? undefined : offset,
        bottom: near ? offset : undefined,
        border: `1px solid ${LINE}`,
        borderBottomWidth: near ? 0 : undefined,
        borderTopWidth: near ? undefined : 0,
      }}
    />
  )
}

function Markings() {
  return (
    <>
      {/* touchlines + goal lines */}
      <div
        className="absolute"
        style={{
          left: '3%',
          right: '3%',
          top: `${MARK.farGoal * 100}%`,
          bottom: `${(1 - MARK.nearGoal) * 100}%`,
          border: `1px solid ${LINE}`,
        }}
      />
      {/* halfway */}
      <div
        className="absolute"
        style={{
          left: '3%',
          right: '3%',
          top: `${MARK.halfway * 100}%`,
          height: 1,
          background: LINE,
        }}
      />
      {/* centre circle + spot */}
      <div
        className="absolute aspect-square w-[26%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ left: '50%', top: `${MARK.halfway * 100}%`, border: `1px solid ${LINE}` }}
      />
      <div
        className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ left: '50%', top: `${MARK.halfway * 100}%`, background: LINE }}
      />
      {/* penalty + goal areas, both ends */}
      <AreaBox near width="52%" depth={BOX_D} />
      <AreaBox near={false} width="52%" depth={BOX_D} />
      <AreaBox near width="24%" depth={SIX_D} />
      <AreaBox near={false} width="24%" depth={SIX_D} />
      {/* penalty spots */}
      <div
        className="absolute size-1 -translate-x-1/2 rounded-full"
        style={{ left: '50%', bottom: `${(1 - MARK.nearGoal + SPOT_D) * 100}%`, background: LINE }}
      />
      <div
        className="absolute size-1 -translate-x-1/2 rounded-full"
        style={{ left: '50%', top: `${(MARK.farGoal + SPOT_D) * 100}%`, background: LINE }}
      />
      {/* goals */}
      <div
        className="absolute h-[0.9%] w-[17%] -translate-x-1/2 rounded-[1px]"
        style={{
          left: '50%',
          bottom: `${(1 - MARK.nearGoal) * 100}%`,
          background: 'rgba(255,255,255,.78)',
        }}
      />
      <div
        className="absolute h-[0.9%] w-[17%] -translate-x-1/2 rounded-[1px]"
        style={{
          left: '50%',
          top: `${MARK.farGoal * 100}%`,
          background: 'rgba(255,255,255,.78)',
        }}
      />
    </>
  )
}

function Grass({ plane }: { plane: Plane }) {
  return (
    <div style={planeStyle(plane)} aria-hidden>
      {/* turf */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, var(--color-grass-700) 0%, var(--color-grass-500) 38%, var(--color-grass-500) 66%, var(--color-grass-600) 100%)',
        }}
      />
      {/* mowing stripes — 14 bands across the length */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'repeating-linear-gradient(180deg, rgba(255,255,255,.085) 0 7.142%, rgba(0,0,0,.07) 7.142% 14.285%)',
        }}
      />
      {/* perspective grid — the cue that says "this surface has depth" */}
      <div
        className="absolute inset-0 opacity-25"
        style={{
          background:
            'repeating-linear-gradient(90deg, rgba(236,255,228,.5) 0 1px, transparent 1px 8.333%)',
        }}
      />
      <Markings />
      {/* stadium falloff */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(118% 76% at 50% 44%, transparent 34%, rgba(2,12,5,.66) 100%)',
        }}
      />
    </div>
  )
}

/* ── one standing card ───────────────────────────────────────────────────── */

interface CardProps {
  index: number
  anchor: Projected
  centre: { x: number; y: number }
  cardW: number
  team: TeamDerived
  mode: PitchMode
  hovered: boolean
  flashing: boolean
  dragging: boolean
  onTap: (slot: number) => void
  onLongPress: (slot: number) => void
  onDragStart: (slot: number) => void
  onDragMove: (slot: number, at: Delta) => void
  onDragEnd: (slot: number, at: Delta) => void
  onDragCancel: () => void
}

function PitchCard({
  index,
  anchor,
  centre,
  cardW,
  team,
  mode,
  hovered,
  flashing,
  dragging,
  onTap,
  onLongPress,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: CardProps) {
  const pressTimer = useRef<number | null>(null)
  const longFired = useRef(false)
  const isDragging = useRef(false)
  const pointerOrigin = useRef<{ x: number; y: number } | null>(null)
  /* The live drag delta rides its own MotionValues on an inner wrapper rather
   * than React state, so a 120Hz finger doesn't re-render seven player cards a
   * frame — and it composes with the anchor spring on the parent instead of
   * fighting it for the same `transform`. */
  const dragX = useMotionValue(0)
  const dragY = useMotionValue(0)

  const slot = team.formation.slots[index]
  const player = resolve(team.roster, team.lineup[index])
  const sc = cardScale(anchor.s)
  const cardH = cardW * TOKEN_RATIO.normal
  const lift = cardW * 0.05
  const shadowW = cardW * 0.8 * sc
  const shadowH = shadowW * 0.3

  const isSwapSource = mode.kind === 'swap' && mode.slot === index
  const isTargetable = (mode.kind === 'swap' && mode.slot !== index) || mode.kind === 'sub'

  const clearTimer = () => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  const baseX = centre.x + anchor.x
  const baseY = centre.y + anchor.y

  /** Keep the ground anchor on the grass, whatever the finger does. */
  const onStage = (d: number, base: number, span: number) =>
    Math.min(Math.max(base + d, 0), span) - base

  /** Spring the delta out on the same curve the anchor springs in on. The two
   *  then cancel frame for frame, so a dropped card sits still at the drop
   *  point instead of rubber-banding home and flying back out. */
  const settle = () => {
    animate(dragX, 0, SPRING)
    animate(dragY, 0, SPRING)
  }

  const endGesture = (e: React.PointerEvent<HTMLDivElement>) => {
    clearTimer()
    pointerOrigin.current = null
    const was = isDragging.current
    isDragging.current = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    return was
  }

  if (!slot) return null

  return (
    <motion.div
      className="absolute top-0 left-0 cursor-grab active:cursor-grabbing"
      style={{
        width: 0,
        height: 0,
        touchAction: 'none',
        // Lower on screen = nearer the camera, so overlapping cards stack like
        // depth rather than like a bug.
        zIndex: dragging ? 1200 : isSwapSource ? 1100 : 500 + Math.round(anchor.y),
      }}
      initial={false}
      animate={{ x: baseX, y: baseY }}
      transition={SPRING}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        longFired.current = false
        isDragging.current = false
        pointerOrigin.current = { x: e.clientX, y: e.clientY }
        // The anchor this sits on is a 0x0 point and the card is barely 50px
        // wide, so a finger leaves it almost immediately. Capturing the pointer
        // is what keeps the rest of the gesture — every move, and the release —
        // addressed to this card instead of to whatever it flew over.
        e.currentTarget.setPointerCapture(e.pointerId)
        pressTimer.current = window.setTimeout(() => {
          longFired.current = true
          navigator.vibrate?.(14)
          onLongPress(index)
        }, LONG_PRESS_MS)
      }}
      onPointerMove={(e) => {
        const from = pointerOrigin.current
        if (!from) return
        const dx = e.clientX - from.x
        const dy = e.clientY - from.y
        if (!isDragging.current) {
          // A motionless tap moves nothing: no transform is ever touched, so
          // there is nothing to unwind on release. This is the whole reason the
          // drag is hand-rolled — framer's `dragSnapToOrigin` unwinds the
          // transform of any pan it started, and because these cards are
          // positioned *by* that transform, unwinding it on a tap parked the
          // card at the stage's literal top-left corner.
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
          isDragging.current = true
          clearTimer()
          onDragStart(index)
        }
        const at = {
          x: onStage(dx, baseX, centre.x * 2),
          y: onStage(dy, baseY, centre.y * 2),
        }
        dragX.set(at.x)
        dragY.set(at.y)
        onDragMove(index, at)
      }}
      onPointerUp={(e) => {
        const at = { x: dragX.get(), y: dragY.get() }
        if (endGesture(e)) {
          settle()
          onDragEnd(index, at)
          return
        }
        if (longFired.current) return
        onTap(index)
      }}
      onPointerCancel={(e) => {
        if (endGesture(e)) {
          settle()
          onDragCancel()
        }
      }}
    >
      {/* everything below rides the live drag delta; the parent carries the
          anchor spring, so the two never fight over one transform */}
      <motion.div
        className="absolute top-0 left-0"
        style={{ width: 0, height: 0, x: dragX, y: dragY }}
      >
        {/* the card's footprint on the grass — sells the float */}
        <span
          className="pointer-events-none absolute"
          style={{
            left: -shadowW / 2,
            top: -shadowH / 2,
            width: shadowW,
            height: shadowH,
            borderRadius: '50%',
            background: 'radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,.6), transparent 72%)',
          }}
          aria-hidden
        />
        {/* billboard: upright, planted on the anchor, scaled by depth */}
        <div
          style={{
            position: 'absolute',
            left: -cardW / 2,
            bottom: lift,
            width: cardW,
            height: cardH,
            transformOrigin: '50% 100%',
            transform: `scale(${sc})`,
          }}
        >
          <PlayerToken
            player={player}
            slotPos={slot.pos}
            fit={team.chem.fits[index] ?? 0}
            chem={player ? team.chem.perSlot[index] : undefined}
            width={cardW}
            accent={team.meta.accent}
            swapping={isSwapSource}
            targeting={isTargetable || hovered}
            flash={flashing}
          />
        </div>
      </motion.div>
    </motion.div>
  )
}

/**
 * The lineup board: one squad, one tilted pitch, own goal at the bottom and the
 * seven attacking up the screen. Cards stand on the grass and face the camera;
 * every gesture the flat board understood works here unchanged, because drag and
 * render share the projection in lib/projection.
 */
export function Pitch3D({
  team,
  mode,
  onTapSlot,
  onLongPressSlot,
  onDropSwap,
  onDropFree,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [hoverSlot, setHoverSlot] = useState<number | null>(null)
  const [dragSlot, setDragSlot] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const r = entry?.contentRect
      if (r) setBox((b) => (b.w === r.width && b.h === r.height ? b : { w: r.width, h: r.height }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Incoming substitute flash, mirrored from the store.
  const subFlash = useSquad((s) => s[team.side].subFlash)
  const [flashSlot, setFlashSlot] = useState<number | null>(null)
  useEffect(() => {
    if (!subFlash) return
    setFlashSlot(subFlash.slot)
    const t = window.setTimeout(() => setFlashSlot(null), 900)
    return () => window.clearTimeout(t)
  }, [subFlash])

  const plane = useMemo(() => planeFor(box), [box])
  const centre = useMemo(() => ({ x: box.w / 2, y: box.h / 2 }), [box])
  const anchors = useMemo(
    () =>
      team.chem.points.map((p) => {
        const uv = toUV(p)
        return project(plane, uv.u, uv.v)
      }),
    [team.chem.points, plane],
  )
  const cardW = Math.round(Math.max(46, Math.min(80, box.w * 0.115)))

  /** Where a dragged card's ground anchor has ended up, in screen offsets. */
  const dropPoint = (slot: number, at: Delta) => {
    const a = anchors[slot]
    if (!a) return null
    return { x: a.x + at.x, y: a.y + at.y }
  }

  /** Nearest other anchor to a drop point, or null for open grass. The tolerance
   *  is an ellipse: on a tilted plane a circle on the ground projects wider than
   *  tall, so the vertical radius has to be the smaller one. */
  const slotUnder = (slot: number, at: { x: number; y: number }): number | null => {
    let best: number | null = null
    let bestD = Infinity
    anchors.forEach((a, i) => {
      if (i === slot) return
      const sc = cardScale(a.s)
      const d = Math.hypot((a.x - at.x) / (cardW * 0.55 * sc), (a.y - at.y) / (cardW * 0.34 * sc))
      if (d < 1 && d < bestD) {
        bestD = d
        best = i
      }
    })
    return best
  }

  const onDragMove = (slot: number, delta: Delta) => {
    const to = dropPoint(slot, delta)
    const hit = to ? slotUnder(slot, to) : null
    setHoverSlot((prev) => (prev === hit ? prev : hit))
  }

  const onDragCancel = () => {
    setHoverSlot(null)
    setDragSlot(null)
  }

  const onDragEnd = (slot: number, delta: Delta) => {
    setHoverSlot(null)
    setDragSlot(null)
    const at = dropPoint(slot, delta)
    if (!at) return
    navigator.vibrate?.(14)
    const hit = slotUnder(slot, at)
    if (hit !== null) {
      onDropSwap(slot, hit)
      return
    }
    const uv = unproject(plane, at.x, at.y)
    onDropFree(slot, fromUV(uv.u, uv.v))
  }

  const ready = box.w > 0 && box.h > 0

  return (
    <div
      ref={stageRef}
      className="relative h-full w-full overflow-hidden rounded-2xl"
      style={{
        ...stageStyle(plane),
        background:
          'radial-gradient(120% 80% at 50% 8%, var(--color-navy-700), var(--color-navy-900) 62%, #04070e 100%)',
      }}
    >
      {ready && (
        <>
          <Grass plane={plane} />

          {/* chemistry web, drawn flat on the grass under everyone's feet */}
          <svg
            className="pointer-events-none absolute inset-0"
            width={box.w}
            height={box.h}
            style={{ zIndex: 100 }}
            aria-hidden
          >
            {team.chem.links.map((l) => {
              const a = anchors[l.a]
              const b = anchors[l.b]
              if (!a || !b) return null
              return (
                <motion.line
                  key={`${l.a}-${l.b}`}
                  initial={false}
                  animate={{
                    x1: centre.x + a.x,
                    y1: centre.y + a.y,
                    x2: centre.x + b.x,
                    y2: centre.y + b.y,
                  }}
                  transition={SPRING}
                  stroke={LINK_COLOR[l.strength]}
                  strokeWidth={l.strength === 3 ? 2 : 1.4}
                  strokeDasharray={l.strength <= 1 ? '4 4' : undefined}
                  strokeOpacity={l.strength === 3 ? 0.6 : l.strength === 2 ? 0.46 : 0.5}
                  strokeLinecap="round"
                />
              )
            })}
          </svg>

          {team.chem.points.map((_, i) => {
            const a = anchors[i]
            if (!a) return null
            return (
              <PitchCard
                key={i}
                index={i}
                anchor={a}
                centre={centre}
                cardW={cardW}
                team={team}
                mode={mode}
                hovered={hoverSlot === i}
                flashing={flashSlot === i}
                dragging={dragSlot === i}
                onTap={onTapSlot}
                onLongPress={onLongPressSlot}
                onDragStart={setDragSlot}
                onDragMove={onDragMove}
                onDragEnd={onDragEnd}
                onDragCancel={onDragCancel}
              />
            )
          })}

          {/* which way is forward — the only text allowed on the grass */}
          <span
            className="display pointer-events-none absolute inset-x-0 top-2 text-center text-2xs tracking-[0.34em] uppercase"
            style={{ zIndex: 90, color: 'rgba(233,238,246,.34)' }}
          >
            ▲ Attacking
          </span>
          <span
            className="display pointer-events-none absolute inset-x-0 bottom-1.5 text-center text-2xs tracking-[0.3em] uppercase"
            style={{ zIndex: 1300, color: team.meta.accentSoft, opacity: 0.65 }}
          >
            {team.meta.name}
          </span>
        </>
      )}
    </div>
  )
}
