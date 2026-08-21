# SPEC 11 — Rendimiento de Frogger

**Estado:** Implemented
**Depende de:** `specs/game-jam/frogger/01-frogger-core.md`
**Fecha:** 2026-08-21

**Objetivo:** Recuperar 60fps estables en Frogger en escritorio eliminando el coste de
composición por frame de las capas CSS que se apilan sobre el canvas del juego.

## Diagnóstico

El JS propio de Frogger (`components/games/FroggerGame.tsx`) es ligero y no es la causa
del lag: 11 carriles con pocas entidades, sin `shadowBlur` de canvas, y los callbacks
(`onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver`) se disparan solo en
eventos puntuales, no en cada frame — Frogger no sufre el patrón de re-render de React a
60fps ni el coste de `shadowBlur` por frame que sí tienen Snake/Tetris/Asteroids (Arkanoid
ya fue optimizado para ese patrón, ver `lib/games/arkanoid/engine.ts:325` y `:753`).

La caída de FPS viene de las **capas de composición CSS compartidas** apiladas sobre el
canvas vivo, cuyo coste escala con el área mostrada — grande en escritorio, lo que explica
por qué el síntoma se nota "sobre todo en escritorio":

1. **`.crt-screen::after`** (`app/globals.css:1192`) — scanlines con
   `mix-blend-mode: multiply` sobre todo el canvas. Un blend-mode sobre un elemento que se
   repinta cada frame (el `<canvas>`) anula el cacheo de capa del compositor y fuerza una
   recomposición completa en cada frame.
2. **`.av-bg::after`** (`app/globals.css:125`) — scanlines a pantalla completa con
   `mix-blend-mode: overlay`, sumado a `.av-bg` con animación `gridscroll` `infinite`
   (`app/globals.css:113`) y `.av-noise` con filtro SVG `feTurbulence`
   (`app/globals.css:139`) — trabajo de composición continuo a viewport completo,
   independiente del juego activo.
3. **`.crt-screen`** (`app/globals.css:1181`) — `overflow: hidden` + `border-radius`
   recortando un canvas que repinta cada frame.

## Alcance

**Dentro:**

- Medición de FPS antes/después (Chrome DevTools) como parte del propio plan de
  implementación.
- Ajustes CSS en las capas de composición que envuelven el canvas de juego:
  `.crt-screen::after`, `.av-bg::after`, `.av-noise`, la animación `gridscroll` de
  `.av-bg`.
- Aislamiento de capa de compositor para el canvas de juego si hace falta
  (`transform`/`will-change`) para que los pseudo-overlays no fuercen su recomposición.
- Micro-fix local en `FroggerGame.tsx`: no llamar a `draw()` en cada frame mientras
  `paused === true` (alinear con el comportamiento de Snake/Arkanoid, que congelan el
  último frame dibujado en pausa).

**Fuera de alcance:**

- Los motores de Snake, Tetris y Asteroids. Comparten un patrón distinto y ya conocido
  (`emitState()` sin dedupe + `shadowBlur` por entidad en cada frame) que **no** se toca
  aquí — es candidato a un spec de performance propio más adelante, no parte de este.
- Rediseño visual del look CRT. Los cambios deben ser visualmente equivalentes al efecto
  actual (scanlines, viñeta, marco), no una reinterpretación del estilo.
- Mecánicas de juego de Frogger (velocidades, colisiones, puntuación): no se modifican.

## Modelo de datos

No aplica. Esta spec no introduce ni modifica estructuras de datos, tablas de Supabase ni
estado persistente — es un cambio de CSS/render puro.

## Plan de implementación

1. **Medir primero.** Con Frogger corriendo en escritorio a tamaño de pantalla CRT grande,
   registrar el FPS base (baseline) con el panel de Performance / FPS meter de Chrome
   DevTools.
2. **Quitar el blend-mode sobre el canvas.** Sustituir `mix-blend-mode: multiply` de
   `.crt-screen::after` por un gradiente de scanlines de opacidad equivalente sin
   blend-mode, de forma que el resultado visual no cambie mientras se elimina la
   recomposición forzada por frame.
3. **Reducir el coste del fondo a pantalla completa.** Quitar o atenuar el
   `mix-blend-mode: overlay` de `.av-bg::after`; evaluar bajar la opacidad de `.av-noise`
   (feTurbulence) y/o pausar la animación `gridscroll` de `.av-bg` mientras hay una
   partida activa en pantalla.
4. **Aislar la capa del canvas.** Confirmar que el canvas de juego obtiene su propia capa
   de compositor (p. ej. `transform: translateZ(0)` / `will-change: transform` según
   corresponda) para que los pseudo-elementos overlay no lo obliguen a recomponer junto
   con sus hermanos.
5. **Micro-fix en Frogger.** En `components/games/FroggerGame.tsx`, omitir la llamada a
   `draw()` en el `loop` cuando `pausedRef.current` es `true` (o redibujar una sola vez al
   entrar en pausa), igual que el patrón ya usado en Snake/Arkanoid.
6. **Volver a medir.** Repetir la medición del paso 1 con el mismo método y confirmar la
   mejora de FPS frente al baseline registrado.

## Criterios de aceptación

- [ ] Frogger sostiene ~60fps en escritorio (pantalla CRT a tamaño grande), sin tirones
      perceptibles, medido en DevTools y comparado contra el baseline del paso 1.
- [ ] El look CRT (scanlines, viñeta, marco, ruido de fondo) se mantiene visualmente
      equivalente al actual tras los cambios.
- [ ] `npm run lint` y `npm run build` pasan sin errores.
- [ ] No se modifican mecánicas de Frogger ni los motores de Snake/Tetris/Asteroids/Arkanoid.

