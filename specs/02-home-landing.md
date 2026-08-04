# 02 — Home Landing

- **Estado:** Draft
- **Depende de:** SPEC 01
- **Fecha:** 2026-08-04
- **Objetivo:** Convertir `/` en la landing page Home (portada de `references/templates/home-about/home.jsx`) y mover la Biblioteca actual a `/games`, actualizando Nav y todos los enlaces internos afectados.

## Alcance

### Dentro de alcance

- Nueva ruta `/` (`app/page.tsx`) con la landing Home portada de `references/templates/home-about/home.jsx`:
  - Hero con eyebrow, título en 3 líneas, subtítulo, CTAs ("EXPLORAR JUEGOS" → `/games`, "CREAR CUENTA" → `/login`) y siluetas pixeladas flotantes decorativas (`FloatingSilhouettes`).
  - Sección "¿POR QUÉ ARCADE VAULT?" con 4 feature cards (iconos pixel SVG inline vía `FeatureIcon`).
  - Sección "JUEGOS DISPONIBLES AHORA": rail de 6 mini-cards con datos reales de `GAMES.slice(0, 6)` de `lib/games.ts`, cada una navega a `/game/[id]`; botón "VER TODOS LOS JUEGOS →" hacia `/games`.
  - Sección de stats (3 bloques: juegos, partidas, ranking) con contenido fijo del template.
  - Sección "ACTIVIDAD EN VIVO": ticker de últimas puntuaciones + top 5 jugadores de hoy, con los datos de ejemplo **hardcodeados** del template (no derivados de `seededScores`/`lib/games.ts`); enlace "VER SALÓN →" hacia `/leaderboard`.
  - Sección de precios (plan único gratis) + FAQ, contenido fijo del template; CTA "EMPEZAR GRATIS →" hacia `/login`.
  - CTA final ("¿LISTO PARA JUGAR?") hacia `/games`.
  - Animaciones de aparición al hacer scroll (`useReveal` / `IntersectionObserver` + clase `.reveal`/`.in`), portadas del template.
- Mover la Biblioteca actual (contenido de `app/page.tsx`) a `app/games/page.tsx`, sin cambios de comportamiento (búsqueda, chips de categoría, grid, estado vacío).
- Actualizar `components/nav.tsx`:
  - Agregar enlace "Inicio" → `/`.
  - Cambiar el enlace "Biblioteca" para que apunte a `/games` (en vez de `/`); `isActive` para biblioteca pasa a chequear `/games` y `/game/`.
  - El logo sigue apuntando a `/` (ahora Home en vez de Biblioteca).
  - Reactivar el panel/menú móvil (hoy comentado): mismos enlaces que desktop (Inicio, Biblioteca, Salón de la Fama, sesión) más el botón hamburguesa que lo abre/cierra.
- Actualizar todos los enlaces internos que hoy asumen que `/` es la Biblioteca, para que apunten a `/games`:
  - `app/game/[id]/page.tsx`: botón "VOLVER" (`Link href="/"`) → `/games`.
  - `components/game-player.tsx`: botón "SALIR" (`router.push("/")`) → `/games`.
  - `app/leaderboard/page.tsx`: botón "VER TODOS LOS JUEGOS" (`router.push("/")`) → `/games`.
  - `app/login/page.tsx`: redirect tras login/registro/invitado (`router.push("/")`) → `/games`, consistente con `auth.jsx` del template (`navigate({ name: "biblioteca" })`).
- Portar a `app/globals.css` las clases CSS necesarias para Home desde `references/templates/home-about/styles.css`: `.home*`, `.feature-*`, `.ft-*`, `.mini-*`, `.stat-block`/`.stat-n`/`.stat-u`/`.stat-s`, `.activity-*`, `.tick-*`, `.top-*`, `.tp-*`, `.pricing-*`, `.price-*`, `.faq-*`, `.reveal`/`.in`, `@keyframes float` y demás animaciones referenciadas por Home.
- Responsive (mobile y desktop) de la landing, igual que el resto del sitio.
- Copy en español, igual que en el template.

### Fuera de alcance

- Página "Acerca de" (`about.jsx`) y su formulario de contacto — se define en un spec futuro.
- Cualquier cambio a `/game/[id]`, `/game/[id]/play`, `/login`, `/leaderboard` más allá de actualizar los enlaces/redirects que apuntaban a `/` y ahora apuntan a `/games`.
- Hacer "real" la sección "Actividad en vivo" (no se conecta a `seededScores` ni a puntuaciones guardadas en `localStorage`).
- Cambios al modelo de datos (`lib/games.ts`, `lib/session.ts`) — Home consume `GAMES` tal cual existe hoy.
- SEO/metadata adicional más allá de lo ya configurado en `app/layout.tsx`.

## Modelo de datos

No se introduce ningún dato nuevo. Home consume `GAMES` de `lib/games.ts` (ya existente) para el rail de 6 juegos; el resto del contenido (stats, actividad, precios, FAQ) es texto/JSX estático portado del template, sin tipos ni estructuras nuevas.

## Plan de implementación

