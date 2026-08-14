# game-jam/frogger — Opción: Cruce Clásico

- **Estado:** Draft
- **Tema del jam:** Frogger
- **Concepto base:** Una rana debe cruzar, salto a salto sobre una grilla, una franja de peligro
  compuesta por una carretera con tráfico y un río con troncos, hasta llegar a un refugio seguro al
  otro lado. El tema se refleja en la mecánica misma (saltar carriles con obstáculos en movimiento),
  no solo en el arte.
- **Enfoque de esta opción:** Tablero fijo de una sola pantalla, con **3 vidas**, un temporizador
  por vida y una condición de victoria por ronda (llenar 5 refugios) que reinicia el cruce con más
  velocidad — el Frogger clásico completo, mayor alcance y profundidad de sistemas.
- **Fecha:** 2026-08-14
- **Categoría propuesta:** ARCADE · **Color:** green

## Diseño

### Concepto y fantasía

El jugador es una rana de neón que arranca en la orilla inferior de una pantalla fija dividida en
tres franjas: una carretera con vehículos, una franja media de descanso, y un río con troncos y
tortugas. Debe saltar celda por celda hacia arriba y encajar en uno de los 5 refugios superiores.
Cada refugio ocupado suma progreso hacia "completar la ronda"; al llenarlos los 5, el tablero se
reinicia con el tráfico y el río más rápidos y menos tiempo por vida — la presión crece ronda tras
ronda, igual que el Frogger original, pero con el propio balance de esta opción (no un port 1:1).
Frente a la Opción B (endless sin fin), aquí el jugador **planea** cada salto sobre un tablero
estático y visible por completo, con vidas de repuesto y una meta de "ronda" clara, en vez de huir
de una amenaza que empuja constantemente desde abajo.

### Mecánicas

- **Grilla y canvas:** 13 columnas × 13 filas, celdas de **40px** → resolución lógica fija
  **520×520**, escalada por CSS.
- **Filas (de abajo hacia arriba, índice 12→0):**
  - Fila 12 (abajo): orilla de salida — segura, punto de respawn de la rana.
  - Filas 11–7: **carretera**, 5 carriles con vehículos.
  - Fila 6: franja media segura (césped, checkpoint visual, no otorga puntos).
  - Filas 5–1: **río**, 5 carriles con troncos y tortugas.
  - Fila 0 (arriba): fila de **refugios**, con 5 huecos de 1 celda cada uno separados por muros de
    césped; solo se puede entrar saltando exactamente sobre el centro de un hueco vacío.
- **Movimiento:** salto discreto de una celda por pulsación de tecla, con una animación de
  interpolación de **120ms** durante la cual se ignoran nuevas pulsaciones (cooldown de input). La
  rana puede moverse en las 4 direcciones libremente (no hay restricción de "no retroceder").
- **Carretera (vehículos):** 5 carriles, velocidades base en px/s `[70, 90, 110, 130, 150]` de la
  fila 11 a la 7; carriles con índice par avanzan hacia la derecha, impares hacia la izquierda.
  Tipos: coche (1 celda de ancho) y camión (2 celdas de ancho), 60%/40% de probabilidad de spawn
  respectivamente. Intervalo de spawn por carril aleatorio entre **1.2s y 2.5s**. Tocar cualquier
  vehículo = pierde una vida.
- **Río (troncos y tortugas):** 5 carriles, velocidades base en px/s `[50, 70, 90, 60, 80]` de la
  fila 5 a la 1, alternando dirección igual que la carretera. Troncos: 2 a 4 celdas de largo, la
  rana se mueve con el tronco mientras está sobre él. Tortugas: grupos de 2 celdas que se sumergen
  cíclicamente (**4s visibles / 1.5s sumergidas**); si la rana está sobre una tortuga sumergida,
  pierde una vida igual que si cayera al agua sin nada debajo.
- **Temporizador por vida:** cada vida dispone de **25s** (ronda 1) para llegar a un refugio desde
  la orilla de salida; se muestra en el HUD como segundos restantes. Si llega a 0, pierde una vida
  y respawnea en la orilla. El temporizador se reinicia al respawnear o al ocupar un refugio.
- **Vidas:** arranca con **3**. Perder una vida (choque con vehículo, caída al agua, tiempo
  agotado) respawnea a la rana en la orilla de salida sin reiniciar refugios ya ocupados. Al llegar
  a **0 vidas** → `gameOver: true`. Se otorga **+1 vida** (hasta un máximo de **5**) cada vez que el
  score acumulado cruza un múltiplo de **1000** puntos.
- **Puntuación:**
  - **+10** por cada fila nueva avanzada respecto al máximo alcanzado en la vida actual (evita
    farmear puntos moviéndose adelante/atrás en la misma fila).
  - **+50** por ocupar un refugio vacío.
  - Al llenar los **5 refugios** (ronda completa): **+200** de bonus más **+10 por cada segundo
    restante** del temporizador de esa vida en el momento de ocupar el último refugio.
