# game-jam/columnas — Columnas Clásico (opción A)

- **Estado:** Draft
- **Tema del jam:** `columnas` — Columns / Puyo-style (PUZZLE), sugerido en
  `references/game-suggestions.md` ("PUZZLE solo tiene Tetris; este es otro puzzle de piezas
  cayendo pero con match-3 en vez de líneas, mecánica claramente distinta.")
- **Concepto base:** Una tripleta de gemas de colores cae por un pozo estrecho; el jugador la
  desplaza y reordena sus colores antes de que aterrice. Al tocar el suelo o apilarse, cualquier
  grupo de 3 o más gemas del mismo color alineadas (fila, columna o diagonal) explota y libera
  espacio, encadenando reacciones si la caída posterior forma nuevos grupos.
- **Enfoque de esta opción:** Versión fiel al Columns clásico — una sola vida (game over
  instantáneo al desbordar el pozo), sin mecánicas añadidas, curva de dificultad basada solo en
  velocidad de caída. Prioriza alcance mínimo y fidelidad al género.
- **Fecha:** 2026-08-24
- **Categoría propuesta:** PUZZLE · **Color:** cyan

## Diseño

### Concepto y fantasía

El tema "columnas" se refleja literalmente en la mecánica: el tablero es un pozo vertical
angosto (más alto que ancho, como una columna) y la pieza que cae es también una columna de 3
gemas apiladas. El jugador no mueve una forma compleja como en Tetris, sino que **reordena el
color dentro de su propia columna** — la variación de mecánica frente a Tetris/Snake/Arkanoid ya
sembrados es genuina: no hay rotación de forma, solo rotación de color, y el match es por
alineación de 3+ del mismo color en cualquier dirección (no por completar una fila entera).

Esta opción A apuesta por la fidelidad al Columns original de Sega (1990): una sola vida, sin
distracciones — el reto es puramente de percepción de patrones y velocidad de decisión.

### Mecánicas

**Tablero:** grilla de `COLS = 6` × `ROWS = 13` celdas de `BLOCK = 40px` → resolución lógica fija
del canvas **240×520px**, escalada por CSS.

**La pieza:** una tripleta vertical de 3 gemas, cada una de un color aleatorio entre 6 posibles
(`GEM_COLORS = ["#ff3b6f", "#ffd23b", "#3bff8f", "#3bc4ff", "#b23bff", "#ff8f3b"]` — rosa, amarillo,
verde, cian, violeta, naranja). Spawnea centrada en la columna `col = 2` (0-indexada), con la
gema superior en `row = 0`.

**Caída automática:** la tripleta desciende una celda cada `dropInterval` ms (ver curva de
dificultad abajo). Si la celda de abajo está ocupada o es el fondo del pozo, la pieza se fija
(`lock`) en su posición actual.

**Controles del jugador mientras la pieza cae:**

- `←` / `→`: desplaza la tripleta una columna (si la celda destino está libre).
- `↑`: rota los colores dentro de la tripleta — el orden cíclico es
  `[top, middle, bottom] → [bottom, top, middle]` (la gema inferior pasa a ser la superior). Es
  instantáneo, sin animación de "kick" (no hay colisión posible al rotar colores, solo formas).
- `↓`: soft drop — fuerza el descenso de una celda inmediatamente y otorga **+1 punto**. Se puede
  mantener pulsada; cada celda de soft-drop repite el cobro de +1 punto y no dispara el lock hasta
  que la pieza realmente no puede bajar más.
- `Espacio`: hard drop — la pieza cae instantáneamente hasta la primera colisión, otorga **+2
  puntos por cada celda** descendida de golpe, y se fija de inmediato.
- `P`: pausa/reanuda (atajo interno además del botón PAUSA del HUD genérico).

**Resolución de matches (tras cada lock):**

1. Se escanea el tablero completo buscando grupos de **3 o más** celdas ocupadas del mismo color
   conectadas en línea recta continua: horizontal, vertical, diagonal-↘ o diagonal-↙ (no en
   forma de "L" ni conteo de blob/flood-fill — solo líneas rectas de 3+).
2. Todas las celdas que forman parte de al menos un grupo válido se marcan y se eliminan a la vez.
3. Las gemas por encima de cada hueco caen por gravedad para llenarlo (una celda por sub-tick de
   `GRAVITY_STEP_MS = 60ms`, puramente visual — el resultado final de posiciones es instantáneo
   para el cálculo de nuevos matches).
4. Tras asentarse la gravedad, se vuelve a escanear (paso 1). Cada escaneo adicional que produce
   un nuevo grupo es una **cadena** (`chain`), incrementando el multiplicador.
5. El proceso repite hasta que un escaneo no produce ningún grupo nuevo; entonces se spawnea la
   siguiente tripleta.

**Puntuación por match:** `puntos = gemasEliminadasEnEsteEscaneo * 10 * chainNumber`, donde
`chainNumber` empieza en 1 para el primer escaneo con match tras el lock y sube +1 por cada
escaneo encadenado subsiguiente con match. Ejemplo: lock provoca un match de 4 gemas (chain 1) →
`4*10*1 = 40` puntos; la caída posterior forma un match de 3 gemas (chain 2) →
`3*10*2 = 60` puntos; total de esa secuencia: 100 puntos.

**Condición de derrota (una sola vida, sin contador de vidas):** si al intentar spawnear la
siguiente tripleta la celda `(row=0, col=2)` o `(row=1, col=2)` ya está ocupada, la partida
termina inmediatamente (`gameOver: true`), igual que el top-out de Tetris (SPEC 07). No hay
sistema de vidas ni reintento automático.

**Curva de dificultad:** `level = floor(totalGemsCleared / 30) + 1` (empieza en nivel 1).
`dropInterval = max(200, 800 - (level - 1) * 60)` ms. No hay otro cambio de balance por nivel
(mismo set de 6 colores, mismo tablero, sin basura ni piezas especiales).

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
interface ColumnasState {
  score: number;
  gemsCleared: number; // total histórico de gemas eliminadas, alimenta el nivel
  level: number;
  gameOver: boolean;
}
```

HUD: `Puntuación` (`score`), `Gemas` (`gemsCleared`, ocupa el hueco que en Tetris muestra
"Líneas" y en Asteroids "Vidas"), `Nivel` (`level`). Sin contador de vidas — igual que Tetris
(SPEC 07), la partida es de un solo intento.

### Metadatos de catálogo propuestos

- `id`: `columnas`
- `title`: `COLUMNAS`
- `short`: `Encadena gemas de colores antes de que el pozo se desborde.`
- `long`: `Controla una tripleta de gemas que cae por un pozo angosto. Reordena sus colores,
alinea tres o más iguales en cualquier dirección y provoca reacciones en cadena antes de que la
pila llegue al techo.`
- `cat`: `PUZZLE`
- `color`: `cyan`
- `cover`: `cover-columnas` (nueva — no existe hoy en `app/globals.css`)

## Técnico

### Alcance

#### Dentro de alcance

- Motor `lib/games/columnas/engine.ts` — clase `ColumnasEngine` construida **desde cero**
  siguiendo el contrato de `reference.md` (constructor no arranca el loop; `start/pause/resume/
restart/destroy`; `onStateChange` cada frame; sin HUD/overlay dibujado en canvas; sin
  auto-reinicio en game-over) y las constantes fijadas arriba en `## Diseño` (grilla 6×13, celda
  40px, 6 colores, `dropInterval` inicial 800ms, curva de nivel cada 30 gemas, puntuación
  10×chain, soft/hard drop).
