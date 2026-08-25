# SPEC 13 — Medidas de seguridad

**Estado:** Implemented
**Depende de:** SPEC 04 (integración base de Supabase), SPEC 06 (catálogo y scores en Supabase, RLS),
SPEC 12 (autenticación real con Supabase)
**Fecha:** 2026-08-25

**Objetivo:** Aplicar las medidas de `references/security/security-checklist.md` — headers de
seguridad en Next.js, endurecer la política INSERT de `scores`, re-asegurar RLS, y
validar/documentar la política de contraseñas y el rate-limit de signup de Supabase Auth.

## Alcance

**Dentro:**

- **Headers de seguridad** en `next.config.ts` vía `headers()` async sobre `source: "/(.*)"`:
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security:
max-age=63072000; includeSubDomains; preload`, `Permissions-Policy: camera=(), microphone=(),
geolocation=()`. Sin CSP (ver "Fuera de alcance").

Informacion sobre proxy aqui: https://nextjs.org/docs/app/getting-started/proxy

Ejemplo: proxy.ts

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// This function can be marked `async` if using `await` inside
export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL("/home", request.url));
}

// Alternatively, you can use a default export:
// export default function proxy(request: NextRequest) { ... }

export const config = {
  matcher: "/about/:path*",
};
```

- **Migración Supabase** (`mcp__supabase__apply_migration`):
  - `alter table public.games enable row level security;` y
    `alter table public.scores enable row level security;` (idempotente — ya están habilitadas hoy,
    se re-asegura por si una migración futura las desactiva sin querer).
  - Reemplazar la política `"public insert scores"` (`WITH CHECK (true)`, marcada por el advisor de
    Supabase `rls_policy_always_true`) por
    `with check (score >= 0 and char_length(name) between 1 and 10)`. Mantiene el guardado sin login
    (modo invitado de SPEC 12) pero rechaza filas con nombre vacío/absurdamente largo o score
    negativo directamente a nivel de política, no solo del `check` de columna ya existente.
- **Validación cliente por regex** en `app/login/page.tsx` y `app/reset-password/page.tsx`:
  - Un helper compartido (`lib/validation.ts`, nuevo) exporta:
    - `PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/` (mínimo 8 caracteres,
      al menos una minúscula, una mayúscula, un dígito y un símbolo).
    - `EMAIL_REGEX` con un patrón básico de formato de email (`algo@algo.algo`).
    - `getPasswordRequirements(password): { label: string; met: boolean }[]` — para pintar la lista
      de requisitos en vivo (longitud ≥8, minúscula, mayúscula, dígito, símbolo).
  - **Pestaña CREAR CUENTA** (`app/login/page.tsx`): mientras el usuario escribe la contraseña, se
    muestra bajo el campo la lista de requisitos con estado ✓/✗ (usa
    `getPasswordRequirements`). El botón de submit permanece deshabilitado hasta que
    `PASSWORD_REGEX.test(password)` y `EMAIL_REGEX.test(email)` sean verdaderos. Si por lo que sea
    se envía sin cumplir, se muestra un mensaje de error en español y **no** se llama a
    `supabase.auth.signUp`.
  - **Pestaña INICIAR SESIÓN**: solo se valida `EMAIL_REGEX` (formato) y que la contraseña no esté
    vacía — **sin** aplicar `PASSWORD_REGEX`, para no bloquear el login de cuentas creadas antes de
    este spec ni filtrar la política de contraseñas a un atacante que solo intenta iniciar sesión.
  - **`app/reset-password/page.tsx`**: misma validación y misma UI de requisitos en vivo que el
    registro, antes de llamar a `supabase.auth.updateUser({ password })`.
- **Documentar configuración manual del dashboard de Supabase** (no ejecutable por MCP, ver
  "Configuración manual" más abajo): longitud mínima de contraseña = 8, leaked password protection
  ON, límite de rate de signups por IP.
- Verificación: `mcp__supabase__get_advisors(security)` deja de reportar `rls_policy_always_true`
  para `scores`; los headers aparecen en la respuesta HTTP; el guardado de score como invitado
  (nombre 1–10 chars, score ≥ 0) sigue funcionando; la regex de contraseña rechaza/acepta los casos
  esperados; `npm run lint` + `npm run build` pasan.

