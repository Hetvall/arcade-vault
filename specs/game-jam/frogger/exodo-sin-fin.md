# game-jam/frogger — Opción: Éxodo sin Fin

- **Estado:** Draft
- **Tema del jam:** Frogger
- **Concepto base:** Una rana debe cruzar, salto a salto sobre una grilla, una franja de peligro
  compuesta por una carretera con tráfico y un río con troncos, hasta llegar a un refugio seguro al
  otro lado. El tema se refleja en la mecánica misma (saltar carriles con obstáculos en movimiento),
  no solo en el arte.
- **Enfoque de esta opción:** Desplazamiento vertical infinito con una **línea letal ascendente**
  que empuja desde abajo y **una sola vida** (un solo golpe termina la partida) — sin refugios ni
  rondas, la meta es la distancia/puntuación máxima antes de morir, con un alcance de construcción
  más simple y rápido que el Frogger clásico completo.
- **Fecha:** 2026-08-14
- **Categoría propuesta:** ARCADE · **Color:** green

## Diseño

### Concepto y fantasía

El jugador es una rana de neón huyendo hacia arriba de una **inundación ascendente** que sube desde
el borde inferior de la pantalla: si la alcanza, muere al instante. Debe saltar celda por celda
carril a carril —carretera con tráfico, río con troncos, césped seguro— generados sin fin hacia
arriba, siempre un poco más rápido que la línea que la persigue. No hay meta final ni refugios que
llenar: el objetivo es sobrevivir la mayor distancia posible mientras la velocidad de todo (tráfico,
troncos, la propia línea letal) sube con la puntuación. Frente a la Opción A (tablero fijo con
vidas y rondas), aquí no hay margen de error ni pausa para planear: un solo golpe —vehículo, agua
sin tronco, o la línea ascendente— termina la partida, y el "tablero" nunca se repite ni se ve
completo de un vistazo, solo lo que ya se generó y lo que se generará justo por encima.

### Mecánicas

- **Grilla y canvas:** 12 columnas × 16 filas visibles, celdas de **40px** → resolución lógica fija
  **480×640**, escalada por CSS. Las filas por encima de la visible se generan proceduralmente a
  medida que la rana avanza (buffer de generación de 4 filas por delante de la fila más alta
  alcanzada).
- **Movimiento:** salto discreto de una celda por pulsación de tecla, con cooldown de input de
  **100ms**. La rana puede moverse en las 4 direcciones (incluido retroceder), limitada a las 12
  columnas visibles (no puede salir de los bordes horizontales).
- **Generación procedural de carriles:** cada fila nueva se sortea como uno de 3 tipos con
  probabilidades fijas: **césped seguro** (25%), **carretera** (45%), **río** (30%). No se repite
  el mismo tipo más de 3 filas seguidas (si el sorteo lo haría, se fuerza césped seguro).
- **Carretera (vehículos):** un único tipo de vehículo (1 celda de ancho). Velocidad del carril
  elegida al azar entre `[80, 110, 140, 170]` px/s, dirección elegida al azar 50/50 por carril.
  Hueco entre vehículos aleatorio entre **2 y 3 celdas**. Tocar un vehículo = fin de partida
  inmediato.
- **Río (troncos):** un único tipo de tronco, largo fijo de **2 a 3 celdas** (aleatorio por
  tronco). Velocidad del carril elegida al azar entre `[60, 90, 120]` px/s, dirección aleatoria por
  carril. No hay tortugas ni sumersión (se simplifica frente a la Opción A). Caer en una celda de
  río sin un tronco debajo = fin de partida inmediato.
- **Línea letal ascendente:** sube desde el borde inferior del canvas a velocidad base
  **18px/s**, que aumenta **+0.6px/s por cada 10 puntos** de score acumulado, con techo de
  **70px/s**. Si la línea alcanza la fila donde está la rana (o una fila por encima de ella) = fin
  de partida inmediato, sin importar en qué carril esté parada.
- **Escalado de dificultad adicional:** cada **200 puntos**, las velocidades de vehículos y
  troncos suben un **+10%** acumulado (tope **+50%** a partir de los 1000 puntos), independiente
  del aumento de la línea letal.
- **Puntuación:**
  - **+5** por cada salto hacia una fila nueva (fila más alta que la máxima alcanzada hasta ahora
    en la partida; moverse lateralmente o hacia abajo no puntúa).
  - **+10 adicionales** por cada fila de distancia máxima alcanzada, calculados como
    `distance * 10` y mostrados como score base — es decir, `score = distance * 10 + hops * 5`,
    donde `distance` es la fila más alta alcanzada (0 en el spawn) y `hops` es el conteo de saltos
    hacia una fila nueva (mismo valor que `distance`, dado que cada avance de fila cuenta una vez).
    En la práctica: `score = distance * 15` (equivalente simplificado, fijado como la fórmula que
    implementa el motor).
- **Fin de partida:** una sola vida — cualquiera de los tres golpes fatales (vehículo, agua sin
  tronco, línea letal) pone `gameOver: true` de inmediato, sin respawn ni vidas de repuesto.

