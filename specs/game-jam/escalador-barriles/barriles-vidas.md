# game-jam/escalador-barriles — Torre de Andamios con Tres Vidas (opción A)

- **Estado:** Draft
- **Tema del jam:** "Escalador de barriles" — un juego de plataformas al estilo Donkey Kong (subir
  plataformas/escaleras esquivando barriles que ruedan cuesta abajo).
- **Concepto base:** El jugador es un operario que debe trepar una estructura de andamios
  industriales hasta la cima, donde un capataz rival lanza barriles que ruedan cuesta abajo por
  cada plataforma. Subir contra la gravedad mientras esquivas objetos que bajan por ella es el
  corazón de la mecánica, no solo el decorado.
- **Enfoque de esta opción:** estructura de **niveles fijos** (como las pantallas repetidas del
  Donkey Kong original) que se completan uno tras otro subiendo por escaleras, con un pool de **3
  vidas**: perder una vida reinicia el nivel actual desde abajo; perder las 3 termina la partida.
- **Fecha:** 2026-08-24
- **Categoría propuesta:** ARCADE · **Color:** cyan

## Diseño

### Concepto y fantasía
El jugador sube andamios de una obra vertical, plataforma ("girder") por plataforma, conectadas
por escaleras. Un barril cae rodando desde arriba cada cierto tiempo y avanza por la plataforma
hasta caer al siguiente nivel por el borde; si alcanza al jugador, pierde una vida. Llegar a la
plataforma superior (la meta) completa el nivel y sube a la siguiente pantalla, más difícil.

Frente a la Opción B (`barriles-contrarreloj.md`), este enfoque es el más fiel al espíritu
"arcade de salón" del tema: pantallas fijas, memorizables, con vidas — el jugador puede fallar,
reintentar el mismo nivel y mejorar con la práctica, igual que Donkey Kong o Mario Bros original.
Es el enfoque de **menor alcance/complejidad de construcción** (geometría fija, sin generación
procedural ni cámara que se desplaza).

### Mecánicas

**Tablero y estructura (fija, reutilizada por los 3 niveles con distinta configuración de
escaleras y ritmo de barriles):**

- Canvas lógico **640×760px**, escalado por CSS dentro de `.crt-screen` (igual patrón que
  `.tetris-canvas`/`.snake-canvas`: se centra por altura).
- **5 plataformas ("girders") horizontales fijas**, cada una de ancho completo (`x: 0–640`), en
  las alturas `y = 700` (suelo/inicio), `y = 560`, `y = 420`, `y = 280`, `y = 140` (cima/meta).
  Una puerta de meta se dibuja en `x: 560–620` sobre la plataforma superior (`y = 140`).
- **Escaleras**: rectángulos de `40px` de ancho que conectan una plataforma con la inmediata
  superior. Solo se puede subir/bajar por una escalera si el jugador está horizontalmente
  alineado con ella (±20px de su centro).
- **Configuración de escaleras por nivel** (todas de `40px` de ancho, coordenadas = centro `x`):

  | Nivel | Escaleras (de suelo a meta, una por transición) | Intervalo barril | Vel. barril | Prob. bajar escalera |
  | ----- | ------------------------------------------------ | ----------------- | ----------- | --------------------- |
  | 1     | 100 → 500 → 100 → 500 (zigzag simple)             | 1800ms            | 160px/s     | 35%                    |
  | 2     | 100+400 → 200+540 → 100+400 → 200+540 (dos rutas) | 1500ms            | 180px/s     | 40%                    |
  | 3     | 320 → 320 → 320 → 320 (una sola escalera central) | 1200ms            | 200px/s     | 45%                    |

  Al completar el nivel 3, el juego **repite la configuración del nivel 3** en bucle (como las
  pantallas del arcade original), pero cada vuelta incrementa la dificultad: intervalo de barril
  **−100ms** (piso **700ms**), velocidad de barril **+20px/s** (techo **260px/s**), probabilidad de
  bajar escalera **+5%** (techo **70%**). El contador de `level` en el HUD sigue subiendo aunque el
  layout se repita, para que el jugador perciba el progreso real.

