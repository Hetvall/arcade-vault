# 15 — Juego Space Invaders (space-invaders)

- **Estado:** Implemented
- **Depende de:** SPEC 06
- **Fecha:** 2026-09-09
- **Objetivo:** Construir desde cero un motor TypeScript de Space Invaders (sin `game.js` de referencia) y conectarlo a la entrada `space-invaders` del catálogo, con HUD, pausa, fin de partida y guardado de puntuación integrados a la plataforma.

## Alcance

### Dentro de alcance

- Nuevo motor de juego escrito desde cero (no hay `game.js` de referencia en `references/started-games/` para Space Invaders), con las siguientes mecánicas fijadas como decisión de diseño de este spec:
  - **Nave del jugador**: se mueve horizontalmente a velocidad fija con `←`/`→`, dispara con `Espacio` una bala propia a la vez (cooldown: no puede disparar de nuevo hasta que su bala anterior sale de pantalla o impacta, estilo arcade clásico).
  - **Cuadrícula de invasores**: 5 filas × 11 columnas. Las 2 filas superiores valen 30 pts por alien, las 2 filas intermedias 20 pts, la fila inferior 10 pts (valores clásicos de Space Invaders). El bloque completo se mueve lateralmente en conjunto; al tocar un borde del canvas invierte dirección y desciende una fila. La velocidad del bloque aumenta a medida que quedan menos aliens vivos (menos aliens → movimiento más rápido).
  - **Disparo de los invasores**: en cada tick, una columna con aliens vivos es elegida al azar con probabilidad acumulada por tiempo (cooldown global de disparo enemigo) y su alien más bajo dispara una bala hacia abajo.
  - **Búnkeres**: 4 búnkeres destructibles distribuidos entre la nave y los invasores, formados por una grilla de celdas pequeñas; cada celda impactada por una bala (del jugador o de un invasor) desaparece, erosionando el búnker progresivamente. Las balas se destruyen al impactar una celda.
  - **OVNI bonus**: cada cierto intervalo aparece un OVNI que cruza la parte superior del canvas; destruirlo otorga un bonus de puntos mayor que un alien normal (100 pts fijos). Si cruza sin ser destruido, desaparece sin penalización.
  - **Vidas y fin de partida**: el jugador empieza con 3 vidas. Pierde una vida si una bala enemiga lo impacta, o si algún invasor alcanza la fila de la nave (invasión exitosa) — este segundo caso también reinicia la posición de la cuadrícula para la vida restante. Al perder la última vida, `gameOver: true`.
  - **Niveles**: al eliminar todos los invasores de la cuadrícula sin perder todas las vidas, sube el nivel: se genera una cuadrícula nueva completa con una velocidad base mayor que la del nivel anterior (progresión de dificultad, sin tocar la mecánica de aceleración por aliens restantes dentro del mismo nivel).
  - Ninguna de estas mecánicas ni sus valores (velocidades, puntos, probabilidades, cooldowns) provienen de un original a portar 1:1 — todos son decisiones de diseño de este spec, documentadas aquí para que la implementación no invente nada por su cuenta.
- El motor se estructura como una clase `SpaceInvadersEngine` sin estado compartido entre instancias, siguiendo el mismo contrato que `AsteroidsEngine`/`ArkanoidEngine` (ver `.claude/skills/add-game/reference.md`), para poder montarse/desmontarse limpiamente con el ciclo de vida de React (incluye StrictMode).
- `SpaceInvadersEngine` expone:
  - `constructor(canvas: HTMLCanvasElement, callbacks: { onStateChange(state: SpaceInvadersState): void })`.
  - `start()` — arranca el loop (`requestAnimationFrame`) y la partida; idempotente.
  - `pause()` / `resume()` — congela/reanuda la simulación (`update(dt)` no se ejecuta en pausa).
  - `restart()` — reinicia la partida desde cero (nivel 1, 3 vidas, cuadrícula completa, búnkeres intactos).
  - `destroy()` — cancela el `requestAnimationFrame` pendiente y remueve los listeners de teclado.
  - `onStateChange` se invoca en cada frame con `{ score, lives, level, gameOver }` — no dibuja HUD/overlay propio en el canvas; esa información sale solo por este callback y la pinta el HUD de React.
  - No hay auto-reinicio automático en `gameOver`: el engine se queda congelado en `gameOver: true` esperando a que algo externo llame `restart()`.
  - Resolución lógica del canvas fija 800×600, escalada visualmente por CSS dentro de `.crt-screen` (mismo patrón que Asteroids/Arkanoid), sin recalcular físicas por tamaño de contenedor.
