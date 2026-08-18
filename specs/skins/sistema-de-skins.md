# Sistema de skins por juego

- Estado: Implemented
- Fecha: 2026-08-18
- Alcance acumulado: **Asteroids** (`asteroids`), **Tetris** (`tetris`),
  **Arkanoid** (`arkanoid`) y **Snake** (`snake`) — los 4 juegos con motor real
  tienen sus 3 skins implementadas.

Documenta el sistema de skins **ya implementado** para los juegos con motor real
de Arcade Vault: cada juego expone al menos 3 skins (**clásico** / default,
**neón**, **retro**), legibles sobre el modo oscuro fijo de la plataforma, con
un seam de inyección de paleta engine → canvas → game-player y un selector por
juego con persistencia independiente en `localStorage`.

Este archivo es documentación de lo aplicado, no un Draft a la espera de
`/spec-impl`.

## Seam compartido de inyección de skin

- **Contrato de paleta por juego**: una interfaz `<Game>Palette` la define el
  propio engine y la inyecta su constructor
  (`new <X>Engine(canvas, callbacks, palette)`), consumida dentro de los
  métodos `draw*` en lugar de literales de color.
- **Persistencia por juego** (`lib/skins.ts`): tipo `SkinId = "classic" |
"neon" | "retro"`, default `classic`. Un único objeto `av_skins` en
  `localStorage` mapea `{ [gameId]: SkinId }` — **no** hay clave global. Sigue el
  patrón mock de la sesión (`av_user`, `lib/session.ts`). `SKINNABLE_GAMES`
  controla qué juegos ofrecen selector (hoy `asteroids`, `tetris`, `arkanoid`,
  `snake`).
- **Selector** (`components/skin-picker.tsx`): componente cliente reutilizable,
  scoped explícitamente a un `gameId` (muestra el título del juego en su
  etiqueta). Se monta en dos puntos:
  - Dentro del reproductor (`components/game-player.tsx`), junto al HUD, con
    cambio de skin **en caliente** (`engine.setPalette`) sin reiniciar la
    partida.
  - Fuera del reproductor, en la ficha del juego (`app/game/[id]/page.tsx`),
    para fijar el skin sin entrar a jugar. Ambos comparten la misma clave
    `av_skins`, así que la elección se sincroniza entre pantallas.
- **Hook CSS**: `game-player.tsx` pone `data-skin={skin}` en el contenedor
  `.av-player`; `app/globals.css` forkea el halo del marco
  (`.av-player[data-skin="neon"|"retro"] .asteroids-canvas`).

## Asteroids — contrato y paletas

Interfaz `AsteroidsPalette` (en `lib/games/asteroids/engine.ts`), roles:
`background`, `ship`, `thruster`, `bullet`, `asteroid`, `particleRgb` (terna
"r,g,b" porque las partículas interpolan alfa por vida), `powerup`, `glow`
(`shadowBlur`; 0 = sin brillo). Paletas concretas en
`lib/games/asteroids/skins.ts`; la clásica vive en el engine
(`CLASSIC_ASTEROIDS_PALETTE`) como fuente de verdad del look original.

| Rol         | clásico               | neón                  | retro                 |
| ----------- | --------------------- | --------------------- | --------------------- |
| background  | `#000000`             | `#0a0a0f` (= --bg)    | `#0d0a04`             |
| ship        | `#ffffff`             | `#00f5ff` (--cyan)    | `#ffc21f`             |
| thruster    | `rgba(255,130,0,.85)` | `rgba(255,0,110,.9)`  | `rgba(255,120,30,.9)` |
| bullet      | `#ffffff`             | `#f5ff00` (--yellow)  | `#fff0c2`             |
| asteroid    | `#ffffff`             | `#ff006e` (--magenta) | `#b8791a`             |
| particleRgb | `255,255,255`         | `0,245,255`           | `255,150,40`          |
| powerup     | `#00ffff`             | `#00ff88` (--green)   | `#8bff5a`             |
| glow        | `0`                   | `8`                   | `3`                   |

- **clásico**: réplica 1:1 de los literales que el engine ya usaba (fondo `#000`,
  vectores blancos, power-up cian `#0ff`, llama naranja). No se reinventa.
