import { createClient } from "@/lib/supabase/server";
import { fetchGamesWithBestScores } from "@/lib/supabase/games";
import GameLibrary from "@/components/game-library";

export default async function Page() {
  const supabase = await createClient();
  const games = await fetchGamesWithBestScores(supabase);

  return <GameLibrary games={games} />;
}
