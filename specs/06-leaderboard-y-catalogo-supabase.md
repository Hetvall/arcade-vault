# 06 — Leaderboard y catálogo de juegos en Supabase

- **Estado:** Implemented
- **Depende de:** SPEC 04
- **Fecha:** 2026-08-12
- **Objetivo:** Migrar el catálogo de juegos (`GAMES`) y las puntuaciones guardadas a tablas reales de Supabase (`games`, `scores`), reemplazando los datos falsos (`seededScores`) y el guardado en `localStorage` (`av_scores`) por consultas y escrituras reales en `/games`, `/game/[id]` y `/leaderboard`.

## Alcance

### Dentro de alcance

- Dos tablas nuevas en el proyecto Supabase ya conectado (`skjiaowautazmyrnrepo`, ver SPEC 04), creadas vía migración con `mcp__supabase__apply_migration`:
  - `games`: catálogo de juegos, sembrada con los mismos 8 juegos que hoy existen en `GAMES` (`lib/games.ts`), mismos `id` (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `asteroids`, `ranaria`, `duelo-pixel`) y mismos textos/valores de `title`, `short`, `long`, `cat`, `cover`, `color`. Los campos `best` y `plays` del mock **no** se migran como columnas: se calculan en vivo desde `scores` (`MAX(score)` y `COUNT(*)` por `game`).
  - `scores`: puntuaciones reales, con columnas `id` (identity), `game` (FK a `games.id`), `name` (iniciales del jugador), `score` (entero, `>= 0`), `created_at` (timestamptz, default `now()`). Índice compuesto `(game, score desc)` para las consultas de top-N y mejor puntuación.
  - RLS: `games` con `select` público (sin `insert`/`update`/`delete` — no hay UI de administración en este spec, el catálogo solo se siembra por migración). `scores` con `select` e `insert` públicos sin restricción adicional más allá del `check (score >= 0)` de la columna — aceptado como limitación conocida dado que no hay auth real (ver "Riesgos").
- `lib/games.ts` se recorta: la interfaz `Game` pierde `best` y `plays`; se elimina el array `GAMES`, `seededScores`, `PLAYERS` y `ScoreRow` (quedan obsoletos, reemplazados por las consultas reales). `CATS` se mantiene igual (enum estático de categorías, no depende de datos).
- Nuevo `lib/supabase/games.ts` con funciones de consulta parametrizadas por un cliente de Supabase inyectado (para poder llamarse tanto desde Server Components con el cliente de servidor como desde Client Components con el cliente de navegador):
  - `fetchGamesWithBestScores(supabase): Promise<(Game & { best: number | null; plays: number })[]>`
  - `fetchGameById(supabase, id): Promise<Game | null>`
  - `fetchTopScores(supabase, game, limit): Promise<Score[]>`
  - `fetchBestScore(supabase, game): Promise<number | null>`
  - `fetchPlayerBestScore(supabase, game, name): Promise<Score | null>`
  - `fetchScoreRank(supabase, game, score): Promise<number>` (posición = cantidad de scores estrictamente mayores + 1)
  - `insertScore(supabase, entry: { game: string; name: string; score: number }): Promise<{ error: string | null }>`
  - Tipos `Game` (sin `best`/`plays`) y `Score` (`{ id, game, name, score, created_at }`) viven en `lib/games.ts`.
