# 08 — Juego Arkanoid

- **Estado:** Implemented
- **Depende de:** SPEC 06
- **Fecha:** 2026-08-13
- **Objetivo:** Portar el prototipo de Arkanoid (`references/started-games/04-arkanoid/game.js`) a un motor TypeScript reutilizable y conectarlo a la entrada `arkanoid` del catálogo Supabase (renombrada desde la fila ya sembrada `bloque-buster`), reemplazando la arena placeholder de `GamePlayer` por el juego real con sprites, sonido, HUD, pausa, fin de partida y guardado de puntuación integrados a la plataforma.

## Alcance

### Dentro de alcance

- Nuevo motor de juego portado 1:1 en mecánicas desde `references/started-games/04-arkanoid/game.js`: física de paleta (`PADDLE_SPEED = 400` px/s, clamp a los bordes del canvas), física de pelota escalada por `dt` (`BASE_BALL_VX = 200`, `BASE_BALL_VY = -300`), rebote en paredes (izquierda/derecha/arriba, sin pared inferior), rebote en paleta (solo cuando `vy > 0`, overlap en X, tolerancia de 8px bajo el borde superior de la paleta, reflexión vertical simple sin modular el ángulo por punto de impacto), colisión con bloques (`collideAABB`, un bloque destruido por frame, `+10` puntos, flip de `vy`), los 5 niveles de `levels.js` con su `speed` por nivel (`1.00, 1.10, 1.21, 1.33, 1.46`) aplicado a `BASE_BALL_VX`/`BASE_BALL_VY` en `initBall`, pérdida de vida al caer la pelota bajo el canvas (`lives = 3` inicial, `initBall()` en cada pérdida, `gameState = 'gameover'` al llegar a 0), avance automático de nivel al destruir todos los bloques (`loadLevel(currentLevel + 1)`), y estado `'win'` al superar el nivel 5. Ninguna constante de balance (velocidades, puntos, tamaños, tolerancia de rebote, curva de velocidad por nivel) cambia respecto al original.
- Se portan también las explosiones de bloque (`explosions[]`, 4 frames vía `EXPLOSION_FRAMES[color]`, `EXPLOSION_DURATION = 150` ms) como parte del gameplay (VFX, no HUD).
- Se portan los sprites y el audio del original, a diferencia de Asteroids/Tetris (que no usan assets externos):
  - Los helpers de `references/started-games/04-arkanoid/assets/spritesheet.js` (`loadSpritesheet`, `drawSprite`, `drawFrame`, `SPRITES`, `EXPLOSION_FRAMES`) se portan dentro del motor, cargando la imagen desde `public/games/arkanoid/spritesheet-breakout.png` (copiada 1:1 desde `assets/spritesheet-breakout.png`).
  - Los sonidos `ball-bounce.mp3` (rebote en pared/paleta) y `break-sound.mp3` (bloque destruido) se copian a `public/games/arkanoid/` y se reproducen igual que el original, vía `.cloneNode().play()` para permitir solape de instancias simultáneas.
  - `start()` espera a que `loadSpritesheet` resuelva antes de arrancar el primer `requestAnimationFrame`; si `destroy()` se llama antes de que la carga termine, el callback de carga no debe arrancar el loop (flag interno de "destruido").
- El motor se reestructura de variables/funciones globales de módulo a una clase `ArkanoidEngine` sin estado compartido entre instancias, para poder montarse/desmontarse limpiamente con el ciclo de vida de React (incluye StrictMode).
- `ArkanoidEngine` expone:
  - `constructor(canvas: HTMLCanvasElement, callbacks: { onStateChange(state: ArkanoidState): void })`.
  - `start()` — arranca el loop (`requestAnimationFrame`) y la partida una vez cargado el spritesheet; idempotente.
  - `pause()` / `resume()` — congelan/reanudan la simulación (`update(dt)` no avanza en pausa; el loop sigue vivo pero no avanza estado ni redibuja más que el último frame).
  - `restart()` — reinicia la partida desde cero (equivalente a `initPaddle()` + `loadLevel(1)` del original).
  - `destroy()` — cancela el `requestAnimationFrame` pendiente y remueve los listeners de teclado.
  - `onStateChange` se invoca en cada frame con `{ score, lives, level, gameOver }`, reemplazando el HUD (`Score`/`Nivel`/iconos de vidas, `game.js:230-244`) y los overlays de `GAME OVER` / `¡Completaste el juego!` / pausa (`drawOverlay`, `drawPauseOverlay`, `PAUSE_BTN_*`) que el original dibujaba directamente en el canvas, los cuales se eliminan del `draw()` portado.
  - Se añade un cap de `dt` (~50ms, mismo patrón que `AsteroidsEngine`/`TetrisEngine`) para evitar que un frame largo (cambio de pestaña) atraviese la pelota a través de la paleta o un bloque; el original no tenía cap. Esto no es un cambio de balance: solo evita tunneling en frames anómalos, sin alterar velocidades ni resultados en juego normal.