- Nuevo Client Component `components/games/space-invaders-canvas.tsx` (`forwardRef`) que:
  - Renderiza `<canvas width={800} height={600} className="space-invaders-canvas" />`, instancia `SpaceInvadersEngine` en un efecto de montaje con deps `[]` (usando `onStateChangeRef` para no reinstanciar el motor en cada render del padre), y llama `destroy()` en el cleanup.
  - Recibe `paused: boolean` por props y llama `pause()`/`resume()` en un efecto separado con deps `[paused]`.
  - Recibe `onStateChange` por props, sincronizado vía `onStateChangeRef` en un efecto con deps `[onStateChange]`.
  - Expone `restart()` al padre vía `useImperativeHandle`/`ref` (`SpaceInvadersCanvasHandle = { restart: () => void }`).
- `components/game-player.tsx` se modifica para:
  - Añadir `"space-invaders"` a `HAS_REAL_ENGINE` y una rama `isSpaceInvaders = game.id === "space-invaders"` que renderiza `SpaceInvadersCanvas` dentro de `.crt-screen` en vez de la arena placeholder.
  - `paused={paused || over}` — el modal de fin de partida también congela el engine.
  - `onStateChange` = un `useCallback` con deps `[]` que hace `setScore`/`setLives`/`setLevel` desde el `state` recibido (reutiliza el mismo estado `lives`/`level` del HUD que ya usan Asteroids/Arkanoid/Pong — Space Invaders cae en la misma rama "Vidas" del HUD), y `if (state.gameOver) setOver(true)`.
  - Un `useRef<SpaceInvadersCanvasHandle>(null)` para que "JUGAR DE NUEVO" llame `.restart()` sobre el motor real.
  - El resto (HUD genérico, botones PAUSA/REANUDAR/FIN/SALIR, modal de fin de partida, flujo de `saveScore`/`saving`/`saveError`) se reutiliza sin cambios.
- CSS: nueva regla `.space-invaders-canvas` en `app/globals.css` junto a `.asteroids-canvas`/`.arkanoid-canvas`, y nueva clase `.cover-space-invaders` (icono/patrón propio de invasores en píxel, distinto del `.cover-asteroids` existente) junto a las `.cover-*` actuales.
- Migración Supabase: insertar la fila del catálogo con `mcp__supabase__apply_migration`:
  ```sql
  insert into public.games (id, title, short, long, cat, cover, color)
  values (
    'space-invaders',
    'SPACE INVADERS',
    'Defiende la Tierra de la invasión alienígena en oleadas.',
    'Una cuadrícula de invasores alienígenas avanza en bloque, cada vez más rápido conforme caen. Dispara desde tu nave, refúgiate tras búnkeres destructibles y derriba el OVNI bonus que cruza el cielo. Tres vidas frente a la invasión.',
    'SHOOTER',
    'cover-space-invaders',
    'yellow'
  );
  ```

### Fuera de alcance

