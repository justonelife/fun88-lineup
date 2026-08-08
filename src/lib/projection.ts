import type { CSSProperties } from 'react'
import type { Vec } from '../types'

/* =============================================================================
   2.5D PITCH PROJECTION
   -----------------------------------------------------------------------------
   The grass is a real CSS 3D surface: a <div> the size of `Plane` sitting inside
   a stage that carries `perspective: p`, rotated `rotateX(TILT_DEG)` about its
   own centre. Everything painted inside that div — stripes, grid, markings —
   foreshortens for free, which is the whole point of doing it in CSS rather than
   drawing a hand-made trapezoid.

   The player cards do NOT live inside that 3D subtree. They are billboards: they
   always face the camera, so their screen position is fully described by
   projecting their ground anchor. Drawing them in a flat overlay at that
   projected point (scaled by the depth factor) is mathematically identical to
   putting them in the plane with `rotateX(-TILT) translateZ(lift)` — and it buys
   three things that matter more than purity:

     · `backdrop-filter` and `overflow` keep working (both are unreliable inside
       a `preserve-3d` subtree),
     · the depth scale can be damped so the far cards stay legible,
     · render and hit-test share ONE function, so a drag can never disagree with
       what the eye sees.

   ── the maths ───────────────────────────────────────────────────────────────
   CSS applies `rotateX(a)` as  (x, y, 0) → (x, y·cos a, y·sin a)  and then the
   perspective divide about `perspective-origin`, scaling by  s = p / (p − z).
   With the plane centred on the stage its transform-origin coincides with the
   perspective origin, so the whole thing collapses to, in screen offsets from
   the stage centre:

       sx = X · s
       sy = Y · cos · s          where   s = p / (p − Y · sin)

   which inverts in closed form (see `unproject`) — no matrix solve, no probing
   the DOM, no drift.
============================================================================= */

/** Camera tilt of the pitch plane, in degrees away from screen-parallel. */
export const TILT_DEG = 50
/** Perspective distance as a multiple of the stage height. Lower = wider lens. */
const PERSPECTIVE_K = 2.2
/** Plane box as a fraction of the stage box. Tuned so the projected trapezoid
 *  lands inside the stage with a strip of dark air above the far touchline —
 *  the same framing FIFA Online uses. */
const PLANE_W_K = 0.7
const PLANE_H_K = 1.2

const RAD = (TILT_DEG * Math.PI) / 180
const SIN = Math.sin(RAD)
const COS = Math.cos(RAD)

export interface Box {
  w: number
  h: number
}

export interface Plane {
  /** Plane width in px, before projection. */
  w: number
  /** Plane height in px, before projection. */
  h: number
  /** Perspective distance in px. */
  p: number
}

export function planeFor(stage: Box): Plane {
  return {
    w: Math.max(1, stage.w * PLANE_W_K),
    h: Math.max(1, stage.h * PLANE_H_K),
    p: Math.max(1, stage.h * PERSPECTIVE_K),
  }
}

export interface Projected {
  /** Screen x offset from the stage centre, px. */
  x: number
  /** Screen y offset from the stage centre, px. */
  y: number
  /** Perspective scale at that depth: < 1 far, > 1 near. */
  s: number
}

/** Plane uv (0-1 over the plane box) → screen offset from the stage centre. */
export function project(plane: Plane, u: number, v: number): Projected {
  const X = (u - 0.5) * plane.w
  const Y = (v - 0.5) * plane.h
  const s = plane.p / (plane.p - Y * SIN)
  return { x: X * s, y: Y * COS * s, s }
}

/** Screen offset from the stage centre → plane uv. Exact inverse of `project`. */
export function unproject(plane: Plane, x: number, y: number): { u: number; v: number } {
  const Y = (plane.p * y) / (plane.p * COS + y * SIN)
  const s = plane.p / (plane.p - Y * SIN)
  return { u: x / s / plane.w + 0.5, v: Y / plane.h + 0.5 }
}

/* ── team-local ⇄ plane ─────────────────────────────────────────────────────
 * Team-local y is 0 at the goal being attacked and 93 at your own goal line;
 * `clampLocal` in the store lets a dragged player roam over [-14, 98]. The plane
 * covers exactly that range plus a hair, so nobody can be dragged off the grass
 * and the drawn markings still land where a real pitch would put them. */
const Y_FAR = -14
const Y_NEAR = 100
const Y_SPAN = Y_NEAR - Y_FAR

export const toUV = (p: Vec): { u: number; v: number } => ({
  u: p.x / 100,
  v: (p.y - Y_FAR) / Y_SPAN,
})

export const fromUV = (u: number, v: number): Vec => ({
  x: u * 100,
  y: Y_FAR + v * Y_SPAN,
})

/** Where the furniture goes, as a fraction of the plane height. */
export const MARK = {
  /** Goal line of the end this team attacks. */
  farGoal: (0 - Y_FAR) / Y_SPAN,
  /** Own goal line. */
  nearGoal: (93 - Y_FAR) / Y_SPAN,
  halfway: (46.5 - Y_FAR) / Y_SPAN,
} as const

/** Inline style for the grass plane: centred on the stage, tilted about itself. */
export function planeStyle(plane: Plane): CSSProperties {
  return {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: plane.w,
    height: plane.h,
    transformOrigin: '50% 50%',
    transform: `translate(-50%, -50%) rotateX(${TILT_DEG}deg)`,
    // Flat on purpose: the subtree is rendered once and mapped onto the tilted
    // quad, which is what makes the stripes and markings foreshorten.
    transformStyle: 'flat',
  }
}

/** Inline style for the stage that carries the camera. */
export function stageStyle(plane: Plane): CSSProperties {
  return { perspective: `${plane.p}px`, perspectiveOrigin: '50% 50%' }
}

/**
 * Depth scale for a billboarded card. True perspective through the band the
 * formations actually occupy (roughly 0.92-1.22), clamped at both ends so a
 * card dragged to the far corner never shrinks below reading size — the one
 * thing a real 3D scene cannot do for you.
 */
export const cardScale = (s: number): number => Math.max(0.86, Math.min(1.24, s))
