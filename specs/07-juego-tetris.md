# 07 — Juego Tetris

- **Estado:** Implemented
- **Depende de:** SPEC 06
- **Fecha:** 2026-08-12
- **Objetivo:** Portar el prototipo de Tetris (`references/started-games/03-tetris/game.js`) a un motor TypeScript reutilizable y conectarlo a la entrada ya sembrada `caida` del catálogo Supabase, reemplazando la arena placeholder de `GamePlayer` por el juego real con HUD, pausa, fin de partida y guardado de puntuación integrados a la plataforma.

## Alcance

### Dentro de alcance

- Nuevo motor de juego portado 1:1 en mecánicas desde `references/started-games/03-tetris/game.js`: tablero 10×20 (`COLS`, `ROWS`, `BLOCK`), las 8 piezas definidas en `PIECES`/`COLORS` (incluye la pieza `N`/"tuerca" ya presente en el original), rotación con wall kicks (`rotateCW`, `tryRotate` con `kicks = [0,-1,1,-2,2]`), colisión (`collide`), soft drop (+1 punto/fila) y hard drop (+2 puntos/celda), pieza fantasma (`ghostY`, dibujada con `globalAlpha 0.2`), limpieza de líneas (`clearLines`) con la tabla de puntos `LINE_SCORES = [0,100,300,500,800]` multiplicada por nivel, progresión de nivel/velocidad (`level = floor(lines/10)+1`, `dropInterval = max(100, 1000-(level-1)*90)`), y la vista previa de la siguiente pieza (`drawNext`). Ninguna constante de balance (`COLS`, `ROWS`, `BLOCK`, `LINE_SCORES`, `dropInterval` inicial, curva de velocidad) cambia respecto al original.
- El motor se reestructura de funciones/variables globales de módulo a una clase `TetrisEngine` sin estado compartido entre instancias, para poder montarse/desmontarse limpiamente con el ciclo de vida de React (incluye StrictMode).
- `TetrisEngine` expone:
  - `constructor(canvas: HTMLCanvasElement, nextCanvas: HTMLCanvasElement, callbacks: { onStateChange(state: TetrisState): void })` — recibe **dos** canvases (tablero + preview de siguiente pieza), a diferencia del contrato de un solo canvas de `AsteroidsEngine`, porque el original ya usa dos `<canvas>` independientes para lo mismo.
  - `start()` — arranca el loop (`requestAnimationFrame`) y la partida (equivalente a `init()`).
  - `pause()` / `resume()` — congela/reanuda la simulación (`update`/auto-drop no avanzan en pausa; el rAF sigue vivo pero no redibuja más que el último frame).
  - `restart()` — reinicia la partida desde cero (equivalente a `init()` del original).
  - `destroy()` — cancela el `requestAnimationFrame` pendiente y remueve el listener de teclado.
  - `onStateChange` se invoca en cada frame con `{ score, lines, level, gameOver }`, reemplazando el HUD (`#score`, `#lines`, `#level`) y el overlay de `PAUSA`/`GAME OVER` que el original dibujaba/mostraba como elementos DOM aparte del canvas (`updateHUD`, `overlay`/`overlayTitle`/`overlayScore`), los cuales se eliminan del motor porteado.
  - El auto-reinicio del original al pulsar el botón `#restart-btn` se elimina como acoplamiento DOM; al llegar a colisión en `spawn()` el engine se queda en `gameOver: true` sin reiniciarse solo, esperando a que algo externo llame `restart()`.
  - La tecla `P` se conserva como atajo de pausa dentro del propio engine (además de que `TetrisCanvas` reciba `paused` por props) — es la única tecla de control que se mantiene del original sin cambios, junto con `←`/`→`/`↑`/`X`/`↓`/`Espacio`.
  - El toggle de tema claro/oscuro (`theme-toggle`, `localStorage['tetris-theme']`) del original **no se porta**: el tema visual de Arcade Vault es fijo y ya viene resuelto por `app/globals.css`.
  - `drawGrid()` usa `getComputedStyle(document.body).getPropertyValue('--grid-line')` en el original; se porta leyendo la misma variable CSS ya definida en `app/globals.css` (sin introducir una nueva).
