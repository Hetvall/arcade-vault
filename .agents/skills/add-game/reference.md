# Receta de seams — portar un juego a Arcade Vault

Este documento es la referencia concreta que usa la skill `add-game` para redactar specs
precisos, y que `/spec-impl` sigue al implementarlos. Describe la forma real en que SPEC 05
(motor de Asteroids) y SPEC 06 (catálogo/leaderboard en Supabase) conectaron un juego a la
plataforma. Un juego nuevo repite exactamente estos 5 seams.

## 1. Motor — `lib/games/<id>/engine.ts`

Clase `<Game>Engine` que envuelve el `game.js` original (globals de módulo o clases) en estado
de instancia, sin estado compartido entre instancias:

```ts
export interface <Game>State {
  score: number;
  // resto de campos que el HUD necesita: lives, level, etc. — los que tenga el original.
  gameOver: boolean;
}

export interface <Game>Callbacks {
  onStateChange: (state: <Game>State) => void;
}

export class <Game>Engine {
  constructor(canvas: HTMLCanvasElement, callbacks: <Game>Callbacks);
  start(): void;    // arranca el loop (rAF) si no está corriendo — idempotente
  pause(): void;    // flag interno; update(dt) no avanza mientras está en true
  resume(): void;
  restart(): void;  // reinicia la partida desde cero (equivalente a initGame() del original)
  destroy(): void;  // cancela el rAF pendiente y remueve los listeners de teclado
}
```

Reglas del contrato (no negociables, copian el patrón de `AsteroidsEngine`):

- El **constructor no arranca el loop**; solo `start()` lo hace, y de forma idempotente
  (`if (this.rafId === null) this.rafId = requestAnimationFrame(this.loop)`).
- Los listeners de teclado (`keydown`/`keyup`) se atan en el constructor sobre `window`, como
  **campos arrow de instancia** (`onKeyDown = (e) => {...}`) para que su identidad sea estable y
  `destroy()` pueda removerlos con el mismo identificador.
- El loop (`loop = (ts) => {...}`, también campo arrow) calcula `dt` con un cap (p.ej. 50ms) y
  hace `update(dt) → draw() → emitState() → requestAnimationFrame(this.loop)` de nuevo. Si
  `this.paused`, reprograma el rAF sin avanzar `update`/tiempo.
- `emitState()` construye el `<Game>State` desde los campos privados y llama
  `this.callbacks.onStateChange(state)` — se invoca cada frame, no solo en eventos.
- **Se elimina** del original todo lo que dibuje HUD/overlay directamente en el canvas
  (`drawHUD`, `drawOverlay('GAME OVER', ...)` o equivalente) — esa info sale por `onStateChange`
  y la pinta el HUD de React.
- **Se elimina** cualquier auto-reinicio automático en el estado de gameover (p.ej. reiniciar al
  pulsar Espacio) — el engine se queda en `gameOver: true` esperando a que algo externo llame
  `restart()`. Si el modal de fin de partida pide texto por teclado, un auto-reinicio con una
  tecla común perdería la puntuación antes de guardarla.
- Resolución lógica del canvas **fija** (la misma `W`/`H` que el original), escalada visualmente
  por CSS — no se recalculan físicas por tamaño de contenedor.
- Ningún valor de balance (velocidades, puntos, probabilidades, cooldowns, tamaños) cambia
  respecto al original: el porteo es 1:1 en mecánicas.

## 2. Wrapper canvas — `components/games/<id>-canvas.tsx`

Client Component que monta el `<canvas>` y gestiona el ciclo de vida del engine con React
(incluye StrictMode, que monta/desmonta efectos dos veces en desarrollo):

- `forwardRef<<Game>CanvasHandle, <Game>CanvasProps>` donde
  `<Game>CanvasHandle = { restart: () => void }` y
  `<Game>CanvasProps = { paused: boolean; onStateChange: (state: <Game>State) => void }`.
- Refs: `canvasRef`, `engineRef`, y `onStateChangeRef` (guarda el último callback recibido).
- Efecto de montaje con **deps `[]`**: instancia `new <Game>Engine(canvas, { onStateChange: (s) =>
onStateChangeRef.current(s) })`, guarda en `engineRef`, llama `engine.start()`. El cleanup llama
  `engine.destroy()` y limpia `engineRef`. El wrapper con `onStateChangeRef` evita que este efecto
  dependa de `onStateChange` (que cambia en cada render del padre) y por tanto evita reinstanciar
  el engine en cada frame.
