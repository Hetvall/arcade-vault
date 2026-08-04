# 01 — MVP Pantallas Visuales

- **Estado:** Implemented
- **Depende de:** —
- **Fecha:** 2026-08-04
- **Objetivo:** Implementar la interfaz visual completa de las 5 pantallas de Arcade Vault (Biblioteca, Detalle de juego, Reproductor simulado, Autenticación y Salón de la Fama) en Next.js App Router con Tailwind, replicando el diseño y las interacciones de `references/templates/` sin implementar lógica real de ningún juego.

## Alcance

### Dentro de alcance

- Las 5 pantallas del prototipo portadas a rutas reales del App Router:
  - `/` — Biblioteca (`biblioteca.jsx`)
  - `/game/[id]` — Detalle de juego (`detalle.jsx`)
  - `/game/[id]/play` — Reproductor (`reproductor.jsx`)
  - `/login` — Autenticación (`auth.jsx`)
  - `/leaderboard` — Salón de la Fama (`salon.jsx`)
- Nav compartido (`nav.jsx`) con enlaces desktop, menú móvil tipo hamburguesa, contador de créditos estático y botón de sesión, integrado en `app/layout.tsx`.
- Footer compartido (copyright + versión), igual que en `app.jsx`.
- Catálogo mock de juegos, categorías, jugadores y generador determinista de leaderboard (`data.jsx`) portado a `lib/`.
- Sesión mock (login, registro, invitado, logout) persistida en `localStorage`, sin backend ni validación real de credenciales.
- Guardado de puntuaciones del Reproductor persistido en `localStorage`.
- Búsqueda y filtro por categoría funcionando en cliente sobre el catálogo mock (Biblioteca).
- Simulación completa de partida en el Reproductor: puntuación que sube sola, HUD (jugador/puntuación/vidas/nivel), pausa, subida de nivel, modal de fin de juego con captura de iniciales y guardado de puntuación, reinicio de partida. Todo esto es estado/UI de cliente, no motor de juego.
- Salón de la Fama: tabs por juego, podio (top 3), tabla completa vía `seededScores`, y fila "TU MEJOR MARCA" cuando el usuario tiene sesión **y** una puntuación propia guardada para ese juego.
- Botones sociales (Google/GitHub) decorativos, sin OAuth real.
- Diseño responsive (mobile y desktop) y tema visual neón oscuro fijo, traducido de `styles.css` a Tailwind v4.
- Copy en español, igual que en los templates.

### Fuera de alcance

- Lógica o motor real de cualquiera de los 8 juegos del catálogo (canvas, colisiones, controles, física). El Reproductor es una simulación de UI, no un juego jugable.
- Backend o autenticación real (sin servidor de validación, sin base de datos, sin cuentas reales).
- OAuth real para Google/GitHub.
- Sistema de créditos/monedas funcional (el contador es solo visual).
- Sincronización de puntuaciones entre dispositivos/usuarios (todo vive en `localStorage` del navegador).
- Modo claro o selector de tema.
- Trabajo de SEO/metadata más allá de lo ya configurado en `app/layout.tsx`.
- Configuración de test runner (no existe uno en el repo).

## Modelo de datos

Todo el modelo es mock/cliente, sin base de datos.

**`lib/games.ts`** (portado de `data.jsx`):

```ts
interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string; // clase de fondo (cover-bricks, cover-tetro, ...)
  color: "cyan" | "magenta" | "green" | "yellow";
  best: number;
  plays: string;
}

const GAMES: Game[];
const CATS: string[]; // ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"]
const PLAYERS: string[];

interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // dd/mm/yyyy
}

function seededScores(seed: number, count?: number): ScoreRow[];
```

**`lib/session.ts`** (nuevo, reemplaza el estado en `app.jsx` del template):

```ts
interface SessionUser {
  name: string;
}

interface SavedScore {
  game: string; // Game.id
  score: number;
  name: string; // iniciales capturadas en el modal de fin de juego
  at: number; // Date.now()
}

// localStorage keys: "av_user", "av_scores"
function getStoredUser(): SessionUser | null;
function setStoredUser(user: SessionUser | null): void;
function getStoredScores(): SavedScore[];
function addStoredScore(entry: Omit<SavedScore, "at">): void;
function bestScoreFor(
  game: string,
  playerName: string,
  scores: SavedScore[],
): SavedScore | null;
```