- Wrapper `components/games/columnas-canvas.tsx` (Client Component, StrictMode-safe, `forwardRef`
  con `ColumnasCanvasHandle = { restart }`), canvas único `width={240} height={520}`.
- Wiring en `components/game-player.tsx` (`HAS_REAL_ENGINE` incluye `"columnas"`, rama de render,
  HUD con slot "Gemas" en vez de "Vidas"/"Líneas" cuando `game.id === "columnas"`, PAUSA/FIN/
  JUGAR DE NUEVO conectados al engine real).
- CSS `.columnas-canvas` en `app/globals.css` (tablero centrado dentro de `.crt-screen`, mismo
  patrón que `.caida-canvas`) + `.cover-columnas` nuevo.
- Migración Supabase: `insert` de la fila en `games` (SQL abajo, a aplicar por `/spec-impl` con
  `mcp__supabase__apply_migration` — **no** por este spec).

#### Fuera de alcance

Controles táctiles, basura/piezas especiales/sistema de vidas (eso es el enfoque de la opción B,
`columnas-combo.md`), cambios de balance respecto a lo fijado en `## Diseño`, tablas nuevas
específicas del juego, y conectar otros juegos del catálogo (`gloton`, `invasores`,
`duelo-pixel`, etc. — fuera de alcance hasta tener su propio spec).

