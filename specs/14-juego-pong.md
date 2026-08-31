# 14 — Juego Pong (pong)

- **Estado:** Implemented
- **Depende de:** SPEC 06
- **Fecha:** 2026-08-31
- **Objetivo:** Crear un motor de Pong en TypeScript (desde cero, modo 1 jugador vs CPU con puntuación de supervivencia por peloteos) y conectarlo al catálogo/leaderboard de Supabase renombrando la entrada placeholder `duelo-pixel` a `pong`, reemplazando la arena placeholder de `GamePlayer` por el juego real con HUD, pausa, fin de partida y guardado de puntuación integrados.

## Alcance

### Dentro de alcance

- Nuevo motor `lib/games/pong/engine.ts` con la clase `PongEngine`, escrito desde cero (no hay
  `game.js` de referencia), modo **1 jugador vs CPU**:
  - Canvas de resolución lógica fija **800×600** (4:3), escalado por CSS dentro de `.crt-screen`.
  - **Paleta del jugador** a la izquierda; **paleta de la CPU** a la derecha. Dimensiones
    **14×90 px**, margen **24 px** desde su borde. Velocidad del jugador **7 px/frame**.
  - **Pelota** cuadrada **14×14 px**. Saque desde el centro hacia un lado aleatorio tras una breve
    pausa de saque (~**0.8 s**). Al golpear una paleta, la componente Y depende del punto de impacto
    (más lejos del centro = más ángulo) y la magnitud sube **+3 %** por golpe hasta un tope.
  - **Puntuación de supervivencia:**
    - **+10** por cada retorno exitoso del jugador (la pelota toca su paleta).
    - **+50** de bonus cuando la pelota rebasa a la CPU (gol del jugador); re-saque.
  - **Vidas:** empieza en **3**. Si la pelota rebasa la paleta del jugador, **−1 vida** y re-saque.
    Game over a **0 vidas** (sin auto-reinicio).
  - **Progresión por niveles:** `level = floor(retornosTotales / 5) + 1`. Sube la velocidad base de
    la pelota (`5 + (level-1)*0.6`, tope **11**) y la velocidad máx de la CPU (`4 + (level-1)*0.5`,
    tope **9**, siempre menor que la del jugador para que sea superable pero endurezca).
  - **IA de la CPU:** mueve su paleta hacia el centro-Y de la pelota, limitada por su velocidad máx
    del nivel (tracking imperfecto → superable al inicio, difícil al subir de nivel).
  - **Controles solo teclado:** **↑/↓** y **W/S** mueven la paleta del jugador. Sin control de la
    paleta CPU.
  - `PongEngine` respeta el contrato de `reference.md`: constructor que **no** arranca el loop,
    `start()` idempotente (`requestAnimationFrame`), `pause()`/`resume()` (flag interno; `update` no
    avanza en pausa), `restart()` (reinicia desde cero), `destroy()` (cancela el rAF pendiente y
    remueve los listeners de teclado de `window`). Listeners y loop como campos arrow de instancia.
    `emitState()` llama `onStateChange` cada frame.
  - El motor **no** dibuja HUD/overlay en el canvas (score/vidas/nivel y "GAME OVER" salen por
    `onStateChange` y los pinta React). Al terminar se queda en `gameOver: true` sin auto-reinicio;
    solo `restart()` externo reinicia (mismo motivo que SPEC 05/09: no perder la puntuación mientras
    el modal pide iniciales por teclado).
  - Dibujo en canvas: fondo oscuro, línea central punteada de neón, dos paletas neón (cyan) y pelota
    neón. Sin sprites ni assets de imagen (todo vectorial en canvas).
- Nuevo Client Component `components/games/pong-canvas.tsx` (`forwardRef`), mismo patrón que
  `snake-canvas.tsx`/`asteroids-canvas.tsx`: monta `<canvas width={800} height={600}
className="pong-canvas" />`, instancia el engine en un `useEffect` deps `[]` (cleanup con
  `destroy()`), efecto `[paused]` → `pause()/resume()`, efecto `[onStateChange]` que actualiza un
  `onStateChangeRef`, y `useImperativeHandle` exponiendo `{ restart }`.
- Wiring en `components/game-player.tsx`, siguiendo la forma vigente del archivo (banderas por juego
  `isAsteroids`/`isFrogger`/… y el gate de motor real, sea `HAS_REAL_ENGINE` o su equivalente
  actual):
  - Registrar `"pong"` como motor real (en el set/gate que hoy distingue motor real vs arena
    placeholder).
  - `isPong = game.id === "pong"`; importar `PongCanvas`/`PongCanvasHandle`/`PongState`; `pongRef`;
    `handlePongStateChange` (`useCallback` deps `[]`) que hace `setScore`, `setLives`, `setLevel`, y
    `setOver(true)` si `state.gameOver`.
  - Renderizar `<PongCanvas>` dentro de `.crt-screen` con `paused={paused || over}` cuando `isPong`.
  - HUD: reutiliza las celdas genéricas **Puntuación**, **Vidas** y **Nivel** tal cual (Pong sí usa
    `lives`, a diferencia de Snake; **no** hace falta generalizar ninguna celda del HUD).
  - `restart()` llama `pongRef.current?.restart()` en su rama; los botones PAUSA/REANUDAR, FIN y
    JUGAR DE NUEVO, el modal de fin de partida y el flujo `saveScore`/`saving`/`saveError` se
    reutilizan sin cambios.