1. Leer `node_modules/next/dist/docs/01-app/` en lo referente a rutas y Client Components si hace falta repasar convenciones de Next 16 antes de mover archivos de ruta.
2. Mover el contenido actual de `app/page.tsx` a `app/games/page.tsx` sin modificar su lógica.
3. Portar las clases CSS de Home (`.home*`, `.feature-*`, `.mini-*`, stats, `.activity-*`, `.tick-*`, `.top-*`, `.pricing-*`, `.price-*`, `.faq-*`, `.reveal`) desde `references/templates/home-about/styles.css` a `app/globals.css`, apoyándose en `/frontend-design` para resolver equivalentes en Tailwind v4 donde aplique.
4. Crear `app/page.tsx` como Client Component con la nueva landing Home: hero, `FloatingSilhouettes`, features, rail de juegos (`GAMES.slice(0, 6)`), stats, actividad en vivo (datos fijos), precios/FAQ, CTA final; usar `next/link`/`useRouter` para las navegaciones (`/games`, `/login`, `/game/[id]`, `/leaderboard`).
5. Portar el hook de reveal-on-scroll (`useReveal`/`IntersectionObserver`) como utilidad de cliente reutilizada en `app/page.tsx`.
6. Actualizar `components/nav.tsx`: agregar enlace "Inicio" (`/`), cambiar "Biblioteca" a `/games`, ajustar `isActive`, y reactivar el panel móvil (descomentar/reconstruir con los mismos 4 enlaces + sesión).
7. Actualizar los enlaces/redirects que asumían `/` como Biblioteca: `app/game/[id]/page.tsx` (botón "VOLVER"), `components/game-player.tsx` (botón "SALIR"), `app/leaderboard/page.tsx` (botón "VER TODOS LOS JUEGOS"), `app/login/page.tsx` (redirect post-login/registro/invitado) — todos a `/games`.
8. Pasada de responsive de Home (mobile ≤480px, desktop ≥1280px) y del menú móvil reactivado.
9. Pasada final de consistencia visual contra `references/templates/home-about/` usando `/frontend-design`.
10. Ejecutar `npm run lint` y corregir lo que reporte.

## Criterios de aceptación

- [ ] `/` renderiza la landing Home (hero, features, rail de juegos, stats, actividad en vivo, precios/FAQ, CTA final) y `/games` renderiza la Biblioteca (búsqueda + filtro por categoría) que antes vivía en `/`.
- [ ] El Nav muestra "Inicio" (→ `/`), "Biblioteca" (→ `/games`) y "Salón de la Fama" (→ `/leaderboard`), con el estado activo correcto en cada ruta (`/`, `/games` + `/game/[id]`, `/leaderboard`).
- [ ] El menú móvil (hamburguesa) abre, cierra y navega a las mismas rutas que el nav de escritorio.
- [ ] En Home, "EXPLORAR JUEGOS" y "VER TODOS LOS JUEGOS →" navegan a `/games`; "CREAR CUENTA" y "EMPEZAR GRATIS →" navegan a `/login`; el CTA final navega a `/games`; "VER SALÓN →" navega a `/leaderboard`.
- [ ] El rail "JUEGOS DISPONIBLES AHORA" muestra 6 juegos reales de `GAMES` y cada mini-card navega a `/game/[id]` del juego correspondiente.
- [ ] Las secciones de features, stats, actividad en vivo y precios/FAQ se ven con el contenido del template (sin necesidad de que "actividad en vivo" sea data real).
- [ ] Las animaciones de aparición al hacer scroll (`.reveal`) funcionan en Home.
- [ ] "VOLVER" en el Detalle, "SALIR" en el Reproductor, y el redirect tras login/registro/invitado en `/login`, navegan a `/games` (no a `/`).
- [ ] El tema visual de Home coincide con `references/templates/home-about/styles.css`.
- [ ] El layout es responsive: verificado en un viewport móvil (≤480px) y uno de escritorio (≥1280px).
- [ ] `npm run lint` pasa sin errores.

## Decisiones tomadas y descartadas

- **Home pasa a vivir en `/` y la Biblioteca existente se mueve a `/games`** (no `/biblioteca`), decisión explícita del usuario — mantiene la convención de rutas técnicas en inglés ya usada (`/login`, `/leaderboard`).
- **La página "Acerca de" queda explícitamente fuera de este spec** y se define en uno futuro; por eso el Nav de este spec no agrega un enlace "Acerca de".
- **Todos los flujos que antes asumían `/` como Biblioteca (volver del Detalle, salir del Reproductor, redirect post-login) ahora apuntan a `/games`**, no a `/` — coherente con el comportamiento original del template (`auth.jsx` navega a `biblioteca` tras login, no a `home`), no una preferencia nueva.
- **La sección "Actividad en vivo" de Home usa los datos de ejemplo fijos del template**, sin derivarlos de `seededScores` — se trata de contenido decorativo de la landing, no una vista funcional del ranking (esa función la sigue cumpliendo `/leaderboard`).
- **Se reactiva el menú móvil de `components/nav.tsx`** (hoy comentado) como parte de este spec, ya que sin él Home y `/games` quedarían inaccesibles desde la navegación en mobile.
