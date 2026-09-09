# Revisión de seguridad — Arcade Vault

**Estado:** Implemented (código) · Recomendaciones de BD pendientes de aplicar por un humano
**Depende de:** SPEC 04 (Supabase base), SPEC 06 (catálogo/scores + RLS), SPEC 12 (auth real),
SPEC 13 (medidas de seguridad)
**Fecha:** 2026-08-26 · **Re-auditoría:** 2026-09-09

## Diagnóstico

Auditoría de la aplicación (headers, validación de auth, hardening de errores, protección de
rutas) y de la base de datos (RLS, política INSERT de `scores`, advisors de Supabase) contra
SPEC 12/13 y `references/security/security-checklist.md`.

Resultado global: **todo el código de SPEC 12/13 ya está implementado y cumple**; no se aplicó
ningún fix de código en esta corrida. La BD ya está endurecida (migración
`harden_scores_insert_policy`, 20260825223446). El único frente abierto son ajustes de
dashboard de Supabase Auth que no se pueden aplicar vía MCP.

### Tabla App (código)

| Control                                                                                                                                | Archivo                             | Estado |
| -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------ |
| Headers: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS, Permissions-Policy                                            | `next.config.ts`                    | ok     |
| `PASSWORD_REGEX` (≥8, min/may/díg/símbolo), `EMAIL_REGEX`, `getPasswordRequirements`                                                   | `lib/validation.ts`                 | ok     |
| Registro: exige `PASSWORD_REGEX` + `EMAIL_REGEX`, requisitos en vivo, submit deshabilitado hasta cumplir, no llama a `signUp` si falla | `app/login/page.tsx`                | ok     |
| Login: solo `EMAIL_REGEX` + password no vacío (sin `PASSWORD_REGEX`)                                                                   | `app/login/page.tsx`                | ok     |
| Reset: misma validación/UI de requisitos que registro antes de `updateUser`                                                            | `app/reset-password/page.tsx`       | ok     |
| Hardening de errores (`describeAuthError`: copy español, `default` genérico sin filtrar internos de Supabase)                          | `app/login/page.tsx`                | ok     |
| Protección de rutas: refresco de sesión en cada request + redirect de logueado fuera de `/login` a `/games`                            | `proxy.ts`, `lib/supabase/proxy.ts` | ok     |
| Cap de nombre `toUpperCase().slice(0, 10)` alineado con `char_length(name) between 1 and 10` de la política                            | `components/game-player.tsx:398`    | ok     |

### Tabla BD (solo lectura)

| Control                                   | Estado   | Detalle                                                                       |
| ----------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| Advisor `rls_policy_always_true` (scores) | ok       | Ya no aparece en `get_advisors(security)`                                     |
| Advisor `auth_leaked_password_protection` | problema | Sigue reportado — ajuste de dashboard                                         |
| RLS en `public.games`                     | ok       | `relrowsecurity = true`                                                       |
| RLS en `public.scores`                    | ok       | `relrowsecurity = true`                                                       |
| `WITH CHECK` de `public insert scores`    | ok       | `((score >= 0) AND ((char_length(name) >= 1) AND (char_length(name) <= 10)))` |
| Migración de hardening                    | ok       | `20260825223446_harden_scores_insert_policy` aplicada                         |

Esquema de `scores` sin cambios (SPEC 12/13); no se tocó.

## Alcance

**Dentro:** auditoría de los archivos listados arriba + estado de RLS/políticas/advisors de la
BD (solo lectura). Aplicar fixes de código claros y de bajo riesgo.

**Fuera:** cambios de esquema de `scores`, migraciones/SQL de escritura (se recomiendan, no se
aplican), CSP, anti-cheat, mecánicas de juego, cualquier ajuste de dashboard aplicado por
código.

## Plan de implementación

Verificación de cada control contra su archivo/objeto de BD. No hubo desviaciones de código
respecto a SPEC 12/13, por lo que no se generó plan de cambios de código.

## Resultado de la implementación

- **Fixes de código aplicados:** ninguno. Todos los controles de la tabla App ya cumplían.
- **BD:** sin cambios (solo lectura). Se confirma que el hardening previsto en SPEC 13 ya está
  aplicado.

## Archivos tocados

- `references/security-coverage.md` (memoria de cobertura, creada).
- `specs/security/revision-seguridad.md` (este documento, creado).
- Ningún archivo de código de la aplicación fue modificado.

## Verificación

- `mcp__supabase__get_advisors(security)`: único warning `auth_leaked_password_protection`
  (dashboard); `rls_policy_always_true` ya no aparece.
- `pg_class`: `relrowsecurity = true` en `games` y `scores`.
- `pg_policies`: `public insert scores` con `WITH CHECK` endurecido.
- `mcp__supabase__list_migrations`: `harden_scores_insert_policy` presente.
- `npm run lint`: 0 errores (9 warnings preexistentes en `app/pokemon/page.tsx` y
  `references/started-games/**`, ajenos a esta auditoría). No se corrió `npm run build` porque
  no hubo cambios de código con impacto en el build.

## Recomendaciones de BD (pendientes de aplicar por un humano)

La BD es **solo lectura** para este agente. Nada de lo siguiente se ejecutó.

### 1. Advisor `auth_leaked_password_protection` (dashboard — no aplicable por MCP)

Estado actual: deshabilitado. Remediación:
<https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection>

Authentication → Sign In / Providers → Password: habilitar "Leaked password protection"
(verificación contra HaveIBeenPwned.org).

### 2. Política de contraseñas y rate limit (dashboard — no aplicable por MCP)

- **Minimum password length = 8** — Authentication → Sign In / Providers → Email.
- **Max signup rate por IP** — Authentication → Rate Limits: limitar signups por IP (anti-bot).

### 3. SQL de referencia para la política de INSERT de `scores` (YA APLICADO — no re-ejecutar)

Se documenta solo como referencia del estado deseado ya presente en la BD. La política ya tiene
este `WITH CHECK`; **no** hace falta re-aplicarlo. Si en el futuro una migración la revirtiera a
`WITH CHECK (true)`, el SQL para re-endurecerla sería:

```sql
alter table public.games enable row level security;
alter table public.scores enable row level security;

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

Mantener el `char_length(name) between 1 and 10` alineado con el cap del campo de nombre en
`components/game-player.tsx:398` (`slice(0, 10)`). Si ese cap cambia, actualizar la política a
la par.

## Re-auditoría 2026-09-09

Segunda corrida del `security-auditor`. Se re-verificaron los 8 controles de la tabla App
(`next.config.ts`, `lib/validation.ts`, `app/login/page.tsx`, `app/reset-password/page.tsx`,
`proxy.ts`, `lib/supabase/proxy.ts`, `components/game-player.tsx`) y los 6 de la tabla BD:
**sin regresiones**, todo sigue cumpliendo. No se aplicó ningún fix de código. La BD sigue
endurecida (política `public insert scores` con el `WITH CHECK` correcto, RLS activo en
`games`/`scores`, migración `harden_scores_insert_policy` presente). `get_advisors(security)`
reporta un único warning: `auth_leaked_password_protection` (dashboard). Sin cambios de código,
`npm run lint`/`npm run build` no eran obligatorios en esta corrida.

## Consideración residual (no es un fix)

`describeAuthError` en el flujo de registro devuelve "Ese correo ya está registrado", lo que
enumera la existencia de un email. Es una **decisión explícita de SPEC 12** y no se cambia sin
pedido del usuario. Con "Confirm email" ON, Supabase suele devolver una respuesta ofuscada, por
lo que esa rama rara vez se dispara. Se deja registrado, no se modifica.
</content>