- `app/games/page.tsx` pasa a ser Server Component: llama `fetchGamesWithBestScores` con el cliente de servidor y renderiza un nuevo Client Component `components/game-library.tsx` que recibe la lista ya resuelta y mantiene el estado interactivo actual (búsqueda `q`, filtro `cat`) sin tocar Supabase de nuevo.
- `components/game-card.tsx` recibe `best: number | null` como prop en vez de leer `game.best`; si es `null` (juego sin partidas guardadas todavía) muestra `—` en vez de un número.
- `app/game/[id]/page.tsx` (ya Server Component) reemplaza `seededScores` por `fetchTopScores(supabase, id, 10)` para el aside "MEJORES PUNTUACIONES" (vacío → ver estado vacío abajo) y por `fetchBestScore` para la celda "Mejor global"; `components/best-score-stat.tsx` se elimina (ya no hace falta aislar esa celda en cliente: con Supabase el dato es accesible en servidor igual que el resto de la página, a diferencia de `localStorage` que motivó ese componente en SPEC 05). "Partidas" en el `stat-strip` pasa de `game.plays` (string mock tipo `"12.4K"`) a el conteo real (`COUNT(*)`) formateado con `toLocaleString("es-ES")`.
- `app/leaderboard/page.tsx` pasa a ser Server Component: resuelve la lista de juegos (`fetchGamesWithBestScores`, solo para pintar las pestañas/tabs) y el top-12 + posición/mejor marca del usuario para el primer juego (`GAMES[0].id` como hoy) en el servidor; el resultado inicial se pasa como props a un nuevo Client Component `components/hall-of-fame.tsx` que:
  - Mantiene el tab activo (`useState`) igual que hoy.
  - Al cambiar de tab, vuelve a consultar `fetchTopScores`/`fetchPlayerBestScore`/`fetchScoreRank` con el cliente de navegador (`lib/supabase/client.ts`), mostrando un estado de carga breve en la tabla mientras resuelve.
  - Calcula "tu mejor marca" con `fetchPlayerBestScore(supabase, tab, user.name)` usando el `user` mock de `useSession()` (se mantiene el criterio de identificar por nombre/iniciales, sin auth real).
- Podio y tabla con datos reales: si hay menos de 3 scores para un juego, solo se pintan los slots de podio que existan (plata/bronce se ocultan si no hay datos, no se rellenan con nada falso); si hay 0 scores, se oculta todo el bloque de podio/tabla y se muestra el mensaje "AÚN NADIE HA JUGADO" (mismo tono pixel-art que el resto de estados vacíos de la plataforma).
- `context/session-context.tsx` y `lib/session.ts`: se elimina todo lo relacionado a `scores`/`SavedScore`/`addStoredScore`/`getStoredScores`/`bestScoreFor`/`bestGlobalScoreFor` (ya no hay puntuaciones en `localStorage`). `saveScore` en el contexto pasa a ser `async`, llama a `insertScore` con el cliente de navegador y devuelve `{ ok: boolean }` para que la UI sepa si falló. El manejo de `user` (`av_user`, login/logout/playAsGuest) no cambia — sigue siendo mock.
- `components/game-player.tsx`: el botón "GUARDAR PUNTUACIÓN" llama al `saveScore` async; mientras está en curso se deshabilita el botón (estado `saving`); si falla (`ok: false`), se muestra un mensaje de error inline ("NO SE PUDO GUARDAR — REINTENTAR") sin cerrar el modal ni perder la puntuación, permitiendo reintentar.
- Verificación manual end-to-end descrita en el plan de implementación.

### Fuera de alcance

- Autenticación real con Supabase Auth — se sigue identificando al jugador por el nombre/iniciales de la sesión mock (`av_user`, `context/session-context.tsx`), sin login real. Un spec futuro puede migrar esto.
- Cualquier UI de administración para crear/editar/borrar juegos en la tabla `games` — el catálogo se siembra una única vez por migración; agregar un juego nuevo hoy requeriría una migración manual, no una pantalla.
- Migrar las puntuaciones que ya existan en `av_scores` (`localStorage`) de pruebas previas (SPEC 05) a la tabla `scores` — se descartan sin migración; `av_scores` deja de leerse.
- Validación anti-trampas más allá de `score >= 0` (rate limiting, verificación server-side de que el score es alcanzable, captcha, etc.) — dado que no hay auth real, cualquiera con la publishable key puede insertar filas directamente; se documenta como riesgo aceptado, no se resuelve aquí.
- Paginación de la tabla del Salón de la Fama más allá del top-12 actual, o de "MEJORES PUNTUACIONES" más allá del top-10 — se mantienen los mismos límites que ya usaba `seededScores`.
- Conectar motores reales a juegos que hoy usan la arena placeholder (`bloque-buster`, `caida`, etc.) — sigue fuera de alcance, igual que en SPEC 05; sus filas en `games` existen y su `best`/"Partidas" ya reflejarán datos reales si alguien llega a guardar un score para ellos vía la API, aunque no tengan motor jugable.
- Borrar o resetear datos de prueba insertados en `scores`/`games` durante el desarrollo de este spec — queda a criterio manual post-implementación, no es un paso del plan.