- Controles táctiles para Space Invaders — se porta solo el control por teclado (`←`/`→`/`Espacio`), igual que el resto de juegos con motor real hasta que tengan su propio soporte táctil. El componente genérico `TouchControls`/`isTouchDevice` de `game-player.tsx` no se conecta para este juego en este spec.
- Sistema de skins (paletas neon/retro/clásico) — queda para el flujo estándar (`skin-designer`, encadenado por `/spec-impl-game` tras implementar este spec), no se diseña aquí.
- Cambios de balance posteriores a este spec (velocidades, puntos, probabilidades, cooldowns) — los valores fijados arriba son la decisión de diseño definitiva de este spec; cualquier rebalanceo futuro necesita su propio spec o decisión explícita.
- Tabla o columna nueva específica de Space Invaders en Supabase — reutiliza `games`/`scores` tal como existen (SPEC 06), sin cambios de esquema.
- Conectar cualquier otro juego del catálogo que siga con la arena placeholder — hoy no hay ninguno (los 6 juegos sembrados ya tienen motor real: `arkanoid`, `asteroids`, `frogger`, `pong`, `snake`, `tetris`); este spec añade el séptimo.
- Sonido/música — no se agrega audio.
- Rediseño del HUD genérico de `game-player.tsx` — Space Invaders reutiliza los campos `score`/`lives`/`level` ya existentes, sin agregar columnas de HUD nuevas (no hay power-up con temporizador como el 3× de Asteroids).

## Modelo de datos

```ts
// lib/games/space-invaders/engine.ts
interface SpaceInvadersState {
  score: number;
  lives: number;
  level: number;
  gameOver: boolean;
}

class SpaceInvadersEngine {
  constructor(
    canvas: HTMLCanvasElement,
    callbacks: {
      onStateChange: (state: SpaceInvadersState) => void;
    }
  );
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  destroy(): void;
}
```

```ts
// components/games/space-invaders-canvas.tsx
type SpaceInvadersCanvasHandle = { restart: () => void };
type SpaceInvadersCanvasProps = {
  paused: boolean;
  onStateChange: (state: SpaceInvadersState) => void;
};
```

No se agregan tablas ni columnas nuevas en Supabase — la fila de `games` usa las mismas columnas de SPEC 06 (`id`, `title`, `short`, `long`, `cat`, `cover`, `color`), y las puntuaciones se guardan en `scores` sin ningún campo adicional.

## Plan de implementación

1. Leer `node_modules/next/dist/docs/01-app/` en lo referente a Client Components, `useEffect` y manejo de `<canvas>`, para confirmar que no hay convención distinta en Next 16 que afecte este patrón (ya aplicado en Asteroids/Tetris/Arkanoid/Snake/Pong).
2. Crear `lib/games/space-invaders/engine.ts`: clase `SpaceInvadersEngine` con las mecánicas descritas en "Dentro de alcance" (nave, cuadrícula de invasores con aceleración por aliens restantes, disparo enemigo, búnkeres destructibles, OVNI bonus, vidas, niveles). Sin HUD/overlay dibujado en canvas, sin auto-reinicio en `gameOver`. `pause()`/`resume()` respetados por `update()`. `onStateChange` invocado al final de cada `update()`.
3. Crear `components/games/space-invaders-canvas.tsx`: monta `<canvas width={800} height={600}>`, instancia el motor en un efecto de montaje (`onStateChangeRef` para evitar reinstanciar en cada render), sincroniza `paused` en efecto separado, expone `restart()` vía `useImperativeHandle`/`forwardRef`.
4. Modificar `components/game-player.tsx`: añadir `"space-invaders"` a `HAS_REAL_ENGINE`, la rama `isSpaceInvaders` que renderiza `SpaceInvadersCanvas`, el `useCallback` de `onStateChange` (reutilizando `score`/`lives`/`level`), el `useRef` del handle, y el wiring de PAUSA/FIN/JUGAR DE NUEVO.
5. Añadir la regla CSS `.space-invaders-canvas` en `app/globals.css`, junto a `.asteroids-canvas`/`.arkanoid-canvas`, y `.cover-space-invaders` junto a las `.cover-*` existentes.
6. Aplicar la migración con `mcp__supabase__apply_migration`: insertar la fila de `space-invaders` en `games` (SQL en "Dentro de alcance").
7. Prueba manual end-to-end: `npm run dev` → `/games` → SPACE INVADERS → "JUGAR AHORA"; jugar con teclado (mover nave, disparar, eliminar invasores de distintas filas y comprobar sus puntos, ver que el bloque acelera al quedar pocos aliens, que dispara de vuelta, que los búnkeres se erosionan al recibir impactos, que el OVNI bonus aparece y otorga puntos al destruirlo); pausar/reanudar; perder las 3 vidas (por impacto enemigo o invasión) y confirmar que aparece el modal "FIN DEL JUEGO" de la plataforma con el score real (no un overlay del canvas); guardar puntuación con iniciales y confirmar que aparece en `/game/space-invaders` y en `/leaderboard`; "JUGAR DE NUEVO" reinicia una partida real jugable; limpiar toda la cuadrícula y confirmar que sube de nivel con velocidad base mayor.
8. Confirmar que los demás juegos del catálogo siguen funcionando sin cambios de comportamiento.
9. Ejecutar `npm run lint` y corregir lo que reporte.