### Controles

- **↑ / W:** salta una celda hacia arriba (avanza distancia).
- **↓ / S:** salta una celda hacia abajo (retrocede, no puntúa).
- **← / A:** salta una celda a la izquierda.
- **→ / D:** salta una celda a la derecha.

### Estado y HUD

```ts
interface FroggerState {
  score: number; // distance * 15
  distance: number; // fila más alta alcanzada desde el spawn (0 al inicio)
  gameOver: boolean;
}
```

HUD muestra: Puntuación y Distancia (filas) en tiempo real; no hay Vidas ni Ronda en esta opción
(un solo intento por partida).

### Metadatos de catálogo propuestos

- **id:** `frogger`
- **title:** `FROGGER`
- **short:** `Huye de la marea. Un solo salto en falso y se acabó.`
- **long:** `Salta sin parar entre tráfico y troncos mientras la inundación sube desde abajo.
Sin vidas de repuesto: cada metro de distancia cuenta para el marcador final.`
- **cat:** `ARCADE`
- **color:** `green`
- **cover:** `cover-frogger-exodo` (nuevo)

## Técnico

### Alcance

#### Dentro de alcance

- Motor `lib/games/frogger/engine.ts` — clase `FroggerEngine` construida **desde cero** siguiendo
  el contrato de `reference.md` (constructor no arranca el loop; `start/pause/resume/restart/
destroy`; `onStateChange` cada frame; sin HUD/overlay dibujado en canvas; sin auto-reinicio en
  game-over) y las constantes fijadas arriba en `## Diseño`, incluyendo la generación procedural
  de carriles y la línea letal ascendente.
- Wrapper `components/games/frogger-canvas.tsx` (Client Component, StrictMode-safe, `forwardRef`
  con `FroggerCanvasHandle = { restart }`).
- Wiring en `components/game-player.tsx` (`HAS_REAL_ENGINE`, rama de render, HUD con Distancia,
  PAUSA/FIN/JUGAR DE NUEVO).
- CSS `.frogger-canvas` en `app/globals.css` + `.cover-frogger-exodo` nuevo.
- Migración Supabase: `insert` de la fila nueva en `games` (SQL abajo), a aplicar por
  `/spec-impl` con `mcp__supabase__apply_migration` — **no** por este agente.

#### Fuera de alcance

Controles táctiles, cambios de balance respecto a lo fijado en `## Diseño`, sistema de vidas o
rondas (pertenecen a la Opción A, no a esta), tortugas/sumersión, tablas nuevas específicas del
juego, y conectar otros juegos del catálogo (`gloton`, `invasores`, `ranaria` — placeholder
existente que **no** se toca ni se renombra —, `duelo-pixel`).

### Modelo de datos

```ts
// lib/games/frogger/engine.ts
export interface FroggerState {
  score: number;
  distance: number;
  gameOver: boolean;
}

export interface FroggerCallbacks {
  onStateChange: (state: FroggerState) => void;
}

export class FroggerEngine {
  constructor(canvas: HTMLCanvasElement, callbacks: FroggerCallbacks);
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
  'frogger',
  'FROGGER',
  'Huye de la marea. Un solo salto en falso y se acabó.',
  'Salta sin parar entre tráfico y troncos mientras la inundación sube desde abajo. Sin vidas de
repuesto: cada metro de distancia cuenta para el marcador final.',
  'ARCADE',
  'cover-frogger-exodo',
  'green'
);
```

### Plan de implementación

1. Leer esta opción completa (`exodo-sin-fin.md`) como fuente de verdad de constantes y contrato.
2. Crear `lib/games/frogger/engine.ts`: generación procedural de carriles (césped/carretera/río)
   con buffer de 4 filas por delante, spawn/movimiento de vehículos y troncos por carril, salto
   discreto con cooldown de 100ms, línea letal ascendente con su curva de velocidad, cálculo de
   `distance`/`score`, y el contrato `start/pause/resume/restart/destroy` + `onStateChange` por
   frame.
3. Crear `components/games/frogger-canvas.tsx` (Client Component `forwardRef`) siguiendo el patrón
   de `snake-canvas.tsx`/`tetris-canvas.tsx`.
4. Modificar `components/game-player.tsx`: añadir `"frogger"` a `HAS_REAL_ENGINE`, `isFrogger`,
   `froggerRef`, estado `distance`, `handleFroggerStateChange`, la rama de render de
   `FroggerCanvas`, la celda HUD "Distancia" y el `restart()` del engine.
5. Añadir la regla `.frogger-canvas` y `.cover-frogger-exodo` en `app/globals.css`.
6. Aplicar la migración de `insert` con `mcp__supabase__apply_migration` (SQL de arriba).
7. Prueba manual end-to-end: `npm run dev` → `/games` → FROGGER → "JUGAR AHORA"; sobrevivir varias
   filas, morir por vehículo, morir por caer al agua sin tronco, morir alcanzado por la línea
   letal, confirmar el modal "FIN DEL JUEGO" con la puntuación real; guardar puntuación, verificar
   `/game/frogger` y `/leaderboard`; "JUGAR DE NUEVO" reinicia una partida real desde distancia 0.
