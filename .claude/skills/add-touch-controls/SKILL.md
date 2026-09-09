---
name: add-touch-controls
description: Analiza cómo funcionan hoy los controles táctiles (gamepad en pantalla) en los juegos que ya los tienen (asteroids, tetris, arkanoid, snake — spec 10) y replica ese patrón implementando el código directamente en el juego indicado que aún no lo tenga. Úsala cuando quieras que un juego (con motor estándar o de estructura combinada como Frogger) sea jugable con controles táctiles. A diferencia de /add-game, esta skill sí escribe código.
disable-model-invocation: true
argument-hint: "<id-del-juego> (p.ej. pong)"
allowed-tools: Read, Glob, Grep, Edit, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(git status:*), Bash(git diff:*), Bash(npm run lint:*), Bash(npm run build:*)
---

# /add-touch-controls — Agregar controles táctiles a un juego

## Session context

Juegos con motor real (`HAS_REAL_ENGINE`):
!`grep -A 10 "HAS_REAL_ENGINE" components/game-player.tsx | head -15`

Juegos que ya tienen controles táctiles hoy (layouts existentes en touch-controls.tsx):
!`grep -o '"[a-z]*":' components/games/touch-controls.tsx | sort -u`

Specs relevantes:
!`ls specs/ | grep -i tactil`

---

Esta skill **implementa código directamente** (a diferencia de `/add-game`, que sólo produce un
spec). Toma como fuente de verdad `specs/10-controles-tactiles-moviles.md` — el spec que
construyó el patrón la primera vez, para asteroids/tetris/arkanoid/snake — y lo **replica** en el
juego que reciba como argumento, sin rediseñarlo. Lee `reference.md` (en el mismo directorio que
esta skill) antes de tocar código: contiene la receta concreta de los 5 seams y la ruta especial
para juegos de estructura no estándar (como Frogger).

Tus respuestas deben estar en el mismo idioma que el prompt inicial. Por defecto, en español
(el repo y sus specs están en español).

## Fase 1 — Contexto

1. Lee `CLAUDE.md`/`AGENTS.md` si no los tienes ya en contexto.
2. Lee `specs/10-controles-tactiles-moviles.md` completo — es la fuente de verdad del patrón.
3. Lee `components/games/touch-controls.tsx` completo (el componente compartido: `TouchButton`,
   la unión discriminada `HoldControlsProps`/`PressControlsProps`, y los layouts existentes).
4. Lee la sección de wiring en `components/game-player.tsx` (busca `useIsTouchDevice`,
   `TouchControls`, y el bloque `{isTouchDevice && (...)}`) para ver el patrón de integración
   exacto.
5. Resuelve el **juego objetivo** desde `$ARGUMENTS`:
   - Si es un juego con motor real (`HAS_REAL_ENGINE`) pero sin layout en `touch-controls.tsx`:
     lee su `lib/games/<id>/engine.ts` y `components/games/<id>-canvas.tsx`. Confirma que el motor
     no expone ya `setKey`/`pressKey` (si ya los tiene, detente y avisa: el juego probablemente ya
     soporta táctil o quedó a medio hacer).
   - Si es un juego de **estructura combinada** (sin `engine.ts` + `<id>-canvas.tsx` separados,
     p. ej. Frogger — un solo componente en `lib/games/<id>/<Nombre>Game.tsx` sin handle
     imperativo): usa la ruta especial de `reference.md`.
   - Si `$ARGUMENTS` no coincide con ningún juego real del catálogo, o el juego sigue con la
     arena placeholder (sin motor): detente y pregunta — no hay controles de teclado que replicar
     en táctil todavía.
   - Si viene vacío: pregunta primero qué juego, usando la lista de la Session context como
     opciones.

## Fase 2 — Clasificar el modelo de input (AskUserQuestion en bloques, recomendación primero)

No asumas — confirma con el usuario (a menos que ya sea obvio leyendo el motor y no haya
ambigüedad, en cuyo caso puedes proponerlo y seguir si no objeta):

- **Modelo de input del motor:** ¿lee `this.keys[code]` cada frame (estado continuo → necesita
  `setKey`) o procesa cada tecla como una acción discreta en `onKeyDown` (→ necesita
  `pressKey`/`handleAction`)? Esto determina qué firma de `onKey` usa el layout nuevo.
- **Botones necesarios:** qué acciones del juego deben tener botón táctil (movimiento direccional
  - acciones especiales), y a qué `code`/`key` de teclado mapea cada uno (deben coincidir
    exactamente con los que ya escucha el motor).
