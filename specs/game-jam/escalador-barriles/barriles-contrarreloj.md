# game-jam/escalador-barriles — Ascenso sin Fin contra la Lava (opción B)

- **Estado:** Draft
- **Tema del jam:** "Escalador de barriles" — un juego de plataformas al estilo Donkey Kong (subir
  plataformas/escaleras esquivando barriles que ruedan cuesta abajo).
- **Concepto base:** El jugador es un operario que debe trepar una estructura de andamios
  industriales hasta la cima, donde un capataz rival lanza barriles que ruedan cuesta abajo por
  cada plataforma. Subir contra la gravedad mientras esquivas objetos que bajan por ella es el
  corazón de la mecánica, no solo el decorado.
- **Enfoque de esta opción:** escalada **procedural e infinita** (sin niveles fijos): las
  plataformas se generan sin patrón según el jugador sube, la mecánica principal es **saltar entre
  huecos** (no escaleras) y una **marea de lava asciende desde abajo** cada vez más rápido; **una
  sola vida** — cualquier contacto con la lava o un barril termina la partida en el acto.
- **Fecha:** 2026-08-24
- **Categoría propuesta:** ARCADE · **Color:** yellow

## Diseño

### Concepto y fantasía
El jugador sube saltando de plataforma en plataforma, generadas sin patrón fijo a medida que
asciende, mientras esquiva barriles que ruedan sobre ellas y huye de una marea de lava que sube
desde abajo sin detenerse. No hay meta ni pantallas: el objetivo es llegar lo más alto posible
antes de que la lava lo alcance o un barril lo toque, una sola vez.

Frente a la Opción A (`barriles-vidas.md`), este enfoque cambia la mecánica principal (saltar
huecos en vez de escalar escaleras), la condición de fin de partida (una sola vida, sin
reintentos, en vez de un pool de 3) y el alcance (motor procedural con cámara que sigue al
jugador, más complejo de construir que la geometría fija de la Opción A). El "escalador de
barriles" se vuelve aquí una carrera contra el tiempo, literalmente: cuanto más tarda el jugador,
más rápido sube la lava.

### Mecánicas

**Mundo y generación procedural:**

- Canvas lógico **480×720px**, escalado por CSS dentro de `.crt-screen`, portrait.
- El mundo se mide en coordenadas propias donde `Y` **decrece** hacia arriba desde el punto de
  inicio (`worldY = 0`). La **altura escalada** (`heightPx`) es el máximo valor de
  `-worldY` alcanzado hasta el momento (nunca decrece).
- **Cámara**: sigue al jugador manteniéndolo fijo en `screenY = 430` (60% de la altura del
  canvas) una vez que `heightPx` supera `290px`; antes de eso el jugador se ve subir libremente
  desde el suelo del canvas.
- **Generación de plataformas**: el motor mantiene siempre generado un colchón de plataformas por
  encima de lo visible (hasta `300px` por delante de la cámara). Cada plataforma nueva:
  - Ancho aleatorio uniforme entre **120px y 220px**.
  - Posición horizontal `x` aleatoria dentro de `[0, 480 − ancho]`.
  - Separación vertical con la plataforma anterior aleatoria uniforme entre **90px y 140px**.
  - El generador **fuerza que sea alcanzable**: si el desplazamiento horizontal entre el borde
    más cercano de la plataforma anterior y la nueva excede **130px**, se recorta la posición `x`
    propuesta hasta que la distancia quede dentro de ese máximo (ver físicas de salto abajo, que
    garantizan un alcance horizontal seguro de referencia de 130px).
  - Las plataformas fuera del colchón visible (muy por debajo de la cámara) se descartan de la
    lista activa (no se dibujan ni colisionan) para no acumular memoria indefinidamente.

**Jugador:**

- Hitbox **26×34px**. Velocidad horizontal (suelo y aire) **150px/s**.
- **Salto** (`Espacio` o `↑`, solo si está apoyado en una plataforma): velocidad vertical inicial
  **−420px/s**, gravedad **900px/s²**. Es la única forma de cruzar el hueco entre plataformas y
  también de esquivar un barril en su camino.
