# Memoria de cobertura de seguridad — Arcade Vault

Leyenda: `[ ]` pendiente · `[x]` verificado/arreglado.
No borrar el histórico ya marcado `[x]`. Si una corrida encuentra una regresión en algo `[x]`,
vuelve a `[ ]` y anota fecha/motivo.

## App (código)

| Control                                                                                                   | Archivo                                    | Estado | Última revisión |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------ | --------------- |
| Headers de seguridad (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, HSTS, Permissions-Policy) | `next.config.ts`                           | [x] ok | 2026-09-09      |
| `PASSWORD_REGEX` / `EMAIL_REGEX` / `getPasswordRequirements`                                              | `lib/validation.ts`                        | [x] ok | 2026-09-09      |
| Registro exige regex + email + submit deshabilitado + requisitos en vivo                                  | `app/login/page.tsx` (tab CREAR CUENTA)    | [x] ok | 2026-09-09      |
| Login solo valida email + password no vacío (sin `PASSWORD_REGEX`)                                        | `app/login/page.tsx` (tab INICIAR SESIÓN)  | [x] ok | 2026-09-09      |
| Reset password con misma validación/UI que registro                                                       | `app/reset-password/page.tsx`              | [x] ok | 2026-09-09      |
| Hardening de errores de auth (copy español, sin filtrar internos)                                         | `app/login/page.tsx` (`describeAuthError`) | [x] ok | 2026-09-09      |
| Refresco de sesión + redirect de logueado fuera de `/login`                                               | `proxy.ts`, `lib/supabase/proxy.ts`        | [x] ok | 2026-09-09      |
| Cap de nombre 1–10 chars alineado con política BD                                                         | `components/game-player.tsx:398`           | [x] ok | 2026-09-09      |

## BD (solo lectura — diagnóstico, un humano aplica)

| Control                                                                                                           | Estado                                 | Última revisión |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------- | --------------- |
| RLS habilitado en `public.games` (`relrowsecurity = true`)                                                        | [x] ok                                 | 2026-09-09      |
| RLS habilitado en `public.scores` (`relrowsecurity = true`)                                                       | [x] ok                                 | 2026-09-09      |
| Política `public insert scores` con `WITH CHECK` endurecido (`score >= 0 and char_length(name) between 1 and 10`) | [x] ok                                 | 2026-09-09      |
| Migración `harden_scores_insert_policy` aplicada                                                                  | [x] ok (20260825223446)                | 2026-09-09      |
| Advisor `rls_policy_always_true` para `scores`                                                                    | [x] resuelto (ya no aparece)           | 2026-09-09      |
| Advisor `auth_leaked_password_protection`                                                                         | [ ] pendiente (dashboard)              | 2026-09-09      |
| Minimum password length = 8 (dashboard)                                                                           | [ ] pendiente (no verificable por MCP) | 2026-09-09      |
| Max signup rate por IP (dashboard)                                                                                | [ ] pendiente (no verificable por MCP) | 2026-09-09      |

## Notas

- 2026-08-26: primera corrida del `security-auditor`. Todo el código de SPEC 12/13 ya estaba
  implementado y cumple; no se aplicó ningún fix de código. La BD ya está endurecida
  (migración `harden_scores_insert_policy`). Único hallazgo abierto: ajustes de dashboard de
  Supabase Auth (leaked password protection, longitud mínima, rate limit de signup), no
  aplicables por MCP.
- 2026-09-09: segunda corrida del `security-auditor`. Re-verificados los 8 controles de App y
  los 6 de BD: sin regresiones, todo sigue cumpliendo. `get_advisors(security)` reporta solo
  `auth_leaked_password_protection`. No se aplicó ningún fix de código. Sigue pendiente solo la
  config de dashboard de Supabase Auth (leaked password protection, longitud mínima, rate limit).
- `describeAuthError` en registro devuelve "Ese correo ya está registrado" (enumera existencia
de email). Es una decisión explícita de SPEC 12; no se cambia sin pedido del usuario. Con
"Confirm email" ON, Supabase suele devolver respuesta ofuscada, por lo que esa rama rara vez
se dispara. Registrado como consideración residual, no como problema.
</content>

</invoke>
