import { createClient } from "@/lib/supabase/server";
import { fetchGamesWithBestScores } from "@/lib/supabase/games";
import HomeContent from "@/components/home-content";

export default async function Page() {
  const supabase = await createClient();
  const games = await fetchGamesWithBestScores(supabase);

  return <HomeContent games={games} />;
}
