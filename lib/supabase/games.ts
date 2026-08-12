import type { SupabaseClient } from "@supabase/supabase-js";
import type { Game, Score } from "@/lib/games";

// Funciones de consulta parametrizadas por un cliente de Supabase inyectado,
// para poder llamarse tanto desde Server Components (cliente de servidor)
// como desde Client Components (cliente de navegador).

export async function fetchGamesWithBestScores(
  supabase: SupabaseClient
): Promise<(Game & { best: number | null; plays: number })[]> {
  const { data: games, error } = await supabase
    .from("games")
    .select("*")
    .order("title");

  if (error || !games) return [];

  const withStats = await Promise.all(
    games.map(async (game) => {
      const [best, plays] = await Promise.all([
        fetchBestScore(supabase, game.id),
        fetchPlayCount(supabase, game.id),
      ]);
      return { ...(game as Game), best, plays };
    })
  );

  return withStats;
}

export async function fetchGameById(
  supabase: SupabaseClient,
  id: string
): Promise<Game | null> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data as Game;
}

export async function fetchTopScores(
  supabase: SupabaseClient,
  game: string,
  limit: number
): Promise<Score[]> {
  const { data, error } = await supabase
    .from("scores")
    .select("*")
    .eq("game", game)
    .order("score", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as Score[];
}

export async function fetchBestScore(
  supabase: SupabaseClient,
  game: string
): Promise<number | null> {
  const { data, error } = await supabase
    .from("scores")
    .select("score")
    .eq("game", game)
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.score as number;
}

export async function fetchPlayCount(
  supabase: SupabaseClient,
  game: string
): Promise<number> {
  const { count, error } = await supabase
    .from("scores")
    .select("*", { count: "exact", head: true })
    .eq("game", game);

  if (error || count === null) return 0;
  return count;
}

export async function fetchPlayerBestScore(
  supabase: SupabaseClient,
  game: string,
  name: string
): Promise<Score | null> {
  const { data, error } = await supabase
    .from("scores")
    .select("*")
    .eq("game", game)
    .eq("name", name)
    .order("score", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as Score;
}

export async function fetchScoreRank(
  supabase: SupabaseClient,
  game: string,
  score: number
): Promise<number> {
  const { count, error } = await supabase
    .from("scores")
    .select("*", { count: "exact", head: true })
    .eq("game", game)
    .gt("score", score);

  if (error || count === null) return 1;
  return count + 1;
}

export async function insertScore(
  supabase: SupabaseClient,
  entry: { game: string; name: string; score: number }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("scores").insert(entry);
  return { error: error ? error.message : null };
}
