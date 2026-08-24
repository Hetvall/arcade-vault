# SPEC 12 — Autenticación real con Supabase (registro, login, logout, sesión)

**Estado:** Approved
**Depende de:** SPEC 04 (integración base de Supabase), SPEC 06 (catálogo y scores en Supabase)
**Fecha:** 2026-08-24

**Objetivo:** Reemplazar la sesión mock de `localStorage` por Supabase Auth real —registro y login
con email+contraseña y con OAuth (Google/GitHub), confirmación de email, reset de contraseña y
logout— manteniendo el alias arcade (`user.name`) y sin cambiar el esquema de `scores`.

## Alcance

**Dentro:**

- Migrar `context/session-context.tsx` a Supabase Auth: `login`/`logout` reales vía
  `supabase.auth`, `user` derivado de la sesión de Supabase (no de `av_user`), suscripción a
  `onAuthStateChange` para reflejar cambios de sesión y `getUser()` inicial al montar.
- `lib/session.ts`: `SessionUser` deja de leer `localStorage`; se deriva de un `User` de Supabase
  (helper `userToSession(user)` que calcula `name` desde `user_metadata.username` o, si no existe
  —caso OAuth— desde el nombre del proveedor normalizado a mayúsculas ≤10 chars).
- Rehacer `/login` (`app/login/page.tsx`) con las dos pestañas existentes (INICIAR SESIÓN / CREAR
  CUENTA) conectadas a Supabase:
  - **Registro** (email + contraseña + alias): `supabase.auth.signUp` con
    `options.data.username` y `emailRedirectTo` al callback. Tras registrar, estado "revisa tu
    correo para confirmar".
  - **Login** (email + contraseña): `supabase.auth.signInWithPassword`; en éxito redirige a
    `/games`.
  - **OAuth**: botones Google/GitHub → `supabase.auth.signInWithOAuth({ provider,
options.redirectTo })`.
  - Enlace "¿Olvidaste tu contraseña?" → dispara reset.
  - Errores de auth mostrados en la tarjeta (credenciales inválidas, email ya registrado, email
    no confirmado, etc.) con copy en español, sin filtrar detalles internos.
  - Se conserva "JUGAR COMO INVITADO" (sigue sin crear sesión).
- **Ruta de callback** `app/auth/callback/route.ts` (Route Handler `GET`): intercambia el `code`
  por sesión (`supabase.auth.exchangeCodeForSession`) para confirmación de email y para OAuth, y
  redirige a `/games` (o a `?next=`), o a `/login?error=...` si falla.
- **Reset de contraseña:**
  - Disparo desde `/login`: `supabase.auth.resetPasswordForEmail(email, { redirectTo })`.
  - Página `app/reset-password/page.tsx`: recibe la sesión de recuperación (vía callback) y permite
    fijar la nueva contraseña con `supabase.auth.updateUser({ password })`.
- `components/nav.tsx`: `logout` real (`supabase.auth.signOut`) y el alias mostrado sale de la
  sesión real (sin tocar el markup).
- `components/game-player.tsx`: cuando hay usuario logueado, prellenar **y bloquear** el campo de
  nombre con `user.name`; el invitado sigue tecleando nombre libre.
- Documentar en el spec (no ejecutar) la **config manual del proyecto Supabase**: habilitar
  confirmación de email, providers Google/GitHub con sus client id/secret, y las Redirect URLs
  (`/auth/callback`, `/reset-password`) para dev y prod.
- Verificación manual end-to-end de cada flujo + `npm run lint` + `npm run build`.

**Fuera de alcance:**

- Cambiar el esquema de `scores` o añadir `user_id`/RLS por usuario: las puntuaciones siguen por
  `name`. El invitado sigue pudiendo guardar con nombre libre.
- Sesiones anónimas (`signInAnonymously`) para el modo invitado (el invitado no crea sesión).
- Roles/permisos, panel de administración de usuarios, verificación anti-cheat de scores.
- Edición de perfil (cambiar alias/avatar) más allá del reset de contraseña.
- Proveedores OAuth distintos de Google y GitHub.
- Crear las apps OAuth en Google/GitHub y pegar secretos en el dashboard (lo hace el usuario; el
  spec solo lo documenta como prerrequisito).

## Modelo de datos

No se crean tablas ni columnas nuevas. Los "datos" de identidad viven en **Supabase Auth**:

- `auth.users` (gestionada por Supabase): email, contraseña hasheada, estado de confirmación.
- `user_metadata.username` — alias arcade elegido en el registro por email. Para OAuth no se
  setea; el alias se deriva en cliente del nombre del proveedor.

`SessionUser` sigue siendo `{ name: string }`; cambia solo su **origen** (sesión de Supabase en vez
de `localStorage`). La tabla `scores` no cambia.

## Plan de implementación

1. **Leer convenciones Next 16 + Supabase Auth SSR** antes de escribir código: los docs locales de
   Route Handlers (`node_modules/next/dist/docs/01-app/.../route.md`) y la guía oficial de
   `@supabase/ssr` para el patrón de `exchangeCodeForSession` en el callback. Confirmar que
   `proxy.ts` (SPEC 04) ya refresca la sesión en cada request (no hay que reescribirlo).