- **Progresión por ronda:** al completar una ronda (5 refugios llenos), el tablero se reinicia:
  los 5 refugios vuelven a estar vacíos, las velocidades de carretera y río suben un **+8%**
  acumulado por ronda (tope **+40%**, ronda 5 en adelante no sigue subiendo), y el temporizador
  por vida baja **2s** por ronda completada (piso de **12s**). El juego continúa indefinidamente
  entre rondas hasta que las vidas llegan a 0.

### Controles

- **↑ / W:** salta una celda hacia arriba.
- **↓ / S:** salta una celda hacia abajo.
- **← / A:** salta una celda a la izquierda.
- **→ / D:** salta una celda a la derecha.

### Estado y HUD

```ts
interface FroggerState {
  score: number;
  lives: number; // 0-5
  round: number; // empieza en 1
  timeLeft: number; // segundos restantes de la vida actual, redondeado hacia arriba
  homesFilled: number; // 0-5 refugios ocupados en la ronda actual
  gameOver: boolean;
}
```

HUD muestra: Puntuación, Vidas (corazones, como Asteroids), Ronda, Tiempo (barra o número
regresivo) y Refugios (p.ej. "3/5").

### Metadatos de catálogo propuestos

- **id:** `frogger`
- **title:** `FROGGER`
- **short:** `Cruza la autopista y el río antes de que se acabe el tiempo.`
- **long:** `Salta carril a carril esquivando tráfico y cabalgando troncos. Llena los cinco
refugios para completar la ronda — cada ronda sube la velocidad y aprieta el reloj.`
- **cat:** `ARCADE`
- **color:** `green`
- **cover:** `cover-frogger` (nuevo)

## Técnico

### Alcance

#### Dentro de alcance

- Motor `lib/games/frogger/engine.ts` — clase `FroggerEngine` construida **desde cero** siguiendo
  el contrato de `reference.md` (constructor no arranca el loop; `start/pause/resume/restart/
destroy`; `onStateChange` cada frame; sin HUD/overlay dibujado en canvas; sin auto-reinicio en
  game-over) y las constantes fijadas arriba en `## Diseño`.
- Wrapper `components/games/frogger-canvas.tsx` (Client Component, StrictMode-safe, `forwardRef`
  con `FroggerCanvasHandle = { restart }`).
- Wiring en `components/game-player.tsx` (`HAS_REAL_ENGINE`, rama de render, HUD con Vidas/Ronda/
  Tiempo/Refugios, PAUSA/FIN/JUGAR DE NUEVO).
- CSS `.frogger-canvas` en `app/globals.css` + `.cover-frogger` nuevo.
- Migración Supabase: `insert` de la fila nueva en `games` (SQL abajo), a aplicar por
  `/spec-impl` con `mcp__supabase__apply_migration` — **no** por este agente.

#### Fuera de alcance

Controles táctiles, cambios de balance respecto a lo fijado en `## Diseño`, tablas nuevas
específicas del juego, sistema de puntuaciones por combo más allá de lo descrito, y conectar
otros juegos del catálogo (`gloton`, `invasores`, `ranaria` — placeholder existente que **no** se
toca ni se renombra —, `duelo-pixel`).

### Modelo de datos

```ts
// lib/games/frogger/engine.ts
export interface FroggerState {
  score: number;
  lives: number;
  round: number;
  timeLeft: number;
  homesFilled: number;
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
  'Cruza la autopista y el río antes de que se acabe el tiempo.',
  'Salta carril a carril esquivando tráfico y cabalgando troncos. Llena los cinco refugios para
completar la ronda — cada ronda sube la velocidad y aprieta el reloj.',
  'ARCADE',
  'cover-frogger',
  'green'
);
```

### Plan de implementación

1. Leer esta opción completa (`cruce-clasico.md`) como fuente de verdad de constantes y contrato.
2. Crear `lib/games/frogger/engine.ts`: grilla 13×13 sobre canvas 520×520, spawn/movimiento de
   vehículos y troncos/tortugas por carril con las velocidades fijadas, salto discreto con
   cooldown de 120ms, temporizador por vida, vidas, refugios, rondas y puntuación según lo
   descrito, más el contrato `start/pause/resume/restart/destroy` + `onStateChange` por frame.
3. Crear `components/games/frogger-canvas.tsx` (Client Component `forwardRef`) siguiendo el patrón
   de `snake-canvas.tsx`/`tetris-canvas.tsx`.
4. Modificar `components/game-player.tsx`: añadir `"frogger"` a `HAS_REAL_ENGINE`, `isFrogger`,
   `froggerRef`, estados `lives`/`round`/`timeLeft`/`homesFilled`, `handleFroggerStateChange`, la
   rama de render de `FroggerCanvas`, las celdas HUD correspondientes y el `restart()` del engine.