- Caer fuera de toda plataforma (sin tocar ninguna) no termina la partida por sí solo — el
  jugador sigue cayendo por gravedad hasta tocar una plataforma inferior o hasta que lo alcance la
  lava (ver abajo), igual que en un juego de escalada tipo "Icy Tower".

**Marea de lava (amenaza principal, sustituye a las vidas):**

- Arranca en `worldY = +720` (una pantalla completa por debajo del punto de inicio del jugador) y
  su nivel **sube** (worldY de la lava decrece) a **40px/s** de forma constante.
- **Ritmo creciente**: cada **15 segundos** de partida transcurridos, la velocidad de ascenso de
  la lava aumenta **+4px/s**, hasta un techo de **140px/s**.
- Si la posición `Y` de la lava alcanza o supera la posición `Y` del jugador (lo "atrapa"): **fin
  de partida inmediato** (`gameOver: true`). No hay invulnerabilidad ni segunda oportunidad.

**Barriles:**

- Se generan sobre plataformas activas dentro del colchón visible: cada **2500ms** (base), cada
  plataforma elegible (que no sea la plataforma actual del jugador) tiene un **40%** de
  probabilidad de generar un barril en uno de sus extremos.
- Ruedan sobre la plataforma a **130px/s** en dirección al otro extremo; al llegar al borde, el
  barril **cae** (deja de existir tras salir de la plataforma, no continúa cayendo indefinidamente
  como amenaza activa).
- Hitbox de barril **24×24px**. Contacto con el jugador (sin estar en salto) = **fin de partida
  inmediato**, igual que la lava.
- **Esquiva con puntos**: si el jugador está en el aire (saltando) cuando un barril pasa dentro de
  `40px` horizontales de su posición sin llegar a tocarlo, se marca ese barril como esquivado
  (una sola vez) y suma **+25 puntos**.
- **Ritmo creciente**: cada **20 segundos** transcurridos, el intervalo base de generación baja
  **−100ms**, hasta un piso de **900ms**.

**Puntuación y condición de fin de partida:**

- `heightMeters = floor(heightPx / 10)` — metros escalados, solo puede subir, se muestra en el
  HUD como estadística de progreso (equivalente al "Nivel"/"Líneas" de otros juegos).
- `score = heightMeters + bonoEsquivas` donde `bonoEsquivas` es la suma acumulada de los +25 por
  cada barril esquivado en salto. `score` también solo puede subir.
- **Game over** (una sola vida, sin pool): al primer contacto con la lava o con un barril fuera de
  salto.

### Controles

- `←` / `→`: mover al jugador horizontalmente (en tierra y en el aire).
- `Espacio` o `↑`: saltar (único modo de cruzar huecos entre plataformas o esquivar un barril).

### Estado y HUD

```ts
interface EscaladorBarrilesContrarrelojState {
  score: number;
  heightMeters: number; // metros escalados, monotonamente creciente
  gameOver: boolean;
}
```

Sin `lives`: es un juego de una sola vida, como Snake/Tetris — el HUD reutiliza el slot que en
otros juegos muestra "Vidas" para mostrar en su lugar **"Altura"** (`heightMeters`, en metros).

### Metadatos de catálogo propuestos

- `id`: `escalador-barriles`
- `title`: `ESCALADOR DE BARRILES`
- `short`: `Escala sin parar mientras la lava te pisa los talones.`
- `long`: `Salta de plataforma en plataforma esquivando barriles rodantes mientras una marea de lava sube desde abajo, cada vez más rápido. Sin niveles, sin vidas: una sola caída y se acabó. ¿Cuántos metros puedes ganarle a la lava?`
- `cat`: `ARCADE`
- `color`: `yellow`
- `cover`: `cover-barriles-lava` (nueva clase, no existe hoy en `app/globals.css`)

## Técnico

### Alcance

#### Dentro de alcance