2. **`lib/session.ts`**: añadir `userToSession(user: User | null): SessionUser | null` que derive
   `name` de `user_metadata.username` o, si falta, del nombre del proveedor normalizado
   (mayúsculas, ≤10 chars). Quitar la lectura/escritura de `av_user`.
3. **`context/session-context.tsx`**: inicializar con `supabase.auth.getUser()`, suscribirse a
   `onAuthStateChange`, y reimplementar `login` (mantener firma para no romper llamadas, pero
   apoyada en Supabase) y `logout` (`signOut`). El estado `user` refleja la sesión real.
4. **`app/login/page.tsx`**: cablear las pestañas a `signUp` / `signInWithPassword`, los botones a
   `signInWithOAuth`, el enlace de reset a `resetPasswordForEmail`, con manejo de errores y el
   estado "revisa tu correo" tras registro. Conservar "jugar como invitado".
5. **`app/auth/callback/route.ts`**: Route Handler `GET` que hace `exchangeCodeForSession` y
   redirige a `/games` (o `?next=`) o a `/login?error=...`.
6. **`app/reset-password/page.tsx`**: formulario de nueva contraseña con `updateUser({ password })`
   sobre la sesión de recuperación, y redirección a `/login` o `/games` al terminar.
7. **`components/nav.tsx`**: `logout` real; alias desde la sesión.
8. **`components/game-player.tsx`**: prellenar y bloquear el nombre con `user.name` para logueados;
   invitado sin cambios.
9. **Documentar la config manual de Supabase** (checklist en el spec): confirmación de email ON,
   providers Google/GitHub, Redirect URLs de dev/prod. No se ejecuta desde el código.
10. **Verificación manual** de los flujos (ver criterios) + `npm run lint` + `npm run build`.

## Criterios de aceptación

- [ ] Registro con email+contraseña+alias crea el usuario, envía email de confirmación y muestra el
      estado "revisa tu correo"; el alias queda en `user_metadata.username`.
- [ ] Al abrir el enlace de confirmación, el callback crea sesión y el usuario queda logueado.
- [ ] Login con email+contraseña de un usuario confirmado inicia sesión y redirige a `/games`.
- [ ] Login con Google y con GitHub completa OAuth vía el callback y deja sesión activa; `user.name`
      se deriva del perfil del proveedor (mayúsculas, ≤10 chars).
- [ ] "¿Olvidaste tu contraseña?" envía el email de reset; la página `/reset-password` permite fijar
      una nueva contraseña y volver a entrar con ella.
- [ ] El nav muestra el alias real y "cerrar sesión" ejecuta `signOut` y limpia la sesión (deja de
      mostrar el usuario).
- [ ] En un juego, con usuario logueado el nombre para guardar puntuación viene prellenado y
      bloqueado con su alias; como invitado se puede teclear un nombre libre.
- [ ] La sesión persiste entre recargas (cookies gestionadas por `@supabase/ssr`/`proxy.ts`), sin
      depender de `av_user` en `localStorage`.
- [ ] No queda ninguna referencia funcional a `av_user`/`setStoredUser` para la sesión.
- [ ] La tabla `scores` no cambió de esquema; guardar/leer puntuaciones sigue funcionando igual.
- [ ] `npm run lint` y `npm run build` pasan sin errores nuevos.

## Decisiones tomadas y descartadas

- **Alias en `user_metadata.username`** (no una tabla `profiles`): preserva `user.name` con mínima
  infraestructura y sin migraciones; se descartó `profiles` por sobredimensionar el alcance y
  derivar del email por feo/colisiones.
- **OAuth Google/GitHub además de email+contraseña**: los botones dejan de ser decorativos; el
  alias OAuth se deriva del perfil del proveedor (el usuario OAuth no teclea alias).
- **Con confirmación de email** (no signup instantáneo): se prioriza validar el correo aunque sume
  el estado "revisa tu correo" y la ruta callback.
- **`scores` sin `user_id` y modo invitado con nombre libre**: se mantiene el comportamiento actual
  de guardado; atar scores a usuarios (RLS por dueño) queda para un spec futuro.
- **Reset de contraseña incluido**: reutiliza el mecanismo de email/callback ya necesario para la
  confirmación.
- **Credenciales OAuth las configura el usuario**: el código (botones + callback) es independiente
  de los secretos, así que el spec no se bloquea por ellas; se documentan como prerrequisito manual.

## Riesgos identificados

- OAuth no funcionará hasta que el usuario cree las apps en Google/GitHub y configure providers +
  Redirect URLs en el dashboard de Supabase; el spec debe dejar esa dependencia muy explícita para
  no confundir la verificación.
- Redirect URLs mal configuradas (dev vs prod) rompen callback de OAuth/confirmación/reset — punto
  frágil típico; documentar ambas.
- El cambio en `session-context.tsx` toca un provider usado por nav, game-player y hall-of-fame:
  hay que mantener la firma de `useSession()` para no romper esos consumidores.
- La confirmación de email introduce un estado "registrado pero sin sesión" que la UI debe manejar
  (no asumir login inmediato tras `signUp`).
