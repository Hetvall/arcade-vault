// Sesión y puntuaciones mock persistidas en localStorage, reemplazando el
// estado que vivía en references/templates/app.jsx ("av_user", "av_scores").

export interface SessionUser {
  name: string;
}

export interface SavedScore {
  game: string; // Game.id
  score: number;
  name: string; // iniciales capturadas en el modal de fin de juego
  at: number; // Date.now()
}

const USER_KEY = "av_user";
const SCORES_KEY = "av_scores";

export function getStoredUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export function setStoredUser(user: SessionUser | null): void {
  if (typeof window === "undefined") return;
  if (user) {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(USER_KEY);
  }
}

export function getStoredScores(): SavedScore[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(SCORES_KEY) || "[]");
  } catch {
    return [];
  }
}

export function addStoredScore(entry: Omit<SavedScore, "at">): void {
  if (typeof window === "undefined") return;
  const all = getStoredScores();
  all.push({ ...entry, at: Date.now() });
  window.localStorage.setItem(SCORES_KEY, JSON.stringify(all));
}

export function bestScoreFor(
  game: string,
  playerName: string,
  scores: SavedScore[]
): SavedScore | null {
  const own = scores.filter((s) => s.game === game && s.name === playerName);
  if (own.length === 0) return null;
  return own.reduce((best, s) => (s.score > best.score ? s : best));
}

// Máximo puntaje guardado para un juego entre TODOS los jugadores/iniciales
// registrados en este navegador (no solo el usuario en sesión). Usado para
// el "Mejor global" de la pantalla de detalle (ver
// specs/05-juego-asteroides.md); null si no hay ninguna partida guardada
// para ese juego todavía.
export function bestGlobalScoreFor(
  game: string,
  scores: SavedScore[]
): number | null {
  const own = scores.filter((s) => s.game === game);
  if (own.length === 0) return null;
  return own.reduce((best, s) => Math.max(best, s.score), 0);
}