**`context/session-context.tsx`** (Client Component, provee `user`, `login`, `logout`, `playAsGuest`, `saveScore`, `scores` a toda la app vía React Context; sincroniza con `lib/session.ts` en el `useEffect` inicial y en cada cambio).

## Plan de implementación

1. Leer las guías relevantes de `node_modules/next/dist/docs/01-app/` (layouts, rutas dinámicas, Client vs Server Components, `notFound`) antes de escribir cualquier ruta — Next 16 difiere de convenciones previas.
2. Traducir las variables/efectos de `styles.css` (colores neón, tipografías pixel/mono, glow, CRT) a tokens de Tailwind v4 en `app/globals.css` (`@theme`), apoyándose en el skill `/frontend-design`.
3. Crear `lib/games.ts` con `GAMES`, `CATS`, `PLAYERS` y `seededScores`, tipados, portados de `data.jsx`.
4. Crear `lib/session.ts` y `context/session-context.tsx` con la sesión mock y el guardado de puntuaciones en `localStorage`.
5. Construir `components/nav.tsx` (Client Component): links desktop, menú móvil, contador de créditos estático, botón de sesión usando el contexto y `next/link` / `usePathname` para estados activos.
6. Actualizar `app/layout.tsx`: envolver `children` con el `SessionProvider`, renderizar `Nav` y el footer.
7. Implementar `app/page.tsx` (Biblioteca): hero, buscador, chips de categoría, grid de `GameCard` con efecto tilt al hover, estado vacío "NO HAY RESULTADOS".
8. Implementar `app/game/[id]/page.tsx` (Detalle): portada, tags, descripción, stat strip, acciones (JUGAR AHORA → `/game/[id]/play`, VOLVER → `/`), leaderboard lateral con `seededScores(id)`. Usar `notFound()` si el `id` no existe en el catálogo.
9. Implementar `app/game/[id]/play/page.tsx` (Reproductor): HUD, arena CRT visual, pausa/fin, modal de fin de juego con input de iniciales y guardado vía contexto (`saveScore`), reinicio, salir.
10. Implementar `app/login/page.tsx` (Auth): tabs iniciar sesión/crear cuenta, formulario, submit crea sesión mock vía contexto y redirige a `/`; "JUGAR COMO INVITADO" navega a `/` sin sesión; botones sociales decorativos.
11. Implementar `app/leaderboard/page.tsx` (Salón de la Fama): tabs por juego (estado de cliente), podio top 3, tabla completa con `seededScores`, fila "TU MEJOR MARCA" calculada con `bestScoreFor` sobre las puntuaciones reales guardadas (se omite si no hay ninguna para ese juego).
12. Pasada de responsive: verificar menú móvil, colapso de grids, y apilado de layouts en los breakpoints de `styles.css`.
13. Pasada final de consistencia visual contra `references/templates/` en las 5 pantallas usando `/frontend-design`.
14. Ejecutar `npm run lint` y corregir lo que reporte.

## Criterios de aceptación

