// Paletas concretas de Arkanoid por skin. El engine define el contrato
// `ArkanoidPalette` y la paleta "clásico" (CLASSIC_ARKANOID_PALETTE, réplica
// 1:1 del look original con los sprites sin teñir); aquí se añaden "neón" y
// "retro", ambas en modo teñido (useSprites: false). Cada color está validado
// para el modo oscuro fijo de la plataforma (ver
// specs/skins/sistema-de-skins.md).
//
// Arkanoid es sprite-based (spritesheet-breakout.png): una skin de solo color
// no basta, así que neón/retro tiñen cada sprite usando su alfa como máscara
// (el engine conserva la silueta y cambia el color). Los 7 colores de bloque
// originales se remapean 1:1 para mantener la diferenciación por fila.

import {
  CLASSIC_ARKANOID_PALETTE,
  type ArkanoidPalette,
} from "@/lib/games/arkanoid/engine";
import type { SkinId } from "@/lib/skins";

// Neón: reutiliza la paleta de glow de la UI (app/globals.css: --cyan,
// --magenta, --yellow, --green) sobre el fondo azul-negro --bg. Cada fila de
// bloques recibe un neón saturado distinto; la paleta (raqueta) es cian, la
// pelota amarilla, todo con shadowBlur para el bloom característico.
const NEON_ARKANOID_PALETTE: ArkanoidPalette = {
  background: "#0a0a0f", // = --bg, coherente con el marco CRT
  paddle: "#00f5ff", // --cyan
  ball: "#f5ff00", // --yellow (resalta como proyectil)
  blocks: {
    cyan: "#00f5ff", // --cyan
    magenta: "#ff006e", // --magenta
    yellow: "#f5ff00", // --yellow
    green: "#00ff88", // --green
    hotpink: "#ff5fd2", // rosa neón, distinto del magenta
    red: "#ff3b30", // rojo neón
    gray: "#a98bff", // violeta neón (los bloques "acero" no se apagan)
  },
  useSprites: false,
  glow: 8,
};

// Retro: fósforo de CRT, distinto en carácter a clásico y neón. Rampa cálida
// ámbar/naranja con separación por luminosidad entre filas, más un único acento
// verde-fósforo (bloques "green") como color frío. Fondo ámbar-negro cálido,
// distinto del negro puro (clásico) y del azul-negro (neón).
const RETRO_ARKANOID_PALETTE: ArkanoidPalette = {
  background: "#0d0a04", // ámbar-negro cálido
  paddle: "#ffc21f", // ámbar brillante
  ball: "#fff0c2", // ámbar casi-blanco (la pelota resalta)
  blocks: {
    hotpink: "#ffe08a", // ámbar pálido (fila más luminosa)
    red: "#ffcf47", // ámbar brillante
    yellow: "#ffb01f", // ámbar
    magenta: "#ff9d3d", // naranja-ámbar
    cyan: "#d98a12", // ámbar-bronce medio
    gray: "#a6791f", // bronce apagado (fila más tenue, aún legible)
    green: "#8bff5a", // acento verde-fósforo (único color frío)
  },
  useSprites: false,
  glow: 3, // leve bloom de fósforo
};

export const ARKANOID_PALETTES: Record<SkinId, ArkanoidPalette> = {
  classic: CLASSIC_ARKANOID_PALETTE,
  neon: NEON_ARKANOID_PALETTE,
  retro: RETRO_ARKANOID_PALETTE,
};

export function resolveArkanoidPalette(skin: SkinId): ArkanoidPalette {
  return ARKANOID_PALETTES[skin] ?? CLASSIC_ARKANOID_PALETTE;
}
