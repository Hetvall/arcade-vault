# Juegos implementados

Fuente: tabla `games` en Supabase (`skjiaowautazmyrnrepo`). Actualizado 2026-09-09.

Los placeholders sin motor real (`gloton`, `invasores`) fueron eliminados del catálogo (ver
commit "remove unused styles and placeholder game components"); las filas `duelo-pixel` y
`ranaria` fueron renombradas/reemplazadas por `pong` y `frogger` respectivamente al portar sus
motores reales. Hoy **las 6 filas de la tabla `games` tienen motor real** (`HAS_REAL_ENGINE` en
`components/game-player.tsx`) — no queda ningún placeholder en el catálogo.

| id          | Título    | Categoría | Color   | Descripción breve                                       |
| ----------- | --------- | --------- | ------- | ------------------------------------------------------- |
| `arkanoid`  | ARKANOID  | ARCADE    | cyan    | Rebota la pelota y destruye muros de neón.              |
| `asteroids` | ASTEROIDS | SHOOTER   | yellow  | Pulveriza asteroides en gravedad cero.                  |
| `frogger`   | FROGGER   | ARCADE    | green   | Cruza la carretera y el río sin convertirte en papilla. |
| `pong`      | PONG      | VERSUS    | cyan    | Pelotea contra la CPU y no dejes que se te escape.      |
| `snake`     | SNAKE     | ARCADE    | green   | Devora frutas de píxel sin morder tu propia cola.       |
| `tetris`    | TETRIS    | PUZZLE    | magenta | Encaja las piezas antes de que el techo te aplaste.     |