## Modelo de datos

```sql
create table public.games (
  id text primary key,
  title text not null,
  short text not null,
  long text not null,
  cat text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover text not null,
  color text not null check (color in ('cyan','magenta','green','yellow')),
  created_at timestamptz not null default now()
);

create table public.scores (
  id bigint generated always as identity primary key,
  game text not null references public.games(id),
  name text not null,
  score integer not null check (score >= 0),
  created_at timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game, score desc);

alter table public.games enable row level security;
alter table public.scores enable row level security;

create policy "public read games" on public.games for select using (true);
create policy "public read scores" on public.scores for select using (true);
create policy "public insert scores" on public.scores for insert with check (true);
```

```ts
// lib/games.ts (interfaces resultantes)
export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string;
  color: "cyan" | "magenta" | "green" | "yellow";
}

export interface Score {
  id: number;
  game: string; // Game.id
  name: string;
  score: number;
  created_at: string; // ISO timestamp
}

export const CATS = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"];
```

```ts
// lib/supabase/games.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Game, Score } from "@/lib/games";

export function fetchGamesWithBestScores(
  supabase: SupabaseClient
): Promise<(Game & { best: number | null; plays: number })[]>;
export function fetchGameById(
  supabase: SupabaseClient,
  id: string
): Promise<Game | null>;
export function fetchTopScores(
  supabase: SupabaseClient,
  game: string,
  limit: number
): Promise<Score[]>;
export function fetchBestScore(
  supabase: SupabaseClient,
  game: string
): Promise<number | null>;
export function fetchPlayCount(
  supabase: SupabaseClient,
  game: string
): Promise<number>;
export function fetchPlayerBestScore(
  supabase: SupabaseClient,
  game: string,
  name: string
): Promise<Score | null>;
export function fetchScoreRank(
  supabase: SupabaseClient,
  game: string,
  score: number
): Promise<number>;
export function insertScore(
  supabase: SupabaseClient,
  entry: { game: string; name: string; score: number }
): Promise<{ error: string | null }>;
```

## Plan de implementación

