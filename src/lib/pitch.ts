import type { Side, Vec } from '../types'

/* Two coordinate spaces:
 *
 *  team-local  x 0-100 left→right of that team's own view, y 0 = the goal it
 *              attacks, y ≈ 93 = its own goal line. Formations and free-drag
 *              overrides are always stored here, so a shape reads the same
 *              whichever side is using it.
 *  pitch       x 0-100 left→right of the screen, y 0 = top (away's goal),
 *              y 100 = bottom (home's goal). What actually gets rendered.
 *
 * Home occupies the bottom half attacking up; away is mirrored through the
 * centre spot onto the top half, so both squads read as facing each other. */

export const toPitch = (side: Side, p: Vec): Vec =>
  side === 'home' ? { x: p.x, y: 50 + p.y / 2 } : { x: 100 - p.x, y: 50 - p.y / 2 }

export const toLocal = (side: Side, p: Vec): Vec =>
  side === 'home' ? { x: p.x, y: (p.y - 50) * 2 } : { x: 100 - p.x, y: (50 - p.y) * 2 }
