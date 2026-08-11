# 04 — Integración base de Supabase

- **Estado:** Implemented
- **Depende de:** —
- **Fecha:** 2026-08-11
- **Objetivo:** Conectar la aplicación Next.js al proyecto de Supabase ya existente (`skjiaowautazmyrnrepo`, configurado en `.mcp.json`) instalando y configurando los clientes oficiales (`@supabase/ssr` + `@supabase/supabase-js`) para navegador, Server Components/Route Handlers y proxy, sin migrar todavía ninguna funcionalidad real (auth, puntuaciones, leaderboard) a Supabase.

## Alcance

### Dentro de alcance

- Instalar `@supabase/supabase-js` y `@supabase/ssr`, agregados a `package.json`.
- Variables de entorno del proyecto Supabase:
  - `NEXT_PUBLIC_SUPABASE_URL` — URL del proyecto.
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — clave pública (publishable key), segura para exponerse en el cliente.
  - Ambas obtenidas durante la implementación vía las herramientas MCP `get_project_url` y `get_publishable_keys` del proyecto `skjiaowautazmyrnrepo`, no inventadas ni pedidas al usuario manualmente.
  - `.env.local.example` documenta ambas variables (sin valores reales sensibles, aunque la URL y la publishable key no son secretas por diseño de Supabase). `.env.local` con los valores reales del proyecto se crea localmente; `.env*` ya está en `.gitignore`, por lo que no se commitea.
- `lib/supabase/client.ts`: helper `createClient()` que crea un cliente de Supabase para **navegador** (Client Components) usando `createBrowserClient` de `@supabase/ssr`.
- `lib/supabase/server.ts`: helper async `createClient()` que crea un cliente de Supabase para **servidor** (Server Components, Route Handlers) usando `createServerClient` de `@supabase/ssr`, integrado con `cookies()` de `next/headers` según las convenciones de Next.js 16.
- `lib/supabase/middleware.ts`: helper `updateSession(request)` que refresca la sesión de Supabase (lee/escribe cookies) en cada request, siguiendo el patrón estándar de `@supabase/ssr` para Next.js.
- `proxy.ts` en la raíz del proyecto (Next.js 16 renombró `middleware.ts` a `proxy.ts` — confirmado en `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`): exporta la función `proxy` que llama a `updateSession`, con `matcher` que excluye assets estáticos (`_next/static`, `_next/image`, `favicon.ico`, archivos con extensión) para no interferir con ellos.
- Endpoint de diagnóstico `app/api/health/supabase/route.ts` (Route Handler `GET`): usa el cliente de servidor para hacer una llamada real a Supabase (`supabase.auth.getUser()`, que golpea el servicio de Auth del proyecto y no requiere tablas propias) y responde:
  - `200 { ok: true }` si Supabase respondió (con o sin usuario autenticado).
  - `500 { ok: false, error: "..." }` con mensaje genérico si la llamada falla (proyecto inalcanzable, credenciales inválidas), sin exponer detalles internos ni claves.
  - Queda en el repo como utilidad de diagnóstico permanente, no se elimina después de verificar.
- Verificación manual end-to-end: con `.env.local` apuntando al proyecto real, `GET /api/health/supabase` en desarrollo debe responder `200 { ok: true }`.

### Fuera de alcance

- Migrar el login/registro/logout mock (`context/session-context.tsx`, `lib/session.ts`, `av_user` en `localStorage`) a Supabase Auth real. Se define en un spec futuro.
- Migrar el guardado de puntuaciones (`av_scores`) a una tabla de Supabase.
- Hacer real el Salón de la Fama (`seededScores` sigue siendo data falsa).
- Crear cualquier tabla, esquema, migración o política RLS en la base de datos del proyecto Supabase — este spec solo conecta la app al proyecto existente, no modela datos todavía.
- OAuth real con Google/GitHub (los botones en `/login` siguen siendo decorativos).
- Sesiones anónimas (`signInAnonymously`) para el modo invitado.
- Cualquier cambio visual o de UX en las pantallas existentes.

## Modelo de datos

Este spec no introduce modelo de datos ni tablas — es únicamente configuración de conexión (clientes + variables de entorno). El único "dato" nuevo es la configuración de entorno:

```
NEXT_PUBLIC_SUPABASE_URL=https://skjiaowautazmyrnrepo.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key del proyecto>
```

## Plan de implementación