- **neón**: reutiliza la paleta de glow de la UI (`--cyan/--magenta/--yellow/
--green` de `app/globals.css`) sobre `--bg`, con `shadowBlur`.
- **retro**: fósforo ámbar de CRT, distinto en carácter (no una variación de
  brillo): monocromo cálido con separación por luminosidad y un único acento
  verde-fósforo en el power-up.

### Validación de modo oscuro (sobre cada `background` propio y `--bg` #0a0a0f)

- **clásico**: colores del original, ya validados de facto (blanco puro y cian
  sobre negro; máximo contraste). Se preservan.
- **neón**: `#00f5ff`, `#f5ff00`, `#ff006e`, `#00ff88` son neones muy saturados
  y luminosos; todos resaltan con claridad sobre `#0a0a0f` y entre sí. El
  `thruster` magenta contrasta con la nave cian.
- **retro**:
  - `ship #ffc21f` sobre `#0d0a04`: ámbar brillante, contraste altísimo.
  - `asteroid #b8791a` sobre `#0d0a04`: ámbar-bronce apagado **pero con
    luminosidad suficiente** para no fundirse con el ámbar-negro; queda
    claramente más tenue que la nave, que es el criterio buscado (jerarquía por
    luminosidad, no por tono).
  - `bullet #fff0c2`: casi-blanco cálido, resalta como disparo.
  - `powerup #8bff5a`: verde-fósforo, único color frío, inconfundible sobre la
    paleta cálida y sobre el fondo oscuro.
  - Sobre `--bg` azul-negro también se distinguen todos (el ámbar contrasta aún
    más contra un fondo frío).

## Tetris — contrato y paletas

Tetris es vectorial (bloques `fillRect` + rejilla `stroke`), así que una skin de
solo color basta (sin sprites). Interfaz `TetrisPalette` (en
`lib/games/tetris/engine.ts`), roles: `background` (relleno tras `clearRect`;
`null` = transparente, deja ver el CRT detrás, como el original), `grid` (color
de la rejilla, incluye su propio alfa), `blockHighlight` (franja de brillo
superior de cada bloque), `blocks` (`(string | null)[]` indexado igual que el
antiguo array `COLORS`: 0 = celda vacía, 1..7 = las 7 piezas I/O/T/S/Z/J/L,
8 = tuerca deshabilitada) y `glow` (`shadowBlur`; 0 = sin brillo). Paletas
concretas en `lib/games/tetris/skins.ts`; la clásica vive en el engine
(`CLASSIC_TETRIS_PALETTE`, cuyo `blocks` es el array `COLORS` original) como
fuente de verdad del look original.

| Rol            | clásico                 | neón                    | retro                   |
| -------------- | ----------------------- | ----------------------- | ----------------------- |
| background     | `null` (transparente)   | `#0a0a0f` (= --bg)      | `#0d0a04`               |
| grid           | `rgba(0,245,255,.18)`   | `rgba(0,245,255,.10)`   | `rgba(255,176,0,.10)`   |
| blockHighlight | `rgba(255,255,255,.12)` | `rgba(255,255,255,.25)` | `rgba(255,240,200,.20)` |
| I (cyan)       | `#4dd0e1`               | `#00f5ff` (--cyan)      | `#ffe08a`               |
| O (yellow)     | `#ffd54f`               | `#f5ff00` (--yellow)    | `#ffcf47`               |
| T (purple)     | `#ba68c8`               | `#b26bff`               | `#8bff5a` (verde)       |
| S (green)      | `#81c784`               | `#00ff88` (--green)     | `#ffb01f`               |
| Z (red)        | `#e57373`               | `#ff3b30`               | `#ff9d3d`               |
| J (blue)       | `#90caf9`               | `#3d7bff`               | `#d98a12`               |
| L (orange)     | `#ffb74d`               | `#ff9d3d`               | `#a6791f`               |
| glow           | `0`                     | `6`                     | `3`                     |

- **clásico**: réplica 1:1 del look original (bloques del array `COLORS`, brillo
  blanco a 0.12, rejilla = `--line` `rgba(0,245,255,.18)`, sin fondo propio —
  solo `clearRect`, sin glow). No se reinventa.
