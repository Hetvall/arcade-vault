// Paletas concretas de Pong por skin. El engine define el contrato
// `PongPalette` y la paleta "clásico" (CLASSIC_PONG_PALETTE, réplica 1:1 del
// look original cian neón); aquí se añaden "neón" y "retro". Pong es un motor
// vectorial (fillRect, sin sprites), así que una skin de solo color basta.
// Cada color está validado para el modo oscuro fijo de la plataforma (ver
// specs/skins/sistema-de-skins.md).

import {
  CLASSIC_PONG_PALETTE,
  type PongPalette,
} from "@/lib/games/pong/engine";
import type { SkinId } from "@/lib/skins";

// Neón: reutiliza la paleta de glow de la UI (app/globals.css: --cyan,
// --magenta, --yellow) sobre el fondo azul-negro --bg. Diferencia jugador y
// CPU por tono (cian vs magenta), imposible en el clásico monocolor. Pelota
// amarilla con halo propio; todo con shadowBlur para el bloom de la interfaz.
const NEON_PONG_PALETTE: PongPalette = {
  background: "#0a0a0f", // = --bg, coherente con el marco CRT
  centerLine: "rgba(0, 245, 255, 0.35)", // --cyan tenue
  playerPaddle: "#00f5ff", // --cyan (jugador)
  cpuPaddle: "#ff006e", // --magenta (CPU), contraste de tono con el jugador
  ball: "#f5ff00", // --yellow, el tercer acento neón
  ballGlowColor: "#f5ff00",
  glow: 12,
  ballGlow: 16,
};

// Retro: fósforo ámbar de CRT, distinto en carácter a clásico y neón (no una
// variación de brillo). Monocromo cálido con separación por luminosidad: la
// paleta del jugador es ámbar brillante y la de la CPU un ámbar-bronce más
// apagado, ambas claramente por encima del fondo ámbar-negro. La pelota es un
// ámbar casi-blanco para que sobresalga del par de paletas.
const RETRO_PONG_PALETTE: PongPalette = {
  background: "#0d0a04", // ámbar-negro cálido (distinto del azul-negro neón)
  centerLine: "rgba(255, 176, 0, 0.28)", // ámbar tenue discontinuo
  playerPaddle: "#ffc21f", // ámbar brillante (jugador)
  cpuPaddle: "#b8791a", // ámbar-bronce apagado (CPU), separado por luminosidad
  ball: "#fff0c2", // ámbar casi-blanco, sobresale del par de paletas
  ballGlowColor: "#ffb000", // halo ámbar puro
  glow: 4, // leve bloom de fósforo
  ballGlow: 8,
};

export const PONG_PALETTES: Record<SkinId, PongPalette> = {
  classic: CLASSIC_PONG_PALETTE,
  neon: NEON_PONG_PALETTE,
  retro: RETRO_PONG_PALETTE,
};

export function resolvePongPalette(skin: SkinId): PongPalette {
  return PONG_PALETTES[skin] ?? CLASSIC_PONG_PALETTE;
}