**Fuera de alcance:**

- **Content-Security-Policy (CSP)**: alto riesgo de romper OAuth (Google/GitHub), el cliente de
  Supabase y estilos/scripts inline existentes; se difiere a un spec futuro si se decide abordarlo
  con las pruebas adecuadas.
- Atar `scores` a `user_id` o RLS por dueño: sigue fuera de alcance (igual que SPEC 12); el invitado
  sigue guardando con nombre libre.
- Aplicar por código los settings de Supabase Auth (longitud mínima, leaked password protection,
  rate limit de signup): son configuración de dashboard/Management API sin herramienta MCP
  disponible — se documentan como pasos manuales, igual que SPEC 12 documentó los providers OAuth.
- Captcha, verificación server-side de que un score es alcanzable, o cualquier anti-cheat más allá
  de lo ya aceptado como riesgo conocido en SPEC 06.
- Aplicar la regex de complejidad de contraseña en el flujo de **login** (solo en registro/reset).

## Modelo de datos

No se crean tablas ni columnas nuevas. Único cambio de esquema: el `WITH CHECK` de la política
`public insert scores` sobre `public.scores` pasa de `true` a
`score >= 0 and char_length(name) between 1 and 10`.

## Plan de implementación

1. **Leer convenciones Next 16** para `headers()` en `next.config.ts`
   (`node_modules/next/dist/docs/01-app/...`) antes de tocar el archivo.
2. **`next.config.ts`**: añadir `headers: async () => [...]` con los 5 headers listados, conservando
   `allowedDevOrigins`.
3. **Migración Supabase**: re-asegurar `ENABLE ROW LEVEL SECURITY` en `games`/`scores` y sustituir la
   política `"public insert scores"` por la versión endurecida (`drop policy` + `create policy` con
   el nuevo `with check`).
4. **`lib/validation.ts`** (nuevo): `PASSWORD_REGEX`, `EMAIL_REGEX`, `getPasswordRequirements`.
5. **`app/login/page.tsx`**: cablear la validación — registro exige `PASSWORD_REGEX` +
   `EMAIL_REGEX` con lista de requisitos en vivo y submit deshabilitado hasta cumplir; login exige
   solo `EMAIL_REGEX` + password no vacío. Mensajes de error en español, sin filtrar detalles
   internos, sin llamar a Supabase si la validación local falla.
6. **`app/reset-password/page.tsx`**: misma validación/UI de requisitos que el registro antes de
   `updateUser({ password })`.
7. **Proteccion de rutas con Proxy Next.js**
8. **Documentar en este spec** (sección "Configuración manual" abajo) los 3 ajustes pendientes del
   dashboard.
9. **Verificación**: `get_advisors(security)`, inspección de headers HTTP, prueba manual de guardado
   de score de invitado (caso válido e inválido), prueba manual de la regex de contraseña (casos de
   la lista de aceptación) + `npm run lint` + `npm run build`.

## Criterios de aceptación

- [ ] La respuesta HTTP de cualquier ruta incluye los 5 headers de seguridad listados arriba.
- [ ] `public insert scores` tiene `with check (score >= 0 and char_length(name) between 1 and 10)`;
      `mcp__supabase__get_advisors(security)` ya no reporta `rls_policy_always_true` para `scores`.
- [ ] RLS sigue habilitado (`relrowsecurity = true`) en `games` y `scores`.
- [ ] Un invitado con nombre de 1–10 caracteres y score ≥ 0 guarda su puntuación correctamente; un
      insert directo con `name` vacío o `score` negativo es rechazado por la política.
- [ ] En CREAR CUENTA, una contraseña que no cumpla ≥8 + minúscula + mayúscula + dígito + símbolo
      (p. ej. `abc`, `abcdefgh`, `Abcdefg1`) muestra el error en la UI y no llama a
      `supabase.auth.signUp`; una que sí cumple (p. ej. `Abcdef1!`) permite continuar.