- CSS en `app/globals.css`:
  - `.pong-canvas`: canvas 4:3 que llena el `.crt-screen` (`position: absolute; inset: 0; width:
100%; height: 100%`), como `.asteroids-canvas`, con marco/estilo neón cyan.
  - `.cover-pong`: nueva portada de catálogo neón para la tarjeta del juego (no existe `.cover-duelo`
    en `globals.css`).
- Migración Supabase con `mcp__supabase__apply_migration`: **renombrar** la fila `duelo-pixel` a
  `pong` (id + título + copia + cover), reasignando cualquier score que la referencie.

### Fuera de alcance

- Controles táctiles/móviles — solo teclado, igual que el resto de juegos con motor real.
- Skins múltiples — se entrega solo el look clásico neón; las skins llegan por `skin-designer`.
- Modo 2 jugadores local — se implementa 1 jugador vs CPU; el multijugador local, si llega, va en
  su propio spec.
- Modo clásico "primero a N puntos" — se usa puntuación de supervivencia por peloteos con vidas.
- Cambios al esquema de Supabase (`games`/`scores` ya existen por SPEC 06); no se crean tablas ni
  columnas nuevas.
- **Migración en Producción** — no hay acceso a esa BD; su SQL se entrega al usuario aparte (ver
  Modelo de datos), no se aplica ni se edita `db/migracion-prod.sql` en este spec.
- Conectar los demás juegos placeholder (`gloton`, `invasores`) — siguen fuera hasta su propio spec.
- Autenticación real / validación server-side de la puntuación — se mantiene la limitación conocida
  de SPEC 06 (RLS pública sin auth).

## Modelo de datos

```ts
// lib/games/pong/engine.ts
interface PongState {
  score: number;
  lives: number; // vidas restantes del jugador (empieza en 3)
  level: number; // tier de velocidad (empieza en 1)
  gameOver: boolean;
}

class PongEngine {
  constructor(
    canvas: HTMLCanvasElement,
    callbacks: {
      onStateChange: (state: PongState) => void;
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
update public.scores set game = 'pong' where game = 'duelo-pixel';

update public.games
set id    = 'pong',
    title = 'PONG',
    short = '<resumen corto, tema vs CPU / peloteos>',
    long  = '<descripción larga, tema Pong neón vs CPU>',
    cover = 'cover-pong'
where id = 'duelo-pixel';
-- cat ('VERSUS') y color ('cyan') se mantienen.
```

Este `update` se aplica **solo en Desarrollo** vía `mcp__supabase__apply_migration`. Para
**Producción** (sin acceso), el mismo cambio se entrega al usuario como SQL para que lo ejecute él
en el SQL Editor de Prod — **después de terminar la implementación y solo cuando lo pida**. No se
edita `db/migracion-prod.sql` como parte de este spec.

## Plan de implementación

1. Leer `node_modules/next/dist/docs/01-app/` sobre Client Components, `useEffect` y `<canvas>` en
   Next 16, para confirmar convenciones antes de codear.
2. Crear `lib/games/pong/engine.ts`: clase `PongEngine` con canvas 800×600, paletas jugador/CPU,
   pelota con saque/rebotes/aceleración, IA de la CPU, puntuación por peloteos (+10/retorno,
   +50/gol), vidas (3) y aceleración por niveles, y el contrato `start/pause/resume/restart/destroy`
   - `onStateChange` por frame. Sin HUD/overlay en canvas ni auto-reinicio.
3. Crear `components/games/pong-canvas.tsx` (Client Component `forwardRef`) siguiendo el patrón de
   `snake-canvas.tsx`.
4. Modificar `components/game-player.tsx`: registrar `"pong"` como motor real, `isPong`, `pongRef`,
   `handlePongStateChange`, la rama de render de `PongCanvas`, y el `restart()` del engine real
   (HUD Puntuación/Vidas/Nivel se reutiliza sin cambios).
5. Añadir `.pong-canvas` y `.cover-pong` en `app/globals.css`.
6. Aplicar la migración **en Desarrollo** con `mcp__supabase__apply_migration` (renombrar
   `duelo-pixel`→`pong` + reasignar scores + `cover-pong`), como en el modelo de datos. **No** tocar
   Producción ni `db/migracion-prod.sql`; el SQL de Prod se entrega al usuario aparte al final, solo
   cuando lo pida.
7. Prueba manual end-to-end: `npm run dev` → `/games` → PONG → "JUGAR AHORA"; jugar con teclado
   (mover paleta, rallar, anotar a la CPU, subir de nivel/velocidad), pausar/reanudar, fallar hasta
   perder las 3 vidas, confirmar el modal "FIN DEL JUEGO" con el score real, guardar puntuación con
   iniciales, verificar que aparece en `/game/pong` y en `/leaderboard` (pestaña PONG); "JUGAR DE
   NUEVO" reinicia una partida real.