8. `npm run lint`.

### Criterios de aceptación

- [ ] `/game/frogger/play` renderiza el canvas real (rana, tráfico, río, línea letal ascendente)
      en vez de la arena placeholder.
- [ ] El HUD muestra Puntuación y Distancia en tiempo real desde el engine, sin campos de Vidas ni
      Ronda.
- [ ] El canvas no dibuja su propio HUD/overlay de "GAME OVER" — esa info vive en el HUD/modal de
      React.
- [ ] Flechas y WASD saltan una celda por pulsación, con cooldown de 100ms entre saltos.
- [ ] Tocar un vehículo, caer al agua sin tronco visible, o ser alcanzado por la línea letal
      termina la partida de inmediato (sin vidas de repuesto ni respawn).
- [ ] La línea letal sube constantemente y su velocidad aumenta con el score acumulado, hasta el
      techo de 70px/s.
- [ ] Las velocidades de vehículos/troncos suben +10% cada 200 puntos hasta el tope +50%.
- [ ] `distance` solo aumenta al alcanzar una fila nueva más alta que la máxima previa; moverse
      lateralmente o hacia abajo no cambia `distance` ni `score`.
- [ ] PAUSA congela vehículos, troncos y la línea letal; REANUDAR retoma exactamente donde quedó.
- [ ] Guardar la puntuación inserta una fila en `scores` para `frogger`; "JUGAR DE NUEVO" reinicia
      una partida jugable desde distancia 0; salir llama `destroy()` sin rAF colgando.
- [ ] La fila `frogger` existe en `games` (FROGGER, ARCADE, `cover-frogger-exodo`, green) y
      aparece en `/games`, `/game/frogger` y `/leaderboard`.
- [ ] `npm run lint` pasa sin errores nuevos.

### Decisiones tomadas y descartadas

- **Una sola vida, sin refugios ni rondas:** simplifica drásticamente el estado del motor frente a
  la Opción A (no hay que rastrear refugios ocupados, rondas ni respawn) — reduce el alcance de
  construcción y prueba a cambio de perder la fantasía de "completar un tablero".
- **Línea letal ascendente en vez de temporizador numérico:** comunica la presión visualmente en
  el propio canvas (algo que se acerca) en vez de un número que baja, reforzando la sensación de
  huida constante que define esta opción frente al cruce planeado de la Opción A.
- **Generación procedural con buffer de 4 filas:** evita generar el mapa entero de antemano
  (innecesario en un endless) y mantiene memoria acotada — solo se conservan las filas cercanas a
  la ventana visible más el buffer.
- **Sin tortugas/sumersión:** una sola mecánica de río (tronco sí/tronco no) es suficiente para
  esta opción más simple; la sumersión cíclica se reserva para la Opción A, que ya tiene más
  presupuesto de complejidad.
- **Fórmula de score simplificada `distance * 15`:** aunque el diseño describe puntos por salto y
  por distancia por separado, ambos términos son proporcionales a `distance` en este modo (cada
  fila nueva se cuenta una sola vez), así que el motor implementa directamente la fórmula
  equivalente — se deja explícita para que `/spec-impl` no tenga que derivarla.
- **Sin dibujo de HUD/overlay en canvas:** el motor solo emite `FroggerState`; el HUD, el overlay
  de pausa y el modal de fin de partida son responsabilidad de React, igual que en Asteroids/
  Tetris/Snake.

### Riesgos identificados

- React StrictMode monta/desmonta efectos dos veces en desarrollo; si `destroy()` no cancela el
  `requestAnimationFrame` ni remueve los listeners de teclado, podrían quedar loops o listeners
  duplicados — mitigar probando pausa/reinicio/salida en desarrollo.
- La generación procedural infinita puede acumular memoria si no se descartan las filas que ya
  quedaron muy por debajo de la vista (detrás de la línea letal) — mitigar liberando/podando
  carriles generados una vez que la línea letal los supera.
- Un techo de velocidad demasiado alto en la línea letal (70px/s) combinado con vehículos al
  +50% podría volver el juego injugable pasado cierto score — mitigar con prueba manual de una
  partida larga antes de dar por aceptado el criterio de escalado.
- RLS pública sin validación server-side de score — limitación conocida heredada de SPEC 06,
  aceptada, no se resuelve aquí.

## Por qué este enfoque frente al otro

Gana en **alcance y velocidad de construcción**: sin rondas, refugios, temporizador por vida ni
tortugas que sumergir, el motor tiene muchos menos estados que probar, y la tensión de "un solo
golpe" es inmediatamente legible sin necesitar HUD de vidas. Pierde la **fidelidad al Frogger
clásico** y el respiro estratégico de la Opción A: aquí no hay margen de error ni la satisfacción
de "completar el tablero", solo una carrera de distancia contra una amenaza que nunca se detiene.
