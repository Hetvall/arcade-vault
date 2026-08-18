# Cobertura de skins — memoria persistente

Checklist de skins por juego con motor real. Leyenda de estado por celda:

- `[ ]` propuesto (aún sin diseñar ni implementar)
- `[~]` diseñado en spec (paleta fijada y validada, sin código)
- `[x]` implementado (en código real y verificado)

Ver el detalle en `specs/skins/sistema-de-skins.md`. No borrar ni reescribir
entradas ya marcadas `[x]`.

## Estado juego × skin

| Juego     | clásico (default) | neón | retro |
| --------- | ----------------- | ---- | ----- |
| asteroids | [x]               | [x]  | [x]   |
| tetris    | [x]               | [x]  | [x]   |
| arkanoid  | [x]               | [x]  | [x]   |
| snake     | [x]               | [x]  | [x]   |

## Notas por juego

- **asteroids** — Implementado el 2026-08-18. Motor vectorial, skin de solo
  color suficiente (sin spritesheet). Seam de inyección de paleta
  engine → canvas → game-player, selector por juego (`SkinPicker`) dentro y
  fuera del reproductor, persistencia por juego (`av_skins`), `data-skin` en
  `.av-player`. Paletas: clásico = look original 1:1; neón = glow de la UI
  (--cyan/--magenta/--yellow/--green); retro = fósforo ámbar CRT con acento
  verde. Lint + build verificados.
- **tetris** — Implementado el 2026-08-18. Motor vectorial (bloques `fillRect`),
  skin de solo color suficiente (sin sprites). Contrato `TetrisPalette`
  (`background`/`grid`/`blockHighlight`/`blocks` indexado 0..8 como el antiguo
  `COLORS`/`glow`); clásico = look original 1:1 (`background: null` para dejar ver
  el CRT, rejilla = `--line`, brillo blanco 0.12, sin glow). Seam
  engine → canvas → game-player idéntico al de Asteroids; selector por juego
  dentro y fuera del reproductor, persistencia `av_skins`, `data-skin` en
  `.av-player` (forks del marco `.tetris-canvas`/`.tetris-next-canvas`).
  Paletas: neón = 7 piezas en tonos neón distintos (`--cyan/--yellow/--green` +
  violeta/rojo/azul/naranja) con bloom; retro = rampa ámbar/fósforo con
  separación por luminosidad entre piezas y la T como único acento verde-fósforo.
  Validado sobre transparente/`#0a0a0f`/`#0d0a04`. Lint + build verificados.
- **arkanoid** — Implementado el 2026-08-18. **Sprite-based**
  (`spritesheet-breakout.png`): una skin de solo color no basta. Enfoque
  aplicado: teñido de sprites por canal alfa (`globalCompositeOperation
"source-in"` sobre un canvas de trabajo) conservando la silueta del sprite.
  Contrato `ArkanoidPalette` con `useSprites` (clásico = sprites sin teñir,
  réplica 1:1) y remapeo de los 7 `BlockColor` para mantener la diferenciación
  por fila. Seam engine → canvas → game-player idéntico al de Asteroids;
  selector por juego dentro y fuera del reproductor, persistencia `av_skins`,
  `data-skin` en `.av-player`. Paletas: clásico = spritesheet original; neón =
  glow de la UI por fila con bloom; retro = rampa ámbar/fósforo con acento
  verde. Limitación conocida: el teñido produce siluetas de color plano (se
  pierde el sombreado interno del sprite), aceptable y deseado para el look
  neón/retro; el clásico conserva el detalle intacto. Lint + build verificados.
- **snake** — Implementado el 2026-08-18. **Sprite-based** (`fruits.png`): una
  skin de solo color no basta para la fruta. Enfoque aplicado: serpiente,
  tablero y rejilla se recolorean con tokens planos; la fruta se **tiñe** en un
  canvas offscreen dibujando el sprite y superponiendo el color de la skin con
  `globalCompositeOperation "source-atop"` (conserva silueta y sombreado del
  sprite). Contrato `SnakePalette` con `foodTint`/`foodTintAlpha`
  (clásico = `foodTint: null`, sprite intacto 1:1). Seam
  engine → canvas → game-player idéntico al de Asteroids; selector por juego
  dentro y fuera del reproductor, persistencia `av_skins`, `data-skin` en
  `.av-player` (forks del marco `.snake-canvas`). Paletas: clásico = look
  original verde 1:1; neón = cabeza cian / cuerpo verde de la UI + fruta magenta;
  retro = fósforo ámbar CRT (distinto del verde clásico) con fruta ámbar
  brillante. Validado sobre `#0a0f0a`/`#0a0a0f`/`#0d0a04`. Limitación conocida:
  en retro (monocromo) la fruta se distingue por brillo y silueta, no por tono.
  Lint + build verificados.
