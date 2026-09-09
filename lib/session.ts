// Sesión real de Supabase Auth. `SessionUser` es una vista mínima del `User`
// de Supabase; su origen es `supabase.auth` (ver context/session-context.tsx),
// no localStorage. Las puntuaciones viven en la tabla `scores` de Supabase
// (ver lib/supabase/games.ts) y no dependen de esta sesión.

import type { User } from "@supabase/supabase-js";

export interface SessionUser {
  name: string;
}

const ALIAS_MAX_LENGTH = 10;

/**
 * Convierte un nombre/alias crudo en el alias de 10 caracteres que usa la
 * UI. Si el valor no cabe entero, prioriza el primer nombre (antes del
 * primer espacio) en vez de cortar a la mitad de una palabra — así
 * "James Orozco Hernandez" se muestra como "JAMES" y no como "JAMES OROZ".
 */
export function toAlias(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const source =
    trimmed.length > ALIAS_MAX_LENGTH ? trimmed.split(/\s+/)[0] : trimmed;
  return source.toUpperCase().slice(0, ALIAS_MAX_LENGTH);
}

function normalize(value: unknown): string | null {
  return toAlias(value);
}

/**
 * Deriva un alias a partir de un perfil OAuth (`identity_data` de un
 * proveedor, tal cual lo manda Google/GitHub — sin fusionar con datos de
 * otro proveedor): usuario de GitHub, nombre de Google/GitHub, y como
 * último recurso el nombre del proveedor. Usado tanto en el callback de
 * OAuth (para fijar el alias definitivo en `user_metadata.username` justo
 * tras el login, ver app/auth/callback/route.ts) como aquí, de respaldo.
 */
export function deriveAliasFromProfile(
  profile: Record<string, unknown> | null | undefined,
  provider?: string | null
): string | null {
  const p = profile ?? {};
  return (
    normalize(p.user_name) ??
    normalize(p.preferred_username) ??
    normalize(p.full_name) ??
    normalize(p.name) ??
    normalize(provider)
  );
}

/**
 * Deriva el alias arcade (`user.name`) de un usuario de Supabase. La fuente
 * de verdad es siempre `user_metadata.username`:
 * - Para registro por email+contraseña se fija explícitamente en el signup.
 * - Para OAuth (Google/GitHub) se fija justo después de cada login, en
 *   `app/auth/callback/route.ts`, a partir del `identity_data` del
 *   proveedor con el que se acaba de autenticar (no del `user_metadata` de
 *   cuenta, que Supabase fusiona entre todos los proveedores enlazados y
 *   puede arrastrar el alias de un login anterior con otro proveedor).
 *
 * Este helper solo necesita leer `username`; el resto de la derivación
 * (perfil OAuth crudo) es respaldo para el primer render antes de que el
 * callback termine de escribirlo, o para cuentas antiguas sin ese campo.
 */
export function userToSession(user: User | null): SessionUser | null {
  if (!user) return null;

  const username = normalize(user.user_metadata?.username);
  if (username) return { name: username };

  const emailLocalPart = user.email?.split("@")[0];
  const name =
    deriveAliasFromProfile(user.user_metadata, user.app_metadata?.provider) ??
    normalize(emailLocalPart) ??
    "USUARIO";

  return { name };
}