- **Se elimina** del original: el control de paleta por ratón (`mousemove` con corrección de escala del canvas) y el handler de `click` sobre el canvas (selector de nivel en pausa, `PAUSE_BTN_*`). El estado `'win'` (nivel 5 superado) se mapea a `gameOver: true` igual que `'gameover'`, sin distinguir texto de victoria — usa el mismo modal genérico "FIN DEL JUEGO" de la plataforma.
- El canvas mantiene resolución lógica fija 800×600 (mismas coordenadas y constantes que el original) y se escala visualmente por CSS dentro de `.crt-screen`, sin recalcular físicas por tamaño de contenedor.
- Nuevo Client Component `ArkanoidCanvas` (`components/games/arkanoid-canvas.tsx`, clon estructural de `AsteroidsCanvas`) que:
  - Renderiza un único `<canvas width={800} height={600} className="arkanoid-canvas">`, instancia `ArkanoidEngine` en un efecto de montaje con deps `[]` (`useRef` para la instancia, cleanup con `destroy()`).
  - Recibe `paused: boolean` por props y llama `pause()`/`resume()` en el engine cuando cambia (efecto separado, deps `[paused]`).
  - Recibe `onStateChange` por props y lo reenvía al engine vía un ref intermedio (`onStateChangeRef`, mismo patrón que `AsteroidsCanvas`/`TetrisCanvas`, para no reinstanciar el engine en cada render del padre).
  - Expone `restart()` al padre vía `useImperativeHandle`/`forwardRef` (`ArkanoidCanvasHandle`).
- `components/game-player.tsx` se modifica para soportar un tercer juego con motor real:
  - `HAS_REAL_ENGINE` pasa a incluir `"arkanoid"`.
  - Se añade `isArkanoid = game.id === "arkanoid"`, un `useRef<ArkanoidCanvasHandle>(null)`, y una rama condicional que renderiza `ArkanoidCanvas` dentro de `.crt-screen` en lugar del `.game-arena` placeholder, con `paused={paused || over}` (igual que las otras dos ramas — el modal de fin de partida también congela el engine).
  - `handleArkanoidStateChange` (`useCallback` con deps `[]`) hace `setScore/setLives/setLevel` desde el `state` recibido y `if (state.gameOver) setOver(true)`.
  - El slot 3 del HUD (hoy `isTetris ? "Líneas" : "Vidas"`) no cambia: Arkanoid tiene vidas como Asteroids, así que cae en la rama `"Vidas"`/corazones existente sin modificarla.
  - "Nivel" en el HUD usa `state.level` real de `arkanoid` (1 a 5), igual que ya hace para `asteroids`/`caida`.
  - El botón "PAUSA"/"REANUDAR" controla pausa real para `arkanoid` igual que para los otros dos juegos.
  - El botón "FIN" para `arkanoid` fuerza el fin de partida usando el score/estado actual del engine, igual que para `asteroids`/`caida`.
  - "JUGAR DE NUEVO" en el modal llama `restart()` sobre el `ArkanoidEngine` real para `arkanoid`.
- Controles: solo teclado (`←`/`→` mover paleta), igual que la parte de teclado del original. El ratón y el selector de nivel en pausa quedan fuera de alcance (ver "Fuera de alcance"). Soporte táctil también queda fuera de alcance.
- CSS nuevo en `app/globals.css`: `.arkanoid-canvas`, idéntica en forma a `.asteroids-canvas` (`position: absolute; inset: 0; width: 100%; height: 100%; display: block;`), mismo patrón de escalado 4:3 dentro de `.crt-screen`. No se crea ninguna clase `cover-*` nueva: `cover-bricks` ya existe y queda asignada a la fila renombrada.
- Catálogo/Supabase: la fila `bloque-buster` ya sembrada por SPEC 06 (`cat: ARCADE`, `color: cyan`, `cover: cover-bricks`) se **actualiza** (no se inserta una fila nueva) para reflejar el juego real portado:
  ```sql
  update public.games
  set id = 'arkanoid',
      title = 'ARKANOID',
      short = 'Rebota la pelota y destruye muros de neón.',
      long = 'Controla la paleta, mantén la pelota en juego y despeja cinco niveles de bloques de colores antes de quedarte sin vidas.'
  where id = 'bloque-buster';
  ```
  Antes de aplicar el `update`, `/spec-impl` debe comprobar que no existan filas en `scores` con `game = 'bloque-buster'` (no debería haber, porque el juego nunca tuvo motor real ni fue jugable); si las hubiera, se migran junto con el `update` en la misma migración para no perder puntuaciones huérfanas.

