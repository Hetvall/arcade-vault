# 09 — Juego Snake (snake)

- **Estado:** Implementado
- **Depende de:** SPEC 06
- **Fecha:** 2026-08-13
- **Objetivo:** Crear un motor de Snake en TypeScript (sin código de referencia, mecánicas clásicas) y conectarlo al catálogo/leaderboard de Supabase renombrando la entrada placeholder `serpentina` a `snake`, reemplazando la arena placeholder de `GamePlayer` por el juego real con HUD, pausa, fin de partida y guardado de puntuación integrados.

## Alcance

### Dentro de alcance

- Nuevo motor `lib/games/snake/engine.ts` con la clase `SnakeEngine`, escrito desde cero (no hay
  `game.js` de referencia) con mecánicas de Snake clásico:
  - Tablero de grilla **20×20 celdas** sobre un canvas de resolución lógica fija **800×800**
    (celdas de **40px**), escalado por CSS dentro de `.crt-screen`.
  - Serpiente que empieza con **longitud 3**, avanza una celda por tick, crece **+1** al comer.
  - Comida: una fruta en una celda vacía aleatoria; el sprite se elige al azar del atlas de
    `fruits.png` (fila de píxel-art, `y=136`, 22 frutas) — solo estético. Cada fruta suma **+10**.
  - **Muerte** (game over, sin vidas) al chocar contra cualquier borde del tablero o contra la
    propia cola.
  - Controles solo teclado: flechas **←↑→↓** y **WASD** cambian de dirección; no se permite
    invertir 180° directamente (giro opuesto ignorado en el mismo tick).
  - **Progresión de velocidad por niveles:** `level = floor(fruitsEaten / 5) + 1`; el intervalo
    de tick arranca en `140ms` y baja `12ms` por nivel hasta un piso de `60ms`. (Valores de
    balance definidos en este spec, no heredados de ningún original.)
  - `SnakeEngine` respeta el contrato de `reference.md`: constructor que **no** arranca el loop,
    `start()` idempotente (`requestAnimationFrame`), `pause()`/`resume()` (flag interno; `update`
    no avanza en pausa), `restart()` (reinicia la partida desde cero), `destroy()` (cancela el
    rAF pendiente y remueve los listeners de teclado de `window`). Listeners y loop como campos
    arrow de instancia para identidad estable. `emitState()` llama `onStateChange` cada frame.
  - El motor **no** dibuja HUD/overlay en el canvas (score/longitud/nivel y "GAME OVER" salen por
    `onStateChange` y los pinta React). Al morir se queda en `gameOver: true` sin auto-reinicio;
    solo `restart()` externo reinicia (mismo motivo que SPEC 05: no perder la puntuación mientras
    el modal pide iniciales por teclado).
  - Dibujo en canvas: fondo oscuro del tablero con grilla sutil, segmentos de la serpiente en
    verde neón (cabeza diferenciada), y la fruta dibujada con `drawImage` desde el atlas con
    padding dentro de su celda.
- **Assets de imagen (seam extra, nuevo en el repo):** copiar
  `references/source-assets/snake-assets/fruits.png` a **`public/snake-assets/fruits.png`** para
  servirlo estáticamente. El motor carga la imagen con `new Image()` (`src = "/snake-assets/fruits.png"`),
  y hasta que `img.complete`/`onload` dibuja la comida como un rombo/óvalo de color de respaldo
  para no bloquear el arranque. Las coordenadas del atlas (fila `y=136`) se incluyen inline en el
  motor, tomadas de `references/source-assets/snake-assets/sprites.js`.
- Nuevo Client Component `components/games/snake-canvas.tsx` (`forwardRef`), mismo patrón que
  `asteroids-canvas.tsx`/`tetris-canvas.tsx`: monta `<canvas width={800} height={800}
className="snake-canvas" />`, instancia el engine en un `useEffect` con deps `[]` (cleanup con
  `destroy()`), efecto `[paused]` → `pause()/resume()`, efecto `[onStateChange]` que actualiza un
  `onStateChangeRef`, y `useImperativeHandle` exponiendo `{ restart }`.
- Wiring en `components/game-player.tsx`:
  - Añadir `"snake"` a `HAS_REAL_ENGINE`.
  - `isSnake = game.id === "snake"`; importar `SnakeCanvas`/`SnakeCanvasHandle`/`SnakeState`;
    `snakeRef`; `handleSnakeStateChange` (`useCallback` deps `[]`) que hace `setScore`,
    `setLength`, `setLevel`, y `setOver(true)` si `state.gameOver`.
  - Renderizar `<SnakeCanvas>` dentro de `.crt-screen` con `paused={paused || over}` cuando
    `isSnake`.
  - Nuevo estado React `length` y generalizar la celda del HUD que hoy hace
    `{isTetris ? "Líneas" : "Vidas"}` para que en Snake muestre **"Longitud"** con el valor
    `length` (Snake no usa corazones ni el estado `lives`).
  - `restart()` llama `snakeRef.current?.restart()` en la rama correspondiente; los botones
    PAUSA/REANUDAR, FIN y JUGAR DE NUEVO, el modal de fin de partida y el flujo `saveScore`/
    `saving`/`saveError` se reutilizan sin cambios.