- [ ] Mientras se escribe la contraseña en el registro, la UI muestra en vivo qué requisitos faltan,
      y el botón de CREAR CUENTA permanece deshabilitado hasta que contraseña y email sean válidos.
- [ ] `/reset-password` aplica la misma validación de contraseña antes de `updateUser`.
- [ ] INICIAR SESIÓN solo valida formato de email y que la contraseña no esté vacía — no aplica
      `PASSWORD_REGEX`, y sigue permitiendo iniciar sesión con contraseñas creadas antes de este spec.
- [ ] El spec documenta los 3 pasos manuales del dashboard de Supabase (longitud mínima, leaked
      password protection, rate limit de signup).
- [ ] `npm run lint` y `npm run build` pasan sin errores nuevos.

## Decisiones tomadas y descartadas

- **`WITH CHECK` endurecido en vez de `true`**: silencia el advisor de Supabase y añade validación
  mínima anti-basura sin romper el modo invitado de SPEC 12. Se descartó restringir el INSERT a
  `authenticated`, porque rompería el guardado de puntuación como invitado (fuera de alcance de esta
  spec cambiar ese comportamiento).
- **Headers: los 3 del checklist + HSTS + Permissions-Policy, sin CSP**: los 5 headers elegidos no
  tienen riesgo conocido de romper flujos existentes; CSP sí lo tiene (OAuth, Supabase, estilos
  inline) y se descartó para esta spec.
- **Settings de Auth documentados como manuales, no aplicados por código**: no existe herramienta MCP
  para longitud mínima/leaked password protection/rate limit de signup; se sigue el mismo patrón que
  SPEC 12 usó para los providers OAuth (documentar como prerrequisito, no bloquear el spec por ello).
- **Regex de complejidad de contraseña solo en registro/reset, no en login** (decisión explícita del
  usuario): aplicarla también en login bloquearía a usuarios con contraseñas creadas antes de este
  spec y filtraría la política de contraseñas a quien solo intenta iniciar sesión. Es una capa de
  UX/defensa en profundidad en el cliente; no sustituye la política real que vive en el dashboard de
  Supabase Auth.
- **Feedback en vivo de requisitos + submit deshabilitado** (decisión explícita del usuario): se
  prioriza no dejar que el usuario intente registrarse con una contraseña que ya sabemos que Supabase
  rechazará (o que, aunque Supabase la aceptara, no cumple nuestra política más estricta).

## Configuración manual del proyecto Supabase (prerrequisito)

Se hace a mano en el [dashboard de Supabase](https://supabase.com/dashboard) del proyecto
`skjiaowautazmyrnrepo` (Authentication → Sign In / Providers y Authentication → Rate Limits). El
código de esta spec no depende de que estos pasos ya estén hechos, pero la protección real solo
existe una vez completados:

- [ ] **Minimum password length = 8** — Authentication → Sign In / Providers → Email: ajustar la
      longitud mínima de contraseña a 8 (si no lo está ya).
- [ ] **Leaked password protection = ON** — Authentication → Sign In / Providers → Password:
      habilitar la verificación contra HaveIBeenPwned.org (hoy deshabilitado según
      `mcp__supabase__get_advisors`).
- [ ] **Max signup rate por IP** — Authentication → Rate Limits: ajustar el límite de signups por IP
      para mitigar registro masivo automatizado (anti-bot).

## Riesgos identificados

- `Strict-Transport-Security` con `preload` fuerza HTTPS de forma persistente en el navegador una vez
  visitado — correcto en producción, pero solo tiene efecto bajo HTTPS real; no debe confundirse con
  un requisito para desarrollo local por HTTP.
- La validación de contraseña en el cliente (regex + UI) es una capa de UX y defensa en profundidad;
  no sustituye la política real de Supabase Auth (dashboard). Sin completar la configuración manual,
  la Management API u otros clientes podrían seguir creando contraseñas débiles.
- El `char_length(name) between 1 and 10` de la política debe mantenerse alineado con el cap de 10
  caracteres del campo de nombre en cliente (`components/game-player.tsx:398`); si ese cap cambia en
  el futuro, la política de la base de datos debe actualizarse a la par o empezará a rechazar scores
  válidos.