**Jugador:**

- Hitbox **28×36px**. Velocidad de movimiento horizontal **140px/s**. Velocidad al subir/bajar
  escalera **110px/s** (vertical, solo mientras está alineado con una escalera).
- **Salto corto de esquiva** (`Espacio`): si se pulsa mientras el jugador está de pie sobre una
  plataforma, queda en el aire **350ms** (sube 46px y vuelve a bajar, arco simétrico), es
  **invulnerable** durante todo el salto. No hay salto entre plataformas: solo sirve para esquivar
  un barril que pasa por debajo.
- Al perder una vida: el jugador vuelve al punto de inicio del nivel actual (`x: 40, y: 700−36`),
  **todos los barriles activos se eliminan**, el jugador queda con **1200ms** de invulnerabilidad
  parpadeante, y el generador de barriles se reanuda **800ms** después.

**Barriles:**

- Se generan en la plataforma superior (`y = 140`, cerca de la puerta de meta) cada
  `intervalo barril` (según nivel/vuelta, tabla arriba), con hitbox **24×24px**.
- Ruedan en línea recta a lo largo de la plataforma a `vel. barril` px/s hacia el lado contrario
  de la meta. Al llegar al borde de la plataforma:
  - Con la `prob. bajar escalera` de esa configuración, si hay una escalera en ese extremo, el
    barril **baja por la escalera** a la plataforma inferior y sigue rodando desde ahí.
  - Si no baja (o no hay escalera en ese extremo), el barril **cae directamente** a la plataforma
    de abajo en la misma posición `x` y continúa rodando en dirección aleatoria.
  - Un barril que cae desde la plataforma más baja (`y = 700`) sale del tablero y se elimina.
- Colisión barril↔jugador (fuera de invulnerabilidad): resta 1 vida y dispara el respawn descrito
  arriba. Un barril que pasa bajo el jugador **mientras está en salto de esquiva** (ver arriba)
  suma **+10 puntos** una única vez por barril (se marca `dodged` para no farmear el mismo barril
  dos veces).

**Progresión y condición de fin de partida:**

- Vidas iniciales: **3**. Nivel inicial: **1**.
- Llegar a la puerta de meta (`x: 560–620` en `y = 140`) suma **+200 puntos**, limpia los barriles
  activos y carga el siguiente nivel (o la siguiente vuelta de la configuración del nivel 3).
- **Game over** cuando las vidas llegan a **0** tras perder la última vida (no hay reintento del
  nivel: la partida termina y el modal de fin de partida se abre con el score real).

### Controles

- `←` / `→`: mover al jugador horizontalmente sobre la plataforma actual.
- `↑` / `↓`: subir/bajar por una escalera, solo si el jugador está alineado con ella.
- `Espacio`: salto corto de esquiva (350ms, invulnerable, no cambia de plataforma).

### Estado y HUD

```ts
interface EscaladorBarrilesState {
  score: number;
  lives: number; // 3 → 0
  level: number; // 1, 2, 3, 4... (sube incluso al repetir el layout del nivel 3)
  gameOver: boolean;
}
```

### Metadatos de catálogo propuestos

- `id`: `escalador-barriles`
- `title`: `ESCALADOR DE BARRILES`
- `short`: `Sube la torre de andamios esquivando barriles con tus tres vidas.`
- `long`: `Un capataz suelta barriles desde la cima de la obra y ruedan plataforma abajo. Trepa por escaleras, esquiva con un salto justo a tiempo y llega a la puerta de meta antes de quedarte sin vidas. Tres pantallas fijas, cada vez más rápidas.`
- `cat`: `ARCADE`
- `color`: `cyan`
- `cover`: `cover-barriles` (nueva clase, no existe hoy en `app/globals.css`)

## Técnico

### Alcance

#### Dentro de alcance

