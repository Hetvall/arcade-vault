---
name: add-game
description: Genera un spec para portar un juego de arcade (desde references/started-games u otra fuente) a un motor TypeScript reutilizable e integrarlo al catálogo y leaderboard de Supabase, siguiendo el patrón de las SPECs 05 y 06. Úsala cuando quieras añadir un juego jugable nuevo a la plataforma. No escribe código: produce un spec en Draft para revisar y luego implementar con /spec-impl.
disable-model-invocation: true
argument-hint: '<carpeta-de-referencia o descripción del juego> (p.ej. 03-tetris)'
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*)
---

# /add-game — Portar un juego + su leaderboard a la plataforma

## Session context

Fecha de hoy (para la cabecera del spec, nunca la adivines):
!`date +%F`

Specs que ya existen:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe aún"`

Juegos de referencia disponibles:
!`ls references/started-games/ 2>/dev/null || echo "references/started-games/ no existe"`

---

Esta skill produce un **spec en `specs/`** que describe cómo portar un juego a un motor
TypeScript reutilizable y conectarlo al catálogo/leaderboard de Supabase. **No escribes código
ni tocas la base de datos aquí** — eso lo hace `/spec-impl` una vez el spec esté `Approved`.
Sigue la misma disciplina que la skill `/spec`, pero especializada para este tipo de feature:
la receta ya está descubierta (SPECs 05 y 06), así que las preguntas se enfocan en los detalles
específicos del juego, no en el diseño del flujo completo.

Lee `reference.md` (en el mismo directorio que esta skill) — contiene la receta concreta de los
5 seams que todo juego nuevo repite (motor, wrapper canvas, wiring en `game-player.tsx`, CSS,
fila en la tabla `games`). Apóyate en ella para las preguntas de la Fase 2 y para escribir el
plan de implementación de la Fase 3.

Antes de escribir el spec, lee también la skill `/spec` (`.claude/skills/spec/SKILL.md` y su
`template.md` hermano) — es la fuente de verdad del formato de spec de este repo (secciones,
orden, tono de las preguntas, criterios para saber cuándo dejar de preguntar). `add-game` no
sustituye a `/spec`: es una especialización suya para este tipo de feature, así que su spec final
debe seguir esa misma estructura al pie de la letra, no solo imitar los ejemplos de SPEC 05/06.

Tus respuestas deben estar en el mismo idioma que el prompt inicial. Los specs de este repo se
escriben en español (revisa `specs/05-juego-asteroides.md` y `specs/06-leaderboard-y-catalogo-supabase.md`
para el tono y formato exacto), así que por defecto escribe el spec en español salvo que el
usuario escriba en otro idioma.

## Fase 1 — Contexto y fuente del juego

1. Lee `CLAUDE.md`/`AGENTS.md` si no los tienes ya en contexto, para confirmar convenciones del
   repo (p.ej. la advertencia sobre Next 16 en `node_modules/next/dist/docs/`).
2. Lee `.claude/skills/spec/SKILL.md` y `.claude/skills/spec/template.md` — son la referencia
   oficial de cómo este repo estructura y redacta un spec (fases, secciones, formato de la
   cabecera, criterios para saber cuándo dejar de preguntar). Todo spec que produzca esta skill
   debe ajustarse a esa estructura.
3. Lee `specs/05-juego-asteroides.md` y `specs/06-leaderboard-y-catalogo-supabase.md` — son el
   ejemplo concreto de esa misma estructura ya aplicada a un juego con leaderboard; úsalos para el
   nivel de detalle y el tono, no como sustituto de leer la skill `/spec` en el paso anterior.
4. Resuelve la **fuente del motor**:
   - Si `$ARGUMENTS` coincide con una carpeta listada en `references/started-games/` (arriba en
     el session context): lee su `game.js`, `index.html` y `README.md`/`CLAUDE.md` para entender
     mecánicas, controles, qué estado necesita el HUD (score/vidas/nivel/otros), resolución del
     canvas, y qué dibuja el original en el canvas (HUD/overlay a eliminar).
   - Si `$ARGUMENTS` no coincide con ninguna carpeta de referencia, o viene vacío: pregunta al
     usuario de dónde viene el motor — otra carpeta, una URL/repo externo, una descripción para
     escribirlo desde cero — antes de continuar. No asumas `references/started-games/` si no fue
     confirmado.
