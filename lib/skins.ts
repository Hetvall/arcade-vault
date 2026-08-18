// Sistema de skins por juego. La elección NO es global: cada juego guarda su
// propio skin bajo un único objeto `av_skins` en localStorage que mapea
// { [gameId]: SkinId }, siguiendo el mismo patrón mock que la sesión
// (`av_user`, ver lib/session.ts). El default para un juego sin elección
// guardada es siempre "classic".

export type SkinId = "classic" | "neon" | "retro";

export const SKIN_IDS: SkinId[] = ["classic", "neon", "retro"];

export const DEFAULT_SKIN: SkinId = "classic";

export const SKIN_LABELS: Record<SkinId, string> = {
  classic: "Clásico",
  neon: "Neón",
  retro: "Retro",
};

// Juegos que ya tienen paletas de skin implementadas. El selector solo se
// muestra para estos ids; el resto del catálogo no ofrece skins todavía.
export const SKINNABLE_GAMES = new Set<string>([
  "asteroids",
  "tetris",
  "arkanoid",
  "snake",
]);

const SKINS_KEY = "av_skins";

function isSkinId(value: unknown): value is SkinId {
  return value === "classic" || value === "neon" || value === "retro";
}

function readAll(): Record<string, SkinId> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SKINS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, SkinId> = {};
    for (const [gameId, skin] of Object.entries(parsed)) {
      if (isSkinId(skin)) out[gameId] = skin;
    }
    return out;
  } catch {
    return {};
  }
}

export function getStoredSkin(gameId: string): SkinId {
  return readAll()[gameId] ?? DEFAULT_SKIN;
}

export function setStoredSkin(gameId: string, skin: SkinId): void {
  if (typeof window === "undefined") return;
  const all = readAll();
  all[gameId] = skin;
  window.localStorage.setItem(SKINS_KEY, JSON.stringify(all));
}