## Decisiones tomadas y descartadas

- **Alcance limitado a Frogger + CSS compartido**, descartando incluir Snake/Tetris/
  Asteroids en esta spec pese a compartir un patrón de performance distinto y también
  mejorable — decisión explícita del usuario para no ampliar el alcance; queda para un
  spec futuro si se decide abordarlo.
- **Se prioriza eliminar el coste de composición (blend-modes, capas) sobre reescribir el
  render del juego**, porque el diagnóstico por código descarta el render propio de
  Frogger como causa y sitúa el problema en las capas CSS compartidas.
- **Los cambios deben ser visualmente equivalentes**, no un rediseño del efecto CRT — se
  descartó cualquier opción que alterara el look reconocible de la interfaz.

## Riesgos identificados

- Los archivos CSS tocados (`.crt-screen`, `.av-bg`, `.av-noise`) son compartidos por
  todas las páginas y juegos, no solo Frogger: cualquier ajuste debe revisarse en el resto
  de pantallas para confirmar que el look no cambió de forma no intencional.
- Quitar un `mix-blend-mode` sin un sustituto visual equivalente puede producir una
  regresión perceptible en el efecto de scanlines/CRT.

## Resultado de la implementación

Implementado en la rama `spec-11-rendimiento-frogger`. No hubo herramienta de navegador
disponible durante la implementación para medir FPS en DevTools (pasos 1 y 6 del plan), así
que el baseline y la remedición quedaron como verificación manual pendiente del usuario; el
resto del plan (pasos 2–5) se implementó completo.

**Paso 2 — `mix-blend-mode: multiply` de `.crt-screen::after`:** eliminado sin más. El color
de origen del gradiente de scanlines es negro puro (`rgba(0,0,0,0.18)`); para un color de
origen negro, `multiply(negro, dst) = negro`, que es el mismo resultado que da la
composición normal (`source-over`) con ese mismo color. Es decir, con origen negro puro
`multiply` y `normal` son matemáticamente idénticos — no hace falta un gradiente sustituto,
basta con quitar la propiedad.

**Paso 3 — `mix-blend-mode: overlay` de `.av-bg::after` + animación `gridscroll`:**

- `mix-blend-mode: overlay` eliminado también, por un motivo distinto al del paso 2: aquí el
  alpha efectivo es ínfimo (`0.03` del `rgba` × `0.6` de `opacity` ≈ 1.8%), así que sobre el
  fondo oscuro de la app la diferencia entre `overlay` y composición normal a esa intensidad
  es imperceptible. No es una equivalencia matemática exacta como en el paso 2, sino una
  aproximación visual justificada por la magnitud del efecto.
- `.av-noise` **no se tocó** — decisión explícita, ver más abajo.
- Animación `gridscroll` de `.av-bg::before`: en vez de "pausar mientras hay una partida
  activa en pantalla" a nivel Frogger, se implementó a nivel de `GamePlayer`
  (`components/game-player.tsx`), que es el componente compartido que monta el motor de
  cualquier juego. Un nuevo `useEffect` añade la clase `av-game-active` a `<body>` al montar
  y la quita al desmontar; en CSS, `body.av-game-active .av-bg::before` aplica
  `animation-play-state: paused`. Cubre Frogger y de paso el resto de juegos con motor real.

**Paso 4 — aislamiento de capa de compositor:** aplicado a `.crt-screen` (no a cada
`.{id}-canvas` individual), porque es el contenedor compartido señalado en el punto 3 del
diagnóstico (`overflow: hidden` + `border-radius` recortando un canvas que repinta cada
frame) y cubre todos los juegos con una sola regla. Se añadió
`transform: translateZ(0); will-change: transform;`. `translateZ(0)` es una transformación
nula — no desplaza nada, solo promueve la capa.

**Paso 5 — micro-fix de pausa en Frogger:** en `components/games/FroggerGame.tsx`, el `loop`
ahora hace early-return cuando `pausedRef.current` es `true` (vuelve a pedir el siguiente
`requestAnimationFrame` sin llamar `update()` ni `draw()`), replicando el patrón exacto ya
usado en `lib/games/snake/engine.ts`. Al reanudar, `dt` se recalcula desde un `lastTsRef`
"viejo" (no se actualizó durante la pausa), pero ya estaba clamped a `Math.min(50, dt)` en
el código existente, así que no hay salto de simulación al despausar.

**Decisión tomada durante la implementación — `.av-noise` sin cambios:** el plan lo dejaba
como "evaluar" (opcional). No se tocó porque `.av-noise` no tiene `mix-blend-mode` ni
animación propia — es una imagen SVG (`feTurbulence`) rasterizada una sola vez, así que
bajarle la opacidad no ataca ningún coste de composición por frame, solo cambiaría el look
sin un beneficio de rendimiento claro.

**Archivos tocados:**

- `app/globals.css` — los 4 ajustes de CSS descritos arriba.
- `components/game-player.tsx` — `useEffect` de la clase `av-game-active` en `<body>`.
- `components/games/FroggerGame.tsx` — early-return en pausa dentro de `loop`.

**Verificación automática:** `npm run lint` (0 errores, solo warnings preexistentes en
`references/started-games/`) y `npm run build` pasan limpio.

**Pendiente de verificación manual (no automatizable en esta sesión, sin browser tooling):**
medir FPS real en Frogger (pasos 1 y 6) y confirmar que el look CRT se mantiene visualmente
equivalente en Frogger y en el resto de pantallas que comparten `.av-bg`/`.crt-screen`.