5. Revisa rápidamente `components/game-player.tsx` (el `HAS_REAL_ENGINE` actual) y
   `app/globals.css` (clases `.asteroids-canvas`, `.game-arena`, `.cover-*` existentes) para
   saber qué ya existe y qué es realmente nuevo.

## Fase 2 — Clarificar (bloques de 3–5 con AskUserQuestion)

No asumas nada que cambie el spec. Usa `AskUserQuestion` en bloques, con tu recomendación
marcada primero cuando ofrezcas opciones. Cubre al menos:

- **Identidad:** `id` único kebab-case del juego (será `games.id` en Supabase **y** la clave
  añadida a `HAS_REAL_ENGINE` — deben coincidir). Verifica que no colisione con los juegos ya
  sembrados (`asteroids`, `bloque-buster`, `caida`, `duelo-pixel`, `gloton`, `invasores`,
  `ranaria`, `serpentina`) ni con otros specs en curso.
- **Metadatos de catálogo:** `title`, `short`, `long`, `cat` (una de `ARCADE`/`PUZZLE`/`SHOOTER`/
  `VERSUS`), `color` (una de `cyan`/`magenta`/`green`/`yellow`), y `cover` — ¿reutiliza una clase
  `cover-*` existente o hace falta crear una nueva (y su CSS)?
- **Estado y HUD:** qué campos necesita `<Game>State` más allá de `score`/`gameOver` (¿vidas?
  ¿nivel? ¿power-ups con temporizador, como el 3x de Asteroids? ¿algo propio del juego?), y
  controles (¿solo teclado, como el patrón actual, o hace falta táctil — que quedaría fuera de
  alcance salvo que el usuario lo pida explícitamente?).
- **Qué se elimina del original:** confirma que se quita cualquier HUD/overlay dibujado en el
  canvas y cualquier auto-reinicio automático en el estado de fin de partida (mismo motivo que
  SPEC 05: el modal de guardado de puntuación necesita el estado congelado).
- **Alcance de balance:** confirma que el porteo es 1:1 en mecánicas/constantes (sin rediseñar
  gameplay) salvo que el usuario pida explícitamente cambios de balance — en ese caso, ese cambio
  debe ir declarado como decisión explícita en el spec, no implícito.
- **Dependencias:** el spec depende de SPEC 06 (tablas `games`/`scores` ya existentes). Si el
  usuario quiere además una tabla o columna nueva específica del juego, señala que eso amplía el
  alcance y pregunta si se acepta o se deja fuera.

Detente cuando puedas responder sin asumir: qué archivos aparecen o cambian, cuál es el primer y
último paso ejecutable, y cómo se verifica que quedó terminado — los mismos tres criterios que
usa `/spec`.

## Fase 3 — Escribir el spec

Si ya tienes todo lo necesario (los tres criterios de arriba respondidos sin inventar nada),
escribe el spec completo de una vez — no vayas sección por sección ni pidas confirmación de
borrador. Si algo sigue faltando, desarrolla sección por sección mostrando cada una y esperando
confirmación antes de la siguiente (igual que `/spec`).

Estructura y orden (igual que SPECs 05/06 — respeta el formato exacto, en español):

1. **Cabecera:**
   ```
   # NN — Juego <Título> (<id>)

   - **Estado:** Draft
   - **Depende de:** SPEC 06
   - **Fecha:** <fecha del session context>
   - **Objetivo:** <una sola frase>
   ```
2. **`## Alcance`** con `### Dentro de alcance` y `### Fuera de alcance` (ambas obligatorias).
   Dentro de alcance debe cubrir explícitamente los 5 seams de `reference.md`:
   - Motor `lib/games/<id>/engine.ts` (mecánicas portadas 1:1, qué se elimina del original).
   - Wrapper `components/games/<id>-canvas.tsx`.
   - Wiring en `components/game-player.tsx` (`HAS_REAL_ENGINE`, HUD, PAUSA/FIN/JUGAR DE NUEVO).
   - CSS `.{id}-canvas` (y `.cover-<slug>` si el cover es nuevo).
   - Migración Supabase: insertar la fila en `games` con `mcp__supabase__apply_migration`.
     Fuera de alcance debe descartar explícitamente: controles táctiles (salvo que se pidieran),
     cambios de balance, tablas nuevas específicas del juego, y conectar cualquier otro juego del
     catálogo que siga con la arena placeholder.
