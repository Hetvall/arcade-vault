# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault (`README.md`) is a platform for playing arcade games online and competing on
leaderboards. The app is a Next.js 16 (App Router, TypeScript, Tailwind v4) build, backed by a
real Supabase project (`skjiaowautazmyrnrepo`), and is well past the initial scaffold — see
`specs/` for the full history of what's implemented and `## Current state` below for a snapshot.

## Critical: this is not the Next.js you know

`package.json` pins `next@16.2.12`, a version ahead of training data with breaking API/convention
changes. Before writing or editing any Next.js code (routing, data fetching, layouts, config,
etc.), read the relevant guide under `node_modules/next/dist/docs/` (organized as
`01-app/`, `02-pages/`, `03-architecture/`, `04-community/`) — do not assume older Next.js
patterns still apply. Heed any deprecation notices found there. Notably: middleware is `proxy.ts`
(exports `proxy`), not `middleware.ts`.

## Commands

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint (flat config in `eslint.config.mjs`, extends `next/core-web-vitals` + `next/typescript`)

There is no test runner configured yet.

## Spec Driven Design

This project follows spec-driven development. Every non-trivial feature starts as a spec in
`specs/NN-titulo.md` (Spanish, sequential numbering; some features get their own subfolder, e.g.
`specs/skins/`, `specs/game-jam/<id>/`) with status `Draft` → `Approved` → `Implemented`, written
with `/spec` and built with `/spec-impl` (from `Klerith/fernando-skills`, installed under
`.claude/skills/spec` and `.claude/skills/spec-impl`). For a game spec specifically, use
`/spec-impl-game` instead: same implementation flow, but after the last plan step it automatically
chains the `skin-designer` then `mobile-porter` agents so the new game ships with skins and a
responsive layout (`.claude/skills/spec-impl-game`). Read `specs/` before touching a feature area
to see what's already decided, in progress, or explicitly out of scope.

### `/add-game` — porting a new arcade game

`.claude/skills/add-game` is a specialization of `/spec` for adding a new playable game. It
reads `.claude/skills/add-game/reference.md`, which documents the **5 seams** every ported game
repeats (see `## Adding a game` below), and produces a spec only — it never writes code or runs
migrations itself. Use it (`/add-game <carpeta-de-referencia-o-descripción>`) instead of
freehanding a new game spec. Reference engines to port live in `references/started-games/`
(currently `02-asteroids`, `03-tetris`, `04-arkanoid`).

### Agents (`.claude/agents/`)

Subagents that plan/design and, for most of them, implement directly — but never touch migrations
themselves. Each entry below is a one-line summary; read the linked `.md` for the full brief
(inputs, coverage-memory file, self-verify steps).

- **`game-planner`** (`model: opus`, `.claude/agents/game-planner.md`) — decides _which_ game to
  add next (not how to port it); recommends only, writes no specs/code.
- **`game-jam`** (`model: sonnet`, `.claude/agents/game-jam.md`) — given a theme, invents an
  original arcade game and writes 2 spec options to `specs/game-jam/<id>/` for a human to pick.
- **`skin-designer`** (`.claude/agents/skin-designer.md`) — implements directly: at least 3 skins
  (neon/retro/clásico) per real-engine game, palette-injection seam, and a per-game selector.
- **`mobile-porter`** (`.claude/agents/mobile-porter.md`) — implements directly: responsive/touch
  CSS and layout fixes across games and site pages, never touching game mechanics.
- **`game-performance-booster`** (`.claude/agents/game-performance-booster.md`) — implements
  directly: audits a given game against the perf anti-pattern catalog in
  `specs/11-rendimiento-frogger.md` and applies fixes (engine, canvas, CSS), using Arkanoid as the
  optimized reference.

## Current state

Implemented specs (`specs/01`–`11`, plus `specs/skins/` and `specs/game-jam/`, all `Implemented`
except where noted):

- **01–03**: MVP visual screens, home landing, About page + contact email (`app/api/contact/route.ts`
  via Resend).
- **04**: Base Supabase integration — `lib/supabase/{client,server,middleware}.ts`, `proxy.ts`
  refreshing session cookies, `GET /api/health/supabase` diagnostic endpoint.
- **05**: First real game engine — Asteroids (`lib/games/asteroids/engine.ts` +
  `components/games/asteroids-canvas.tsx`), establishing the engine/canvas-wrapper pattern.
- **06**: Catalog + leaderboard migrated to real Supabase tables (`games`, `scores`, see
  `lib/supabase/games.ts`), replacing the mock `GAMES`/`seededScores`/`localStorage` scores.
  Auth/session (`av_user`) is still mock (`context/session-context.tsx`, `lib/session.ts`).
- **07–09**: Tetris, Arkanoid, Snake engines ported/built the same way (each its own
  `lib/games/<id>/engine.ts` + `components/games/<id>-canvas.tsx`).
- **10**: Touch controls for mobile (`specs/10-controles-tactiles-moviles.md`) — on-screen controls
  and responsive canvas sizing across the 4 real-engine games of the time.
