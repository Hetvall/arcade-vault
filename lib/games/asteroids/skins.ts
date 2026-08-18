// Paletas concretas de Asteroids por skin. El engine define el contrato
// `AsteroidsPalette` y la paleta "clásico" (CLASSIC_ASTEROIDS_PALETTE, réplica
// 1:1 del look original); aquí se añaden "neón" y "retro". Cada color está
// validado para el modo oscuro fijo de la plataforma (ver
// specs/skins/sistema-de-skins.md).

import {
  CLASSIC_ASTEROIDS_PALETTE,
  type AsteroidsPalette,
} from "@/lib/games/asteroids/engine";
import type { SkinId } from "@/lib/skins";

// Neón: reutiliza la paleta de glow de la UI (app/globals.css: --cyan,
// --magenta, --yellow, --green) sobre el fondo azul-negro --bg. Nave cian,
// asteroides magenta, balas amarillas, power-up verde, chispas cian; todo con
// shadowBlur para el brillo característico del resto de la interfaz.
const NEON_ASTEROIDS_PALETTE: AsteroidsPalette = {
  background: "#0a0a0f", // = --bg, coherente con el marco CRT
  ship: "#00f5ff", // --cyan
  thruster: "rgba(255, 0, 110, 0.9)", // --magenta como ember de contraste
  bullet: "#f5ff00", // --yellow
  asteroid: "#ff006e", // --magenta
  particleRgb: "0,245,255", // chispas cian
  powerup: "#00ff88", // --green
  glow: 8,
};

// Retro: fósforo ámbar de CRT, distinto en carácter a clásico y neón (no una
// variación de brillo). Monocromo cálido con separación por luminosidad para
// legibilidad, más un único acento verde-fósforo en el power-up. Fondo
// ámbar-negro cálido, distinto del negro puro (clásico) y del azul-negro
// (neón).
const RETRO_ASTEROIDS_PALETTE: AsteroidsPalette = {
  background: "#0d0a04", // ámbar-negro cálido
  ship: "#ffc21f", // ámbar brillante
  thruster: "rgba(255, 120, 30, 0.9)", // ember naranja
  bullet: "#fff0c2", // ámbar casi-blanco (los disparos resaltan)
  asteroid: "#b8791a", // ámbar-bronce apagado, claramente más tenue que la nave
  particleRgb: "255,150,40", // chispas ámbar
  powerup: "#8bff5a", // acento verde-fósforo (único color frío)
  glow: 3, // leve bloom de fósforo
};

export const ASTEROIDS_PALETTES: Record<SkinId, AsteroidsPalette> = {
  classic: CLASSIC_ASTEROIDS_PALETTE,
  neon: NEON_ASTEROIDS_PALETTE,
  retro: RETRO_ASTEROIDS_PALETTE,
};

export function resolveAsteroidsPalette(skin: SkinId): AsteroidsPalette {
  return ASTEROIDS_PALETTES[skin] ?? CLASSIC_ASTEROIDS_PALETTE;
}