- **neón**: reutiliza la paleta de glow de la UI (`--cyan/--yellow/--green`) y
  añade violeta/rojo/azul/naranja neón para cubrir las 7 piezas manteniéndolas
  separadas por tono; fondo `--bg`, rejilla cian tenue, bloom con `shadowBlur`.
- **retro**: fósforo ámbar de CRT, distinto en carácter (no una variación de
  brillo): rampa monocroma cálida donde las 7 piezas se separan por luminosidad,
  más un único acento verde-fósforo (la pieza T) como color frío.

### Validación de modo oscuro (sobre cada `background` propio y `--bg` #0a0a0f)

- **clásico**: colores del original, ya validados de facto (pasteles saturados
  medios — cyan/amarillo/púrpura/verde/rojo/azul/naranja — sobre el CRT oscuro,
  con brillo blanco superior que los realza). Se preservan.
- **neón**: los 7 tonos son neones saturados y luminosos, todos resaltan sobre
  `#0a0a0f` y son distinguibles entre sí (la I cian `#00f5ff` se separa de la J
  azul `#3d7bff` por ser más verdosa y clara; el violeta `#b26bff` de la T no se
  confunde con el rojo `#ff3b30` ni el azul). Rejilla cian a 0.10 de alfa:
  visible sin competir con las piezas.
- **retro**:
  - Rampa `#ffe08a` → `#ffcf47` → `#ffb01f` → `#ff9d3d` → `#d98a12` → `#a6791f`:
    seis niveles de luminosidad ámbar, todos con luminosidad suficiente para no
    fundirse con el ámbar-negro; el más tenue (`#a6791f` bronce) sigue siendo
    legible sobre `#0d0a04` (jerarquía por luminosidad, no por tono).
  - `T #8bff5a`: verde-fósforo, único color frío, inconfundible sobre la paleta
    cálida y el fondo oscuro; da un punto de referencia de color a una skin por
    lo demás monocroma.
  - Sobre `--bg` azul-negro también se distinguen todos (el ámbar contrasta aún
    más contra un fondo frío).

**Limitación conocida (retro)**: al ser una rampa monocroma, las piezas se
distinguen por luminosidad y forma, no por tono (salvo la T verde). Es el
carácter buscado del fósforo CRT; aceptado.

## Arkanoid — contrato y paletas (sprite-based)

Arkanoid dibuja **todo** desde `spritesheet-breakout.png` (paleta/raqueta,
pelota, 7 colores de bloque, frames de explosión), así que una skin de solo
color no basta. La interfaz `ArkanoidPalette` (en
`lib/games/arkanoid/engine.ts`) soporta dos modos vía el flag `useSprites`:

- **`useSprites: true`** (clásico): los sprites se copian tal cual, sin teñir —
  réplica 1:1 del look original. Los campos de color se ignoran.
- **`useSprites: false`** (neón/retro): cada sprite se **tiñe** usando su canal
  alfa como máscara. En un canvas de trabajo se dibuja el frame y se rellena con
  `globalCompositeOperation = "source-in"` con el color del rol; se conserva la
  silueta exacta del sprite y se cambia su color. `glow` añade `shadowBlur` para
  el bloom.

Roles: `background`, `paddle`, `ball`, `blocks` (`Record<BlockColor, string>`,
un tinte por cada uno de los 7 colores originales para mantener la
diferenciación por fila), `useSprites`, `glow`. La paleta clásica vive en el
engine (`CLASSIC_ARKANOID_PALETTE`) como fuente de verdad; neón/retro en
`lib/games/arkanoid/skins.ts` (`resolveArkanoidPalette`). El seam
engine → canvas → game-player, el selector y la persistencia son idénticos a
los de Asteroids (`av_skins`, `SkinPicker`, `data-skin`).