- [ ] Las 5 rutas (`/`, `/game/[id]`, `/game/[id]/play`, `/login`, `/leaderboard`) existen y se navega entre ellas con `next/link`.
- [ ] El Nav refleja el estado de sesión (botón "Iniciar Sesión" vs nombre de usuario) y persiste tras recargar la página (`localStorage` → `av_user`).
- [ ] El menú móvil (hamburguesa) abre, cierra y navega a las mismas rutas que el nav de escritorio.
- [ ] La Biblioteca filtra el catálogo por texto y categoría en tiempo real, y muestra "NO HAY RESULTADOS" cuando no hay coincidencias.
- [ ] Cada `GameCard` navega al detalle correspondiente (`/game/[id]`).
- [ ] El Detalle muestra tags, descripción, stats y un leaderboard determinista generado con `seededScores`.
- [ ] "JUGAR AHORA" en el Detalle navega a `/game/[id]/play` del mismo juego.
- [ ] El Reproductor simula la partida: la puntuación sube automáticamente, "PAUSA" detiene el incremento, "FIN" abre el modal de fin de juego.
- [ ] El modal de fin de juego permite editar iniciales y "GUARDAR PUNTUACIÓN" persiste la entrada en `localStorage` (`av_scores`) y muestra confirmación.
- [ ] "JUGAR DE NUEVO" reinicia el estado de la partida sin salir de la pantalla.
- [ ] Login y registro (tabs) aceptan cualquier usuario/contraseña y redirigen a `/` con sesión mock activa.
- [ ] "JUGAR COMO INVITADO" navega a `/` sin crear sesión.
- [ ] Los botones de Google/GitHub se muestran pero no ejecutan ninguna acción real.
- [ ] El Salón de la Fama permite cambiar de juego por tabs y muestra podio (top 3) + tabla completa vía `seededScores`.
- [ ] La fila "TU MEJOR MARCA" aparece solo si el usuario tiene sesión y al menos una puntuación guardada para el juego seleccionado; en caso contrario no se muestra.
- [ ] El tema visual (colores neón, tipografías pixel/mono, efectos de glow) coincide visualmente con `references/templates/styles.css` en las 5 pantallas.
- [ ] El layout es responsive: se verifica en un viewport móvil (≤480px) y uno de escritorio (≥1280px).
- [ ] `npm run lint` pasa sin errores.
- [ ] No existe ningún archivo de motor/lógica de juego real (canvas, colisiones, control del jugador, etc.) para ninguno de los 8 juegos del catálogo.

## Decisiones tomadas y descartadas

- **Rutas en inglés** (`/game/[id]`, `/game/[id]/play`, `/login`, `/leaderboard`) mientras el copy de la UI permanece en español — decisión explícita del usuario, priorizando nombres de ruta técnicos convencionales.
- **Sesión y puntuaciones mock persistidas vía `localStorage`**, sin backend, extendiendo el comportamiento de `app.jsx` (`av_user`, `av_scores`) a un `SessionProvider` de React Context, necesario porque ahora hay rutas reales en vez de enrutamiento por hash.
- **El Reproductor implementa la simulación completa de partida** (puntuación automática, pausa, HUD, modal de fin, guardado) tal como en el template. Se entiende como comportamiento de UI/interacción, no como lógica de juego real: no hay motor, colisiones ni control del jugador — coherente con "no hay que implementar ningún juego".
- **La fila "TU MEJOR MARCA" del Salón de la Fama se calcula con datos reales guardados en `localStorage`**, en vez del valor simulado fijo del template (`youRank`/`youScore` derivados solo de la pestaña activa). Esto es consistente con la decisión de persistir puntuaciones de verdad: si no hay ninguna puntuación guardada para ese juego, la fila simplemente no aparece en vez de mostrar un dato inventado.
- **Un solo tema visual fijo (dark neon)**, sin modo claro ni selector de tema — el template no define una variante clara.
- **Botones sociales (Google/GitHub) y contador de créditos son puramente decorativos**, sin lógica funcional detrás.
- No se crea ningún spec adicional para el "juego real" en este momento; queda explícitamente fuera de alcance de este MVP.

## Riesgos identificados

- Traducir los efectos neón/glow/CRT de `styles.css` a Tailwind v4 puede requerir utilidades custom (`@theme`, sombras arbitrarias) — mitigación: apoyarse en el skill `/frontend-design` durante la implementación.
- Next.js 16 tiene convenciones distintas a las que el modelo conoce por defecto (routing, Server/Client Components, `notFound`) — mitigación: leer `node_modules/next/dist/docs/01-app/` antes de codear cada patrón nuevo, como indica `AGENTS.md`.
- Mezclar rutas (potencialmente Server Components) con estado de sesión en `localStorage` obliga a marcar como `"use client"` los componentes que lo consumen; riesgo de desajuste de hidratación si el estado inicial de sesión no se maneja con cuidado en el primer render — mitigación: seguir el patrón recomendado en la documentación de Next 16 para estado de cliente dependiente de `localStorage`.