8. Confirmar que los demás juegos placeholder siguen igual y ejecutar `npm run lint`.

## Criterios de aceptación

- [x] `/game/pong/play` renderiza el canvas real de Pong (dos paletas + pelota + línea central) en
      vez de la arena placeholder.
- [x] El HUD muestra `Puntuación`, `Vidas` y `Nivel` en tiempo real desde el estado del engine (no
      el `setInterval` de puntaje aleatorio).
- [x] El canvas no dibuja su propio SCORE/overlay "GAME OVER" — esa info vive solo en HUD/modal.
- [x] ↑/↓ y W/S mueven la paleta del jugador; la CPU se controla sola.
- [x] Cada retorno exitoso suma +10; rebasar a la CPU suma +50 y re-saca.
- [x] Rebasar la paleta del jugador resta una vida y re-saca; a 0 vidas termina la partida (sin
      auto-reinicio) y abre el modal "FIN DEL JUEGO" con la puntuación final real.
- [x] La velocidad de la pelota y de la CPU aumenta por niveles y el HUD "Nivel" lo refleja.
- [x] PAUSA congela la simulación real y muestra el overlay "EN PAUSA"; REANUDAR la retoma.
- [x] Guardar la puntuación inserta una fila en `scores` para `pong` vía `saveScore`; "JUGAR DE
      NUEVO" reinicia una partida jugable; salir llama `destroy()` (sin rAF colgando).
- [x] En **Desarrollo**, la fila `duelo-pixel` ya no existe; `games` tiene `pong` (PONG, VERSUS,
      `cover-pong`, cyan) y aparece en `/games`, `/game/pong` y `/leaderboard`.
- [x] El SQL equivalente para **Producción** queda listo para entregar al usuario (no aplicado aquí).
- [x] `npm run lint` pasa sin errores nuevos.

## Decisiones tomadas y descartadas

- **Sí — 1 jugador vs CPU:** genera un score individual limpio que encaja en el leaderboard de un
  solo entero de SPEC 06 sin tocar el esquema. **No — 2 jugadores local:** no hay score individual
  natural que guardar; si llega, va en su propio spec.
- **Sí — puntuación de supervivencia por peloteos (+ vidas + aceleración):** da un high-score
  creciente ideal para ranking, como Snake. **No — clásico "primero a N":** techo de score bajo y
  fijo, peor para un leaderboard.
- **Sí — motor clase TS (`PongEngine`) desde cero con el contrato de Asteroids/Snake:** montaje/
  desmontaje limpio con React StrictMode y `destroy()` determinista. **No — componente único estilo
  Frogger:** se prefiere el patrón mayoritario de los 4 motores originales.
- **Sí — renombrar `duelo-pixel`→`pong`:** sigue el precedente del repo (`serpentina`→`snake`,
  etc.); evita duplicar el juego. Se reasignan scores previos por seguridad aunque el placeholder no
  fuera jugable. **No — insertar una fila `pong` nueva junto a `duelo-pixel`:** dejaría el
  placeholder huérfano en el catálogo.
- **Sí — balance declarado aquí** (paleta 14×90, jugador 7px/f, pelota base 5 +0.6/nivel tope 11,
  CPU 4 +0.5/nivel tope 9, +3 %/golpe, +10/retorno, +50/gol, 3 vidas, nivel cada 5 retornos): no
  hay original, así que se fija como balance de referencia del juego.
- **Sí — HUD reutiliza `Vidas`:** Pong sí tiene vidas, a diferencia de Snake; no se generaliza
  ninguna celda del HUD.
- **Sí — táctil y skins fuera de alcance:** se mantiene el spec contenido, igual que Snake; llegan
  por `mobile-porter`/`skin-designer`.

## Riesgos identificados

- React StrictMode monta/desmonta efectos dos veces en desarrollo; si `destroy()` no cancela el
  `requestAnimationFrame` ni remueve los listeners de teclado, podrían quedar dos loops o listeners
  duplicados — mitigación: probar pausa/reinicio/salida en desarrollo antes de dar por verificado.
- La migración cambia la **PK** `games.id`; si existieran scores referenciando `duelo-pixel` sin
  reasignar, la FK fallaría — mitigación: el `update scores ... set game='pong'` va antes del
  `update games` en la misma migración.
- IA de la CPU demasiado perfecta haría el juego injugable (nunca falla) → sin high-score posible;
  mitigación: la velocidad de la CPU está capada por debajo de la del jugador y del ángulo máximo de
  la pelota, dejando huecos ganables que se estrechan al subir de nivel.
- RLS pública sin validación server-side de score — limitación conocida heredada de SPEC 06,
  aceptada, no se resuelve aquí.

## What is **not** in this spec

- Controles táctiles/móviles.
- Skins múltiples.
- Modo 2 jugadores local.
- Modo clásico "primero a N puntos".

Cada uno, si llega, va en su propio spec.
