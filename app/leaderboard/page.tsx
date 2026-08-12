import { createClient } from "@/lib/supabase/server";
import { fetchGamesWithBestScores, fetchTopScores } from "@/lib/supabase/games";
import HallOfFame from "@/components/hall-of-fame";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const games = await fetchGamesWithBestScores(supabase);
  const firstGame = games[0];
  const scores = firstGame
    ? await fetchTopScores(supabase, firstGame.id, 12)
    : [];

  return (
    <HallOfFame
      games={games}
      initialTab={firstGame?.id ?? ""}
      initialScores={scores}
    />
  );
}
