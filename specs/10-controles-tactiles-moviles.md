# 10 — Controles táctiles para móviles

- **Estado:** Implementado
- **Depende de:** SPEC 05, SPEC 07, SPEC 08, SPEC 09
- **Fecha:** 2026-08-18
- **Objetivo:** Añadir controles en pantalla (D-pad y botones) a los cuatro motores con juego
  real (Asteroids, Tetris, Arkanoid, Snake) para que sean jugables por completo en dispositivos
  táctiles, sin tocar las mecánicas ni el flujo de teclado existentes.

## Alcance

### Dentro de alcance

- **Seam nuevo en cada motor: inyección sintética de input.** Cada `<Game>Engine` expone un
  método público que reutiliza exactamente la misma lógica de input que ya usa para teclado (sin
  duplicar reglas de juego):
  - `AsteroidsEngine.setKey(code: string, pressed: boolean)` y
    `ArkanoidEngine.setKey(key: string, pressed: boolean)` — motores de estado continuo
    (`this.keys[code] = true/false`, leído cada frame). Refactorizan `onKeyDown`/`onKeyUp` para
    delegar en la misma función interna que llama `setKey`, así el atajo de teclado y el táctil
    comparten una sola implementación.
  - `TetrisEngine.pressKey(code: string)` y `SnakeEngine.pressKey(code: string)` — motores de
    input discreto (una pulsación = una acción: mover una celda, rotar, hard-drop, cambiar
    dirección). Refactorizan el `switch` de `onKeyDown` a un método privado
    `handleAction(code: string)` reutilizado por el listener real de teclado y por `pressKey`.
  - Ningún motor cambia sus constantes de balance, su bucle de juego, ni su manejo de
    `pause`/`gameOver` (los guards existentes — p. ej. Snake ignorando input si `paused` o
    `gameOver` — se preservan intactos porque están dentro de la función compartida).
- **`components/games/touch-controls.tsx`** (nuevo): componente compartido que renderiza el
  overlay de controles según una prop `layout`:
  - `"snake"` → D-pad de 4 flechas. Cada botón dispara `pressKey` una vez por `touchstart` (sin
    repetición: Snake no la necesita, la serpiente sigue moviéndose sola en la última dirección
    encolada).
  - `"tetris"` → D-pad (izquierda/derecha/abajo) + botón rotar + botón hard-drop. Izquierda,
    derecha y abajo implementan repetición mientras se mantiene presionado (intervalo interno del
    componente que vuelve a llamar `pressKey` mientras dure el `touchstart`, deteniéndose en
    `touchend`/`touchcancel`), imitando el auto-repeat de teclado del que dependen hoy. Rotar y
    hard-drop son de una sola pulsación.
  - `"asteroids"` → botones ◄ ► (rotar, mantener = `setKey(código, true/false)` en
    `touchstart`/`touchend`), ▲ (empuje, mismo patrón hold) y disparo (dispara vía repetición
    interna mientras se mantiene presionado, ya que el motor trata "Space" como pulsación
    discreta por frame).
  - `"arkanoid"` → botones ◄ ► para mover la paleta, mismo patrón hold (`setKey` en
    `touchstart`/`touchend`).
  - Un solo `onKey` callback prop (`(code: string, pressed: boolean) => void` para los layouts de
    tipo "hold"; `(code: string) => void` para los de tipo "press") desacopla el componente de
    cada ref concreto — `game-player.tsx` decide a qué método del ref llamar.
- **`<Game>CanvasHandle` extendido** en los cuatro `components/games/<id>-canvas.tsx`: cada
  handle ya expone `restart()`; se le añade `setKey`/`pressKey` (según corresponda) que reenvía
  directamente al método nuevo del engine.
- **Wiring en `components/game-player.tsx`**: renderiza `<TouchControls layout={...} onKey={...}
/>` como tarjeta propia inmediatamente después de la tarjeta `.av-player`, para cada uno de los
  4 juegos, conectado al ref correspondiente (`asteroidsRef`, `tetrisRef`, `arkanoidRef`,
  `snakeRef`), con el mismo patrón condicional que ya usa (`isAsteroids`, `isTetris`, etc.).
- **Detección de dispositivo táctil**: hook/util `useIsTouchDevice()` (o inline en
  `game-player.tsx`) basado en `window.matchMedia("(pointer: coarse)")`, reevaluado en cliente
  tras montar (para no romper el render de servidor). El overlay solo se renderiza cuando
  `true`; en desktop con mouse/teclado no aparece. El teclado sigue funcionando en todos los
  casos — este spec solo añade el input táctil, no reemplaza ni condiciona el existente.
