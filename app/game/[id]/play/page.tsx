import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchGameById } from "@/lib/supabase/games";
import GamePlayer from "@/components/game-player";

export default async function GamePlayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const game = await fetchGameById(supabase, id);
  if (!game) notFound();

  return <GamePlayer game={game} />;
}
