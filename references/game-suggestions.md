# Sugerencias de juegos — memoria de game-planner

Este archivo es la memoria persistente del agente `game-planner`
(`.claude/agents/game-planner.md`). Cada corrida del agente lee este To-Do antes de decidir, y lo
actualiza al final para no repetir sugerencias ya hechas.

Estados: `[ ]` sugerido · `[~]` aprobado (spec en curso) · `[x]` implementado

## Pendientes / sugeridos

- [ ] `duelo-pixel` — Pong (VERSUS) · sugerido 2026-08-14 · Razón: VERSUS solo tiene 1 juego en el
      catálogo; Pong es mecánicamente simple y ya tiene fila en Supabase (placeholder sin engine).
      → `/add-game duelo-pixel`
- [ ] `gloton` — Pac-Man (ARCADE) · placeholder en catálogo, sin engine.
- [ ] `invasores` — Space Invaders (SHOOTER) · placeholder en catálogo, sin engine.
- [ ] `ranaria` — Frogger (ARCADE) · placeholder en catálogo, sin engine.

## Implementados (histórico)

- [x] `asteroids` — Asteroids (SHOOTER)
- [x] `tetris` — Tetris (PUZZLE)
- [x] `arkanoid` — Arkanoid (ARCADE)
- [x] `snake` — Snake (ARCADE)