1. Leer `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` (ya revisado: Next 16 usa `proxy.ts` con función exportada `proxy`, no `middleware.ts`/`middleware`) y `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` para Route Handlers, para confirmar convenciones antes de escribir código.
2. Usar las herramientas MCP `get_project_url` y `get_publishable_keys` sobre el proyecto `skjiaowautazmyrnrepo` para obtener la URL y la publishable key reales.
3. Instalar `@supabase/supabase-js` y `@supabase/ssr` (`npm install`), quedando reflejados en `package.json`.
4. Crear `.env.local.example` con `NEXT_PUBLIC_SUPABASE_URL=` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` documentados; crear/actualizar `.env.local` (no versionado) con los valores reales obtenidos en el paso 2.
5. Crear `lib/supabase/client.ts` con el cliente de navegador (`createBrowserClient`).
6. Crear `lib/supabase/server.ts` con el cliente de servidor async (`createServerClient` + `cookies()` de `next/headers`), manejando el caso de que `set` falle en Server Components (try/catch documentado, patrón estándar de `@supabase/ssr`).
7. Crear `lib/supabase/middleware.ts` con `updateSession(request)`.
8. Crear `proxy.ts` en la raíz que invoca `updateSession` y define el `matcher` de exclusión de assets estáticos.
9. Crear `app/api/health/supabase/route.ts` con la llamada de diagnóstico a `supabase.auth.getUser()` y las respuestas `200`/`500` descritas en el alcance.
10. Verificación manual: levantar `npm run dev`, visitar/curlear `/api/health/supabase` y confirmar `200 { ok: true }` contra el proyecto real.
11. Ejecutar `npm run lint` y corregir lo que reporte.

## Criterios de aceptación

- [x] `@supabase/supabase-js` y `@supabase/ssr` están en las dependencias de `package.json`.
- [x] `.env.local.example` documenta `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- [x] `.env.local` existe localmente con los valores reales del proyecto `skjiaowautazmyrnrepo` y no aparece en `git status` (sigue ignorado).
- [x] `lib/supabase/client.ts` exporta un helper que crea un cliente de Supabase de navegador.
- [x] `lib/supabase/server.ts` exporta un helper async que crea un cliente de Supabase de servidor integrado con las cookies de Next.js.
- [x] `proxy.ts` existe en la raíz, refresca la sesión de Supabase en cada request y excluye assets estáticos vía `matcher`.
- [x] `GET /api/health/supabase` responde `200 { ok: true }` cuando el proyecto Supabase es alcanzable, y `500 { ok: false, ... }` sin filtrar detalles internos si falla.
- [x] Ninguna pantalla existente (`/login`, `/leaderboard`, juegos) cambia de comportamiento: la sesión y las puntuaciones siguen siendo mock/`localStorage`.
- [x] `npm run lint` pasa sin errores nuevos.

## Decisiones tomadas y descartadas

- **`@supabase/ssr` en vez de solo `@supabase/supabase-js`**: se necesita manejo de cookies de sesión entre navegador y servidor para Server Components/Route Handlers en App Router; un único cliente de navegador no sirve para SSR ni para el futuro spec de auth real.
- **`proxy.ts` en vez de `middleware.ts`**: Next.js 16 deprecó y renombró `middleware` a `proxy` (confirmado en la documentación local del repo). Usar `middleware.ts` sería seguir una convención ya obsoleta en esta versión.
- **`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en vez de `NEXT_PUBLIC_SUPABASE_ANON_KEY`**: el MCP de Supabase expone `get_publishable_keys` (no `get_anon_key`), reflejando el sistema de API keys vigente del proyecto; se usa la terminología actual en vez de la legada `anon key`.
- **Sin tablas ni migraciones en este spec**: el alcance se limita a la conexión; modelar datos (usuarios, puntuaciones) se decide en los specs que migren auth y scores, para no inventar un esquema sin haber definido antes cómo se usará.
- **Endpoint de diagnóstico permanente**: se decidió (a pedido del usuario) dejar `/api/health/supabase` en el repo como utilidad reusable, en vez de una verificación ad-hoc descartable.
- **Credenciales obtenidas vía MCP, no pedidas al usuario**: el MCP de Supabase ya está configurado apuntando al proyecto correcto (`skjiaowautazmyrnrepo`), así que `get_project_url`/`get_publishable_keys` son la fuente de verdad durante la implementación.

## Riesgos identificados

- Si el proyecto Supabase tiene restricciones de red o está pausado (planes free se pausan por inactividad), `/api/health/supabase` fallará con `500` aunque la integración esté bien configurada; no es un bug de este spec pero puede confundir la verificación manual.
- El `matcher` de `proxy.ts` debe excluir assets estáticos correctamente — un matcher mal configurado puede degradar el rendimiento (proxy corriendo en cada request de imagen/CSS) o, peor, interferir con rutas que no deberían pasar por Supabase.
