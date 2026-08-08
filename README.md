# ULTRA XI

A mobile-first, FIFA Online style lineup builder. Pick a shape, drag eleven players into
it, argue with the chemistry web, write a tactical plan, then play the match and watch the
consequences land on your squad.

Everything runs offline in the browser. The player database, clubs and match engine are all
local and fictional — no API, no accounts, no network calls.

## Features

**Lineup** — the hero screen.
- Eight formations (4-3-3, 4-2-3-1, 3-5-2, 5-4-1, …). Switching shape slides the XI across
  canonical slots rather than rebuilding it.
- Chemistry web drawn straight onto the pitch: every slot links to its nearest neighbours,
  coloured by link strength (shared club, shared nation, position fit).
- Tap a token for a bottom sheet with the full attribute breakdown (PAC / SHO / PAS / DRI /
  DEF / PHY), position fit, form and stamina.
- Long-press a token to arm swap mode, then tap a second token to exchange them.
- Drag a token onto any other slot to swap in place.
- Substitutions: tap a bench card, then tap the starter coming off. Five subs, spent one at
  a time, with an animated flash on the incoming player.
- Tired legs are called out — a pulsing marker below 45 stamina, plus a colour-coded meter
  on every card.
- **Auto-fit XI** solves the whole board greedily: position fit first, effective rating second.

**Tactics** — a real plan, not decoration.
- Six instructions on sliders: mentality, pressure, width, depth, line height, tempo.
- Six presets (Balanced, Tiki-Taka, Counter, Park the Bus, High Press, Wing Play), each
  showing its projected fit *before* you apply it.
- A live tactical-fit gauge that scores the plan against your shape and your personnel — a
  high line with slow centre-backs, or a heavy press without the legs for it, is punished.
- Fit feeds the team rating directly, so the header number moves as you drag.

**Squad** — the database.
- ~50 players, searchable by name, club, nation or position.
- Filter chips by line (GK / DEF / MID / FWD) and sort by rating, name or position.
- Membership tags show at a glance who is starting and who is a sub.
- Tap any player to drop them into the XI (replacing the weakest starter, or into their best
  slot if already starting) or onto the bench.

**Match** — consequences.
- Simulated 90 minutes driven by your team rating, chemistry and tactical fit.
- Full-screen live overlay: score ticker, minute clock, minute-by-minute commentary streaming
  in, and a skip-to-full-time control.
- Post-match report: possession, shots, and per-player ratings with goals, assists, stamina
  cost and ▲/▼ rating movement.
- Stamina loss and rating changes are written back to the roster, so the next lineup you pick
  is shaped by the last match you played. **Rest squad** recovers stamina and resets subs.

The whole squad — lineup, bench, formation, tactics and last result — persists to
`localStorage`, so a reload drops you back exactly where you were.

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
  data/         players, clubs, formations, tactics presets (all local, deterministic)
  lib/          chemistry, lineup solving, match simulation
  store/        zustand squad store + derived selectors
  components/   Pitch, PlayerToken, BenchStrip, FormationSelector, Header, TabBar
  components/ui Tappable, Slider, Sheet, Avatar, Bars, OvrBadge
  screens/      Lineup, Tactics, Squad, Match
  index.css     design tokens (colour, type scale, spacing, motion) + component recipes
```

All names, clubs and squads are fictional. Not affiliated with EA or FIFA.
