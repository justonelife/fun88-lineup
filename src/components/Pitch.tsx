import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { PlayerToken } from './PlayerToken'
import { LINK_COLOR, resolve } from '../lib/chemistry'
import { useDerived } from '../store/derived'
import { useSquad } from '../store/useSquad'

export type PitchMode =
  | { kind: 'idle' }
  | { kind: 'swap'; slot: number }
  | { kind: 'sub'; benchIndex: number }

interface Props {
  mode: PitchMode
  onTapSlot: (slot: number) => void
  onLongPressSlot: (slot: number) => void
  onDropSwap: (a: number, b: number) => void
}

const LONG_PRESS_MS = 380

/** Mown-grass bands + regulation markings, drawn with layout primitives so they
 *  stay crisp at any width and never distort the centre circle. */
function Markings() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, var(--color-pitch-700), var(--color-pitch-900) 55%, var(--color-pitch-800))',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.55]"
        style={{
          background:
            'repeating-linear-gradient(180deg, rgba(255,255,255,.035) 0 8.33%, rgba(0,0,0,.05) 8.33% 16.66%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 70% at 50% 0%, rgba(184,241,60,.10), transparent 55%), radial-gradient(100% 60% at 50% 100%, rgba(0,0,0,.55), transparent 60%)',
        }}
      />
      {/* touchlines */}
      <div className="absolute inset-2 rounded-[10px] border border-[var(--color-pitch-line)]" />
      {/* halfway */}
      <div className="absolute inset-x-2 top-1/2 h-px bg-[var(--color-pitch-line)]" />
      {/* centre circle */}
      <div className="absolute top-1/2 left-1/2 aspect-square w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--color-pitch-line)]" />
      <div className="absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-pitch-line)]" />
      {/* penalty areas */}
      <div className="absolute bottom-2 left-1/2 h-[16%] w-[62%] -translate-x-1/2 rounded-t-[3px] border border-b-0 border-[var(--color-pitch-line)]" />
      <div className="absolute bottom-2 left-1/2 h-[7%] w-[32%] -translate-x-1/2 rounded-t-[2px] border border-b-0 border-[var(--color-pitch-line)]" />
      <div className="absolute top-2 left-1/2 h-[16%] w-[62%] -translate-x-1/2 rounded-b-[3px] border border-t-0 border-[var(--color-pitch-line)]" />
      <div className="absolute top-2 left-1/2 h-[7%] w-[32%] -translate-x-1/2 rounded-b-[2px] border border-t-0 border-[var(--color-pitch-line)]" />
      {/* goals */}
      <div className="absolute bottom-1 left-1/2 h-1 w-[20%] -translate-x-1/2 rounded-sm bg-white/25" />
      <div className="absolute top-1 left-1/2 h-1 w-[20%] -translate-x-1/2 rounded-sm bg-white/25" />
    </div>
  )
}

