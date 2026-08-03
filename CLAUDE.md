# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault (`README.md`) is a platform for playing arcade games online and competing on
leaderboards. The app itself has **not been built yet** — this repo is currently a fresh
`create-next-app` scaffold (App Router, TypeScript, Tailwind v4). All real screens still need
to be implemented under `app/`.

## Critical: this is not the Next.js you know

`package.json` pins `next@16.2.12`, a version ahead of training data with breaking API/convention
changes. Before writing or editing any Next.js code (routing, data fetching, layouts, config,
etc.), read the relevant guide under `node_modules/next/dist/docs/` (organized as
`01-app/`, `02-pages/`, `03-architecture/`, `04-community/`) — do not assume older Next.js
patterns still apply. Heed any deprecation notices found there.

## Commands

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint (flat config in `eslint.config.mjs`, extends `next/core-web-vitals` + `next/typescript`)

There is no test runner configured yet.

## Design reference: `resources/templates/`

This directory contains a static, non-Next.js HTML/CSS/JS prototype of the full product
(`Arcade Vault.html` + plain React-via-CDN `.jsx` files, no build step). It is the **design and
behavior spec** to port into the real Next.js app under `app/`, not code to import or run as-is:

- `data.jsx` — mock game catalog (`GAMES`), categories, mock players, and a seeded fake
  leaderboard generator (`seededScores`). Useful as the shape of the eventual data model.
- `app.jsx` — root component wiring hash-based routing (`#biblioteca`, `#detalle`, `#player`,
  `#auth`, `#salon`) and `localStorage`-backed auth/session (`av_user`) and score persistence
  (`av_scores`). In the real app this routing/auth belongs to Next.js App Router conventions
  and real persistence, not hash routes or `localStorage`.
- `auth.jsx`, `biblioteca.jsx` (game library), `detalle.jsx` (game detail), `reproductor.jsx`
  (game player), `salon.jsx` (hall of fame / leaderboard), `nav.jsx` — one screen/component each,
  matching the routes wired in `app.jsx`.
- `styles.css` — the visual system (neon/pixel arcade aesthetic) to translate into Tailwind.

When implementing a screen, check the matching template file first for intended content,
copy (Spanish UI text), and interaction flow.

## Spec Driven Design

Per `README.md`, this project is meant to follow spec-driven development using the `/spec` and
`/spec-impl` skills from `Klerith/fernando-skills` (installed via `npx skills@latest add
Klerith/fernando-skills`). These skills are not yet installed in this repo — if asked to plan or
implement a feature and those skills are unavailable, say so before improvising a different
workflow.