- Motor `lib/games/escalador-barriles/engine.ts` — clase `EscaladorBarrilesEngine` construida
  **desde cero** (sin fuente porteable) siguiendo el contrato de `reference.md`: constructor que
  ata los listeners de teclado (`keydown`/`keyup` como campos arrow de instancia) pero **no**
  arranca el loop; `start()` idempotente vía `requestAnimationFrame`; `pause()`/`resume()` (flag
  interno, `update(dt)` no avanza en pausa); `restart()` reinicia vidas/nivel/posición desde cero;
  `destroy()` cancela el rAF pendiente y remueve los listeners. `emitState()` construye
  `EscaladorBarrilesState` y llama `onStateChange` cada frame. Sin HUD/overlay dibujado en canvas
  (ni "GAME OVER" ni contador de vidas/nivel — eso lo pinta el HUD de React) y sin auto-reinicio en
  game-over. Implementa las 5 plataformas fijas, las 3 configuraciones de escalera/barril de la
  tabla de `## Diseño`, el spawner de barriles, la física de salto de esquiva, el sistema de vidas
  y respawn, y el bucle de dificultad tras el nivel 3, todo con las constantes fijadas arriba.
- Wrapper `components/games/escalador-barriles-canvas.tsx` (Client Component, StrictMode-safe,
  `forwardRef<EscaladorBarrilesCanvasHandle, EscaladorBarrilesCanvasProps>` con
  `EscaladorBarrilesCanvasHandle = { restart: () => void }`, `canvasRef`/`engineRef`/
  `onStateChangeRef`, efecto de montaje con deps `[]`, efecto `[paused]`, efecto `[onStateChange]`,
  `<canvas width={640} height={760} className="escalador-barriles-canvas" />`).
- Wiring en `components/game-player.tsx`: añadir `"escalador-barriles"` a `HAS_REAL_ENGINE`; rama
  `isEscaladorBarriles = game.id === "escalador-barriles"`; `escaladorBarrilesRef`;
  `handleEscaladorBarrilesStateChange` (`useCallback` deps `[]`) → `setScore`/`setLives`/
  `setLevel`/`setOver`; render de `EscaladorBarrilesCanvas` con `paused={paused || over}` dentro de
  `.crt-screen`; HUD reutiliza el slot "Vidas" existente (igual formato de corazones que
  Asteroids) y el slot "Nivel"; `restart()` del modal llama al handle real.
- CSS `.escalador-barriles-canvas` en `app/globals.css` (canvas 640×760 centrado por altura dentro
  del `.crt-screen` 4:3, mismo patrón que `.tetris-canvas`/`.snake-canvas`) + nueva clase
  `.cover-barriles` junto a las `cover-*` existentes.
- Migración Supabase: `insert` de la fila en `games` (SQL abajo), a aplicar por `/spec-impl` con
  `mcp__supabase__apply_migration` — **no** por este agente.

#### Fuera de alcance

- Controles táctiles/móviles — solo teclado, igual que el resto del catálogo con motor real.
- Cambios de balance respecto a lo fijado en `## Diseño` (alturas de plataforma, velocidades,
  intervalos de barril, puntos, probabilidades).
- Más de 3 configuraciones de nivel hechas a mano — a partir de la vuelta 2 del nivel 3 se reutiliza
  la misma geometría con parámetros más difíciles, como en el arcade original.
- Tablas nuevas específicas del juego — no hay estado que no quepa en `EscaladorBarrilesState`.
- Conectar otros juegos del catálogo o modificar filas existentes distintas de la propia.
- La Opción B (`barriles-contrarreloj.md`) de este mismo `game-jam` — es un enfoque alternativo
  completo, no se implementan ambas a la vez.

### Modelo de datos

