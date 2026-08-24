// Sesión real de Supabase Auth. `SessionUser` es una vista mínima del `User`
// de Supabase; su origen es `supabase.auth` (ver context/session-context.tsx),
// no localStorage. Las puntuaciones viven en la tabla `scores` de Supabase
// (ver lib/supabase/games.ts) y no dependen de esta sesión.

import type { User } from "@supabase/supabase-js";

export interface SessionUser {
  name: string;
}

/**
 * Deriva el alias arcade (`user.name`) de un usuario de Supabase:
 * - Si se registró con email+contraseña, usa el alias elegido en el
 *   registro (`user_metadata.username`).
 * - Si entró por OAuth (Google/GitHub), no hay alias elegido por el
 *   usuario: se deriva del proveedor (`app_metadata.provider`),
 *   normalizado a mayúsculas y truncado a 10 caracteres (p. ej. "GOOGLE",
 *   "GITHUB").
 */
export function userToSession(user: User | null): SessionUser | null {
  if (!user) return null;

  const username = user.user_metadata?.username;
  if (typeof username === "string" && username.trim().length > 0) {
    return { name: username };
  }

  const provider = user.app_metadata?.provider ?? "usuario";
  return { name: provider.toUpperCase().slice(0, 10) };
}
