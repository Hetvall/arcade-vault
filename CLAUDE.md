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
`specs/NN-titulo.md` (Spanish, sequential numbering) with status `Draft` → `Approved` →
`Implemented`, written with `/spec` and built with `/spec-impl` (from `Klerith/fernando-skills`,
installed under `.claude/skills/spec` and `.claude/skills/spec-impl`). Read `specs/` before
touching a feature area to see what's already decided, in progress, or explicitly out of scope.

### `/add-game` — porting a new arcade game

`.claude/skills/add-game` is a specialization of `/spec` for adding a new playable game. It
reads `.claude/skills/add-game/reference.md`, which documents the **5 seams** every ported game
repeats (see `## Adding a game` below), and produces a spec only — it never writes code or runs
migrations itself. Use it (`/add-game <carpeta-de-referencia-o-descripción>`) instead of
freehanding a new game spec. Reference engines to port live in `references/started-games/`
(currently `02-asteroids`, `03-tetris`, `04-arkanoid`).

### Agents (`.claude/agents/`)

Subagents that plan/design but never touch app code, specs-in-progress, or migrations themselves
— each hands off a concrete next step (a recommendation, spec files, or a Draft spec) for a human
or another skill to act on:

- **`game-planner`** (`model: opus`) — runs **before** `/add-game`; decides _which_ game to add
  next (not how to port it). Reads the Supabase catalog (`references/implemented-games.md`),
  `HAS_REAL_ENGINE`, and unconsumed sources in `references/started-games/`, then recommends one
  game with justification (catalog placeholders first, thin categories like VERSUS/PUZZLE
  weighted higher). Keeps a persistent, git-tracked memory of past suggestions in
  `references/game-suggestions.md` (a checklist) so it never repeats a recommendation. Output:
  "run `/add-game <id>`" for the user to act on.
- **`game-jam`** — given a theme, invents one original arcade game (engine built from scratch,
  Snake-style, not a 1:1 port) and writes **2 self-contained spec options** (design + technical in
  one file each) to `specs/game-jam/<id>/<enfoque-a>.md` / `<enfoque-b>.md`, each named after its
  own approach, for a human to review and pick one.
- **`skin-designer`** — audits that every game with a real engine (`asteroids`, `tetris`,
  `arkanoid`, `snake`) has at least 3 skins (neon, retro, clásico/default) that read well in the
  app's fixed dark mode, and **implements directly** (no approval gate) the palette-injection
  seam (engine → canvas → game-player) plus a **per-game** skin selector with independent
  persistence per game. Runs `npm run lint`/`build` to self-verify. Keeps coverage memory in
  `references/skin-coverage.md` and leaves `specs/skins/sistema-de-skins.md` as `Implemented`
  documentation of the work done, not a Draft awaiting `/spec-impl`.

## Current state

Implemented specs (`specs/01`–`09`, all `Implemented` except where noted):

- **01–03**: MVP visual screens, home landing, About page + contact email (`app/api/contact/route.ts`
  via Resend).
- **04**: Base Supabase integration — `lib/supabase/{client,server,middleware}.ts`, `proxy.ts`
  refreshing session cookies, `GET /api/health/supabase` diagnostic endpoint.
- **05**: First real game engine — Asteroids (`lib/games/asteroids/engine.ts` +
  `components/games/asteroids-canvas.tsx`), establishing the engine/canvas-wrapper pattern.
- **06**: Catalog + leaderboard migrated to real Supabase tables (`games`, `scores`, see
  `lib/supabase/games.ts`), replacing the mock `GAMES`/`seededScores`/`localStorage` scores.
  Auth/session (`av_user`) is still mock (`context/session-context.tsx`, `lib/session.ts`).
- **07–09**: Tetris, Arkanoid, Snake engines ported the same way (each its own
  `lib/games/<id>/engine.ts` + `components/games/<id>-canvas.tsx`).

Games with a real playable engine today (`HAS_REAL_ENGINE` in `components/game-player.tsx`):
`asteroids`, `tetris`, `arkanoid`, `snake`. All other rows seeded in the Supabase `games` table
still use the placeholder arena.

Still mock/out of scope: real Supabase Auth (login/register/logout are `localStorage`-backed via
`context/session-context.tsx`), OAuth buttons on `/login` (decorative), anti-cheat/score
validation beyond `score >= 0`, admin UI for the `games` table (catalog is migration-seeded only).

## Adding a game (the 5 seams)

Full recipe: `.claude/skills/add-game/reference.md`. Every ported game touches exactly these:

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
