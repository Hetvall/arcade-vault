# Revisión de seguridad — Arcade Vault

**Estado:** Implemented (código) · BD verificada solo-lectura
**Depende de:** SPEC 12 (auth Supabase), SPEC 13 (medidas de seguridad)
**Última auditoría:** 2026-08-25 (`security-auditor`)

Registro de lo auditado e implementado, no una propuesta a aprobar. Cubre los dos frentes:
seguridad de aplicación (código, implementado) y seguridad de base de datos (solo lectura;
los cambios de BD los aplica un humano).

## Diagnóstico

Corrida de auditoría del 2026-08-25. La rama `spec-13-medidas-seguridad` ya traía el trabajo
de SPEC 13. Se releyeron los archivos, se corrió `get_advisors(security)` y se inspeccionó la
BD en solo lectura.

### Tabla App (código)

| Control                                                                                                                                    | Archivo                                              | Estado |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | ------ |
| 5 headers de seguridad (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`) | `next.config.ts`                                     | ok     |
| `PASSWORD_REGEX` + `EMAIL_REGEX` + `getPasswordRequirements`                                                                               | `lib/validation.ts`                                  | ok     |
| Registro exige regex de password + email, submit deshabilitado, requisitos en vivo                                                         | `app/login/page.tsx`                                 | ok     |
| Login solo valida formato email + password no vacío (sin `PASSWORD_REGEX`)                                                                 | `app/login/page.tsx`                                 | ok     |
| Hardening de errores de auth (`describeAuthError`, mensajes en español)                                                                    | `app/login/page.tsx` / `app/reset-password/page.tsx` | ok     |
| Reset password aplica misma validación + UI de requisitos + confirmación                                                                   | `app/reset-password/page.tsx`                        | ok     |
| Protección de rutas: refresco de sesión + redirección `/login`→`/games` con sesión                                                         | `proxy.ts` / `lib/supabase/proxy.ts`                 | ok     |
| Cap de nombre alineado con política BD (`.slice(0, 10)` ↔ `char_length between 1 and 10`)                                                  | `components/game-player.tsx`                         | ok     |

Sin CSP (fuera de alcance, SPEC 13). No hay rutas autenticadas que gatear: catálogo, juego,
leaderboard y modo invitado son públicos por diseño (SPEC 12); `/reset-password` maneja su
propio estado sin sesión (`no-session`). Nada que añadir en el proxy.

### Tabla BD (solo lectura)

| Control                                        | Evidencia                                                                 | Estado   |
| ---------------------------------------------- | ------------------------------------------------------------------------- | -------- |
| RLS en `public.games`                          | `pg_class.relrowsecurity = true`                                          | ok       |
| RLS en `public.scores`                         | `pg_class.relrowsecurity = true`                                          | ok       |
| `public insert scores` `WITH CHECK` endurecido | `(score >= 0) AND (char_length(name) >= 1) AND (char_length(name) <= 10)` | ok       |
| Advisor `rls_policy_always_true`               | ya no se reporta                                                          | ok       |
| Advisor `auth_leaked_password_protection`      | se reporta WARN (dashboard)                                               | problema |
| Migración de endurecimiento                    | `20260825223446 harden_scores_insert_policy` presente                     | ok       |

## Alcance

- **Dentro:** verificación de los controles de app de SPEC 13 y del estado real de RLS /
  políticas / advisors de la BD.
- **Fuera:** aplicar migraciones o SQL de escritura (este agente es solo-lectura sobre BD),
  cambiar el esquema de `scores`, introducir CSP, tocar mecánicas de juego o flujos OAuth.

## Plan de implementación

No se requirieron fixes de código en esta corrida: todos los controles de la tabla App ya
estaban implementados por SPEC 13 y se verificaron sin regresiones. La BD ya fue endurecida
por la migración `20260825223446` (aplicada por un humano, según el patrón solo-lectura del
agente).

## Resultado de la implementación

- Código de app: sin cambios; todo verificado `ok`.
- BD: verificada; único hallazgo abierto es de dashboard (leaked password protection), fuera
  del alcance ejecutable por MCP.

## Archivos tocados

- `references/security-coverage.md` — actualizada la memoria de cobertura (App todo `[x]`; BD
  RLS/política `[x]`; dashboard pendiente).
- `specs/security/revision-seguridad.md` — este documento.

Ningún archivo de código de la app fue modificado en esta corrida.

## Verificación

- `npm run lint`: 0 errores (8 warnings preexistentes, todos en
  `references/started-games/04-arkanoid/*`, ajenos a la app).
- `get_advisors(security)`: solo `auth_leaked_password_protection` (dashboard).
- BD: RLS activo en `games` y `scores`; política INSERT endurecida; migración presente.
- No se corrió `npm run build` por no haber cambios con impacto en el build.

## Recomendaciones de BD (pendientes de aplicar por un humano)

La BD ya está endurecida por la migración `20260825223446 harden_scores_insert_policy`. Si por
alguna razón se necesitara re-aplicar el endurecimiento de la política (p. ej. una migración
futura la revierte a `WITH CHECK (true)` y el advisor `rls_policy_always_true` vuelve), el SQL
recomendado es:

```sql
-- Re-asegurar RLS (idempotente)
alter table public.games enable row level security;
alter table public.scores enable row level security;

-- Endurecer la política de INSERT de scores
drop policy if exists "public insert scores" on public.scores;
create policy "public insert scores"
  on public.scores
  for insert
  to public
  with check (
    score >= 0
    and char_length(name) between 1 and 10
  );
```

Nota: mantener el `char_length(name) between 1 and 10` alineado con el cap de 10 del campo de
nombre en `components/game-player.tsx` (`.toUpperCase().slice(0, 10)`). Si ese cap cambia, la
política debe actualizarse a la par.

### Ajustes de dashboard de Supabase Auth (no aplicables por MCP)

Proyecto `skjiaowautazmyrnrepo`, [dashboard de Supabase](https://supabase.com/dashboard):

- [ ] **Leaked password protection = ON** — Authentication → Sign In / Providers → Password.
      Advisor `auth_leaked_password_protection` (WARN) sigue reportándose. Remediación:
      https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- [ ] **Minimum password length = 8** — Authentication → Sign In / Providers → Email.
- [ ] **Max signup rate por IP** — Authentication → Rate Limits (anti-bot).

La validación de contraseña en cliente (`lib/validation.ts`) es defensa en profundidad de UX;
no sustituye estos ajustes de dashboard, que son la política real que aplica también a la
Management API y otros clientes.