- **Disposición:** ¿encaja en un `dpad-2`/`dpad-3`/`dpad-4` + `action-btn` ya existentes, o hace
  falta una variante CSS nueva? Recomienda reusar si es posible.
- **¿Alguna acción es "discreta por frame" como el disparo de Asteroids?** (el motor consume un
  flag `justPressed` en vez de leer estado continuo) — si sí, el botón correspondiente necesita el
  patrón de flanco forzado (`onKey(code, false)` seguido de `onKey(code, true)` en cada repeat),
  documentado en `reference.md`.

Detente cuando puedas nombrar exactamente: el método nuevo del motor y su firma, los botones y su
mapeo a `code`, y si hace falta CSS nuevo o no.

## Fase 3 — Implementar los 5 seams

Sigue `reference.md` para las plantillas. En orden, dejando el sistema funcional en cada paso
(o la ruta especial si el juego es de estructura combinada):

1. **Motor** `lib/games/<id>/engine.ts` — añade `setKey(code, pressed)` o
   (`handleAction(code)` privado + `pressKey(code)` público), reusando exactamente la misma
   lógica que ya usan `onKeyDown`/`onKeyUp`. No dupliques reglas: refactoriza para compartir.
2. **Handle del canvas** `components/games/<id>-canvas.tsx` — añade el método nuevo al
   `useImperativeHandle` existente (junto a `restart`), reenviando al motor.
3. **Layout** en `components/games/touch-controls.tsx` — añade `"<id>"` a la unión discriminada
   correspondiente (`HoldControlsProps` o `PressControlsProps`), crea el sub-componente de botones
   con `TouchButton` y las clases `dpad`/`action-btn` que correspondan, y añade su rama en el
   render de `TouchControls`.
4. **Wiring** en `components/game-player.tsx` — el flag `isX`, el `ref` tipado para el nuevo
   handle, y el bloque `{isTouchDevice && isX && <TouchControls layout="<id>" onKey={...} />}`
   como tarjeta hermana debajo de `.av-player` (mismo patrón que los 4 juegos existentes).
5. **CSS** en `app/globals.css` — sólo si Fase 2 determinó que hace falta una variante nueva de
   `dpad`/`action-btn`; si no, no toques CSS.

## Fase 4 — Verificar

1. `npm run lint` — debe pasar limpio.
2. `npm run build` — debe compilar sin errores.
3. Checklist manual (repórtalo al usuario, no lo asumas si no puedes ejecutar el navegador):
   jugar el juego con los botones táctiles simulados, pausar, terminar partida y confirmar que el
   modal de guardado de score sigue funcionando, y confirmar que en desktop (`pointer: fine`) el
   comportamiento no cambió — `<TouchControls>` sigue detrás de `isTouchDevice`.

## Hard rules

- **Nunca reescribas ni rebalancees mecánicas del juego.** Sólo agregas una vía de input nueva
  que llama exactamente la misma lógica que ya dispara el teclado.
- **Reusa la lógica de input existente** — si el motor tiene un `switch` de teclado duplicable,
  refactorízalo a un método privado compartido en vez de copiar sus casos.
- **Sólo eventos `touchstart`/`touchend`/`touchcancel`, nunca `onClick`** (evita el mouse fantasma
  que sintetiza el navegador tras un touch).
- **Botones ≥44×44px con `touch-action: none`** — reusa las clases CSS existentes; no bajes del
  mínimo si creas una variante nueva.
- **Llama métodos del motor directamente** (`setKey`/`pressKey` vía el ref) — nunca despaches
  eventos de teclado sintéticos (`KeyboardEvent`) para simular una pulsación.
- **No toques migraciones de Supabase ni el catálogo** — esta skill sólo agrega una vía de input,
  no cambia el juego en Supabase.
- **Desktop debe quedar intacto** — todo el render de `<TouchControls>` va detrás de
  `isTouchDevice`; no cambies el flujo de teclado existente.
- **Un solo juego por invocación.** Si `$ARGUMENTS` pide varios juegos, sugiere invocar la skill
  una vez por juego.
- **Si el juego ya tiene controles táctiles, detente y avisa** — no los reescribas sin que el
  usuario lo pida explícitamente.

## Arguments

`$ARGUMENTS` es el **id del juego objetivo** (el mismo `id` usado en `games.id` / la clave en
`HAS_REAL_ENGINE`). Si viene vacío, pregunta primero qué juego usando la lista de la Session
context.
