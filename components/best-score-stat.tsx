"use client";

// Celda "Mejor global" del stat-strip de /game/[id]. Ver
// specs/05-juego-asteroides.md: se aísla en su propio Client Component para
// que el resto de app/game/[id]/page.tsx siga siendo Server Component.

import { useSession } from "@/context/session-context";
import { bestGlobalScoreFor } from "@/lib/session";
import type { Game } from "@/lib/games";

export default function BestScoreStat({ game }: { game: Game }) {
  const { scores } = useSession();

  // `scores` arranca en [] en el primer render (servidor y cliente
  // coinciden, ver session-context.tsx), así que este componente también
  // pinta el fallback `game.best` en su primer render, sin salto de layout;
  // se actualiza al valor real tras montar si hay alguna partida guardada.
  const value = bestGlobalScoreFor(game.id, scores) ?? game.best;

  return (
    <div>
      <div className="l">Mejor global</div>
      <div
        className="v"
        style={{
          color: "var(--magenta)",
          textShadow: "0 0 6px rgba(255,0,110,0.5)",
        }}
      >
        {value.toLocaleString("es-ES")}
      </div>
    </div>
  );
}