5. Añadir la regla `.frogger-canvas` y `.cover-frogger` en `app/globals.css`.
6. Aplicar la migración de `insert` con `mcp__supabase__apply_migration` (SQL de arriba).
7. Prueba manual end-to-end: `npm run dev` → `/games` → FROGGER → "JUGAR AHORA"; cruzar carretera
   y río, montar troncos, hundirse con tortuga sumergida, agotar el temporizador, perder las 3
   vidas y confirmar el modal "FIN DEL JUEGO"; llenar los 5 refugios y confirmar que sube la ronda
   y la velocidad; guardar puntuación, verificar `/game/frogger` y `/leaderboard`; "JUGAR DE
   NUEVO" reinicia una partida real.
8. `npm run lint`.

### Criterios de aceptación

- [ ] `/game/frogger/play` renderiza el canvas real (rana, tráfico, río, refugios) en vez de la
      arena placeholder.
- [ ] El HUD muestra Puntuación, Vidas, Ronda, Tiempo y Refugios en tiempo real desde el engine.
- [ ] El canvas no dibuja su propio HUD/overlay de "GAME OVER" — esa info vive en el HUD/modal de
      React.
- [ ] Flechas y WASD saltan una celda por pulsación, con cooldown de 120ms entre saltos.
- [ ] Tocar un vehículo, caer al agua sin tronco/tortuga visible, o agotar el temporizador resta
      una vida y respawnea en la orilla sin perder los refugios ya ocupados.
- [ ] Llenar los 5 refugios suma el bonus de ronda, sube la velocidad de carriles (+8%, tope
      +40%) y reduce el temporizador de la siguiente vida (−2s, piso 12s).
- [ ] Perder la tercera vida termina la partida y abre el modal "FIN DEL JUEGO" con la puntuación
      real; no hay auto-reinicio por teclado.
- [ ] PAUSA congela vehículos, troncos y temporizador; REANUDAR retoma exactamente donde quedó.
- [ ] Guardar la puntuación inserta una fila en `scores` para `frogger`; "JUGAR DE NUEVO" reinicia
      una partida jugable; salir llama `destroy()` sin rAF colgando.
- [ ] La fila `frogger` existe en `games` (FROGGER, ARCADE, `cover-frogger`, green) y aparece en
      `/games`, `/game/frogger` y `/leaderboard`.
- [ ] `npm run lint` pasa sin errores nuevos.

### Decisiones tomadas y descartadas

- **Tablero fijo de una sola pantalla (no scroll):** mantiene la fantasía original de Frogger —
  ver el cruce completo de un vistazo y planear la ruta — frente a un scroll continuo, que se deja
  para la Opción B.
- **Vidas + temporizador combinados:** el temporizador por sí solo ya presiona, pero las vidas dan
  margen de error suficiente para que el jugador aprenda los patrones de tráfico sin terminar la
  partida en el primer choque — más accesible que un solo golpe fatal.
- **Rondas con reinicio de refugios y velocidad creciente:** replica la curva de dificultad del
  Frogger clásico (cada "board" completo sube la apuesta) sin necesidad de niveles con layouts
  distintos — el mismo tablero, más rápido y con menos tiempo.
- **Cooldown de salto de 120ms en vez de movimiento continuo tipo Snake:** el salto discreto es la
  esencia de Frogger; un cooldown corto evita saltos accidentales dobles por rebote de tecla sin
  sentirse lento.
- **Sin dibujo de HUD/overlay en canvas:** el motor solo emite `FroggerState`; el HUD, el overlay
  de pausa y el modal de fin de partida son responsabilidad de React, igual que en Asteroids/
  Tetris/Snake.

### Riesgos identificados

- React StrictMode monta/desmonta efectos dos veces en desarrollo; si `destroy()` no cancela el
  `requestAnimationFrame` ni remueve los listeners de teclado, podrían quedar loops o listeners
  duplicados que hagan saltar la rana el doble — mitigar probando pausa/reinicio/salida en
  desarrollo.
- Colisión de la rana sobre troncos/tortugas requiere que la posición de la rana se acople al
  desplazamiento del objeto que la sostiene (arrastre horizontal); un cálculo impreciso podría
  dejarla "flotando" fuera del tronco visualmente aunque el estado lógico diga que sigue viva —
  mitigar anclando la posición visual de la rana al `x` del tronco mientras `ridingLog === true`.
- El temporizador decreciente por ronda (piso 12s) podría volverse injugable si no se prueba con
  las velocidades +40% de la ronda 5 — mitigar con prueba manual explícita de varias rondas
  seguidas antes de dar por aceptado el criterio de progresión.
- RLS pública sin validación server-side de score — limitación conocida heredada de SPEC 06,
  aceptada, no se resuelve aquí.

## Por qué este enfoque frente al otro

Gana **fidelidad y profundidad**: vidas de repuesto, rondas con progresión clara y un tablero
legible de un vistazo hacen que la partida se sienta como el Frogger clásico completo, con más
sistemas para lucirse en el catálogo. Pierde en **alcance/esfuerzo**: son más estados (rondas,
refugios, temporizador, tortugas que se sumergen) que construir y balancear que la Opción B, y el
ritmo es más pausado/estratégico frente a la tensión constante de un endless.
