// Paletas concretas de Tetris por skin. El engine define el contrato
// `TetrisPalette` y la paleta "clásico" (CLASSIC_TETRIS_PALETTE, réplica 1:1
// del look original con el array COLORS); aquí se añaden "neón" y "retro".
// Cada color está validado para el modo oscuro fijo de la plataforma (ver
// specs/skins/sistema-de-skins.md).
//
// `blocks` sigue la indexación del engine: índice 0 = celda vacía (null),
// 1..7 = las 7 piezas (I, O, T, S, Z, J, L), 8 = tuerca deshabilitada.

import {
  CLASSIC_TETRIS_PALETTE,
  type TetrisPalette,
} from "@/lib/games/tetris/engine";
import type { SkinId } from "@/lib/skins";

// Neón: reutiliza la paleta de glow de la UI (app/globals.css: --cyan,
// --magenta, --yellow, --green) sobre el fondo azul-negro --bg. Las 7 piezas
// mantienen tonos saturados distintos entre sí; rejilla cian tenue y bloom
// con shadowBlur, coherente con el resto de la interfaz.
const NEON_TETRIS_PALETTE: TetrisPalette = {
  background: "#0a0a0f", // = --bg
  grid: "rgba(0, 245, 255, 0.10)", // cian tenue, sin competir con las piezas
  blockHighlight: "rgba(255,255,255,0.25)",
  blocks: [
    null,
    "#00f5ff", // I - --cyan
    "#f5ff00", // O - --yellow
    "#b26bff", // T - violeta neón
    "#00ff88", // S - --green
    "#ff3b30", // Z - rojo neón
    "#3d7bff", // J - azul neón (más profundo que la I cian)
    "#ff9d3d", // L - naranja neón
    "#a98bff", // N - violeta claro (tuerca deshabilitada)
  ],
  glow: 6,
};

// Retro: fósforo ámbar de CRT, distinto en carácter a clásico y neón (no una
// variación de brillo). Rampa monocroma cálida donde las piezas se separan por
// luminosidad, más un único acento verde-fósforo (la pieza T) como color frío.
// Fondo ámbar-negro cálido, distinto del transparente (clásico) y del
// azul-negro (neón).
const RETRO_TETRIS_PALETTE: TetrisPalette = {
  background: "#0d0a04", // ámbar-negro cálido
  grid: "rgba(255, 176, 0, 0.10)", // rejilla ámbar tenue
  blockHighlight: "rgba(255,240,200,0.20)", // brillo cálido
  blocks: [
    null,
    "#ffe08a", // I - ámbar claro
    "#ffcf47", // O - ámbar
    "#8bff5a", // T - verde-fósforo (único acento frío)
    "#ffb01f", // S - ámbar medio
    "#ff9d3d", // Z - naranja ámbar
    "#d98a12", // J - ámbar apagado
    "#a6791f", // L - bronce (el más tenue)
    "#8a6a1a", // N - bronce oscuro (tuerca deshabilitada)
  ],
  glow: 3,
};

export const TETRIS_PALETTES: Record<SkinId, TetrisPalette> = {
  classic: CLASSIC_TETRIS_PALETTE,
  neon: NEON_TETRIS_PALETTE,
  retro: RETRO_TETRIS_PALETTE,
};

export function resolveTetrisPalette(skin: SkinId): TetrisPalette {
  return TETRIS_PALETTES[skin] ?? CLASSIC_TETRIS_PALETTE;
}