```ts
// lib/games/escalador-barriles/engine.ts
export interface EscaladorBarrilesState {
  score: number;
  lives: number;
  level: number;
  gameOver: boolean;
}

export interface EscaladorBarrilesCallbacks {
  onStateChange: (state: EscaladorBarrilesState) => void;
}

export class EscaladorBarrilesEngine {
  constructor(canvas: HTMLCanvasElement, callbacks: EscaladorBarrilesCallbacks);
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
  'escalador-barriles',
  'ESCALADOR DE BARRILES',
  'Sube la torre de andamios esquivando barriles con tus tres vidas.',
  'Un capataz suelta barriles desde la cima de la obra y ruedan plataforma abajo. Trepa por escaleras, esquiva con un salto justo a tiempo y llega a la puerta de meta antes de quedarte sin vidas. Tres pantallas fijas, cada vez más rápidas.',
  'ARCADE',
  'cover-barriles',
  'cyan'
);
```

### Plan de implementación

1. Leer este spec completo (fuente única de verdad de constantes de este enfoque) y
   `node_modules/next/dist/docs/01-app/` sobre Client Components, `useEffect` y `<canvas>` en
   Next 16, para confirmar convenciones antes de codear.
2. Crear `lib/games/escalador-barriles/engine.ts`: clase `EscaladorBarrilesEngine` con las 5
   plataformas fijas, las 3 configuraciones de escalera/barril, el spawner, la física de salto de
   esquiva, el sistema de vidas/respawn, la meta y el bucle de dificultad tras el nivel 3, más el
   contrato `start/pause/resume/restart/destroy` + `onStateChange` por frame. Sin HUD/overlay en
   canvas ni auto-reinicio.
3. Crear `components/games/escalador-barriles-canvas.tsx` (Client Component `forwardRef`)
   siguiendo el patrón de `snake-canvas.tsx`.
4. Modificar `components/game-player.tsx`: añadir `"escalador-barriles"` a `HAS_REAL_ENGINE`,
   `isEscaladorBarriles`, `escaladorBarrilesRef`, `handleEscaladorBarrilesStateChange`, la rama de
   render, y el `restart()` del engine real en el botón "JUGAR DE NUEVO".
5. Añadir la regla `.escalador-barriles-canvas` y `.cover-barriles` en `app/globals.css`.
6. Aplicar la migración `insert` con `mcp__supabase__apply_migration` (SQL de arriba).
7. Prueba manual end-to-end: `npm run dev` → `/games` → ESCALADOR DE BARRILES → "JUGAR AHORA";
   subir escaleras, esquivar barriles con `Espacio`, perder una vida y confirmar respawn con
   invulnerabilidad, perder las 3 vidas y confirmar el modal "FIN DEL JUEGO" con el score real,
   completar los 3 niveles y confirmar el bucle de dificultad del nivel 3, pausar/reanudar,
   guardar puntuación, "JUGAR DE NUEVO" reinicia una partida real.
8. `npm run lint` y corregir lo que reporte.

### Criterios de aceptación

- [ ] `/game/escalador-barriles/play` renderiza el canvas real (plataformas, escaleras, jugador,
      barriles) en vez de la arena placeholder.
- [ ] El HUD muestra `Puntuación`, `Vidas` (corazones) y `Nivel` en tiempo real desde el engine.
- [ ] El canvas no dibuja su propio HUD/overlay de "GAME OVER" — esa info vive solo en el HUD/modal.
- [ ] `←`/`→` mueven al jugador; `↑`/`↓` suben/bajan por una escalera solo si está alineado;
      `Espacio` ejecuta el salto corto de esquiva (350ms, invulnerable).
- [ ] Un barril que toca al jugador fuera de invulnerabilidad resta 1 vida y lo reposiciona en el
      inicio del nivel actual con invulnerabilidad temporal; un barril esquivado en salto suma +10.
- [ ] Llegar a la puerta de meta suma +200, limpia los barriles y carga el siguiente
      nivel/configuración.
- [ ] Perder la 3ª vida termina la partida y abre el modal "FIN DEL JUEGO" con el score real; no
      hay auto-reinicio por teclado.
- [ ] Completar el nivel 3 hace que la partida siga en bucle sobre la misma geometría con barriles
      más rápidos/frecuentes, y el HUD "Nivel" sigue incrementando.