- El canvas principal mantiene resolución lógica fija 300×600 (`COLS×BLOCK` × `ROWS×BLOCK`) y el canvas de preview 120×120, iguales al original, escalados visualmente por CSS dentro de `.crt-screen` sin recalcular físicas por tamaño de contenedor.
- Nuevo Client Component `TetrisCanvas` (`components/games/caida-canvas.tsx`) que:
  - Renderiza los dos `<canvas>` (tablero `.caida-canvas` y preview `.caida-next-canvas`), instancia `TetrisEngine` en un efecto de montaje (`useRef` para la instancia, cleanup con `destroy()`).
  - Recibe `paused: boolean` por props y llama `pause()`/`resume()` en el engine cuando cambia.
  - Recibe `onStateChange` por props y lo reenvía al engine vía un ref intermedio (mismo patrón que `AsteroidsCanvas`, para no reinstanciar el engine en cada render del padre).
  - Expone `restart()` al padre vía `useImperativeHandle`/`forwardRef` (`TetrisCanvasHandle`).
- `components/game-player.tsx` se modifica para soportar más de un juego con motor real:
  - `HAS_REAL_ENGINE` pasa a incluir `"asteroids"` y `"caida"`.
  - Se añade una rama condicional para `game.id === "caida"` que renderiza `TetrisCanvas` dentro de `.crt-screen` en lugar del `.game-arena` placeholder, alimentando el HUD y el modal de fin de partida con el estado real recibido de `onStateChange`.
  - El slot del HUD que hoy muestra siempre "Vidas" pasa a mostrar "Líneas" (`state.lines`) cuando el juego activo es `caida`, y sigue mostrando "Vidas" para `asteroids`. La etiqueta y el valor del slot se deciden según `game.id`, sin cambiar el layout general del HUD.
  - "Nivel" en el HUD usa `state.level` real de `caida`, igual que ya hace para `asteroids` (reemplaza el `simulatedLevel` derivado del score solo para juegos sin motor real).
  - El botón "PAUSA"/"REANUDAR" controla pausa real para `caida` igual que ya hace para `asteroids`.
  - El botón "FIN" para `caida` fuerza el fin de partida usando el score/estado actual del engine, igual que para `asteroids` (no destruye el tablero real; solo corta la partida y abre el modal).
  - "JUGAR DE NUEVO" en el modal llama `restart()` sobre el `TetrisEngine` real para `caida`.
- Controles: solo teclado, igual que el original (`←`/`→` mover, `↑`/`X` rotar, `↓` soft drop, `Espacio` hard drop, `P` pausa). Soporte táctil queda fuera de alcance.
- Tetris no tiene concepto de "vidas": la partida termina de un solo golpe (top-out) cuando `spawn()` genera una pieza que ya colisiona con el tablero. Por eso `TetrisState` no incluye `lives` y el slot "Vidas" del HUD genérico se repurposa a "Líneas" para `caida` (no se muestran corazones ni ningún contador de vidas restantes).
- CSS nuevo en `app/globals.css`: `.caida-canvas` (tablero, mismo patrón que `.asteroids-canvas`) se centra horizontalmente dentro de `.crt-screen`; `.caida-next-canvas` (preview 120×120) se posiciona desplazada hacia la derecha del tablero (lateral derecho de la pantalla), sin solaparse ni quedar centrada sobre el tablero. No se crea ninguna clase `cover-*` nueva: el cover `cover-tetro` ya existe y ya está asignado a la fila `caida` desde SPEC 06.
- Catálogo/Supabase: **no se inserta ninguna fila nueva**. La fila `caida` (`title: "CAÍDA"`, `cat: "PUZZLE"`, `cover: "cover-tetro"`, `color: "magenta"`) ya existe en la tabla `games` desde la migración de SPEC 06 y ya coincide en tema/descripción con Tetris. El único cambio de "catálogo" de este spec es en código (`HAS_REAL_ENGINE`), no en la base de datos.

### Fuera de alcance