### Fuera de alcance

- Controles táctiles/móviles para Arkanoid.
- Control de paleta por ratón y el selector de nivel por click en pausa del original — se elimina, no se reimplementa en React.
- Cualquier cambio de mecánicas o balance del juego (velocidades, puntos, layouts de los 5 niveles, tolerancia de rebote de paleta) respecto a `references/started-games/04-arkanoid/game.js` — la portada es 1:1.
- Distinguir el estado `'win'` (nivel 5 completado) del `'gameover'` con texto o UI propia — ambos usan el mismo modal genérico "FIN DEL JUEGO".
- Insertar una fila nueva en `games` — se reutiliza y renombra la fila ya sembrada `bloque-buster`.
- Migrar el guardado de puntuaciones a un modelo distinto — `saveScore`/`insertScore` de SPEC 06 siguen funcionando sin cambios, ahora escribiendo con `game = 'arkanoid'`.
- Conectar los demás juegos del catálogo que siguen con la arena placeholder (`duelo-pixel`, `gloton`, `invasores`, `ranaria`, `serpentina`) a motores reales.
- Redimensionar el canvas dinámicamente según el contenedor (ResizeObserver) — se escala por CSS manteniendo la resolución lógica fija 800×600.
- Cualquier tabla o columna nueva específica de Arkanoid — este spec no amplía el esquema de SPEC 06.

## Modelo de datos

```ts
// lib/games/arkanoid/engine.ts
interface ArkanoidState {
  score: number;
  lives: number;
  level: number; // 1..5
  gameOver: boolean; // true tanto en derrota (lives === 0) como en victoria (nivel 5 superado)
}

interface ArkanoidCallbacks {
  onStateChange: (state: ArkanoidState) => void;
}

class ArkanoidEngine {
  constructor(canvas: HTMLCanvasElement, callbacks: ArkanoidCallbacks);
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  destroy(): void;
}
```

No se agregan tablas ni columnas nuevas a Supabase, ni claves de `localStorage` nuevas. El único cambio de datos es el `update` de la fila `bloque-buster` → `arkanoid` en `games` (ver SQL arriba); `scores` sigue con el mismo esquema de SPEC 06, ahora recibiendo filas con `game = 'arkanoid'`.

## Plan de implementación