export function Pitch({ mode, onTapSlot, onLongPressSlot, onDropSwap }: Props) {
  const { formation, chem, roster, lineup } = useDerived()
  const subFlash = useSquad((s) => s.subFlash)

  const wrapRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const pressTimer = useRef<number | null>(null)
  const longFired = useRef(false)
  const dragging = useRef(false)

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

  const [flashSlot, setFlashSlot] = useState<number | null>(null)
  useEffect(() => {
    if (!subFlash) return
    setFlashSlot(subFlash.slot)
    const t = window.setTimeout(() => setFlashSlot(null), 900)
    return () => window.clearTimeout(t)
  }, [subFlash])

  const tokenW = Math.max(48, Math.min(78, box.w * 0.175))
  const tokenH = tokenW * 1.38

  const pos = (x: number, y: number) => ({
    x: (x / 100) * box.w - tokenW / 2,
    y: (y / 100) * box.h - tokenH / 2,
  })

  const nearestSlot = (clientX: number, clientY: number, exclude: number) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return null
    const px = ((clientX - rect.left) / rect.width) * 100
    const py = ((clientY - rect.top) / rect.height) * 100
    let best: number | null = null
    let bestD = Infinity
    for (const s of formation.slots) {
      if (s.i === exclude) continue
      const d = Math.hypot(s.x - px, s.y - py)
      if (d < bestD) {
        bestD = d
        best = s.i
      }
    }
    return bestD < 18 ? best : null
  }

  return (
    <div
      ref={wrapRef}
      className="relative mx-auto aspect-[10/13.6] w-full max-w-[30rem] touch-pan-y rounded-2xl border border-hairline/70 shadow-[0_24px_60px_-24px_rgba(0,0,0,.95)]"
    >
      <Markings />

      {/* chemistry web */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        {chem.links.map((l) => {
          const a = formation.slots[l.a]
          const b = formation.slots[l.b]
          if (!a || !b) return null
          return (
            <motion.line
              key={`${formation.id}-${l.a}-${l.b}`}
              initial={false}
              animate={{ x1: a.x, y1: a.y, x2: b.x, y2: b.y }}
              transition={{ type: 'spring', stiffness: 190, damping: 26 }}
              stroke={LINK_COLOR[l.strength]}
              strokeWidth={l.strength === 3 ? 1.6 : 1.2}
              strokeDasharray={l.strength <= 1 ? '3 3' : undefined}
              strokeOpacity={l.strength === 3 ? 0.55 : l.strength === 2 ? 0.42 : 0.5}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
      </svg>

      {/* tokens */}
      {box.w > 0 &&
        formation.slots.map((slot) => {
          const player = resolve(roster, lineup[slot.i])
          const target = pos(slot.x, slot.y)
          const isSwapSource = mode.kind === 'swap' && mode.slot === slot.i
          const isTargetable =
            (mode.kind === 'swap' && mode.slot !== slot.i) || mode.kind === 'sub'

          return (
            <motion.div
              key={slot.i}
              className="absolute top-0 left-0 cursor-pointer"
              style={{ zIndex: isSwapSource ? 20 : 10 }}
              initial={false}
              animate={{ x: target.x, y: target.y }}
              transition={{ type: 'spring', stiffness: 210, damping: 24, mass: 0.7 }}
              drag
              dragSnapToOrigin
              dragMomentum={false}
              dragElastic={0.16}
              whileDrag={{ scale: 1.12, zIndex: 40 }}
              onDragStart={() => {
                dragging.current = true
                if (pressTimer.current) window.clearTimeout(pressTimer.current)
              }}
              onDragEnd={(e, info) => {
                dragging.current = false
                const native = e as PointerEvent
                const cx = Number.isFinite(native.clientX)
                  ? native.clientX
                  : info.point.x - window.scrollX
                const cy = Number.isFinite(native.clientY)
                  ? native.clientY
                  : info.point.y - window.scrollY
                const hit = nearestSlot(cx, cy, slot.i)
                if (hit !== null) {
                  navigator.vibrate?.(14)
                  onDropSwap(slot.i, hit)
                }
              }}
              onPointerDown={() => {
                longFired.current = false
                pressTimer.current = window.setTimeout(() => {
                  longFired.current = true
                  navigator.vibrate?.(14)
                  onLongPressSlot(slot.i)
                }, LONG_PRESS_MS)
              }}
              onPointerUp={() => {
                if (pressTimer.current) window.clearTimeout(pressTimer.current)
                if (longFired.current || dragging.current) return
                onTapSlot(slot.i)
              }}
              onPointerCancel={() => {
                if (pressTimer.current) window.clearTimeout(pressTimer.current)
              }}
            >
              <PlayerToken
                player={player}
                slotPos={slot.pos}
                fit={chem.fits[slot.i] ?? 0}
                chem={chem.perSlot[slot.i] ?? 0}
                width={tokenW}
                swapping={isSwapSource}
                targeting={isTargetable}
                flash={flashSlot === slot.i}
              />
            </motion.div>
          )
        })}
    </div>
  )
}
