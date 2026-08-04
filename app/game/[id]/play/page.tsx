import { notFound } from "next/navigation";
import { GAMES } from "@/lib/games";
import GamePlayer from "@/components/game-player";

export default async function GamePlayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  if (!game) notFound();

  return <GamePlayer game={game} />;
}