- Motor `lib/games/escalador-barriles/engine.ts` — clase `EscaladorBarrilesEngine` construida
  **desde cero** siguiendo el contrato de `reference.md`: constructor que ata los listeners de
  teclado (campos arrow de instancia) pero **no** arranca el loop; `start()` idempotente vía
  `requestAnimationFrame`; `pause()`/`resume()` (flag interno, `update(dt)` no avanza en pausa,
  incluida la lava y el spawner); `restart()` reinicia altura/score/lava/plataformas desde cero;
  `destroy()` cancela el rAF pendiente y remueve los listeners. `emitState()` construye
  `EscaladorBarrilesContrarrelojState` y llama `onStateChange` cada frame. Sin HUD/overlay
  dibujado en canvas y sin auto-reinicio en game-over. Implementa la generación procedural de
  plataformas con alcance garantizado, la física de salto, la marea de lava con su ritmo
  creciente, el spawner de barriles con su ritmo creciente, y el cálculo de `heightMeters`/`score`,
  todo con las constantes fijadas arriba en `## Diseño`.
- Wrapper `components/games/escalador-barriles-canvas.tsx` (Client Component, StrictMode-safe,
  `forwardRef<EscaladorBarrilesCanvasHandle, EscaladorBarrilesCanvasProps>` con
  `EscaladorBarrilesCanvasHandle = { restart: () => void }`, `canvasRef`/`engineRef`/
  `onStateChangeRef`, efecto de montaje con deps `[]`, efecto `[paused]`, efecto
  `[onStateChange]`, `<canvas width={480} height={720} className="escalador-barriles-canvas" />`).
- Wiring en `components/game-player.tsx`: añadir `"escalador-barriles"` a `HAS_REAL_ENGINE`; rama
  `isEscaladorBarriles = game.id === "escalador-barriles"`; `escaladorBarrilesRef`;
  `handleEscaladorBarrilesStateChange` (`useCallback` deps `[]`) → `setScore`/
  `setHeightMeters`(nuevo estado)/`setOver`; render de `EscaladorBarrilesCanvas` con
  `paused={paused || over}` dentro de `.crt-screen`; el slot HUD "Vidas" pasa a mostrar "Altura"
  (`heightMeters` + "m") para este juego, igual que "Líneas" en Tetris o "Longitud" en Snake; sin
  slot de "Nivel" con número propio (se reutiliza igual patrón que Snake/Tetris de repurposear un
  slot existente en vez de añadir uno nuevo al HUD genérico); `restart()` del modal llama al
  handle real.
- CSS `.escalador-barriles-canvas` en `app/globals.css` (canvas 480×720 centrado por altura dentro
  del `.crt-screen` 4:3, mismo patrón que `.tetris-canvas`) + nueva clase `.cover-barriles-lava`
  junto a las `cover-*` existentes.
- Migración Supabase: `insert` de la fila en `games` (SQL abajo), a aplicar por `/spec-impl` con
  `mcp__supabase__apply_migration` — **no** por este agente.

#### Fuera de alcance

- Controles táctiles/móviles — solo teclado, igual que el resto del catálogo con motor real.
- Cambios de balance respecto a lo fijado en `## Diseño` (velocidades de lava/barril, rangos de
  generación de plataformas, física de salto, puntos).
- Persistencia de la altura máxima entre partidas fuera de `scores` (p.ej. "mejor altura" propia
  fuera del leaderboard genérico) — se reutiliza el mismo mecanismo de `scores` que el resto del
  catálogo.
- Escaleras o cualquier mecánica de movimiento vertical distinta al salto — es la diferencia
  mecánica deliberada frente a la Opción A.
- Tablas nuevas específicas del juego — no hay estado que no quepa en
  `EscaladorBarrilesContrarrelojState`.
- Conectar otros juegos del catálogo o modificar filas existentes distintas de la propia.
- La Opción A (`barriles-vidas.md`) de este mismo `game-jam` — es un enfoque alternativo completo,
  no se implementan ambas a la vez.

### Modelo de datos

```ts
// lib/games/escalador-barriles/engine.ts
export interface EscaladorBarrilesContrarrelojState {
  score: number;
  heightMeters: number;
  gameOver: boolean;
}

export interface EscaladorBarrilesCallbacks {
  onStateChange: (state: EscaladorBarrilesContrarrelojState) => void;
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
  'Escala sin parar mientras la lava te pisa los talones.',
  'Salta de plataforma en plataforma esquivando barriles rodantes mientras una marea de lava sube desde abajo, cada vez más rápido. Sin niveles, sin vidas: una sola caída y se acabó. ¿Cuántos metros puedes ganarle a la lava?',
  'ARCADE',
  'cover-barriles-lava',
  'yellow'
);
```