1. Leer `node_modules/next/dist/docs/01-app/` en lo referente a Client Components, `useEffect`, manejo de `<canvas>`/APIs de navegador y servir archivos estáticos desde `public/`, para confirmar que no hay convención distinta en Next 16 que afecte este patrón.
2. Copiar `references/started-games/04-arkanoid/assets/spritesheet-breakout.png`, `assets/sounds/ball-bounce.mp3` y `assets/sounds/break-sound.mp3` a `public/games/arkanoid/`.
3. Crear `lib/games/arkanoid/engine.ts`: portar la lógica de `update`/`draw`/`initPaddle`/`initBall`/`loadLevel`/`collideAABB` desde `references/started-games/04-arkanoid/game.js` y los 5 niveles de `levels.js`, envolviéndolos en la clase `ArkanoidEngine` (estado de instancia, no globals de módulo). Portar `loadSpritesheet`/`drawSprite`/`drawFrame`/`SPRITES`/`EXPLOSION_FRAMES` desde `assets/spritesheet.js`, apuntando la carga de imagen a `/games/arkanoid/spritesheet-breakout.png`, y el audio a `/games/arkanoid/ball-bounce.mp3` y `/games/arkanoid/break-sound.mp3`. Quitar el HUD en canvas, los overlays (`drawOverlay`, `drawPauseOverlay`, `PAUSE_BTN_*`) y los listeners de ratón/click. Añadir `pause()`/`resume()` (flag interno que `update()` respeta), un cap de `dt` (~50ms) y `onStateChange` al final de cada `update()`.
4. Crear `components/games/arkanoid-canvas.tsx` (Client Component): monta el `<canvas width={800} height={600} className="arkanoid-canvas">`, instancia `ArkanoidEngine` en `useEffect` (cleanup con `destroy()`), sincroniza `paused` por props con `pause()/resume()`, reenvía `onStateChange`, y expone `restart()` vía `useImperativeHandle`/`forwardRef`.
5. Modificar `components/game-player.tsx`: añadir `"arkanoid"` a `HAS_REAL_ENGINE`, añadir `isArkanoid`, el `useRef<ArkanoidCanvasHandle>`, la rama de render dentro de `.crt-screen`, `handleArkanoidStateChange`, y el dispatch de `restart()` en el botón "JUGAR DE NUEVO", manteniendo el comportamiento actual sin cambios para `asteroids`/`caida`/el resto del catálogo.
6. Añadir la regla `.arkanoid-canvas` en `app/globals.css`, junto a `.asteroids-canvas`.
7. Aplicar la migración con `mcp__supabase__apply_migration`: comprobar que no existan filas en `scores` con `game = 'bloque-buster'` y, si las hay, migrarlas a `game = 'arkanoid'` en la misma migración; luego ejecutar el `update` de la fila `bloque-buster` → `arkanoid` (id/title/short/long) descrito en "Modelo de datos".
8. Prueba manual end-to-end: `npm run dev`, ir a `/games` → ARKANOID → "JUGAR AHORA", mover la paleta con teclado, romper bloques (confirmar sonido `break-sound` y animación de explosión), rebotar en paredes/paleta (confirmar sonido `ball-bounce`), superar un nivel y confirmar que carga el siguiente con su velocidad, perder las 3 vidas y confirmar que el juego se congela mostrando el modal "FIN DEL JUEGO" con el score real (no el overlay del canvas), pausar/reanudar, guardar puntuación con iniciales, volver a `/game/arkanoid` y confirmar que aparece en el catálogo/leaderboard como "ARKANOID".
9. Confirmar que los demás juegos del catálogo (p.ej. `serpentina`) siguen mostrando la arena placeholder sin cambios de comportamiento.
10. Ejecutar `npm run lint` y corregir lo que reporte.

## Criterios de aceptación

- [x] `/game/arkanoid/play` renderiza el canvas real de Arkanoid (paleta, pelota, bloques con sprites, explosiones) en vez de la arena placeholder de CSS.
- [x] El HUD superior (`Puntuación`, `Vidas`, `Nivel`) refleja en tiempo real el estado del engine.
- [x] El canvas ya no dibuja su propio Score/Nivel/vidas ni los overlays de `GAME OVER`/pausa/selector de nivel — esa información vive solo en el HUD y modal de React.
- [x] Los controles de teclado (`←` `→`) mueven la paleta igual que en `references/started-games/04-arkanoid/game.js`; el ratón y el click de selección de nivel ya no responden.
- [x] Destruir un bloque suma exactamente 10 puntos, reproduce el sonido de rotura y muestra la animación de explosión de 4 frames.
- [x] Rebotar en pared o paleta reproduce el sonido de rebote.
- [x] Al destruir todos los bloques de un nivel, carga automáticamente el siguiente con la velocidad de pelota correspondiente (`speed` de `levels.js`); al superar el nivel 5, se abre el mismo modal "FIN DEL JUEGO" que al perder todas las vidas.
- [x] El botón PAUSA congela la simulación real y muestra el overlay "EN PAUSA" ya existente; REANUDAR la retoma sin perder estado.
- [x] Al perder la tercera vida, el juego no se reinicia solo; se abre el modal "FIN DEL JUEGO" de la plataforma con la puntuación final real.
- [x] Guardar la puntuación desde el modal persiste vía `insertScore` con `game = 'arkanoid'`, igual que para el resto de juegos.
- [x] "JUGAR DE NUEVO" en el modal reinicia una partida real y jugable del engine.
- [x] "VOLVER AL VAULT" y "SALIR" navegan igual que hoy, sin dejar el `requestAnimationFrame` del engine corriendo en segundo plano.
- [x] El catálogo (`/games`), `/game/arkanoid` y `/leaderboard` muestran "ARKANOID" (no queda ninguna entrada `bloque-buster`).
- [x] Los demás juegos del catálogo (`asteroids`, `caida`, `serpentina`, etc.) siguen con su comportamiento actual, sin cambios.
- [x] `npm run lint` pasa sin errores nuevos.

## Decisiones tomadas y descartadas