### Modelo de datos

```ts
// lib/games/columnas/engine.ts
interface ColumnasState {
  score: number;
  gemsCleared: number;
  level: number;
  gameOver: boolean;
}

interface ColumnasCallbacks {
  onStateChange: (state: ColumnasState) => void;
}

class ColumnasEngine {
  constructor(canvas: HTMLCanvasElement, callbacks: ColumnasCallbacks);
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
  'Encadena gemas de colores antes de que el pozo se desborde.',
  'Controla una tripleta de gemas que cae por un pozo angosto. Reordena sus colores, alinea tres o
más iguales en cualquier dirección y provoca reacciones en cadena antes de que la pila llegue al
techo.',
  'PUZZLE',
  'cover-columnas',
  'cyan'
);
```

### Plan de implementación

1. Leer esta opción completa (`columnas-clasico.md`) como fuente de verdad de mecánicas/balance.
2. Crear `lib/games/columnas/engine.ts`: grilla 6×13, spawn de tripletas, movimiento/rotación de
   color, caída automática con `dropInterval` por nivel, lock, escaneo de matches en 4
   direcciones, gravedad post-match, cadenas con multiplicador, puntuación, condición de game
   over por spawn bloqueado, contrato `start/pause/resume/restart/destroy` + `onStateChange`.
3. Crear `components/games/columnas-canvas.tsx` (Client Component `forwardRef`) siguiendo el
   patrón de `caida-canvas.tsx`/`snake-canvas.tsx`.
4. Modificar `components/game-player.tsx`: añadir `"columnas"` a `HAS_REAL_ENGINE`, rama de
   render, slot HUD "Gemas", conectar PAUSA/FIN/JUGAR DE NUEVO al engine real.
5. Añadir `.columnas-canvas` y `.cover-columnas` en `app/globals.css`.
6. Aplicar la migración con `mcp__supabase__apply_migration` (insert de la fila `columnas`).
7. Prueba manual end-to-end: `npm run dev` → `/games` → COLUMNAS → "JUGAR AHORA"; mover, rotar
   colores, soft/hard drop, provocar un match simple y una cadena de 2+, pausar/reanudar,
   desbordar el pozo, confirmar modal "FIN DEL JUEGO" con score real, guardar puntuación con
   iniciales, verificar en `/game/columnas` y `/leaderboard`; "JUGAR DE NUEVO" reinicia una
   partida real.
8. Ejecutar `npm run lint`.

### Criterios de aceptación

- [ ] `/game/columnas/play` renderiza el canvas real (pozo 6×13 con gemas de color) en vez de la
      arena placeholder.
- [ ] El HUD muestra `Puntuación`, `Gemas` y `Nivel` en tiempo real desde el estado del engine.
- [ ] El canvas no dibuja su propio SCORE/overlay "GAME OVER" — esa info vive solo en HUD/modal.
- [ ] `←`/`→` mueven la tripleta; `↑` rota el orden de colores sin cambiar de columna/fila.
- [ ] `↓` acelera la caída sumando +1 punto/celda; `Espacio` hace hard drop sumando +2
      puntos/celda y fija la pieza al instante.