### Plan de implementación

1. Leer este spec completo (fuente única de verdad de constantes de este enfoque) y
   `node_modules/next/dist/docs/01-app/` sobre Client Components, `useEffect` y `<canvas>` en
   Next 16, para confirmar convenciones antes de codear.
2. Crear `lib/games/escalador-barriles/engine.ts`: clase `EscaladorBarrilesEngine` con la
   generación procedural de plataformas (alcance garantizado ≤130px), la física de salto, la
   marea de lava con su ritmo creciente cada 15s, el spawner de barriles con su ritmo creciente
   cada 20s, el cálculo de `heightMeters`/`score`, y el contrato `start/pause/resume/restart/
   destroy` + `onStateChange` por frame. Sin HUD/overlay en canvas ni auto-reinicio.
3. Crear `components/games/escalador-barriles-canvas.tsx` (Client Component `forwardRef`)
   siguiendo el patrón de `snake-canvas.tsx`.
4. Modificar `components/game-player.tsx`: añadir `"escalador-barriles"` a `HAS_REAL_ENGINE`,
   `isEscaladorBarriles`, `escaladorBarrilesRef`, estado `heightMeters`,
   `handleEscaladorBarrilesStateChange`, la rama de render, el slot HUD "Altura", y el `restart()`
   del engine real en el botón "JUGAR DE NUEVO".
5. Añadir la regla `.escalador-barriles-canvas` y `.cover-barriles-lava` en `app/globals.css`.
6. Aplicar la migración `insert` con `mcp__supabase__apply_migration` (SQL de arriba).
7. Prueba manual end-to-end: `npm run dev` → `/games` → ESCALADOR DE BARRILES → "JUGAR AHORA";
   saltar entre plataformas generadas, esquivar barriles en el aire (+25), confirmar que la altura
   solo sube, dejar que la lava alcance al jugador y confirmar fin de partida inmediato, tocar un
   barril fuera de salto y confirmar fin de partida inmediato, pausar/reanudar (la lava no avanza
   en pausa), guardar puntuación, "JUGAR DE NUEVO" reinicia una partida real desde cero.
8. `npm run lint` y corregir lo que reporte.

### Criterios de aceptación

- [ ] `/game/escalador-barriles/play` renderiza el canvas real (plataformas generadas, jugador,
      barriles, marea de lava) en vez de la arena placeholder.
- [ ] El HUD muestra `Puntuación`, `Altura` (en metros) y "FIN DEL JUEGO" en tiempo real desde el
      engine; no muestra corazones/vidas ni un contador de "Nivel" separado.
- [ ] El canvas no dibuja su propio HUD/overlay de "GAME OVER" — esa info vive solo en el
      HUD/modal.
- [ ] `←`/`→` mueven al jugador en tierra y en el aire; `Espacio`/`↑` saltan (única forma de cruzar
      huecos entre plataformas).
- [ ] Las plataformas generadas son siempre alcanzables por el salto (nunca un hueco imposible de
      cruzar dado el alcance horizontal de referencia de 130px).
- [ ] La marea de lava sube constantemente y acelera cada 15s reales hasta el techo de 140px/s; si
      alcanza al jugador, termina la partida de inmediato sin invulnerabilidad.
- [ ] Un barril esquivado en salto (dentro de 40px, sin contacto) suma +25 una sola vez; un barril
      que toca al jugador fuera de salto termina la partida de inmediato.
- [ ] `heightMeters` y `score` solo pueden subir durante la partida (nunca decrecen).
- [ ] PAUSA congela la simulación real (incluida la lava y el spawner); REANUDAR la retoma sin
      perder altura/score/posición.
- [ ] Guardar la puntuación inserta una fila en `scores` para `escalador-barriles`; "JUGAR DE
      NUEVO" reinicia una partida jugable desde altura 0; salir llama `destroy()` (sin rAF
      colgando).
