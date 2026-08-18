// Paletas concretas de Snake por skin. El engine define el contrato
// `SnakePalette` y la paleta "clásico" (CLASSIC_SNAKE_PALETTE, réplica 1:1 del
// look original); aquí se añaden "neón" y "retro". Cada color está validado
// para el modo oscuro fijo de la plataforma (ver
// specs/skins/sistema-de-skins.md).
//
// Snake es sprite-based (la fruta sale de /snake-assets/fruits.png); por eso
// cada paleta incluye `foodTint`/`foodTintAlpha` para recolorear el sprite (ver
// SnakePalette en el engine). En "clásico" la fruta va sin teñir.

import {
  CLASSIC_SNAKE_PALETTE,
  type SnakePalette,
} from "@/lib/games/snake/engine";
import type { SkinId } from "@/lib/skins";

// Neón: reutiliza la paleta de glow de la UI (app/globals.css: --cyan,
// --magenta, --green) sobre el fondo azul-negro --bg. Cabeza cian, cuerpo
// verde (contraste de tono cabeza/cuerpo), rejilla cian tenue, fruta teñida de
// magenta para que resalte contra la serpiente fría; todo con shadowBlur para
// el brillo característico del resto de la interfaz.
const NEON_SNAKE_PALETTE: SnakePalette = {
  background: "#0a0a0f", // = --bg, coherente con el marco CRT
  grid: "rgba(0, 245, 255, 0.10)", // rejilla cian tenue
  snakeHead: "#00f5ff", // --cyan
  snakeBody: "#00ff88", // --green (distinto en tono de la cabeza)
  snakeGlow: "#00f5ff",
  glowHead: 16,
  glowBody: 8,
  foodTint: "#ff006e", // --magenta: la fruta contrasta con la serpiente fría
  foodTintAlpha: 0.55,
  foodFallback: "#ff006e",
};

// Retro: fósforo ámbar de CRT, distinto en carácter a clásico (que es verde) y
// a neón. Monocromo cálido con separación por luminosidad cabeza/cuerpo y fruta
// teñida de ámbar brillante para que destaque sobre el cuerpo más apagado.
// Fondo ámbar-negro cálido, distinto del verde-negro (clásico) y del azul-negro
// (neón). Bloom mínimo de fósforo.
const RETRO_SNAKE_PALETTE: SnakePalette = {
  background: "#0d0a04", // ámbar-negro cálido
  grid: "rgba(255, 176, 0, 0.10)", // rejilla ámbar tenue
  snakeHead: "#ffd257", // ámbar brillante
  snakeBody: "#c8880f", // ámbar-bronce apagado, claramente más tenue que la cabeza
  snakeGlow: "#ffb000",
  glowHead: 4,
  glowBody: 2,
  foodTint: "#ffcf4d", // ámbar brillante: la fruta resalta sobre el cuerpo
  foodTintAlpha: 0.6,
  foodFallback: "#fff0c2",
};

export const SNAKE_PALETTES: Record<SkinId, SnakePalette> = {
  classic: CLASSIC_SNAKE_PALETTE,
  neon: NEON_SNAKE_PALETTE,
  retro: RETRO_SNAKE_PALETTE,
};

export function resolveSnakePalette(skin: SkinId): SnakePalette {
  return SNAKE_PALETTES[skin] ?? CLASSIC_SNAKE_PALETTE;
}
