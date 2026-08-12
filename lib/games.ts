// Tipos del catálogo de juegos y puntuaciones, respaldados por las tablas
// `games`/`scores` de Supabase (ver lib/supabase/games.ts).

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string; // clase de fondo (cover-bricks, cover-tetro, ...)
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