| Rol           | clásico (sprite) | neón                  | retro     |
| ------------- | ---------------- | --------------------- | --------- |
| background    | `#000000`        | `#0a0a0f` (= --bg)    | `#0d0a04` |
| paddle        | spritesheet      | `#00f5ff` (--cyan)    | `#ffc21f` |
| ball          | spritesheet      | `#f5ff00` (--yellow)  | `#fff0c2` |
| block cyan    | spritesheet      | `#00f5ff` (--cyan)    | `#d98a12` |
| block magenta | spritesheet      | `#ff006e` (--magenta) | `#ff9d3d` |
| block yellow  | spritesheet      | `#f5ff00` (--yellow)  | `#ffb01f` |
| block green   | spritesheet      | `#00ff88` (--green)   | `#8bff5a` |
| block hotpink | spritesheet      | `#ff5fd2`             | `#ffe08a` |
| block red     | spritesheet      | `#ff3b30`             | `#ffcf47` |
| block gray    | spritesheet      | `#a98bff`             | `#a6791f` |
| glow          | `0`              | `8`                   | `3`       |

- **clásico**: sprites del spritesheet sin teñir (fondo `#000`). No se reinventa.
- **neón**: cada fila recibe un neón saturado distinto; se reutilizan
  `--cyan/--magenta/--yellow/--green` de la UI y se añaden rosa/rojo/violeta
  neón para cubrir los 7 colores manteniéndolos separados; bloom con
  `shadowBlur`.
- **retro**: rampa cálida ámbar/naranja con separación por luminosidad entre
  filas (fósforo CRT), más un único acento verde-fósforo (`green`) como color
  frío; distinta en carácter, no una variación de brillo del neón.

### Validación de modo oscuro (sobre `background` propio y `--bg` #0a0a0f)

- **clásico**: sprites originales sobre negro, ya validados de facto; se
  preservan.
- **neón**: los 7 tintes son neones muy saturados y luminosos; todos resaltan
  con claridad sobre `#0a0a0f` y son distinguibles entre sí (el rosa `#ff5fd2`
  se separa del magenta `#ff006e`; el violeta `#a98bff` evita que el bloque
  "gris/acero" quede apagado). Paleta cian y pelota amarilla contrastan entre
  sí y con los bloques.
- **retro**:
  - `paddle #ffc21f` y `ball #fff0c2` sobre `#0d0a04`: ámbar brillante y
    casi-blanco cálido, contraste altísimo.
  - Rampa de bloques `#ffe08a` → `#ffcf47` → `#ffb01f` → `#ff9d3d` →
    `#d98a12` → `#a6791f`: seis niveles de luminosidad ámbar, todos con
    luminosidad suficiente para no fundirse con el ámbar-negro; el más tenue
    (`#a6791f` bronce) sigue siendo legible sobre `#0d0a04` y queda claramente
    por debajo de la raqueta (jerarquía por luminosidad, no por tono).
  - `green #8bff5a`: verde-fósforo, único color frío, inconfundible sobre la
    paleta cálida y el fondo oscuro.
  - Sobre `--bg` azul-negro también se distinguen todos (el ámbar contrasta aún
    más contra un fondo frío).

**Limitación conocida**: el teñido por `source-in` produce siluetas de color
plano (se pierde el sombreado/bevel interno del sprite). Es aceptable y buscado
para el carácter neón/retro; el clásico conserva el detalle del spritesheet
intacto. Assets alternativos por skin quedan fuera de alcance.

## Nota sobre juegos sprite-based

Asteroids y Tetris son puramente vectoriales (`ctx.stroke`/`fill`/`fillRect`),
así que una skin de solo color basta. Los dos juegos sprite-based ya están
resueltos por teñido de
sprite: Arkanoid (`spritesheet-breakout.png`) con `source-in` sobre canvas de
trabajo (silueta de color plano, ver arriba) y Snake (`fruits.png`) con
`source-atop` para la fruta (ver su sección). Assets alternativos por skin
quedan fuera de alcance en ambos.

## Archivos tocados (Asteroids)

- `lib/games/asteroids/engine.ts` — `AsteroidsPalette`,
  `CLASSIC_ASTEROIDS_PALETTE`, 3.er parámetro del constructor, `setPalette`,
  `draw*` parametrizados.
- `lib/games/asteroids/skins.ts` — paletas neón/retro + `resolveAsteroidsPalette`.
- `lib/skins.ts` — tipos, labels, persistencia por juego (`av_skins`),
  `SKINNABLE_GAMES`.
- `components/skin-picker.tsx` — selector reutilizable scoped por juego.
- `components/games/asteroids-canvas.tsx` — prop `palette` + `setPalette` en
  caliente.
- `components/game-player.tsx` — estado de skin, `data-skin`, selector en HUD,
  paleta al canvas.
