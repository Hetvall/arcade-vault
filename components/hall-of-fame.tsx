"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Game, Score } from "@/lib/games";
import { createClient } from "@/lib/supabase/client";
import {
  fetchPlayerBestScore,
  fetchScoreRank,
  fetchTopScores,
} from "@/lib/supabase/games";
import { useSession } from "@/context/session-context";

type GameWithStats = Game & { best: number | null; plays: number };

function formatDate(iso: string) {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

export default function HallOfFame({
  games,
  initialTab,
  initialScores,
}: {
  games: GameWithStats[];
  initialTab: string;
  initialScores: Score[];
}) {
  const router = useRouter();
  const { user } = useSession();
  const [tab, setTab] = useState(initialTab);
  const [rows, setRows] = useState<Score[]>(initialScores);
  const [loading, setLoading] = useState(false);
  const [you, setYou] = useState<Score | null>(null);
  const [youRank, setYouRank] = useState<number | null>(null);

  const game = games.find((g) => g.id === tab) ?? null;

  useEffect(() => {
    let cancelled = false;
    // El primer tab ya llega resuelto desde el servidor (initialScores);
    // solo volvemos a consultar cuando el usuario cambia de pestaña.
    if (tab === initialTab && rows === initialScores) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const supabase = createClient();
    fetchTopScores(supabase, tab, 12).then((data) => {
      if (!cancelled) {
        setRows(data);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setYou(null);
      setYouRank(null);
      return;
    }

    const supabase = createClient();
    fetchPlayerBestScore(supabase, tab, user.name).then(async (best) => {
      if (cancelled) return;
      if (!best) {
        setYou(null);
        setYouRank(null);
        return;
      }
      const rank = await fetchScoreRank(supabase, tab, best.score);
      if (!cancelled) {
        setYou(best);
        setYouRank(rank);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [tab, user]);

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {games.map((g) => (
          <button
            key={g.id}
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {rows.length === 0 && !loading && (
        <div
          style={{
            textAlign: "center",
            padding: 80,
            color: "var(--ink-faint)",
          }}
        >
          <div
            className="pixel"
            style={{ fontSize: 14, color: "var(--magenta)", marginBottom: 12 }}
          >
            AÚN NADIE HA JUGADO
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="podium">
            {rows[1] && (
              <div className="podium-slot silver">
                <div className="rank-num">02</div>
                <div className="name">{rows[1].name}</div>
                <div className="score">
                  {rows[1].score.toLocaleString("es-ES")}
                </div>
                <div className="date">{formatDate(rows[1].created_at)}</div>
              </div>
            )}
            {rows[0] && (
              <div className="podium-slot gold">
                <div
                  className="pixel"
                  style={{
                    fontSize: 9,
                    color: "var(--gold)",
                    letterSpacing: "0.18em",
                  }}
                >
                  CAMPEÓN
                </div>
                <div
                  className="rank-num"
                  style={{ fontSize: 36, marginTop: 4 }}
                >
                  01
                </div>
                <div className="name">{rows[0].name}</div>
                <div className="score" style={{ fontSize: 20 }}>
                  {rows[0].score.toLocaleString("es-ES")}
                </div>
                <div className="date">{formatDate(rows[0].created_at)}</div>
              </div>
            )}
            {rows[2] && (
              <div className="podium-slot bronze">
                <div className="rank-num">03</div>
                <div className="name">{rows[2].name}</div>
                <div className="score">
                  {rows[2].score.toLocaleString("es-ES")}
                </div>
                <div className="date">{formatDate(rows[2].created_at)}</div>
              </div>
            )}
          </div>

          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.id}
                className={
                  "tr" +
                  (i === 0
                    ? " top1"
                    : i === 1
                      ? " top2"
                      : i === 2
                        ? " top3"
                        : "")
                }
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(i + 1).padStart(2, "0")}</div>
                <div className="pl">{r.name}</div>
                <div className="sc">{r.score.toLocaleString("es-ES")}</div>
                <div className="dt">{formatDate(r.created_at)}</div>
              </div>
            ))}
            {you && (
              <>
                <div className="tr you-label">
                  ▸ TU MEJOR MARCA EN {game?.title ?? ""}
                </div>
                <div
                  className="tr you"
                  style={{ animationDelay: `${rows.length * 50 + 50}ms` }}
                >
                  <div className="rk" style={{ color: "var(--yellow)" }}>
                    #{String(youRank).padStart(2, "0")}
                  </div>
                  <div className="pl" style={{ color: "var(--yellow)" }}>
                    {you.name}
                  </div>
                  <div
                    className="sc"
                    style={{
                      color: "var(--yellow)",
                      textShadow: "0 0 6px rgba(245,255,0,0.5)",
                    }}
                  >
                    {you.score.toLocaleString("es-ES")}
                  </div>
                  <div className="dt">{formatDate(you.created_at)}</div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <button className="btn lg" onClick={() => router.push("/games")}>
          VOLVER A LA BIBLIOTECA
        </button>
      </div>
    </div>
  );
}
