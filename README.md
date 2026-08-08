# ULTRA 7S

A mobile-first, FIFA Online style **7-a-side versus board**. Two editable teams share one
pitch — home attacking up from the bottom half, away mirrored on the top — and everything
you touch belongs to whichever side the **HOME | AWAY** switch points at. Pick a shape,
drag your seven anywhere you like, argue with the chemistry web, write a plan for each
side, then play the match and watch the consequences land on both squads.

Everything runs offline in the browser. The player database, clubs and match engine are all
local and fictional — no API, no accounts, no network calls.

## Features

**Versus** — the hero screen.
- One pitch, two squads: home in lime on the bottom half, away in orange mirrored on the
  top half, each with its own formation, chemistry web and team colour.
- A prominent **HOME | AWAY** segmented control (also on Tactics and Squad) picks the active
  side. Only the active side is editable; the opposing seven stay readable and tap-to-inspect.
- Six 7-a-side shapes — 2-3-1 (Balanced), 2-2-2 (Narrow), 3-2-1 (Defensive), 1-3-2
  (Attacking), 2-4-0 (Wide press), 3-1-2 (Wing overload). Switching shape slides the seven
  across canonical slots rather than rebuilding them.
- **Free positioning**: drag a token onto open grass and the player stands exactly there —
  no slot snapping. Drop it on a team-mate instead and the two swap. The token you are
  hovering lights up, so swap-versus-place is never a guess.
- Chemistry links are drawn from where the players *actually* stand: drag someone wide and
  his nearest-neighbour links rewire to follow him. Both teams' webs are on screen at once.
- Tap a token for the full attribute breakdown (PAC / SHO / PAS / DRI / DEF / PHY), position
  fit, form and stamina. Long-press arms swap mode.
- Substitutions: tap a bench card, then tap the starter coming off. Three subs per side,
  with an animated flash on the incoming player.
- Tired legs are called out — a pulsing marker below 45 stamina, plus a colour-coded meter.
- **Auto-fit seven** solves the active side greedily: position fit first, effective rating
  second. **Reset positions** puts the shape back to the formation default.

**Tactics** — a real plan, per side.
- Six instructions on sliders: mentality, pressure, width, depth, line height, tempo.
- Six presets (Balanced, Tiki-Taka, Counter, Park the Bus, High Press, Wing Play), each
  showing its projected fit *before* you apply it.
- A live tactical-fit gauge scoring the plan against that side's shape and personnel — a
  high line with slow centre-backs, or a heavy press without the legs for it, is punished.
- Sliders and gauge take the active team's colour, so you always know whose plan you're editing.

**Squad** — one database, two teams.
- ~50 players, searchable by name, club, nation or position; filter by line, sort by rating,
  name or position.
- Membership tags show who is starting or benched for the **active** side, and a muted tag
  marks anyone the opposition has already taken (both teams draw from the same pool, and a
  player may appear in both — the match engine only drains their legs once).
- Tap any player to drop them into the active seven (replacing the weakest starter, or into
  their best slot if already starting) or onto that side's bench.

**Match** — consequences for both sides.
- Simulated 90 minutes driven by *both* squads: ratings, chemistry, shape and instructions
  push against each other on every beat, and both keepers get named in the commentary.
- Blocked until both sevens are full.
- Full-screen live overlay: score ticker, minute clock, streaming commentary, skip to full time.
- Post-match report: possession, shots, home player ratings with goals, assists, stamina cost
  and ▲/▼ movement — plus the away seven's stamina drain and ovr movement.
- Everything is written back to the shared roster, so the next board you build is shaped by
  the last match you played. **Rest squads** recovers stamina and resets both benches' subs.

## Persistence

Both teams — formation, seven, bench, subs, tactics and custom positions — plus the shared
roster and the last result persist to `localStorage` under `ultra-xi:squad` (schema v2).

An existing v1 save (the old single-team eleven-a-side board) is **migrated, not discarded**:
the roster keeps every bit of earned progress (stamina, form, ovr), the stored eleven is
re-solved by `autoFit` into the best seven for 2-3-1 with the leftovers pushed onto the
bench ahead of the old reserves, and the saved tactics come across intact. The away side is
seeded from its defaults, avoiding anyone the migrated home squad now uses.

### How custom positions behave

Overrides are keyed **by slot index**, and the rules are deliberately boring:

| Action | Effect on custom positions |
|---|---|
| Drag onto open grass | Sets that slot's position |
| Drag onto a team-mate / long-press swap | Players exchange slots; the *spots* stay put, so the two visibly trade places |
| Change formation | **Kept** — a player you placed by hand stays where you put him |
| Auto-fit seven | Kept — auto-fit changes personnel, never geometry |
| Empty a slot (to bench) | That slot's override is cleared, so the empty marker returns to the shape default |
| Reset positions | Clears every override for that side |

## Player photos

Every card falls back to a generated SVG avatar (club colours + initials), but you can drop
in real photos of your team:

1. Pick a photo from your team album.
2. Save it into `public/players/` as `<player-id>.jpg` — e.g. `ivan-petrescu-0.jpg`. Player
   ids are `slug-of-the-name-<index>`; find the exact id for anyone in `src/data/players.ts`
   (or open their sheet — it shows the hint with the exact filename when a photo is missing).
3. Refresh — Vite serves anything in `public/` as-is and hot-reloads it. Delete the file to
   go back to the generated avatar.

Square-ish JPGs look best (cards clip to a circle), but any size works — smaller loads
faster.

## Stack

| | |
|---|---|
| UI | React 19 |
| Build | Vite 8 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite`, custom dark esports theme |
| Animation | `motion` (Framer Motion) |
| State | `zustand` + `persist` middleware |
| Fonts | Oswald Variable (display) + Inter Variable (text), self-hosted |

## Running it

```bash
npm install     # install dependencies
npm run dev     # dev server on http://localhost:5173
npm run build   # type-check (tsc -b) then production build to dist/
npm run preview # serve the production build
npm run lint    # oxlint
```

Built for a phone first — 44px touch targets, thumb-zone tab bar, safe-area padding — but it
scales cleanly up to desktop.

## Layout

```
src/
  data/         players, clubs, formations (7s), team identities, tactics presets
  lib/          chemistry, lineup solving, pitch coordinate spaces, match simulation
  store/        zustand two-team store (+ v1→v2 migration) and per-side derived selectors
  components/   Pitch (versus board), SideToggle, PlayerToken, BenchStrip,
                FormationSelector, Header, TabBar
  components/ui Tappable, Slider, Sheet, Avatar, Bars, OvrBadge
  screens/      Versus (Lineup), Tactics, Squad, Match
  index.css     design tokens (colour incl. the away ramp, type scale, motion) + recipes
```

Coordinates live in two spaces (`src/lib/pitch.ts`): formations and drag overrides are stored
in **team-local** coordinates (y 0 = the goal you attack, y ≈ 93 = your own), and the pitch
maps them onto its half per side — which is what lets one shape serve both teams.

All names, clubs and squads are fictional. Not affiliated with EA or FIFA.