1. Leer `node_modules/next/dist/docs/01-app/` en lo referente a Server Components async con fetch de datos y su combinación con Client Components hijos, para confirmar convenciones de Next 16 antes de reestructurar `app/games/page.tsx` y `app/leaderboard/page.tsx`.
2. Crear la migración con `mcp__supabase__apply_migration` sobre el proyecto `skjiaowautazmyrnrepo`: tablas `games`/`scores`, índice, RLS y políticas descritas en el modelo de datos, más los `insert` de semilla con los 8 juegos actuales de `GAMES` (mismos `id`, `title`, `short`, `long`, `cat`, `cover`, `color`).
3. Ejecutar `mcp__supabase__generate_typescript_types` para confirmar el esquema aplicado (uso informativo/validación, no bloquea el resto del plan si el proyecto ya tipa manualmente en `lib/games.ts`).
4. Recortar `lib/games.ts`: quitar `GAMES`, `seededScores`, `PLAYERS`, `ScoreRow`; ajustar `Game` (sin `best`/`plays`); agregar `Score`. Mantener `CATS`.
5. Crear `lib/supabase/games.ts` con las funciones de consulta listadas en el modelo de datos, implementadas contra las tablas `games`/`scores`.
6. Modificar `lib/session.ts`: quitar `SavedScore`, `addStoredScore`, `getStoredScores`, `bestScoreFor`, `bestGlobalScoreFor`. Mantener `SessionUser`, `getStoredUser`, `setStoredUser`.
7. Modificar `context/session-context.tsx`: quitar el estado `scores` y su sincronización desde `localStorage`; `saveScore` pasa a ser `async (entry) => { const { error } = await insertScore(createClient(), entry); return { ok: !error }; }` usando el cliente de navegador (`lib/supabase/client.ts`).
8. Modificar `components/game-card.tsx` para recibir `best: number | null` por props (en vez de `game.best`), mostrando `—` cuando es `null`.
9. Convertir `app/games/page.tsx` en Server Component: `const supabase = await createClient(); const games = await fetchGamesWithBestScores(supabase);`, pasa `games` a un nuevo `components/game-library.tsx` (Client Component) que porta la lógica actual de búsqueda/filtro y renderiza `GameCard` con el `best` recibido.
10. Modificar `app/game/[id]/page.tsx`: reemplazar `seededScores` por `fetchTopScores(supabase, id, 10)` (aside "MEJORES PUNTUACIONES", con estado vacío si no hay filas); reemplazar la celda "Mejor global" (eliminar `components/best-score-stat.tsx`) por `fetchBestScore(supabase, id)` resuelto directamente en la página; "Partidas" pasa a `fetchPlayCount(supabase, id)`.
11. Convertir `app/leaderboard/page.tsx` en Server Component: resuelve `fetchGamesWithBestScores` (para las pestañas) y, para el primer juego, `fetchTopScores`/`fetchPlayerBestScore`/`fetchScoreRank`; pasa todo como props iniciales a un nuevo `components/hall-of-fame.tsx` (Client Component) que porta el tab-switching actual y vuelve a consultar con el cliente de navegador al cambiar de tab, mostrando podio/tabla con slots ocultos si hay menos de 3/12 filas, y el mensaje "AÚN NADIE HA JUGADO" si hay 0.
12. Modificar `components/game-player.tsx`: `saveScore` ahora es async; agregar estado `saving`/`saveError` al botón "GUARDAR PUNTUACIÓN" (deshabilitado mientras guarda, mensaje de reintento si falla).
13. Prueba manual end-to-end: `npm run dev`; en `/games` confirmar que la biblioteca carga los 8 juegos desde Supabase con "Mejor puntuación" en `—` para juegos sin partidas; jugar Asteroids, terminar partida, guardar puntuación, confirmar que aparece en `/game/asteroids` (top puntuaciones + "Mejor global" + "Partidas") y en `/leaderboard` (pestaña ASTEROIDS); cambiar de pestaña en el Salón de la Fama y confirmar que recarga datos reales del juego seleccionado; jugar dos veces con nombres distintos y confirmar podio/ranking correctos; probar un juego sin ninguna partida guardada y confirmar el estado vacío "AÚN NADIE HA JUGADO".
14. Ejecutar `npm run lint` y corregir lo que reporte.

## Criterios de aceptación

- [ ] Las tablas `games` y `scores` existen en el proyecto Supabase con las columnas, índice y políticas RLS descritas, y `games` contiene los 8 juegos originales con los mismos `id`/textos que tenía `GAMES`.
- [ ] `/games` renderiza la biblioteca completa leyendo de Supabase (no de un array importado), con búsqueda y filtro por categoría funcionando igual que antes.
- [ ] `GameCard` muestra `—` en "Mejor puntuación" para un juego sin ninguna partida guardada, y el valor real (`MAX(score)`) en cuanto existe al menos una.
- [ ] `/game/[id]` muestra "Mejor global" y "Partidas" calculados en vivo desde `scores`, y el aside "MEJORES PUNTUACIONES" lista las partidas reales guardadas para ese juego (vacío si no hay ninguna, sin datos falsos).
- [ ] Guardar una puntuación desde el modal de fin de partida (`components/game-player.tsx`) inserta una fila real en `scores` vía Supabase; mientras se guarda el botón se deshabilita, y si falla se muestra un mensaje de error sin perder la puntuación en pantalla, permitiendo reintentar.
- [ ] `/leaderboard` (SALÓN DE LA FAMA) muestra pestañas por juego leídas de `games`; al cambiar de pestaña, el podio y la tabla se recargan con las puntuaciones reales de ese juego desde `scores`.
- [ ] Si un juego tiene menos de 3 puntuaciones guardadas, el podio solo pinta los slots que existen (sin relleno falso); si tiene 0, se muestra "AÚN NADIE HA JUGADO" en vez de podio/tabla vacíos.
- [ ] "TU MEJOR MARCA" en el Salón de la Fama refleja la puntuación real más alta guardada con el nombre de la sesión mock actual (`useSession().user.name`), con su posición calculada contra los datos reales.
- [ ] `lib/games.ts` ya no exporta `GAMES`, `seededScores`, `PLAYERS` ni `ScoreRow`; `lib/session.ts` ya no exporta nada relacionado a `SavedScore`/puntuaciones.
- [ ] `localStorage` (`av_scores`) ya no se lee ni se escribe en ningún flujo de la aplicación.
- [ ] `npm run lint` pasa sin errores nuevos.