- [ ] Un grupo de 3+ gemas del mismo color en línea recta (horizontal, vertical o diagonal) se
      elimina tras el lock; las gemas superiores caen para llenar el hueco.
- [ ] Una cadena de 2+ escaneos con match consecutivos multiplica la puntuación según
      `gemas * 10 * chainNumber`.
- [ ] La velocidad de caída aumenta por nivel (`level = floor(gemsCleared/30)+1`) y el HUD
      "Nivel" lo refleja.
- [ ] Si la celda de spawn está ocupada, la partida termina de inmediato (una sola vida, sin
      auto-reinicio por teclado) y abre el modal "FIN DEL JUEGO" con la puntuación final real.
- [ ] PAUSA congela la simulación real y muestra el overlay "EN PAUSA"; REANUDAR la retoma.
- [ ] Guardar la puntuación inserta una fila en `scores` para `columnas`; "JUGAR DE NUEVO"
      reinicia una partida jugable; salir llama `destroy()` (sin rAF colgando).
- [ ] `npm run lint` pasa sin errores nuevos.

### Decisiones tomadas y descartadas

- **Match por líneas rectas (no flood-fill de blob):** replica la regla original de Columns —
  mantiene el motor simple (4 escaneos direccionales) y evita ambigüedad sobre qué cuenta como
  "grupo conectado" en diagonal.
- **Rotación de color en vez de rotación de forma:** la pieza siempre ocupa las mismas 3 celdas
  verticales; solo cambia qué color está en qué celda. Evita toda la complejidad de wall-kicks de
  Tetris (SPEC 07) — no aplica aquí porque no hay forma que rotar.
- **Sin sistema de vidas, sin basura, sin piezas especiales:** decisión explícita de esta opción
  para minimizar alcance y quedar más cerca del Columns original; la opción B
  (`columnas-combo.md`) cubre el otro extremo con vidas y mecánicas añadidas.
- **Multiplicador de cadena simple (`×chainNumber` lineal):** fácil de razonar y de testear
  manualmente frente a fórmulas exponenciales; suficiente para premiar cadenas sin desbalancear
  la curva de puntuación.
- **`gemsCleared` en vez de `lines` en el HUD:** sigue el precedente de Tetris ("Líneas") y Snake
  ("Longitud") de repurposar el slot "Vidas" del HUD genérico con la métrica relevante del juego.

### Riesgos identificados

- React StrictMode monta/desmonta efectos dos veces en desarrollo; si `destroy()` no cancela el
  `requestAnimationFrame` ni remueve los listeners de teclado, podrían quedar loops o listeners
  duplicados — mitigación: probar pausa/reinicio/salida en desarrollo antes de dar por verificado.
- La resolución recursiva de cadenas (match → gravedad → nuevo escaneo) puede entrar en bucles si
  la condición de parada ("ningún grupo nuevo") no se evalúa correctamente tras cada gravedad —
  mitigación: capar defensivamente el número de escaneos por lock (p. ej. máximo 20) y loguear si
  se alcanza, aunque en la práctica un tablero 6×13 nunca debería necesitar tantos.
- RLS pública sin validación server-side de score — limitación conocida heredada de SPEC 06,
  aceptada, no se resuelve aquí.

## Por qué este enfoque frente al otro

Esta opción gana en **simplicidad y velocidad de implementación**: sin basura, sin piezas bomba,
sin sistema de vidas, el motor tiene menos estados que testear y el balance es más fácil de
razonar. Pierde frente a la opción B en **profundidad y rejugabilidad** — no hay presión externa
creciente (la basura de `columnas-combo.md`) ni una mecánica de recuperación tras desbordar el
pozo, así que una partida mediocre termina de golpe sin margen de error, lo que puede sentirse
más punitivo para un jugador nuevo.