- CSS `.snake-canvas` en `app/globals.css`: canvas cuadrado 1:1 centrado por altura dentro del
  `.crt-screen` 4:3 (mismo enfoque que `.tetris-canvas`: `height: 100%; width: auto; aspect-ratio:
1 / 1; left: 50%; transform: translateX(-50%)`) con marco neón verde. No hace falta cover nuevo:
  `.cover-snake` ya existe.
- Migración Supabase con `mcp__supabase__apply_migration`: **renombrar** la fila `serpentina` a
  `snake` (id + título + copia de frutas), reasignando cualquier score que la referencie.

### Fuera de alcance

- Controles táctiles/móviles — solo teclado, igual que el resto de juegos con motor real.
- Sprites propios para el cuerpo de la serpiente — se dibuja con rectángulos neón en canvas (solo
  las frutas usan `fruits.png`); las demás filas/atlas de `fruits.png` no se usan.
- Sistema de vidas, power-ups, obstáculos, modos de dificultad seleccionables u otras variantes —
  se implementa Snake clásico de una sola vida con aceleración por niveles.
- Cambios al esquema de Supabase (`games`/`scores` ya existen por SPEC 06); no se crean tablas ni
  columnas nuevas específicas del juego.
- Conectar los demás juegos del catálogo que siguen con la arena placeholder (`gloton`,
  `invasores`, `ranaria`, `duelo-pixel`) — siguen fuera de alcance hasta tener su propio spec.
- Autenticación real / validación server-side de la puntuación — se mantiene la limitación
  conocida de SPEC 06 (RLS pública sin auth).

## Modelo de datos

```ts
// lib/games/snake/engine.ts
interface SnakeState {
  score: number;
  length: number; // nº de segmentos de la serpiente
  level: number; // tier de velocidad (empieza en 1)
  gameOver: boolean;
}

class SnakeEngine {
  constructor(
    canvas: HTMLCanvasElement,
    callbacks: {
      onStateChange: (state: SnakeState) => void;
    }
  );
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  destroy(): void;
}
```

No se introducen tablas ni columnas nuevas. La única operación de datos es renombrar la fila
existente del catálogo (placeholder → juego real):

```sql
-- reasigna scores previos (si los hubiera) antes de mover la PK
update public.scores set game = 'snake' where game = 'serpentina';

update public.games
set id    = 'snake',
    title = 'SNAKE',
    short = '<resumen corto, tema frutas>',
    long  = '<descripción larga, tema frutas de píxel>'
where id = 'serpentina';
-- cat ('ARCADE'), cover ('cover-snake') y color ('green') se mantienen.
```

(La copia definitiva `short`/`long` se redacta en la implementación siguiendo el tono neón del
resto del catálogo; el `id` `snake` es el mismo valor que se añade a `HAS_REAL_ENGINE`.)

## Plan de implementación

1. Leer `node_modules/next/dist/docs/01-app/` sobre Client Components, `useEffect`, `<canvas>` y
   carga de assets estáticos desde `public/` en Next 16, para confirmar convenciones antes de codear.
2. Copiar `references/source-assets/snake-assets/fruits.png` → `public/snake-assets/fruits.png`.
3. Crear `lib/games/snake/engine.ts`: clase `SnakeEngine` con la grilla 20×20 sobre canvas
   800×800, movimiento por tick, crecimiento, colisión con pared/cola, comida con fruta aleatoria
   (+10), aceleración por niveles, carga de `fruits.png` con respaldo dibujado, y el contrato
   `start/pause/resume/restart/destroy` + `onStateChange` por frame. Sin HUD/overlay en canvas ni
   auto-reinicio.
4. Crear `components/games/snake-canvas.tsx` (Client Component `forwardRef`) siguiendo el patrón de
   `tetris-canvas.tsx`.
5. Modificar `components/game-player.tsx`: añadir `"snake"` a `HAS_REAL_ENGINE`, `isSnake`,
   `snakeRef`, estado `length`, `handleSnakeStateChange`, la rama de render de `SnakeCanvas`, la
   celda HUD "Longitud", y el `restart()` del engine real.
6. Añadir la regla `.snake-canvas` en `app/globals.css`.
7. Aplicar la migración con `mcp__supabase__apply_migration` (renombrar `serpentina`→`snake` +
   reasignar scores), como en el modelo de datos.
