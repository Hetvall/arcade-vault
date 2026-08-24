# game-jam/columnas — Columnas Combo (opción B)

- **Estado:** Draft
- **Tema del jam:** `columnas` — Columns / Puyo-style (PUZZLE), sugerido en
  `references/game-suggestions.md` ("PUZZLE solo tiene Tetris; este es otro puzzle de piezas
  cayendo pero con match-3 en vez de líneas, mecánica claramente distinta.")
- **Concepto base:** Una tripleta de gemas de colores cae por un pozo estrecho; el jugador la
  desplaza y reordena sus colores antes de que aterrice. Al tocar el suelo o apilarse, cualquier
  grupo de 3 o más gemas del mismo color alineadas (fila, columna o diagonal) explota y libera
  espacio, encadenando reacciones si la caída posterior forma nuevos grupos.
- **Enfoque de esta opción:** Añade presión externa creciente (escombros que suben desde abajo
  cada cierto tiempo, al estilo Puyo Puyo Challenge), una gema especial "bomba" que limpia área, y
  un sistema de **3 vidas** con recuperación parcial en vez de game over instantáneo al
  desbordar. Más profundo y con más alcance de implementación que la opción A.
- **Fecha:** 2026-08-24
- **Categoría propuesta:** PUZZLE · **Color:** magenta

## Diseño

### Concepto y fantasía

Comparte con la opción A la fantasía central: reordenar colores dentro de una columna que cae y
provocar cadenas de coincidencias. La diferencia es que aquí el pozo **no es un espacio pasivo**:
cada cierto tiempo sube una fila de escombros desde el fondo, empujando la pila hacia el techo
independientemente de cómo juegue el jugador — como una autopista que se estrecha sola. Esto
convierte "columnas" en una carrera contra el tiempo además de un puzzle de patrones, y justifica
un sistema de vidas con recuperación (perder una vida limpia parte del tablero en vez de terminar
la partida), dando margen para remontar tras un mal momento — al estilo de los modos "challenge"
de Puyo Puyo, con más alcance y profundidad que la opción A.

### Mecánicas

**Tablero:** grilla de `COLS = 7` × `ROWS = 14` celdas de `BLOCK = 36px` → resolución lógica fija
del canvas **252×504px**, escalada por CSS. Un poco más ancho que la opción A para dar espacio a
la gestión de escombros sin que el pozo se sienta injustamente estrecho.

**La pieza:** tripleta vertical de 3 gemas. Cada gema es de uno de 6 colores normales
(`GEM_COLORS = ["#ff3b6f", "#ffd23b", "#3bff8f", "#3bc4ff", "#b23bff", "#ff8f3b"]`) con
probabilidad uniforme, **excepto** que cada gema individual tiene `BOMB_CHANCE = 5%` de
probabilidad de generarse como **gema bomba** (`"#ffffff"`, con un ícono de estrella) en vez de un
color normal. Spawnea centrada en `col = 3` (0-indexada de 7), gema superior en `row = 0`.

**Caída y controles (igual que la opción A):**

- `←` / `→`: mover una columna.
- `↑`: rotar colores dentro de la tripleta (`[top, middle, bottom] → [bottom, top, middle]`).
- `↓`: soft drop, **+1 punto/celda**.
- `Espacio`: hard drop, **+2 puntos/celda**.
- `P`: pausa/reanuda.

**Gema bomba:** al ser parte de un lock (no necesita alinearse con nada), si tras asentarse la
gravedad la gema bomba queda fija en el tablero (no fue eliminada por ser parte de un match
normal), se detona automáticamente en el siguiente escaneo: elimina las 8 celdas vecinas
(bloque 3×3 centrado en la bomba, sin importar el color) más ella misma, otorga
`50 puntos fijos + 10 puntos por cada celda no vacía destruida en el área`. La detonación cuenta
como un escaneo de cadena propio (incrementa `chainNumber` igual que un match normal) y puede
disparar nuevos matches por la gravedad resultante.

**Matches normales:** idénticos a la opción A — grupos de 3+ gemas del mismo color en línea recta
(horizontal, vertical, diagonal-↘, diagonal-↙), eliminados tras cada lock/detonación, con
gravedad y reescaneo en cadena. `puntos = gemasEliminadas * 10 * chainNumber` (mismo multiplicador
lineal que la opción A, `chainNumber` compartido con las detonaciones de bomba).

**Escombros (presión externa):** cada `garbageIntervalMs` (empieza en `20000` ms = 20s, mostrado
en el HUD como cuenta regresiva "Escombros en: Xs"), se inserta desde abajo una fila de
`garbageRowsPerWave = min(3, level)` filas de celdas grises indestructibles por sí solas
(`"#5a5a6a"`, sin color de match), empujando todo el contenido existente `garbageRowsPerWave`
filas hacia arriba (si una fila se sale del tablero por arriba, esas celdas se pierden y cuentan
como desbordamiento, ver abajo). Una celda de escombro **se destruye** automáticamente (sin sumar
puntos) cuando una gema de color adyacente (ortogonal) es eliminada en un match — así el jugador
puede "limpiar" escombros jugando cerca de ellos, igual que en Puyo. El contador se reinicia tras
cada oleada. `garbageIntervalMs = max(8000, 20000 - (level - 1) * 1500)`.

**Vidas y recuperación (condición de fin distinta a la opción A):** el jugador empieza con
`lives = 3`. Si al intentar spawnear la siguiente tripleta la celda de spawn está ocupada
**o** una oleada de escombros empuja contenido fuera del tablero por arriba:

1. Se resta 1 `life`.
2. Se limpia el **50% superior** del tablero (filas `0` a `ROWS/2 - 1`, redondeando hacia abajo:
   filas 0–6 de las 14) — no se cuenta como match ni suma puntos, es una penalización visual de
   "reinicio parcial".
3. Si `lives` llega a `0`, `gameOver: true` y la partida termina de verdad (sin más limpiezas).
4. Si `lives > 0`, la partida continúa: se spawnea la siguiente tripleta con normalidad.

**Curva de dificultad:** `level = floor(score / 500) + 1`. `dropInterval = max(150, 700 -
(level - 1) * 50)` ms (caída base más rápida que la opción A y sube más agresivo). El intervalo y
volumen de escombros también escalan con `level` (ver fórmulas arriba), a diferencia de la opción
A donde solo la velocidad de caída cambia.

### Controles

| Tecla     | Efecto                                          |
| --------- | ----------------------------------------------- |
| `←` `→`   | Mover la tripleta una columna                   |
| `↑`       | Rotar el orden de colores dentro de la tripleta |
| `↓`       | Soft drop (+1 punto/celda)                      |
| `Espacio` | Hard drop (+2 puntos/celda)                     |
| `P`       | Pausa/reanuda                                   |

### Estado y HUD

```ts
interface ColumnasComboState {
  score: number;
  lives: number; // 3 → 0
  level: number;
  garbageInSeconds: number; // cuenta regresiva a la próxima oleada de escombros, redondeada
  gameOver: boolean;
}
```

HUD: `Puntuación` (`score`), `Vidas` (`lives`, corazones — reutiliza el slot genérico de
Asteroids sin repurposar como hacen Tetris/Snake), `Nivel` (`level`), y una etiqueta adicional
"Escombros en: Xs" (`garbageInSeconds`) visible junto al HUD genérico (nuevo campo, no sustituye
ningún slot existente).

### Metadatos de catálogo propuestos

- `id`: `columnas`
- `title`: `COLUMNAS`
- `short`: `Encadena gemas, detona bombas y resiste la marea de escombros.`
- `long`: `Controla una tripleta de gemas que cae por un pozo bajo asedio. Alinea colores, detona
gemas bomba en área y limpia los escombros que suben desde el fondo antes de perder tus tres
vidas.`
- `cat`: `PUZZLE`
- `color`: `magenta`
- `cover`: `cover-columnas` (nueva — no existe hoy en `app/globals.css`; mismo slug propuesto por
  la opción A, ya que ambas comparten el mismo `id` de catálogo y solo una se implementará)

## Técnico

### Alcance

#### Dentro de alcance

- Motor `lib/games/columnas/engine.ts` — clase `ColumnasEngine` construida **desde cero**
  siguiendo el contrato de `reference.md` (constructor no arranca el loop; `start/pause/resume/
restart/destroy`; `onStateChange` cada frame; sin HUD/overlay dibujado en canvas; sin
  auto-reinicio en game-over) y las constantes fijadas arriba en `## Diseño` (grilla 7×14, celda
  36px, 6 colores + gema bomba al 5%, `dropInterval` inicial 700ms, escombros cada 20s
  decreciente, 3 vidas con limpieza parcial al 50%, curva de nivel cada 500 puntos).
- Wrapper `components/games/columnas-canvas.tsx` (Client Component, StrictMode-safe, `forwardRef`
  con `ColumnasCanvasHandle = { restart }`), canvas único `width={252} height={504}`.
- Wiring en `components/game-player.tsx` (`HAS_REAL_ENGINE` incluye `"columnas"`, rama de render,
  HUD con `lives` en el slot genérico "Vidas" + campo nuevo "Escombros en: Xs", PAUSA/FIN/JUGAR
  DE NUEVO conectados al engine real).
- CSS `.columnas-canvas` en `app/globals.css` (tablero centrado dentro de `.crt-screen`, mismo
  patrón que `.caida-canvas`) + `.cover-columnas` nuevo.
- Migración Supabase: `insert` de la fila en `games` (SQL abajo, a aplicar por `/spec-impl` con
  `mcp__supabase__apply_migration` — **no** por este spec).

#### Fuera de alcance

Controles táctiles, cambios de balance respecto a lo fijado en `## Diseño`, tablas nuevas
específicas del juego (los escombros/gemas bomba viven solo en el estado interno del engine, no
en Supabase), y conectar otros juegos del catálogo. Multijugador o escombros enviados entre
jugadores (esa mecánica de Puyo Puyo Challenge real requeriría VERSUS y está fuera de alcance de
esta opción, que sigue siendo de un solo jugador).

### Modelo de datos

```ts
// lib/games/columnas/engine.ts
interface ColumnasComboState {
  score: number;
  lives: number;
  level: number;
  garbageInSeconds: number;
  gameOver: boolean;
}

interface ColumnasComboCallbacks {
  onStateChange: (state: ColumnasComboState) => void;
}

class ColumnasEngine {
  constructor(canvas: HTMLCanvasElement, callbacks: ColumnasComboCallbacks);
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  destroy(): void;
}
```

```sql
insert into public.games (id, title, short, long, cat, cover, color)
values (
  'columnas',
  'COLUMNAS',
  'Encadena gemas, detona bombas y resiste la marea de escombros.',
  'Controla una tripleta de gemas que cae por un pozo bajo asedio. Alinea colores, detona gemas
bomba en área y limpia los escombros que suben desde el fondo antes de perder tus tres vidas.',
  'PUZZLE',
  'cover-columnas',
  'magenta'
);
```

### Plan de implementación

1. Leer esta opción completa (`columnas-combo.md`) como fuente de verdad de mecánicas/balance —
   no depende de constantes fijadas en `columnas-clasico.md`.
2. Crear `lib/games/columnas/engine.ts`: grilla 7×14, spawn de tripletas con probabilidad de
   bomba, movimiento/rotación de color, caída automática con `dropInterval` por nivel, lock,
   escaneo de matches en 4 direcciones + detonación de bombas en área 3×3, gravedad post-match,
   cadenas con multiplicador, oleadas de escombros por temporizador con destrucción por
   adyacencia, sistema de 3 vidas con limpieza parcial al desbordar, contrato
   `start/pause/resume/restart/destroy` + `onStateChange`.
3. Crear `components/games/columnas-canvas.tsx` (Client Component `forwardRef`) siguiendo el
   patrón de `caida-canvas.tsx`/`snake-canvas.tsx`.
4. Modificar `components/game-player.tsx`: añadir `"columnas"` a `HAS_REAL_ENGINE`, rama de
   render, HUD con `lives` (corazones) + nuevo campo "Escombros en: Xs", conectar PAUSA/FIN/
   JUGAR DE NUEVO al engine real.
5. Añadir `.columnas-canvas` y `.cover-columnas` en `app/globals.css`.
6. Aplicar la migración con `mcp__supabase__apply_migration` (insert de la fila `columnas`).
7. Prueba manual end-to-end: `npm run dev` → `/games` → COLUMNAS → "JUGAR AHORA"; mover, rotar
   colores, provocar un match simple, una cadena, detonar una bomba, esperar una oleada de
   escombros y limpiarla con un match adyacente, desbordar el pozo tres veces seguidas (perder
   las 3 vidas), confirmar el modal "FIN DEL JUEGO" con score real solo tras la tercera pérdida,
   guardar puntuación con iniciales, verificar en `/game/columnas` y `/leaderboard`; "JUGAR DE
   NUEVO" reinicia una partida real con `lives = 3`.
8. Ejecutar `npm run lint`.

### Criterios de aceptación

- [ ] `/game/columnas/play` renderiza el canvas real (pozo 7×14 con gemas de color, gema bomba
      distinguible visualmente, y filas de escombro grises) en vez de la arena placeholder.
- [ ] El HUD muestra `Puntuación`, `Vidas` (corazones), `Nivel` y "Escombros en: Xs" en tiempo
      real desde el estado del engine.
- [ ] El canvas no dibuja su propio SCORE/overlay "GAME OVER"/"VIDAS" — esa info vive solo en
      HUD/modal.
- [ ] `←`/`→` mueven la tripleta; `↑` rota el orden de colores; `↓` y `Espacio` funcionan igual
      que la opción A (+1/+2 puntos por celda).
- [ ] Un match de 3+ gemas del mismo color en línea recta se elimina tras el lock, con gravedad y
      reescaneo en cadena (`gemas * 10 * chainNumber`).
- [ ] Una gema bomba fija en el tablero detona en el siguiente escaneo, elimina el bloque 3×3 a
      su alrededor y suma `50 + 10 por celda destruida`.
- [ ] Cada `garbageIntervalMs` (que decrece por nivel) sube una oleada de `min(3, level)` filas de
      escombro gris desde el fondo; una celda de escombro se destruye cuando un match elimina una
      gema de color adyacente a ella.
- [ ] Al desbordar el pozo (spawn bloqueado o escombros empujando fuera del tablero) se resta 1
      vida y se limpia el 50% superior del tablero, sin terminar la partida mientras `lives > 0`.
- [ ] Al llegar `lives` a 0, `gameOver: true` y se abre el modal "FIN DEL JUEGO" con la
      puntuación final real; no hay auto-reinicio por teclado.
- [ ] PAUSA congela toda la simulación (caída, cadenas, temporizador de escombros) y muestra el
      overlay "EN PAUSA"; REANUDAR la retoma sin adelantar el reloj de escombros de golpe.
- [ ] Guardar la puntuación inserta una fila en `scores` para `columnas`; "JUGAR DE NUEVO"
      reinicia una partida jugable con `lives = 3`; salir llama `destroy()` (sin rAF colgando).
- [ ] `npm run lint` pasa sin errores nuevos.

### Decisiones tomadas y descartadas

- **Vidas con limpieza parcial en vez de game over instantáneo:** dado que los escombros suben
  sin importar cómo juegue el jugador, un desbordamiento no siempre es "culpa" del jugador — dar
  margen de recuperación (limpiar el 50% superior en vez de terminar la partida) hace que la
  presión de escombros sea interesante en vez de simplemente injusta. Se descartó un sistema sin
  vidas (game over al primer desborde, igual que la opción A) porque con escombros activos eso
  volvería la partida frustrantemente corta.
- **Gema bomba con detonación automática (no manual):** simplifica el input — no se añade una
  tecla nueva para "activar" la bomba; basta con que quede fija en el tablero. Mantiene el mismo
  set de controles que la opción A.
- **Escombro destruido por adyacencia, no por match directo del color gris:** el escombro no
  tiene color propio, así que nunca puede ser parte de un grupo de 3+ iguales; se limpia como
  efecto secundario de un match cercano, igual que el mecanismo real de Puyo Puyo, dándole
  sentido táctico a jugar pegado a los escombros en vez de ignorarlos.
- **Tablero más ancho (7×14 vs. 6×13 de la opción A):** compensa el espacio que ocupan las filas
  de escombro recién insertadas, para que el jugador tenga margen de maniobra lateral incluso
  bajo presión.
- **`chainNumber` compartido entre matches normales y detonaciones de bomba:** una detonación que
  dispara un match en cadena debe sentirse como parte de la misma combo, no reiniciar el contador
  — mantiene la fórmula de puntuación (`×chainNumber`) consistente en todos los casos.
- **Sin escombros enviados entre jugadores (no es VERSUS):** se consideró y se descartó extender
  esto a dos jugadores (como el Puyo Puyo Challenge real) porque cambiaría la categoría a VERSUS y
  el alcance de implementación (necesitaría input de un segundo jugador, división de pantalla o
  matchmaking) excede lo que un solo spec de game-jam debe cubrir; queda anotado como posible
  fase futura, no como parte de esta opción.

### Riesgos identificados

- React StrictMode monta/desmonta efectos dos veces en desarrollo; si `destroy()` no cancela el
  `requestAnimationFrame`, el temporizador de escombros ni los listeners de teclado, podrían
  quedar loops/timers duplicados — mitigación: probar pausa/reinicio/salida en desarrollo antes de
  dar por verificado, prestando atención especial al temporizador de escombros (fácil de duplicar
  si no se limpia con `destroy()`).
- Complejidad de la resolución de cadenas ahora incluye detonaciones de bomba además de matches
  normales — mayor superficie para bucles infinitos si la condición de parada no contempla ambos
  casos; mitigación: capar defensivamente el número de escanos por lock (p. ej. máximo 20).
- Insertar filas de escombro mientras una pieza está cayendo o mientras se resuelve una cadena
  podría corromper el estado si no se serializa correctamente — mitigación: el temporizador de
  escombros solo aplica la oleada cuando el tablero está en reposo (sin pieza activa cayendo ni
  cadena en resolución), encolando la oleada si el momento no es válido.
- RLS pública sin validación server-side de score — limitación conocida heredada de SPEC 06,
  aceptada, no se resuelve aquí.

## Por qué este enfoque frente al otro

Esta opción gana en **profundidad y rejugabilidad**: la presión externa de los escombros, la
gema bomba y el sistema de vidas con recuperación dan más razones para seguir jugando y más
decisiones tácticas por partida (cuándo limpiar escombros vs. cuándo priorizar cadenas grandes).
Pierde frente a la opción A en **simplicidad de implementación y de balance** — el motor tiene
más estados que coordinar (temporizador de escombros, detonaciones de bomba, limpieza parcial de
vidas) y más superficie de bugs potenciales (ver riesgos), lo que la hace más cara de construir y
de testear manualmente antes de dar el spec por implementado.