- **Layout: panel propio, no overlay sobre el canvas.** Según el mockup provisto (juego arriba,
  pad abajo), `TouchControls` **no** se superpone al canvas ni vive dentro de la tarjeta
  `.av-player` existente: se renderiza como una **segunda tarjeta independiente**, debajo de la
  tarjeta del reproductor (HUD + `.crt-screen`), con el mismo lenguaje visual — borde redondeado
  neón (verde), fondo oscuro — que ya usa `.av-player`/`.crt-screen`, para que se lea como un
  panel hermano ("consola" de controles) y no como un elemento flotante. Solo se monta cuando hay
  dispositivo táctil (ver detección abajo); en desktop el layout no reserva su espacio.
- **CSS** — reglas nuevas en `app/globals.css` para ese panel (`.touch-controls`,
  `.touch-controls .dpad`, `.touch-controls button`, etc.): tarjeta independiente apilada debajo
  de `.av-player` (sin overlay flotante encima del canvas, sin scroll horizontal), botones con
  área táctil ≥44×44px, estética coherente con el resto de la UI (paleta neón/oscura ya
  establecida, mismo tratamiento de borde que `.crt-screen`). `touch-action: none` en los botones
  para evitar scroll/zoom accidental al tocar.
- Portrait está soportado tal cual: el `.crt-screen` ya escala por `aspect-ratio` (spec 05); no se
  agrega lock de orientación ni sugerencia de rotar el dispositivo.
- **Ampliación (post-revisión visual en dispositivo real):** el layout inicial del pad táctil
  es funcional pero visualmente pobre en móvil (HUD desordenado, D-pad sin refinar, navbar de
  sitio robando espacio vertical). Se añade al alcance, solo para `pointer: coarse`
  (desktop no cambia):
  - **Pulido visual de `TouchControls`**: D-pad y botones de acción con mejor jerarquía visual
    (tamaño, espaciado, color) siguiendo el lenguaje neón ya establecido.
  - **`player-hud` compacto en móvil**: en viewports táctiles, `PAUSA`/`FIN`/`SALIR` y el
    `SkinPicker` se reorganizan en una barra más compacta (menos padding, chips de skin más
    pequeños o un `<select>` nativo en vez de los chips actuales) para no competir en altura con
    el canvas del juego. Es CSS + un modo compacto de `SkinPicker` — no cambia qué acciones
    existen, solo cómo se agrupan visualmente en pantallas pequeñas.
  - **Navbar del sitio oculto durante la partida en móvil**: `components/nav.tsx` detecta la
    ruta `/game/[id]/play` y, solo en viewports táctiles (vía CSS `@media`, no JS), oculta la
    `<nav>` global mientras se juega, para maximizar el espacio vertical disponible para
    canvas + controles. Fuera de esa ruta, o en desktop, el navbar se comporta igual que hoy.

### Fuera de alcance

- Gestos de swipe sobre el canvas (se descartó a favor de D-pad/botones explícitos).
- Drag-to-steer en Asteroids o drag-to-move en Arkanoid (se descartó a favor de botones que
  reflejan 1:1 el input de teclado existente).
- Vibración/haptics al tocar los botones.
- Cualquier cambio a los juegos sin motor real (siguen con la arena placeholder, sin controles
  táctiles).
- Rediseño del HUD superior o del modal de fin de partida para móvil — solo se agregan los
  controles de juego bajo el canvas.
- Soporte de gamepad/mando físico.

## Modelo de datos

No aplica — este spec no introduce ni modifica tablas de Supabase, `localStorage`, ni ninguna
estructura persistida. Es puramente de input y UI.

## Plan de implementación

1. **Asteroids** (`lib/games/asteroids/engine.ts`): extraer la lógica de `onKeyDown`/`onKeyUp` a
   un método `setKey(code, pressed)` reutilizado por ambos listeners reales; el motor queda
   funcionalmente idéntico por teclado. Añadir `setKey` a `AsteroidsCanvasHandle` /
   `asteroids-canvas.tsx`.
2. **Arkanoid** (`lib/games/arkanoid/engine.ts`): mismo refactor con `setKey(key, pressed)`
   (usa `e.key`, no `e.code`, como ya hace el motor). Añadir a `ArkanoidCanvasHandle` /
   `arkanoid-canvas.tsx`.
3. **Tetris** (`lib/games/tetris/engine.ts`): extraer el `switch` de `onKeyDown` (excluyendo
   `KeyP`/pausa, que no es parte de este spec) a `handleAction(code)`, expuesto como
   `pressKey(code)`. Añadir a `TetrisCanvasHandle` / `tetris-canvas.tsx`.
4. **Snake** (`lib/games/snake/engine.ts`): mismo refactor, `handleAction(code)` expuesto como
   `pressKey(code)`. Añadir a `SnakeCanvasHandle` / `snake-canvas.tsx`.