- `app/game/[id]/page.tsx` — selector fuera del reproductor.
- `app/globals.css` — estilos del selector y hook `[data-skin]`.

## Archivos tocados (Arkanoid)

- `lib/games/arkanoid/engine.ts` — `ArkanoidPalette`,
  `CLASSIC_ARKANOID_PALETTE`, 3.er parámetro del constructor, `setPalette`,
  teñido de sprites por alfa en `drawFrame` (`source-in`), `draw*`
  parametrizados.
- `lib/games/arkanoid/skins.ts` — paletas neón/retro + `resolveArkanoidPalette`.
- `lib/skins.ts` — `arkanoid` añadido a `SKINNABLE_GAMES`.
- `components/games/arkanoid-canvas.tsx` — prop `palette` + `setPalette` en
  caliente.
- `components/game-player.tsx` — `resolveArkanoidPalette`, paleta pasada al
  `ArkanoidCanvas` (estado de skin y `data-skin` ya eran compartidos).
- `app/globals.css` — forks `[data-skin]` del marco `.arkanoid-canvas`
  (neón/retro).
- El selector dentro y fuera del reproductor ya es genérico
  (`components/skin-picker.tsx`, `app/game/[id]/page.tsx`) y aplica a Arkanoid
  vía `SKINNABLE_GAMES`.

## Snake — contrato y paletas (sprite-based)

Interfaz `SnakePalette` (en `lib/games/snake/engine.ts`), roles: `background`,
`grid` (color de rejilla, incluye su propio alfa), `snakeHead`, `snakeBody`,
`snakeGlow` (`shadowColor`), `glowHead`/`glowBody` (`shadowBlur`; 0 = sin
brillo), `foodTint` (color de tinte del sprite de fruta; `null` = sprite
intacto), `foodTintAlpha` (0..1) y `foodFallback` (rombo mientras carga
`fruits.png`). Paletas concretas en `lib/games/snake/skins.ts`; la clásica vive
en el engine (`CLASSIC_SNAKE_PALETTE`) como fuente de verdad del look original.

**Tratamiento sprite-based**: la comida se dibuja desde
`/snake-assets/fruits.png`, así que una skin de solo color no basta para la
fruta. Enfoque implementado: la serpiente, el tablero y la rejilla se recolorean
con tokens planos; la fruta se **tiñe** en un canvas offscreen dibujando el
sprite y superponiendo el color de la skin con
`globalCompositeOperation = "source-atop"` (respeta la silueta y el sombreado
del sprite pero desplaza su tono hacia el acento de la skin). En clásico
`foodTint` es `null`, así que el sprite se dibuja intacto 1:1.

| Rol           | clásico               | neón                  | retro                 |
| ------------- | --------------------- | --------------------- | --------------------- |
| background    | `#0a0f0a`             | `#0a0a0f` (= --bg)    | `#0d0a04`             |
| grid          | `rgba(0,255,128,.08)` | `rgba(0,245,255,.10)` | `rgba(255,176,0,.10)` |
| snakeHead     | `#7cff7c`             | `#00f5ff` (--cyan)    | `#ffd257`             |
| snakeBody     | `#22e06a`             | `#00ff88` (--green)   | `#c8880f`             |
| snakeGlow     | `#22e06a`             | `#00f5ff`             | `#ffb000`             |
| glowHead/Body | `12` / `6`            | `16` / `8`            | `4` / `2`             |
| foodTint      | `null` (sin teñir)    | `#ff006e` (--magenta) | `#ffcf4d`             |
| foodTintAlpha | `0`                   | `0.55`                | `0.6`                 |
| foodFallback  | `#ff4d6d`             | `#ff006e`             | `#fff0c2`             |

- **clásico**: réplica 1:1 de los literales del engine (fondo verde-negro,
  cabeza verde clara, cuerpo verde, fruta sin teñir). No se reinventa.
- **neón**: reutiliza la paleta de glow de la UI (`--cyan/--green/--magenta`)
  sobre `--bg`; cabeza cian y cuerpo verde (distintos en tono), fruta teñida de
  magenta para que resalte contra la serpiente fría.
