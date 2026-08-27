-- Arcade Vault — Bootstrap de Producción
-- Ejecutar UNA vez en el SQL Editor de la instancia Prod.
-- Idempotente: se puede re-ejecutar sin romper nada.
-- Generado a partir del estado real de Dev (skjiaowautazmyrnrepo) el 2026-08-27.

-- 1) Tabla de catálogo de juegos
create table if not exists public.games (
  id         text primary key,
  title      text not null,
  short      text not null,
  long       text not null,
  cat        text not null check (cat = any (array['ARCADE','PUZZLE','SHOOTER','VERSUS'])),
  cover      text not null,
  color      text not null check (color = any (array['cyan','magenta','green','yellow'])),
  created_at timestamptz not null default now()
);

-- 2) Tabla de puntuaciones
create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  game       text not null references public.games(id),
  name       text not null,
  score      integer not null check (score >= 0),
  created_at timestamptz not null default now()
);

create index if not exists scores_game_score_idx on public.scores using btree (game, score desc);

-- 3) RLS
alter table public.games  enable row level security;
alter table public.scores enable row level security;

-- 4) Políticas (drop + create para idempotencia)
drop policy if exists "public read games"    on public.games;
create policy "public read games" on public.games for select using (true);

drop policy if exists "public read scores"   on public.scores;
create policy "public read scores" on public.scores for select using (true);

drop policy if exists "public insert scores" on public.scores;
create policy "public insert scores" on public.scores for insert
  with check (score >= 0 and char_length(name) >= 1 and char_length(name) <= 10);

-- 5) Seed del catálogo — SOLO juegos con motor real (HAS_REAL_ENGINE en
--    components/game-player.tsx): asteroids, tetris, arkanoid, snake, frogger.
--    Se excluyen duelo-pixel, gloton e invasores (placeholders sin mecánica jugable).
--    scores queda VACÍA a propósito (no se migran los datos de prueba de Dev).
insert into public.games (id, title, short, long, cat, cover, color) values
  ('arkanoid','ARKANOID','Rebota la pelota y destruye muros de neón.','Controla la paleta, mantén la pelota en juego y despeja cinco niveles de bloques de colores antes de quedarte sin vidas.','ARCADE','cover-bricks','cyan'),
  ('asteroids','ASTEROIDS','Pulveriza asteroides en gravedad cero.','Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir asteroides en fragmentos cada vez más pequeños. Cuidado con los OVNIs en el horizonte.','SHOOTER','cover-asteroids','yellow'),
  ('frogger','FROGGER','Cruza la carretera y el río sin convertirte en papilla.','Guía a tu rana a través de una carretera repleta de coches y un río de troncos y tortugas flotantes. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.','ARCADE','cover-frogger','green'),
  ('snake','SNAKE','Devora frutas de píxel sin morder tu propia cola.','Una serpiente neón recorre la grilla cazando frutas de píxel: manzanas, sandías, uvas y más caen a su paso. Cada bocado la alarga y acelera el ritmo del juego. Un giro de más contra el borde o contra su propia cola y todo termina.','ARCADE','cover-snake','green'),
  ('tetris','TETRIS','Encaja las piezas antes de que el techo te aplaste.','Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.','PUZZLE','cover-tetro','magenta')
on conflict (id) do nothing;