- **11**: Frogger performance pass (`specs/11-rendimiento-frogger.md`) — documents the canvas/React
  perf anti-pattern catalog (`emitState` dedupe, no per-entity `shadowBlur`/`shadowColor`, no
  `draw()` while paused, no shared CSS compositing layers over the live canvas) that
  `game-performance-booster` audits every real-engine game against.
- **`specs/skins/sistema-de-skins.md`**: per-game skin system (neon/retro/clásico), implemented by
  `skin-designer` for all 4 original real-engine games.
- **`specs/game-jam/frogger/`**: Frogger, an original game (not a port) invented via `game-jam` and
  added as a 5th real engine. Unlike the other four it's a single combined component,
  `lib/games/frogger/FroggerGame.tsx` (no separate `components/games/frogger-canvas.tsx`), and
  remounts via a `frogKey` instead of an imperative restart handle.
- **`specs/game-jam/columnas/`**: two `Draft` spec options (`columnas-clasico.md`,
  `columnas-combo.md`) awaiting a human pick — not yet implemented.

Games with a real playable engine today (`HAS_REAL_ENGINE` in `components/game-player.tsx`):
`asteroids`, `tetris`, `arkanoid`, `snake`, `frogger`. All other rows seeded in the Supabase `games`
table still use the placeholder arena. Note `references/implemented-games.md` (the game-planner
catalog memory) has not been updated to include `frogger` yet.

Still mock/out of scope: real Supabase Auth (login/register/logout are `localStorage`-backed via
`context/session-context.tsx`), OAuth buttons on `/login` (decorative), anti-cheat/score
validation beyond `score >= 0`, admin UI for the `games` table (catalog is migration-seeded only).

## Adding a game (the 5 seams)

Full recipe: `.claude/skills/add-game/reference.md`. This pattern applies to **ports** done via
`/add-game`; every ported game touches exactly these. Games invented from scratch by `game-jam`
(Snake, Frogger) don't start from a `game.js` source and may deviate — e.g. Frogger ships as a
single combined component instead of a separate engine + canvas wrapper (see `## Current state`).

1. **Engine** `lib/games/<id>/engine.ts` — a `<Game>Engine` class wrapping the original `game.js`
   in instance state (no cross-instance shared state). Constructor wires listeners but does not
   start the loop; only `start()` does, idempotently. `pause()`/`resume()`/`restart()`/`destroy()`.
   `onStateChange` callback fires every frame with the HUD-relevant state. **Strip** any
   canvas-drawn HUD/overlay and any auto-restart-on-keypress from the original — the React modal
   needs the frozen game-over state to save a score. Mechanics/constants are ported 1:1 (no
   rebalancing) unless explicitly requested.
2. **Canvas wrapper** `components/games/<id>-canvas.tsx` — Client Component mounting the
   `<canvas>` and managing the engine's lifecycle with React (mount/unmount, StrictMode-safe).
3. **Wiring** in `components/game-player.tsx` — add the id to `HAS_REAL_ENGINE`, add the render
   branch, wire the HUD fields, pause/game-over/play-again flow.
4. **CSS** — a `.{id}-canvas` rule in `app/globals.css` (and a new `.cover-<slug>` if the catalog
   cover art doesn't already have one).
5. **Supabase migration** — insert the new row into `games` via `mcp__supabase__apply_migration`
   (schema: `specs/06-leaderboard-y-catalogo-supabase.md`). No new tables/columns per game.

## Design reference: `references/templates/`

Static, non-Next.js HTML/CSS/JS prototype of the full product (`Arcade Vault.html` + plain
React-via-CDN `.jsx` files, no build step). It was the **original design and behavior spec** most
screens were ported from — most of it has now been implemented for real (see specs above), but it
remains useful when extending a screen or checking original Spanish copy/interaction intent:

- `data.jsx` — original mock game catalog/leaderboard shape (superseded by the real Supabase
  schema in `lib/games.ts` / `lib/supabase/games.ts`).
- `app.jsx` — original hash-based routing + `localStorage` auth/scores (superseded by App Router
  routes under `app/` and, for scores, real Supabase persistence; auth is still mock).
- `auth.jsx`, `biblioteca.jsx`, `detalle.jsx`, `reproductor.jsx`, `salon.jsx`, `nav.jsx` — one
  screen/component each, now implemented as `app/login`, `app/games`, `app/game/[id]`,
  `app/game/[id]/play`, `app/leaderboard`, `components/nav.tsx`.
- `styles.css` — the neon/pixel arcade visual system, translated into Tailwind + `app/globals.css`.

`references/started-games/` and `references/source-assets/` hold the original standalone
`game.js` sources used as porting input for `/add-game` (see above) — not part of the app itself.

## Skills

Usa siempre /frontend-design para hacer interfaces de usuarios.

Para portar un juego nuevo, usa siempre /add-game (ver `## Adding a game` arriba) en vez de
escribir el spec a mano.
