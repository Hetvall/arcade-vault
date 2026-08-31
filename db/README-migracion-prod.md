# Migración Dev → Prod (Supabase)

Este documento y `migracion-prod.sql` (en esta misma carpeta) permiten llevar la estructura,
políticas y catálogo de la instancia **Dev** de Supabase (`skjiaowautazmyrnrepo`) a la instancia
**Prod** recién creada, sin que Claude Code necesite acceso a Prod.

## Qué incluye el script

- Tablas `public.games` y `public.scores` (mismo esquema, checks e índice que Dev).
- RLS habilitado en ambas tablas + las 3 políticas de Dev (`public read games`,
  `public read scores`, `public insert scores`).
- Seed del catálogo con **solo los 5 juegos con motor real** (`HAS_REAL_ENGINE` en
  `components/game-player.tsx`): `arkanoid`, `asteroids`, `frogger`, `snake`, `tetris`.
  Se excluyen `duelo-pixel`, `gloton` e `invasores` — filas del catálogo de Dev sin mecánica
  jugable implementada (usan la arena placeholder).
- `scores` se deja **vacía a propósito** — los 20 registros de Dev son datos de prueba y no se migran.

Es **idempotente**: puedes reejecutarlo sin duplicar filas ni romper políticas existentes.

## Pasos

1. Entra al dashboard de la instancia **Prod** → **SQL Editor** → _New query_.
2. Pega el contenido completo de `migracion-prod.sql` y dale **Run**. Debe terminar sin errores.
3. Verifica en **Table Editor**:
   - `games` → 5 filas (arkanoid, asteroids, frogger, snake, tetris).
   - `scores` → 0 filas.
   - Ambas con RLS **Enabled**.
4. Configura las variables de entorno del hosting de Prod (ver tabla abajo) usando la **URL y
   publishable key de Prod** — nunca las de Dev.
5. Redespliega la app apuntando a Prod.

## Variables de entorno para Prod

| Variable                               | De dónde sale                                                  | Notas                                                 |
| -------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Prod dashboard → Project Settings → API → Project URL          | Distinta a la de Dev                                  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Prod dashboard → Project Settings → API Keys → publishable key | La app **solo** usa esta clave (nunca `service_role`) |
| `RESEND_API_KEY`                       | Panel de Resend                                                | Necesaria para `POST /api/contact`                    |
| `CONTACT_TO_EMAIL`                     | Opcional                                                       | Default: `jamesorozcoh@gmail.com` si no se define     |

No se necesitan `SUPABASE_DB_PASSWORD` ni las variables de Telegram en el runtime de la app — son
solo de tooling local (`.env.local`), no de despliegue.

## Verificación end-to-end

En el SQL Editor de Prod:

```sql
select count(*) from public.games;   -- 5
select count(*) from public.scores;  -- 0
select policyname, cmd from pg_policies where schemaname = 'public'; -- 3 filas
```

Contra la app ya desplegada con las variables de Prod:

- `GET /api/health/supabase` → OK.
- `/games` y home cargan el catálogo de 5 juegos (todos con motor jugable).
- Jugar y guardar un score inserta en `public.scores` de Prod y aparece en `/leaderboard`.
- Un intento de insert inválido (nombre vacío/>10 chars o score negativo) es rechazado por la
  política `public insert scores`.

## Alcance y lo que NO se migra

- **Auth real / OAuth**: la app usa sesión mock (`localStorage`), no Supabase Auth. No hay nada de
  Auth que migrar hoy.
- **Edge functions**: no existen en Dev.
- **Extensiones**: solo las que trae Supabase por defecto; ninguna custom en uso por la app.
- **Migraciones históricas**: en Dev existen 6 migraciones aplicadas vía MCP, no versionadas en el
  repo. Este script consolida el estado final resultante, no el historial paso a paso.
- **Juegos sin motor real**: `duelo-pixel`, `gloton` e `invasores` siguen en el catálogo de Dev
  (usan la arena placeholder) pero no se migran a Prod hasta que tengan mecánica jugable.

## Nota de seguridad

`.env.local` en este repo contiene actualmente secretos en texto plano (token de Telegram, una
línea de "PROD DB PASSWORD"). Ese archivo es solo para desarrollo local:

- Confirma que `.env.local` está ignorado por git (lo está por convención de Next.js).
- No copies credenciales de Prod dentro de `.env.local`; el hosting de Prod (Vercel u otro) toma
  sus propias variables de entorno, independientes de este archivo local.