- [ ] PAUSA congela la simulación real; REANUDAR la retoma sin perder posición/vidas/barriles.
- [ ] Guardar la puntuación inserta una fila en `scores` para `escalador-barriles`; "JUGAR DE
      NUEVO" reinicia una partida jugable; salir llama `destroy()` (sin rAF colgando).
- [ ] `games` tiene la fila `escalador-barriles` (ARCADE, `cover-barriles`, cyan) y aparece en
      `/games`, `/game/escalador-barriles` y `/leaderboard`.
- [ ] `npm run lint` pasa sin errores nuevos.

### Decisiones tomadas y descartadas

- **Categoría `ARCADE` en vez de `PLATFORMER`**: `Game.cat` en `lib/games.ts` solo admite
  `"ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS"` (CHECK real de la tabla `games`); la sugerencia
  original en `references/game-suggestions.md` que menciona "PLATFORMER" es aspiracional y no
  corresponde a ningún valor válido hoy. `ARCADE` es la categoría existente más cercana a una
  mecánica de plataformas/saltos (ya alberga a `snake`, `arkanoid`, `gloton`, `ranaria`).
- **3 configuraciones fijas + bucle de dificultad, no generación procedural**: mantiene el motor
  simple (geometría constante, sin generador ni cámara con scroll) y fiel al arcade original, a
  costa de contenido finito — la variedad viene de la dificultad creciente, no de niveles nuevos.
  Es el trade-off explícito frente a la Opción B.
- **Salto de esquiva sin desplazamiento entre plataformas**: solo sirve para esquivar, no para
  saltar huecos (eso lo requiere la Opción B) — mantiene el control simple de una sola tecla de
  acción y evita física de salto con arco horizontal en este enfoque.
- **Vidas en vez de una sola vida**: encaja con el árcade clásico tipo Donkey Kong/Mario Bros
  (múltiples intentos por partida) y da al jugador una curva de aprendizaje más indulgente que la
  Opción B.
- **Barriles limpiados al perder una vida o completar un nivel**: evita estados inconsistentes
  (barriles "huérfanos" de una geometría anterior) y simplifica el respawn.
- **`EscaladorBarrilesEngine` con contrato idéntico a `SnakeEngine`/`TetrisEngine`**: mismo patrón
  de montaje/desmontaje limpio con React StrictMode que el resto de motores reales del catálogo.

### Riesgos identificados

- React StrictMode monta/desmonta efectos dos veces en desarrollo; si `destroy()` no cancela el
  `requestAnimationFrame` ni remueve los listeners de teclado, podrían quedar loops o listeners
  duplicados — mitigación: probar pausa/reinicio/salida en desarrollo antes de dar por verificado.
- La detección de alineación con escalera (±20px) puede sentirse imprecisa si el hitbox del
  jugador (28px de ancho) no calza bien con el ancho de escalera (40px) — mitigación: ajustar el
  margen de alineación en la implementación si el playtesting lo pide, sin tocar las demás
  constantes de balance.
- El bucle de dificultad tras el nivel 3 podría volverse injugable si los topes (`260px/s`,
  `700ms`, `70%`) se alcanzan demasiado rápido — mitigación: los topes ya están fijados en este
  spec como límite explícito, no hay incremento sin techo.
- RLS pública sin validación server-side de score — limitación conocida heredada de SPEC 06,
  aceptada, no se resuelve aquí.

## Por qué este enfoque frente al otro

Gana **fidelidad al tema y menor esfuerzo de construcción**: geometría fija sin cámara ni
generación procedural, curva de dificultad simple por niveles, y vidas que hacen la partida más
indulgente para el jugador casual. Pierde frente a la Opción B en **rejugabilidad y tensión**: al
ser solo 3 configuraciones que se repiten, un jugador que las memoriza pierde la sorpresa; la
Opción B, al ser procedural e infinita con una sola vida y una amenaza que sube constantemente,
ofrece más tensión y una puntuación potencialmente ilimitada.