8. Prueba manual end-to-end: `npm run dev` → `/games` → SNAKE → "JUGAR AHORA"; jugar con teclado
   (girar, comer frutas, crecer, subir de nivel/velocidad), pausar/reanudar, chocar contra pared y
   contra la cola, confirmar el modal "FIN DEL JUEGO" con el score real (no overlay del canvas),
   guardar puntuación con iniciales, verificar que aparece en `/game/snake` (mejor global +
   partidas + top) y en `/leaderboard` (pestaña SNAKE); "JUGAR DE NUEVO" reinicia una partida real.
9. Confirmar que los demás juegos placeholder siguen igual y ejecutar `npm run lint`.

## Criterios de aceptación

- [x] `/game/snake/play` renderiza el canvas real de Snake (serpiente neón + fruta de sprite) en
      vez de la arena placeholder.
- [x] El HUD muestra `Puntuación`, `Longitud` y `Nivel` en tiempo real desde el estado del engine
      (no el `setInterval` de puntaje aleatorio).
- [x] El canvas no dibuja su propio SCORE/overlay "GAME OVER" — esa info vive solo en HUD/modal.
- [x] Flechas y WASD cambian de dirección; no se puede invertir 180° en un mismo tick.
- [x] La serpiente crece +1 y suma +10 al comer; la fruta reaparece en una celda vacía con un
      sprite aleatorio de `fruits.png`.
- [x] Chocar contra un borde o contra la propia cola termina la partida (sin vidas) y abre el
      modal "FIN DEL JUEGO" con la puntuación final real; no hay auto-reinicio por teclado.
- [x] La velocidad aumenta por niveles al comer y el HUD "Nivel" lo refleja.
- [x] PAUSA congela la simulación real y muestra el overlay "EN PAUSA"; REANUDAR la retoma.
- [x] Guardar la puntuación inserta una fila en `scores` para `snake` vía `saveScore`; "JUGAR DE
      NUEVO" reinicia una partida jugable; salir llama `destroy()` (sin rAF colgando).
- [x] La fila `serpentina` ya no existe; `games` tiene `snake` (SNAKE, ARCADE, `cover-snake`,
      green) con la copia de frutas, y aparece en `/games`, `/game/snake` y `/leaderboard`.
- [x] `npm run lint` pasa sin errores nuevos.

## Decisiones tomadas y descartadas

- **Motor clase TS con callbacks (`SnakeEngine`) escrito desde cero**: no hay `game.js` de
  referencia, pero se adopta el mismo contrato que Asteroids/Tetris/Arkanoid para montaje/desmontaje
  limpio con React StrictMode y `destroy()` determinista.
- **Renombrar `serpentina`→`snake` en vez de insertar una fila nueva**: sigue el precedente del
  repo (`rocas`→`asteroids`, `caída`→`tetris`, `bloque-buster`→`arkanoid`); evita duplicar el juego
  en el catálogo. Se reasignan scores previos por seguridad aunque el placeholder no fuera jugable.
- **Copia actualizada al tema de frutas**: la copia de `serpentina` hablaba de "núcleos magenta";
  como la comida real son frutas de píxel, los textos se ajustan a lo que se juega.
- **Vida única + "Longitud" en el HUD**: Snake clásico es de una sola vida; se reutiliza el hueco
  "Vidas"/"Líneas" del HUD para mostrar la longitud (como Tetris con "Líneas"), sin tocar el estado
  `lives`.
- **Frutas cosméticas con puntos fijos (+10)**: mantiene el balance simple y fiel al clásico; la
  variedad de sprites da riqueza visual sin complicar la puntuación.
- **`fruits.png` servido desde `public/` y cargado con `new Image()`**: es el primer juego con
  assets de imagen; servirlo como estático de Next y dibujarlo con respaldo hasta que cargue evita
  bloquear el arranque del canvas.
- **Canvas cuadrado 800×800 escalado por CSS, centrado como Tetris**: Snake es cuadrado; se centra
  dentro del CRT 4:3 con marco neón, manteniendo las constantes de física en resolución lógica fija.
- **Sin balance heredado**: al no haber original, los valores (tick 140ms, −12ms/nivel, piso 60ms,
  +10/fruta, longitud inicial 3, nivel cada 5 frutas) se declaran explícitamente aquí como el
  balance de referencia del juego.

## Riesgos identificados

- React StrictMode monta/desmonta efectos dos veces en desarrollo; si `destroy()` no cancela el
  `requestAnimationFrame` ni remueve los listeners de teclado, podrían quedar dos loops o listeners
  duplicados — mitigación: probar pausa/reinicio/salida en desarrollo antes de dar por verificado.
- Carga asíncrona de `fruits.png`: si se dibuja antes de `onload` sin respaldo, la comida no se
  vería el primer frame — mitigación: dibujar forma de respaldo hasta `img.complete`.
- La migración cambia la **PK** `games.id`; si existieran scores referenciando `serpentina` sin
  reasignar, la FK fallaría — mitigación: el `update scores ... set game='snake'` va antes del
  `update games` en la misma migración.
- RLS pública sin validación server-side de score — limitación conocida heredada de SPEC 06,
  aceptada, no se resuelve aquí.