5. **`components/games/touch-controls.tsx`**: componente nuevo con los 4 layouts descritos
   arriba, sin dependencias de un juego concreto (recibe `layout` + `onKey`).
6. **`app/globals.css`**: reglas `.touch-controls` (tarjeta contenedora con borde neón a juego con
   `.crt-screen`, D-pad, botones, estados `:active`).
7. **`components/game-player.tsx`**: hook de detección táctil + render condicional de
   `<TouchControls>` como tarjeta propia debajo de `.av-player`, para cada uno de los 4 juegos con
   motor real, cableado a su ref.
8. **Verificación manual**: `npm run build` y `npm run lint`; probar en devtools con emulación
   táctil (u dispositivo real) que cada uno de los 4 juegos es jugable de principio a fin
   (empezar, moverse/rotar/disparar según el juego, terminar la partida, reiniciar) solo con
   controles táctiles, y que el teclado sigue funcionando igual que antes en desktop.

## Criterios de aceptación

- [x] En un viewport con `pointer: coarse` (emulado o dispositivo real), los 4 juegos
      (`asteroids`, `tetris`, `arkanoid`, `snake`) muestran, debajo de la tarjeta del reproductor,
      una segunda tarjeta con el pad de controles táctiles (borde neón consistente con
      `.crt-screen`, no superpuesta al canvas).
- [x] En un viewport con `pointer: fine` (desktop normal), esa tarjeta de controles no se
      renderiza.
- [x] Asteroids: los botones táctiles rotan la nave, la empujan y disparan; se puede jugar una
      partida completa hasta game over solo con táctil.
- [x] Tetris: el D-pad táctil mueve la pieza a izquierda/derecha/abajo (con repetición mientras se
      mantiene presionado), el botón de rotar rota y el de hard-drop cae instantáneamente.
- [x] Arkanoid: los botones ◄► mueven la paleta de forma continua mientras se mantienen
      presionados.
- [x] Snake: el D-pad táctil cambia de dirección (respetando que no se puede invertir 180°, regla
      ya existente en el motor).
- [x] El teclado (flechas, WASD, Space, X, P según el juego) sigue funcionando exactamente igual
      que antes de este spec, en desktop y en táctil simultáneamente.
- [x] `npm run lint` y `npm run build` pasan sin errores nuevos.
- [x] Ningún motor cambia su comportamiento de pausa/game-over/reinicio por este cambio.

## Decisiones tomadas y descartadas

- **Inyección de teclas sintéticas vs. API semántica por juego**: se eligió reutilizar
  `setKey`/`pressKey` porque cero duplica las reglas de input que cada motor ya tiene probadas
  (rotación, límites de dirección de Snake, hard-drop de Tetris, etc.); una API semántica
  (`rotateLeft()`, `moveLeft()`, ...) habría requerido reimplementar esas ramas dos veces.
- **D-pad/botones vs. gestos de swipe**: se descartaron los gestos porque compiten con el scroll
  de la página y son menos descubribles que botones visibles; los botones también permiten
  mapear 1:1 con las teclas existentes sin inventar un modelo de input nuevo.
- **Overlay condicionado a `pointer: coarse` en vez de ocultar el teclado o viceversa**: ambos
  inputs conviven — un dispositivo táctil con teclado externo sigue teniendo ambos disponibles,
  sin necesidad de que se exclyan mutuamente.
- **Sin lock de orientación**: el `.crt-screen` ya es responsive (spec 05); agregar una sugerencia
  de rotar a landscape es un cambio de layout más amplio, fuera de alcance de "hacerlo jugable
  por táctil".
- **Repetición (hold-to-repeat) implementada en `TouchControls`, no en los motores**: Tetris
  depende hoy del auto-repeat nativo del teclado del sistema operativo para mover piezas
  sosteniendo una flecha; como los motores de Tetris/Asteroids tratan ciertas teclas como
  pulsación discreta por frame, replicar esa sensación en táctil es responsabilidad del
  componente de UI (temporizador interno mientras dura el `touchstart`), no del motor.

## Riesgos identificados

- **Zoom/scroll accidental al tocar los botones**: mitigado con `touch-action: none` y
  `preventDefault` en los handlers táctiles del overlay, siguiendo el mismo patrón que ya usan los
  motores con `e.preventDefault()` en teclado.
- **Doble disparo de eventos táctiles + mouse sintético del navegador**: se usan exclusivamente
  handlers `touchstart`/`touchend`/`touchcancel` (no `onClick`) para evitar que el navegador
  dispare además un evento de mouse fantasma que duplique la acción.
- **Overlay tapando parte del canvas en pantallas muy pequeñas**: se coloca fuera del
  `.crt-screen` (debajo, en el flujo normal), no superpuesto, para no depender de mediciones de
  tamaño del canvas.