## Criterios de aceptación

- [x] `/game/space-invaders/play` renderiza el canvas real de Space Invaders (nave, cuadrícula de invasores, balas, búnkeres, OVNI bonus) en vez de la arena placeholder.
- [x] El HUD superior (`Puntuación`, `Vidas`, `Nivel`) refleja en tiempo real el estado del engine.
- [x] El canvas no dibuja su propio SCORE/NIVEL/vidas ni overlay de fin de partida — esa información vive solo en el HUD y modal de React.
- [x] Los controles de teclado (`←` `→` `Espacio`) mueven la nave y disparan según el cooldown de una bala propia a la vez.
- [x] El bloque de invasores acelera su movimiento lateral a medida que quedan menos aliens vivos, invierte dirección y desciende al tocar un borde del canvas.
- [x] Los invasores disparan balas hacia abajo con cooldown; una bala enemiga que impacta la nave resta una vida.
- [x] Los búnkeres pierden celdas visiblemente al recibir impactos de balas (propias o enemigas).
- [x] El OVNI bonus aparece periódicamente cruzando la parte superior y otorga 100 puntos al ser destruido.
- [x] Limpiar toda la cuadrícula de invasores sube el nivel y genera una cuadrícula nueva con velocidad base mayor.
- [x] El botón PAUSA congela la simulación real y muestra el overlay "EN PAUSA" ya existente; REANUDAR la retoma sin perder estado.
- [x] Al perder la tercera vida, el juego NO se reinicia solo; se abre el modal "FIN DEL JUEGO" de la plataforma con la puntuación final real.
- [x] Guardar la puntuación desde el modal inserta una fila real en `scores` vía Supabase, igual que el resto de juegos.
- [x] "JUGAR DE NUEVO" reinicia una partida real y jugable del engine (nivel 1, 3 vidas, búnkeres intactos).
- [x] "VOLVER AL VAULT" y "SALIR" navegan igual que hoy, sin dejar el `requestAnimationFrame` del engine corriendo en segundo plano (`destroy()` se llama al desmontar).
- [x] `space-invaders` aparece en `/games` con su propia portada (`cover-space-invaders`), y en `/leaderboard` como pestaña nueva.
- [x] Los demás juegos del catálogo siguen funcionando sin cambios de comportamiento.
- [x] `npm run lint` pasa sin errores nuevos.

## Decisiones tomadas y descartadas