- Controles táctiles/móviles para Tetris — se porta solo el control por teclado del original.
- Cualquier cambio de mecánicas o balance del juego (tamaño de tablero, tabla de puntos, curva de velocidad, set de piezas, wall kicks) respecto a `references/started-games/03-tetris/game.js` — la portada es 1:1.
- El toggle de tema claro/oscuro y su persistencia en `localStorage['tetris-theme']` del prototipo original.
- Crear una fila nueva en `games` o modificar los valores ya sembrados de `caida` (`title`/`short`/`long`/`cat`/`cover`/`color`) — se reutiliza tal cual.
- Conectar los demás juegos del catálogo que siguen con la arena placeholder (`bloque-buster`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`) a motores reales.
- Sonido/música — el original no tiene audio y este spec no lo agrega.
- Tabla de puntuaciones específica de Tetris con datos propios — el leaderboard de `/game/caida` sigue usando las mismas consultas genéricas de `lib/supabase/games.ts` ya conectadas por SPEC 06.
- Redimensionar los canvases dinámicamente según el contenedor (ResizeObserver) — se escalan por CSS manteniendo la resolución lógica fija.

## Modelo de datos

```ts
// lib/games/caida/engine.ts
interface TetrisState {
  score: number;
  lines: number;
  level: number;
  gameOver: boolean;
  // Sin `lives`: Tetris es de una sola vida (top-out inmediato en spawn()),
  // no un contador de vidas restantes como AsteroidsState.
}

class TetrisEngine {
  constructor(
    canvas: HTMLCanvasElement,
    nextCanvas: HTMLCanvasElement,
    callbacks: {
      onStateChange: (state: TetrisState) => void;
    }
  );
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  destroy(): void;
}
```

No se agregan tablas ni columnas nuevas en Supabase. La fila `caida` en `games` ya existe (SPEC 06); las puntuaciones fluyen a `scores` por el mismo `insertScore(supabase, { game: "caida", name, score })` genérico que ya usan todos los juegos.

## Plan de implementación

1. Leer `references/started-games/03-tetris/game.js`, `index.html` y `CLAUDE.md` (ya revisados en este spec) para confirmar mecánicas, controles y qué dibuja el original en cada canvas.
2. Leer `node_modules/next/dist/docs/01-app/` en lo referente a Client Components, `useEffect` y `<canvas>`, para confirmar que no hay convención distinta en Next 16 que afecte este patrón (mismo paso que hizo SPEC 05).
3. Crear `lib/games/caida/engine.ts`: portar `createBoard`, `randomPiece`, `collide`, `rotateCW`, `tryRotate`, `merge`, `clearLines`, `ghostY`, `hardDrop`, `softDrop`, `lockPiece`, `spawn`, `drawBlock`, `drawGrid`, `draw`, `drawNext`, `loop` desde `references/started-games/03-tetris/game.js`, envueltos en la clase `TetrisEngine` (estado de instancia, sin globals de módulo). Quitar `updateHUD`/manipulación de `overlay` DOM y el toggle de tema. Conservar `P` como atajo de pausa interno. Añadir `pause()`/`resume()` (flag interno que el auto-drop del loop respeta) e invocar `onStateChange` al final de cada frame procesado.
4. Crear `components/games/caida-canvas.tsx`: monta `<canvas className="caida-canvas" width={300} height={600}>` y `<canvas className="caida-next-canvas" width={120} height={120}>`, instancia `TetrisEngine` en un efecto de montaje con deps `[]` (cleanup con `destroy()`), sincroniza `paused` por props en un efecto separado, reenvía `onStateChange` vía ref intermedio, y expone `restart()` vía `useImperativeHandle`/`forwardRef`.
5. Modificar `components/game-player.tsx`: añadir `"caida"` a `HAS_REAL_ENGINE`; añadir rama de render para `caida` (`TetrisCanvas` en vez de `.game-arena`); conectar `onStateChange` a `setScore`/`setLines`(nuevo estado)/`setLevel`/`setOver`; hacer que el slot HUD "Vidas" muestre "Líneas" cuando `game.id === "caida"`; conectar PAUSA/FIN/JUGAR DE NUEVO al `TetrisCanvasHandle` real para `caida`, sin alterar el comportamiento existente para `asteroids` ni para el resto de juegos con arena placeholder.
6. Añadir a `app/globals.css` las reglas `.caida-canvas` (tablero centrado horizontalmente dentro de `.crt-screen`) y `.caida-next-canvas` (preview desplazada hacia la derecha del tablero, sin solaparse).
7. Prueba manual end-to-end: `npm run dev`, ir a `/games` → CAÍDA → "JUGAR AHORA", jugar con teclado (mover, rotar con wall kick, soft drop, hard drop, ver pieza fantasma y preview de siguiente pieza), pausar con el botón y con `P`, reanudar, perder (torre hasta el tope), confirmar que aparece el modal "FIN DEL JUEGO" de la plataforma con el score real (no un overlay del canvas), guardar puntuación con iniciales, volver a `/game/caida` y confirmar que "Mejor global"/"Partidas"/"MEJORES PUNTUACIONES" reflejan la partida guardada, y que aparece en `/leaderboard` bajo la pestaña CAÍDA; "JUGAR DE NUEVO" desde el modal reinicia una partida real jugable.
8. Confirmar que Asteroids y los demás juegos del catálogo (p.ej. `bloque-buster`) siguen funcionando sin cambios de comportamiento.
9. Ejecutar `npm run lint` y corregir lo que reporte.

## Criterios de aceptación

- [x] `/game/caida/play` renderiza el tablero real de Tetris (piezas, pieza fantasma, preview de siguiente pieza) en vez de la arena placeholder de CSS.
- [x] El HUD superior (`Puntuación`, `Líneas`, `Nivel`) refleja en tiempo real el estado del engine, no el `setInterval` de puntaje aleatorio.
- [x] Ni el canvas del tablero ni el de preview dibujan su propio SCORE/LINES/LEVEL ni ningún overlay de PAUSA/GAME OVER — esa información vive solo en el HUD y modal de React.
- [x] Los controles de teclado (`←` `→` `↑`/`X` `↓` `Espacio`) funcionan igual que en `references/started-games/03-tetris/game.js`: mover, rotar con wall kick, soft drop (+1/fila), hard drop (+2/celda).
- [x] Limpiar líneas otorga los mismos puntos (`[0,100,300,500,800]` × nivel) del original, y el nivel/velocidad de caída avanza igual (`floor(lines/10)+1`, `max(100, 1000-(level-1)*90)`).
- [x] El botón PAUSA congela la simulación real (las piezas dejan de caer) y muestra el overlay "EN PAUSA" ya existente de la plataforma; `P` también pausa/reanuda; REANUDAR retoma sin perder estado.
- [x] Al colisionar una pieza nueva al aparecer, el juego NO se reinicia solo; en su lugar se abre el modal "FIN DEL JUEGO" de la plataforma con la puntuación final real.
- [x] Guardar la puntuación desde el modal inserta una fila real en `scores` vía Supabase para `game = "caida"`, igual que para el resto de juegos.
- [x] "JUGAR DE NUEVO" en el modal reinicia una partida real y jugable del engine.
- [x] "VOLVER AL VAULT" y "SALIR" navegan igual que hoy, sin dejar el `requestAnimationFrame` del engine corriendo en segundo plano (se llama `destroy()` al desmontar).
- [x] En `/game/caida`, "Mejor global"/"Partidas"/"MEJORES PUNTUACIONES" reflejan datos reales de `scores` tras guardar una partida.
- [x] El HUD de `caida` no muestra el slot "Vidas"/corazones; muestra "Líneas" en su lugar, y la partida termina en el primer top-out (no hay reintentos por vidas).
- [x] El tablero se ve centrado en la pantalla CRT y la preview de la siguiente pieza aparece a su derecha, sin solaparse con el tablero.
- [x] Asteroids y los demás juegos del catálogo (`bloque-buster`, etc.) siguen funcionando sin cambios de comportamiento.
- [x] `npm run lint` pasa sin errores nuevos.

**Nota de implementación:** los nombres de archivo/clase reales usan `tetris` en vez de `caida` (`lib/games/tetris/engine.ts`, `components/games/tetris-canvas.tsx`, `.tetris-canvas`/`.tetris-next-canvas`, `HAS_REAL_ENGINE` incluye `"tetris"`) porque el `game.id` sembrado en Supabase para esta fila es `tetris`, no `caida` como asumía el borrador de este spec. El comportamiento y alcance descritos arriba se cumplen igual.

## Decisiones tomadas y descartadas

- **Reusar la fila `caida` ya sembrada en vez de crear un `id` nuevo**: `caida` ya existe en `games` desde SPEC 06 con `cat: PUZZLE`, `cover: cover-tetro` y una descripción ("piezas geométricas descienden... rótalas, encástralas y limpia líneas") que ya describe Tetris exactamente; crear una fila nueva duplicaría el concepto en el catálogo sin necesidad.
- **`TetrisEngine` recibe dos canvases (tablero + preview) en el constructor, en vez de un solo canvas como `AsteroidsEngine`**: el original ya separa el tablero y la vista previa en dos `<canvas>` independientes con su propio contexto 2D; forzar un solo canvas obligaría a recomponer layout que el original no tiene, sin beneficio.
- **Se conserva la tecla `P` como atajo de pausa dentro del engine, además del control por props**: es una decisión explícita del usuario para no perder el atajo de teclado del original; no es 1:1 estricto en el sentido de "eliminar todo acoplamiento UI del original" (como si se hizo con `restartBtn`/overlay/tema), pero se documenta aquí como excepción consciente.
- **Se elimina el HUD DOM (`updateHUD`) y el overlay compartido de PAUSA/GAME OVER**: mismo motivo que SPEC 05 — esa información ya la muestra el HUD/modal de React de la plataforma; duplicarla sería ruido visual redundante.
- **Se elimina el toggle de tema claro/oscuro del original**: Arcade Vault ya tiene su propio sistema de tema fijo (`app/globals.css`); el original lo necesitaba como app standalone, la plataforma no.
- **El slot "Vidas" del HUD genérico se reutiliza para mostrar "Líneas" en `caida` en vez de agregar un nuevo `hud-stat` fijo**: mantiene el layout de cuatro columnas del HUD consistente entre juegos con motor real sin necesidad de rediseñar `player-hud`; la etiqueta/valor mostrados dependen de `game.id`.
- **Sin cambios de balance/mecánicas respecto al original**: el juego ya fue diseñado y ajustado en `references/started-games/03-tetris`; este spec es de integración a la plataforma, no de rediseño de gameplay.
- **No se aplica ninguna migración de Supabase en este spec**: a diferencia de SPEC 05 (que no tocó Supabase) y del seam 5 genérico descrito en `reference.md` (que asume insertar una fila nueva), aquí la fila ya existe desde SPEC 06 — el único trabajo de "catálogo" es código (`HAS_REAL_ENGINE`).

## Riesgos identificados

- React StrictMode en desarrollo monta y desmonta efectos dos veces; si `TetrisEngine.destroy()` no cancela correctamente el `requestAnimationFrame` y remueve el listener de teclado (incluida la tecla `P`), podrían quedar dos loops corriendo en paralelo o pausas duplicadas — mitigación: probar explícitamente el flujo de pausa/reinicio/salida en desarrollo antes de dar el spec por verificado (mismo riesgo que SPEC 05).
- El listener de teclado del original está en `window`, incluida la tecla `P`; si el usuario navega fuera de `/game/caida/play` sin que `destroy()` se ejecute a tiempo, `P` podría interferir con otras pantallas — mitigación: `destroy()` se llama en el cleanup de `useEffect`, igual que en `AsteroidsCanvas`.
- Mostrar "Líneas" en el mismo slot visual donde Asteroids muestra "Vidas" acopla el layout del HUD a `game.id` en `game-player.tsx`; si se agrega un tercer juego con motor real y un tercer significado para ese slot, ese componente necesitará una refactorización más genérica (fuera de alcance de este spec).