- [ ] `games` tiene la fila `escalador-barriles` (ARCADE, `cover-barriles-lava`, yellow) y aparece
      en `/games`, `/game/escalador-barriles` y `/leaderboard`.
- [ ] `npm run lint` pasa sin errores nuevos.

### Decisiones tomadas y descartadas

- **Categoría `ARCADE` en vez de `PLATFORMER`**: `Game.cat` en `lib/games.ts` solo admite
  `"ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS"` (CHECK real de la tabla `games`); la sugerencia
  original en `references/game-suggestions.md` que menciona "PLATFORMER" es aspiracional y no
  corresponde a ningún valor válido hoy. `ARCADE` es la categoría existente más cercana a una
  mecánica de plataformas/saltos.
- **Generación procedural con alcance garantizado, no niveles fijos**: da rejugabilidad infinita
  (cada partida es distinta) a costa de un motor más complejo (colchón de plataformas, descarte de
  las que salen de cámara, cálculo de alcance) frente a la geometría estática de la Opción A —
  trade-off explícito documentado en la sección final.
- **Una sola vida (`heightMeters`/`score` en vez de `lives`)**: refuerza la tensión de "carrera
  contra la lava" propia de este enfoque; añadir vidas rompería la lógica de "la lava nunca
  retrocede" (¿a qué altura respawnearía el jugador sin quedar atrapado de inmediato?). Se
  descarta un sistema de vidas por incompatible con la amenaza elegida.
- **Salto como único modo de movimiento vertical (sin escaleras)**: es la diferencia mecánica
  deliberada frente a la Opción A; con plataformas de posición aleatoria, una escalera fija no
  tendría sentido geométrico.
- **`heightMeters` y `score` ambos monótonos crecientes, con `score` derivado de `heightMeters`
  + bono de esquivas**: da al jugador una métrica de progreso limpia (metros) separada de la
  puntuación total (que también premia el estilo de esquivar en salto), sin necesitar un tercer
  campo de estado.
- **`EscaladorBarrilesEngine` con contrato idéntico a `SnakeEngine`/`TetrisEngine`**: mismo patrón
  de montaje/desmontaje limpio con React StrictMode que el resto de motores reales del catálogo.

### Riesgos identificados

- React StrictMode monta/desmonta efectos dos veces en desarrollo; si `destroy()` no cancela el
  `requestAnimationFrame` ni remueve los listeners de teclado, podrían quedar loops o listeners
  duplicados — mitigación: probar pausa/reinicio/salida en desarrollo antes de dar por verificado.
- La generación procedural con alcance garantizado es la pieza más delicada del motor: si el
  recorte de `x` al generar una plataforma no se implementa con cuidado, podría producir huecos
  imposibles de cruzar (partida injusta) — mitigación: el límite de 130px queda fijado en este
  spec como invariante que el generador debe respetar en cada plataforma nueva, no solo en
  promedio.
- Acumular plataformas/barriles indefinidamente sin descartar los que quedan muy por debajo de la
  cámara podría degradar el rendimiento en partidas largas — mitigación: el spec ya fija que las
  plataformas fuera del colchón visible se descartan de la lista activa.
- RLS pública sin validación server-side de score — limitación conocida heredada de SPEC 06,
  aceptada, no se resuelve aquí. Al ser una puntuación potencialmente ilimitada (sin techo de
  nivel), es más sensible a manipulación de cliente que un juego de niveles fijos; se acepta el
  mismo nivel de riesgo que el resto del catálogo, sin resolverlo aquí.

## Por qué este enfoque frente al otro

Gana **rejugabilidad y tensión**: cada partida es distinta (generación procedural), la lava
ascendente crea presión constante sin necesidad de "vidas" artificiales, y la puntuación no tiene
techo — encaja mejor con un leaderboard competitivo. Pierde frente a la Opción A en **alcance de
construcción** (motor bastante más complejo: cámara con scroll, generación con garantía de
alcance, descarte de entidades fuera de vista) y en **indulgencia con el jugador**: una sola vida
sin reintentos puede frustrar a quien busca la experiencia arcade clásica de "perder una vida y
seguir intentándolo" que sí ofrece la Opción A.