3. **`## Modelo de datos`**: la interfaz `<Game>State` y la firma de `<Game>Engine` (como en el
   modelo de SPEC 05), más el `insert` SQL de la fila en `games` (como en SPEC 06). Si no se
   introduce ninguna tabla/columna nueva, dilo explícitamente.
4. **`## Plan de implementación`**: pasos numerados, cada uno dejando el sistema funcional.
   Debe incluir, como mínimo y en este orden: leer el motor de referencia → crear
   `lib/games/<id>/engine.ts` → crear `components/games/<id>-canvas.tsx` → modificar
   `components/game-player.tsx` (añadir a `HAS_REAL_ENGINE`, rama de render, wiring del HUD) →
   añadir la regla CSS → aplicar la migración con `mcp__supabase__apply_migration` (insertar fila
   en `games`) → prueba manual end-to-end (jugar, pausar, perder, guardar puntuación, ver
   reflejado en `/game/<id>` y `/leaderboard`) → `npm run lint`.
5. **`## Criterios de aceptación`**: checklist booleano verificable (no aspiracional) — calca el
   estilo de SPEC 05/06 (HUD real, canvas sin dibujar su propio SCORE/overlay, pausa real,
   guardado de puntuación funcionando, juego visible en catálogo/leaderboard, lint limpio).
6. **`## Decisiones tomadas y descartadas`**: justifica brevemente las decisiones de diseño
   (p.ej. por qué esta forma de clase, por qué se elimina el HUD del canvas) igual que en SPEC 05.
7. **`## Riesgos identificados`**: solo si aplican (StrictMode y limpieza de listeners, RLS
   pública sin validación server-side de score, etc. — reusa los de SPEC 05/06 si siguen siendo
   relevantes).

## Fase 4 — Guardar el spec

1. Determina el siguiente número secuencial desde el listado de `specs/` del session context
   (máximo existente + 1, dos dígitos). Si `specs/` está vacío, no debería pasar en este repo —
   avisa si ocurre.
2. Genera el slug `juego-<slug-del-id-o-titulo>` (kebab-case).
3. Usa la fecha del session context para `**Fecha:**` — nunca escribas una que no leíste de ahí.
4. Escribe el archivo directamente en `specs/NN-juego-<slug>.md`. **No pidas permiso para
   escribirlo ni preguntes si el nombre está bien** — anuncia la ruta en la confirmación final.
   Solo pregunta si el archivo destino ya existe.
5. Marca el estado como `Draft`. **Nunca lo marques como `Approved` automáticamente.**
6. Confirma al usuario:
   - Ruta del archivo creado.
   - Recordatorio: el spec está en `Draft`; cámbialo a `Approved` una vez lo hayas releído.
   - Siguiente paso: ejecutar `/spec-impl NN-juego-<slug>` una vez aprobado.
   - **Detente aquí.** No propongas implementar el spec ni escribir código ni aplicar la
     migración — eso es trabajo de `/spec-impl`.

## Hard rules

- **Nunca escribas código ni apliques migraciones de Supabase durante este comando.** Solo el
  `.md` del spec al final. `mcp__supabase__apply_migration` se menciona como paso del plan que
  ejecutará `/spec-impl`, no algo que tú corras aquí.
- **Nunca asumas decisiones que el usuario no confirmó** (id del juego, cat/color/cover, qué
  campos lleva el HUD). Si falta información, pregunta en la Fase 2.
- **No repreguntes en la Fase 3 lo que ya se respondió en la Fase 2.**
- **El porteo del motor es 1:1 en mecánicas** salvo que el usuario pida explícitamente cambiar
  el balance — y en ese caso, documenta el cambio como decisión explícita, no lo apliques callado.
- **Un solo juego por spec.** Si `$ARGUMENTS` pide portar varios juegos a la vez, sugiere generar
  un spec por juego (aunque compartan el mismo patrón) en vez de mezclar sus alcances.
- **No proponer implementar tras guardar el spec.** Tu trabajo termina al escribir el archivo.

## Arguments

`$ARGUMENTS` es la **fuente del juego** (una carpeta de `references/started-games/`, una
descripción, una ruta u URL externa) — no el nombre final del archivo del spec. Si viene vacío,
pregunta primero de dónde sale el juego antes de continuar con la Fase 1.