- **Motor construido desde cero, no portado**: no existe `references/started-games/<algo>/game.js` de Space Invaders en este repo; el usuario confirmó escribirlo desde cero en vez de aportar una fuente externa. Por eso este spec fija explícitamente cada mecánica y valor de balance (ver "Dentro de alcance"), en vez de remitir a un original — es la fuente de verdad que reemplaza al `game.js` que tendría un porteo normal.
- **`id` en inglés (`space-invaders`) en vez de una traducción española**: el usuario pidió explícitamente evitar "invasores" como nombre; se usa el nombre original del juego en inglés tanto para `id` como para `title`, aceptando la inconsistencia con el resto del catálogo (mayormente en español) como decisión deliberada del usuario.
- **Cuadrícula clásica con búnkeres y OVNI bonus, en vez de una versión simplificada**: el usuario eligió expresamente la variante fiel al arcade original de 1978 (búnkeres destructibles, disparo enemigo, aceleración por aliens restantes, OVNI bonus) sobre una versión reducida sin esos elementos.
- **Color `yellow` repetido con Asteroids**: el catálogo permite colores repetidos entre juegos (no es una clave única); se prioriza mantener el shooter con el tono amarillo/alerta característico de Space Invaders sobre introducir una nueva paleta de color solo para diferenciarlo.
- **Cover nueva (`cover-space-invaders`) en vez de reutilizar `cover-asteroids`**: aunque ambos son SHOOTER, comparten motor de tipo "nave contra enemigos" pero visualmente son juegos distintos (cuadrícula de invasores vs. campo de asteroides); una portada compartida confundiría la identidad de la tarjeta en `/games`.
- **Vidas compartiendo la misma rama del HUD que Asteroids/Arkanoid/Pong**: Space Invaders es un juego de vidas (no de longitud como Snake ni de líneas como Tetris), así que no se agrega ningún campo de HUD nuevo — reutiliza `lives`/`level` ya existentes en `game-player.tsx`.
- **Skins fuera de alcance de este spec**: el sistema de skins (`skin-designer`) se aplica en un paso posterior del flujo estándar (`/spec-impl-game` lo encadena automáticamente tras implementar), no como parte de definir el motor base.
- **Sin controles táctiles en este spec**: es una feature transversal a todo el catálogo (ver SPEC 10), no específica de Space Invaders; se deja para un spec/paso posterior de soporte táctil si se pide.

## Riesgos identificados

- Al no existir un original de referencia, el balance (velocidades, cooldowns, probabilidad de disparo enemigo, frecuencia del OVNI) queda a criterio de la implementación dentro de los rangos descritos en este spec — si el resultado se siente demasiado fácil/difícil en la prueba manual, ajustar esos valores es un cambio de balance permitido sin reabrir el spec (no cambia mecánicas ni estructura).
- React StrictMode en desarrollo monta y desmonta efectos dos veces; si `SpaceInvadersEngine.destroy()` no cancela correctamente el `requestAnimationFrame` y remueve los listeners de teclado, podrían quedar loops o listeners duplicados — mitigación: probar explícitamente pausa/reinicio/salida en desarrollo antes de dar el spec por verificado (mismo riesgo ya documentado y mitigado en SPEC 05/07/08).
- RLS pública en `scores` sin validación server-side del score (ver SPEC 06/13) — riesgo ya aceptado y documentado a nivel de plataforma, no específico de este juego.

## Nota de implementación

Durante la prueba manual (paso 7 del plan) se encontraron y corrigieron 2 bugs en la primera
versión de `lib/games/space-invaders/engine.ts`, ninguno de los dos visible por revisión de
código estática, ambos confirmados con un hook de depuración temporal (removido antes de cerrar
el spec):

- `updateGrid()` calculaba el nuevo límite lateral del bloque restando dos veces el offset
  acumulado (`alien.x - gridOffsetX + newOffsetX`), lo que hacía que el chequeo de borde casi
  nunca disparara: el bloque avanzaba indefinidamente sin invertir dirección ni descender.
  Corregido a `alien.x + newOffsetX`.
- La colisión bala del jugador–alien comparaba contra la posición **base** del alien
  (`alien.x`/`alien.y`, sin sumar `gridOffsetX`/`gridOffsetY`), la misma que usa el dibujo. Como
  resultado, las balas del jugador solo podían impactar en el instante t≈0 (offset≈0) y luego
  nunca más alcanzaban visualmente a ningún invasor. Corregido sumando el offset del bloque a la
  caja de colisión del alien antes de comparar.

El resto de mecánicas (disparo enemigo, búnkeres, OVNI, vidas/invasión, subida de nivel, pausa,
guardado de puntuación) se verificaron funcionando correctamente sin cambios adicionales sobre lo
descrito en "Dentro de alcance".
