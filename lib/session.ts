// Sesión mock persistida en localStorage, reemplazando el estado que vivía
// en references/templates/app.jsx ("av_user"). Las puntuaciones ya no se
// guardan en localStorage: viven en la tabla `scores` de Supabase (ver
// lib/supabase/games.ts).

export interface SessionUser {
  name: string;
}

const USER_KEY = "av_user";

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
