# Memoria de cobertura — security-auditor

Leyenda: `[ ]` pendiente · `[x]` verificado/arreglado.

Sembrado inicial (2026-08-25). Primera corrida real del agente confirmada el 2026-08-25:
se releyeron todos los archivos, se corrió `get_advisors(security)` y se inspeccionó la BD
(solo lectura). Resultado: código de app ya completo (SPEC 13), BD ya endurecida por la
migración `20260825223446 harden_scores_insert_policy`. Único pendiente real: ajustes de
dashboard de Supabase Auth (no aplicables por MCP).

## App (código)

- [x] Headers de seguridad en `next.config.ts` (`X-Content-Type-Options`, `X-Frame-Options`,
      `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`) — verificado 2026-08-25.
- [x] Validación de contraseña/email (`lib/validation.ts`: `PASSWORD_REGEX`, `EMAIL_REGEX`,
      `getPasswordRequirements`) cableada en `app/login/page.tsx` (registro) y
      `app/reset-password/page.tsx`, con submit deshabilitado hasta cumplir requisitos y lista
      de requisitos en vivo — verificado 2026-08-25.
- [x] INICIAR SESIÓN solo valida formato de email + password no vacío (`isLoginValid`, sin
      `PASSWORD_REGEX`) — verificado 2026-08-25.
- [x] Hardening de errores de auth (`describeAuthError` en `app/login/page.tsx`; reset usa
      mensajes genéricos en español sin filtrar detalles internos de Supabase) — verificado 2026-08-25.
- [x] Protección de rutas en `proxy.ts` / `lib/supabase/proxy.ts`: `updateSession` refresca la
      sesión en cada request y redirige a `/games` si un usuario con sesión visita `/login`.
      No hay rutas autenticadas que gatear: catálogo, juego, leaderboard y modo invitado son
      públicos por diseño (SPEC 12); `/reset-password` maneja su propio estado sin sesión.
      Nada más que gatear — verificado 2026-08-25.
- [x] Alineación `char_length(name) between 1 and 10` (política BD) con el cap del campo nombre
      en `components/game-player.tsx` (`.toUpperCase().slice(0, 10)`) — alineado, verificado
      2026-08-25.

## BD (solo lectura)

- [x] RLS habilitado (`relrowsecurity = true`) en `public.games` y `public.scores` — verificado
      2026-08-25 vía `pg_class`.
- [x] Política `public insert scores` con `WITH CHECK` endurecido
      (`(score >= 0) AND (char_length(name) >= 1) AND (char_length(name) <= 10)`), ya no `true`.
      Aplicada por migración `20260825223446 harden_scores_insert_policy` (por un humano).
      El advisor `rls_policy_always_true` YA NO se reporta — verificado 2026-08-25.
- [ ] `auth_leaked_password_protection` — sigue deshabilitado según advisor. Requiere ajuste de
      dashboard (Supabase Auth → Password), no aplicable por MCP. PENDIENTE (humano).
- [ ] Longitud mínima de contraseña en Supabase Auth (dashboard, ≥8) — no verificable por MCP.
      PENDIENTE (humano).
- [ ] Rate limit de signup por IP (dashboard) — no verificable por MCP. PENDIENTE (humano).