- Efecto separado con deps `[paused]`: `paused ? engine.pause() : engine.resume()`.
- Efecto separado con deps `[onStateChange]`: actualiza `onStateChangeRef.current`.
- `useImperativeHandle(ref, () => ({ restart: () => engineRef.current?.restart() }))`.
- Render: `<canvas ref={canvasRef} width={W} height={H} className="<id>-canvas" />` con `W`/`H`
  iguales a la resolución lógica fija del motor.

## 3. Wiring en `components/game-player.tsx`

Único archivo de acoplamiento entre un juego con motor real y la plataforma:

- Añadir el `id` del juego a `const HAS_REAL_ENGINE = new Set([...])`.
- Añadir una rama condicional (`isThisGame = HAS_REAL_ENGINE.has(game.id) && game.id === "<id>"`,
  o extender el switch existente) que renderiza `<Game>Canvas` dentro de `.crt-screen` en vez del
  `.game-arena` placeholder:
  - `paused={paused || over}` — el modal de fin de partida también debe congelar el engine.
  - `onStateChange` = un `useCallback` con deps `[]` que hace `setScore/setLives/setLevel/...`
    desde el `state` recibido, y `if (state.gameOver) setOver(true)`.
- Un `useRef<<Game>CanvasHandle>(null)` para poder llamar `.restart()` desde el botón
  "JUGAR DE NUEVO" del modal existente.
- El resto (HUD genérico, botones PAUSA/REANUDAR, FIN, SALIR, el modal de fin de partida, el
  input de iniciales, y el flujo async de `saveScore`/`saving`/`saveError`) ya es genérico y se
  reutiliza **sin cambios** — no reinventar esa UI por juego.

## 4. CSS — `app/globals.css`

Una única regla nueva por juego, junto a `.asteroids-canvas` y `.game-arena`:

```css
.<id > -canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
```

Si el juego usa un `cover` de catálogo nuevo (ver sección 5), también añadir la clase
`.cover-<slug>` correspondiente junto a las `cover-*` existentes.

## 5. Catálogo y leaderboard — fila en Supabase `games`

No requiere ningún cambio de código: todo (`/games`, `/game/[id]`, `/leaderboard`, home rail) es
data-driven desde la tabla `games` vía las funciones ya existentes en `lib/supabase/games.ts`
(`fetchGamesWithBestScores`, `fetchGameById`, `fetchTopScores`, `fetchBestScore`, `fetchPlayCount`,
`fetchPlayerBestScore`, `fetchScoreRank`, `insertScore`). Insertar la fila es el único paso:

```sql
insert into public.games (id, title, short, long, cat, cover, color)
values ('<id>', '<Título>', '<resumen corto>', '<descripción larga>',
        '<ARCADE|PUZZLE|SHOOTER|VERSUS>', 'cover-<slug>', '<cyan|magenta|green|yellow>');
```

Reglas:

- `id` debe ser único, kebab-case, y es el mismo valor que se usa en `HAS_REAL_ENGINE` (sección 3).
- `cat` debe satisfacer el CHECK existente (`ARCADE`, `PUZZLE`, `SHOOTER`, `VERSUS`).
- `color` debe satisfacer el CHECK existente (`cyan`, `magenta`, `green`, `yellow`).
- `cover` debe corresponder a una clase CSS `cover-*` real (existente o creada en el paso 4);
  si no existe, la tarjeta del juego se renderiza sin fondo.
- Aplicar con `mcp__supabase__apply_migration` sobre el proyecto Supabase ya conectado (ver
  SPEC 04/06 para el project ref). No se necesita ninguna migración de esquema (`games`/`scores`
  ya existen) — solo el `insert` de la fila.
- Las puntuaciones fluyen automáticamente: `insertScore` desde `context/session-context.tsx` ya
  escribe en `scores` con el `game.id` correcto; ninguna query de leaderboard necesita cambios.

## Fuentes de motor

- `references/started-games/<carpeta>/game.js` (+ `index.html`, `README.md`/`CLAUDE.md`): juegos
  vanilla JS/canvas de referencia (p.ej. `02-asteroids`, `03-tetris`, `04-arkanoid`). Pueden ser
  clases (`02-asteroids`) o globals de módulo procedural (`03-tetris`, `04-arkanoid`). Ambos
  formatos se portan al mismo contrato de clase `<Game>Engine` de la sección 1.
- Cualquier otra fuente (descripción del usuario, otro repo, código desde cero): el mismo
  contrato aplica igual; solo cambia de dónde se extraen las mecánicas/constantes de balance.