- **Motor como clase TS con callbacks (`ArkanoidEngine`) en vez de portar casi literal con variables de módulo**: mismo motivo que Asteroids/Tetris — el original usa globals de módulo (`paddle`, `ball`, `blocks`, `score`, ...) incompatibles con más de una instancia viva o un remount limpio bajo StrictMode; encapsular el estado en una instancia de clase evita fugas entre remounts y permite `destroy()` determinista.
- **Se elimina el HUD/overlays dibujados en canvas** (score/nivel/vidas, `GAME OVER`, pausa con selector de nivel): mostrar la misma información dos veces (canvas + HUD React) sería ruido redundante; la plataforma ya tiene su propio sistema de HUD y modal consistente con el resto de juegos.
- **Se elimina el control por ratón y el selector de nivel en pausa** (en vez de portarlo): el patrón de la plataforma para juegos ya integrados es solo teclado (Asteroids, Tetris); mezclar ratón introduciría un tipo de input que ningún otro juego maneja hoy, y el selector de nivel por click era una utilidad de desarrollo/testeo del prototipo, no una mecánica core.
- **`win` se mapea al mismo modal genérico que `gameover`, sin distinguir texto**: evita tocar el modal de fin de partida compartido (usado hoy sin cambios por Asteroids/Tetris) solo para un caso de un juego; el usuario confirmó explícitamente esta simplificación.
- **Se reutiliza y renombra la fila `bloque-buster` → `arkanoid` en vez de insertar una fila nueva**: `bloque-buster` ya es temáticamente Arkanoid (`cover-bricks`, copy de "rebota la pelota") pero con un id genérico; renombrarla al id real del juego sigue el mismo patrón que Tetris (que usa `tetris`, no un id genérico) y evita una fila de catálogo duplicada/huérfana.
- **Se portan sprites y audio (a diferencia de Asteroids/Tetris)**: decisión explícita del usuario; el original de Arkanoid ya trae spritesheet y sonido como parte central de su presentación, y omitirlos habría sido una regresión visual/sonora notoria frente al prototipo. Se acepta como la mayor desviación de patrón respecto a los dos ports previos (introduce bundling de assets en `public/` y reproducción de audio).
- **Cap de `dt` (~50ms) añadido, ausente en el original**: mismo patrón ya usado en `AsteroidsEngine`/`TetrisEngine`; sin cap, un frame anómalo (cambio de pestaña) podría atravesar la pelota a través de la paleta o un bloque sin colisión. No altera velocidades ni resultados en juego normal, por lo que no se considera cambio de balance.
- **Canvas de resolución lógica fija (800×600) escalado por CSS, no redimensionado dinámicamente**: mismo motivo que SPEC 05/07 — mantiene intactas las constantes de física del original sin recalcularlas por viewport.
- **Solo teclado, controles táctiles fuera de alcance**: feature transversal a todo el catálogo, no específica de Arkanoid.

## Riesgos identificados

- React StrictMode monta y desmonta efectos dos veces en desarrollo; si la carga asíncrona del spritesheet (`loadSpritesheet`) resuelve después de que `destroy()` ya se ejecutó, podría arrancar un loop sobre un engine ya destruido — mitigación: un flag interno de "destruido" que el callback de carga comprueba antes de llamar `start()`/arrancar el rAF.
- El `update` de la fila `bloque-buster` → `arkanoid` cambia una clave primaria (`games.id`) referenciada por `scores.game` (foreign key, según el esquema de SPEC 06); si existieran filas de `scores` con `game = 'bloque-buster'`, el `update` fallaría o dejaría puntuaciones huérfanas — mitigación: comprobar y migrar esas filas en la misma migración antes del `update` (paso 7 del plan). En la práctica no debería haber ninguna, porque `bloque-buster` nunca tuvo motor real ni fue jugable.
- Cargar un PNG y dos MP3 desde `public/` añade una dependencia de red/caché que Asteroids/Tetris no tienen; si el spritesheet tarda en cargar, el jugador ve un canvas en blanco hasta que `loadSpritesheet` resuelve — aceptado como comportamiento equivalente al original (que tampoco arranca el loop hasta cargar el spritesheet).
- Los listeners de teclado (`keydown`/`keyup`) están en `window`; si el usuario navega fuera de `/game/arkanoid/play` sin que `destroy()` se ejecute a tiempo, podrían interferir con otras pantallas — mitigado por el cleanup de `useEffect` que React/Next.js garantiza al desmontar.