## Decisiones tomadas y descartadas

- **`best`/`plays` calculados en vivo desde `scores` en vez de columnas estáticas en `games`**: son datos derivados de las partidas reales; guardarlos como columnas estáticas los dejaría desactualizados apenas hubiera partidas nuevas, obligando a mantenerlos sincronizados manualmente. Se acepta el costo de una consulta agregada adicional por carga de página.
- **Identificación de jugador por nombre/iniciales (sesión mock), no por Supabase Auth real**: migrar auth es un cambio transversal (login, registro, RLS por usuario) fuera del objetivo de una sola frase de este spec; ya se dejó fuera de alcance en SPEC 04 y se reafirma aquí.
- **Se elimina `components/best-score-stat.tsx`**: existía específicamente para aislar en cliente una lectura de `localStorage` no disponible en servidor (ver SPEC 05). Con Supabase el dato es accesible directamente en el Server Component de `/game/[id]`, así que mantener ese componente aparte sería complejidad residual sin propósito.
- **Reemplazo completo de `localStorage` en vez de escritura dual**: una sola fuente de verdad es más simple de razonar y coincide con el objetivo de "datos reales"; el histórico de pruebas en `av_scores` se descarta sin migrar (ver alcance).
- **RLS pública sin restricciones adicionales en `scores`**: consistente con que no hay auth real todavía; se documenta como riesgo aceptado (ver abajo) en vez de construir validación server-side que solo mitigaría parcialmente sin resolver el problema de fondo (falta de identidad verificada).
- **Patrón Server Component (datos iniciales) + Client Component (interacción/refetch)**: igual que SPEC 05 mantiene SEO/carga inicial en servidor para el contenido no interactivo, y limita el código de cliente a lo estrictamente interactivo (tabs, búsqueda, guardado de score).
- **Sin UI de administración de juegos**: el catálogo es fijo y conocido (los mismos 8 juegos del mock); agregar CRUD de juegos es una feature de administración distinta, no pedida en el objetivo de este spec.

## Riesgos identificados

- Sin autenticación real ni validación server-side más allá de `score >= 0`, cualquiera con la publishable key (pública por diseño de Supabase) puede insertar puntuaciones arbitrarias directamente contra la API, sin pasar por la UI del juego — riesgo aceptado explícitamente en este spec; resolverlo requiere auth real y/o validación de partidas (fuera de alcance).
- Los juegos que aún no tienen motor real (placeholder + puntaje simulado) pueden terminar con puntuaciones guardadas en `scores` si alguien juega esa arena falsa y guarda — no rompe nada técnicamente (la tabla no distingue "motor real" vs "simulado"), pero puede generar datos poco significativos en el Salón de la Fama para esos juegos hasta que tengan su propio spec de motor.
- El refetch client-side al cambiar de pestaña en el Salón de la Fama depende de la publishable key/RLS pública para `select` en `scores`; si en el futuro se restringe RLS por auth real, ese refetch se rompe y necesitará pasar por una Route Handler en vez de consultar Supabase directo desde el navegador.
