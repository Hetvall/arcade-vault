# Sugerencias de juegos — memoria de game-planner

Este archivo es la memoria persistente del agente `game-planner`
(`.claude/agents/game-planner.md`). Cada corrida del agente lee este To-Do antes de decidir, y lo
actualiza al final para no repetir sugerencias ya hechas.

Estados: `[ ]` sugerido · `[~]` aprobado (spec en curso) · `[x]` implementado

## Pendientes / sugeridos

- [ ] `gloton` — Pac-Man (ARCADE) · sugerido 2026-08-14 · Razón: refuerza ARCADE con maze-chase,
      mecánica distinta a Frogger/Arkanoid/Snake.
      (actualizado 2026-09-09: la fila placeholder `gloton` que existía en Supabase fue **eliminada
      del catálogo** — commit "remove unused styles and placeholder game components". Portar este
      juego hoy implica insertar una fila **nueva**, no reutilizar/actualizar una existente.)
      → `/add-game gloton`
- [ ] `invasores` — Space Invaders (SHOOTER) · sugerido 2026-08-14 · Razón: refuerza SHOOTER junto
      a Asteroids con carril fijo de disparo, mecánica distinta.
      (actualizado 2026-09-09: la fila placeholder `invasores` que existía en Supabase fue
      **eliminada del catálogo** — mismo commit de limpieza que `gloton`. Portar este juego hoy
      implica insertar una fila **nueva**.)
      → `/add-game invasores`
- [ ] `air-hockey` — Air Hockey (VERSUS) · sugerido 2026-08-14 · Razón: VERSUS ya tiene motor real
      (Pong, implementado 2026-08-31); Air Hockey aporta duelo físico en tiempo real, mecánica
      distinta al rebote de paletas de Pong.
      → `/add-game air-hockey`
- [ ] `tanques-duelo` — Combat / Battle Tanks (VERSUS) · sugerido 2026-08-14 · Razón: refuerza la
      categoría VERSUS más delgada con un shooter de laberinto a dos jugadores, mecánica de
      apuntado distinta a todo lo existente.
      → `/add-game tanques-duelo`
- [ ] `cuatro-en-linea` — Connect Four (VERSUS) · sugerido 2026-08-14 · Razón: variante VERSUS de
      ritmo lento/estratégico (tablero por turnos), gran contraste con la acción arcade del resto
      del catálogo.
      → `/add-game cuatro-en-linea`
- [ ] `columnas` — Columns / Puyo-style (PUZZLE) · sugerido 2026-08-14 · Razón: PUZZLE solo tiene
      Tetris; este es otro puzzle de piezas cayendo pero con match-3 en vez de líneas, mecánica
      claramente distinta.
      → `/add-game columnas`
- [ ] `dr-pastillas` — Dr. Mario-style (PUZZLE) · sugerido 2026-08-14 · Razón: cápsulas cayendo que
      emparejan colores contra virus; cubre PUZZLE con otra variante de fisicas de caída distinta
      a Tetris/Columnas.
      → `/add-game dr-pastillas`
- [ ] `minas` — Minesweeper (PUZZLE) · sugerido 2026-08-14 · Razón: puzzle de lógica sin piezas
      cayendo ni tiempo real, gran variedad de mecánica frente al resto de PUZZLE/ARCADE.
      → `/add-game minas`
- [ ] `memoria-simon` — Simon (PUZZLE) · sugerido 2026-08-14 · Razón: juego de memoria por
      secuencias, mecánica mínima y muy distinta, fácil de portar y de bajo esfuerzo.
      → `/add-game memoria-simon`
- [ ] `numero-2048` — 2048 (PUZZLE) · sugerido 2026-08-14 · Razón: puzzle de deslizar y fusionar
      fichas, otra mecánica de PUZZLE sin relación con piezas cayendo.
      → `/add-game numero-2048`
- [ ] `centopie` — Centipede (SHOOTER) · sugerido 2026-08-14 · Razón: shooter de campo de hongos
      con ciempiés descendente, apuntado libre distinto al carril fijo de Invasores/Asteroids.
      → `/add-game centopie`
- [ ] `comando-misiles` — Missile Command (SHOOTER) · sugerido 2026-08-14 · Razón: shooter de
      defensa con mira/click en vez de nave, variedad de input dentro de SHOOTER.
      → `/add-game comando-misiles`
- [ ] `saltarin-cubo` — Q*bert (ARCADE) · sugerido 2026-08-14 · Razón: plataformas isométricas de
      saltos y cambio de color, mecánica muy distinta al resto de ARCADE (maze/paddle/snake).
      → `/add-game saltarin-cubo`
- [ ] `pinball-neon` — Pinball (ARCADE) · sugerido 2026-08-14 · Razón: física de flippers y mesa,
      variedad grande dentro de ARCADE frente a Gloton/Ranaria/Arkanoid/Snake.
      → `/add-game pinball-neon`
- [ ] `escalador-barriles` — Donkey Kong-style platformer (PLATFORMER) · sugerido 2026-08-14 ·
      Razón: categoría PLATFORMER inexistente hoy; escalar plataformas esquivando barriles agrega
      una mecánica de salto/gravedad que no existe en el catálogo.
      → `/add-game escalador-barriles`
- [ ] `ave-pixel` — Flappy-style (ARCADE) · sugerido 2026-08-14 · Razón: endless de un botón, muy
      bajo esfuerzo de portar y variedad de ritmo dentro de ARCADE.
      → `/add-game ave-pixel`
- [ ] `carrera-neon` — Top-down racer (RACING) · sugerido 2026-08-14 · Razón: categoría RACING
      inexistente hoy; mecánica de vehículo/vueltas totalmente ausente del catálogo actual.
      → `/add-game carrera-neon`
- [ ] `boliche-pixel` — Bowling (SPORTS) · sugerido 2026-08-14 · Razón: categoría SPORTS
      inexistente hoy; apuntado y potencia con física de tiro único, variedad frente a la acción
      continua del resto.
      → `/add-game boliche-pixel`

## Implementados (histórico)

- [x] `asteroids` — Asteroids (SHOOTER)
- [x] `tetris` — Tetris (PUZZLE)
- [x] `arkanoid` — Arkanoid (ARCADE)
- [x] `snake` — Snake (ARCADE)
- [x] `frogger` — Frogger reinventado, vía agente `game-jam` (ARCADE) · spec en
      `specs/game-jam/frogger/01-frogger-core.md` (Implemented). Reemplazó la fila placeholder
      `ranaria` (el técnico terminó insertando/actualizando la fila como `frogger`, no `ranaria`).
- [x] `pong` — Pong, 1 jugador vs CPU (VERSUS) · spec `specs/14-juego-pong.md` (Implemented,
      2026-08-31). Reemplazó por completo la fila placeholder `duelo-pixel` (id, título y URL
      renombrados a `pong`/"PONG", sin conservar el slug viejo).