- **retro**: fósforo ámbar de CRT, distinto en carácter al verde del clásico y
  al neón: monocromo cálido con separación por luminosidad cabeza/cuerpo y fruta
  teñida de ámbar brillante para destacar sobre el cuerpo apagado.

### Validación de modo oscuro (sobre cada `background` propio y `--bg` #0a0a0f)

- **clásico**: colores del original, ya validados de facto (cabeza `#7cff7c` y
  cuerpo `#22e06a` sobre `#0a0f0a`; verde luminoso sobre verde-negro). Se
  preservan.
- **neón**: `#00f5ff` (cabeza) y `#00ff88` (cuerpo) son neones muy saturados,
  resaltan sobre `#0a0a0f` y se distinguen entre sí por tono. Rejilla cian a
  0.10 de alfa: visible pero sin competir con la serpiente. Fruta magenta
  `#ff006e`: color frío opuesto que destaca contra la serpiente cian/verde.
- **retro**:
  - `snakeHead #ffd257` sobre `#0d0a04`: ámbar brillante, contraste altísimo.
  - `snakeBody #c8880f` sobre `#0d0a04`: ámbar-bronce apagado **pero con
    luminosidad suficiente** para no fundirse con el ámbar-negro; queda
    claramente más tenue que la cabeza (jerarquía por luminosidad, no por tono).
  - `foodTint #ffcf4d`: ámbar brillante cercano a la cabeza; la fruta destaca
    sobre el cuerpo más apagado. Al ser monocromo, la fruta se distingue por
    **brillo y por la silueta/sombreado del sprite** (que el tinte conserva),
    no por tono — limitación aceptada del enfoque sprite-based.
  - Sobre `--bg` azul-negro también se distinguen todos (el ámbar contrasta aún
    más contra un fondo frío).

## Archivos tocados (Snake)

- `lib/games/snake/engine.ts` — `SnakePalette`, `CLASSIC_SNAKE_PALETTE`, 3.er
  parámetro del constructor, `setPalette`, `draw*` parametrizados, canvas
  offscreen de tinte de fruta (`getTintCtx` + `source-atop`).
- `lib/games/snake/skins.ts` — paletas neón/retro + `resolveSnakePalette`.
- `lib/skins.ts` — `snake` añadido a `SKINNABLE_GAMES`.
- `components/games/snake-canvas.tsx` — prop `palette` + `setPalette` en
  caliente.
- `components/game-player.tsx` — paleta de Snake resuelta y pasada al canvas.
- `app/globals.css` — forks `[data-skin]` del marco `.snake-canvas` (neón/retro).
- El selector dentro y fuera del reproductor ya es genérico
  (`components/skin-picker.tsx`, `app/game/[id]/page.tsx`) y aplica a Snake vía
  `SKINNABLE_GAMES`.

## Archivos tocados (Tetris)

- `lib/games/tetris/engine.ts` — `TetrisPalette`, `CLASSIC_TETRIS_PALETTE`, 4.º
  parámetro del constructor (default clásico), `setPalette` (redibuja la
  preview), `draw*` parametrizados (`drawBlock`/`drawGrid`/`draw`/`drawNext`),
  fondo opcional tras `clearRect`.
- `lib/games/tetris/skins.ts` — paletas neón/retro + `resolveTetrisPalette`.
- `lib/skins.ts` — `tetris` añadido a `SKINNABLE_GAMES`.
- `components/games/tetris-canvas.tsx` — prop `palette` + `setPalette` en
  caliente.
- `components/game-player.tsx` — `resolveTetrisPalette`, paleta pasada al
  `TetrisCanvas` (estado de skin y `data-skin` ya eran compartidos).
- `app/globals.css` — forks `[data-skin]` del marco `.tetris-canvas` y
  `.tetris-next-canvas` (neón/retro).
- El selector dentro y fuera del reproductor ya es genérico
  (`components/skin-picker.tsx`, `app/game/[id]/page.tsx`) y aplica a Tetris vía
  `SKINNABLE_GAMES`.

## Estado final

Los 4 juegos con motor real (`asteroids`, `tetris`, `arkanoid`, `snake`) tienen
sus 3 skins (clásico/neón/retro) implementadas y verificadas (lint + build). No
quedan huecos pendientes dentro del alcance (juegos con motor real).
