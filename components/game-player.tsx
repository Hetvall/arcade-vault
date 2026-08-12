"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Game } from "@/lib/games";
import { useSession } from "@/context/session-context";
import AsteroidsCanvas, {
  type AsteroidsCanvasHandle,
} from "@/components/games/asteroids-canvas";
import type { AsteroidsState } from "@/lib/games/asteroids/engine";

// Único juego con motor real por ahora (ver specs/05-juego-asteroides.md).
// El resto del catálogo sigue con la arena placeholder + puntaje simulado.
const HAS_REAL_ENGINE = new Set(["asteroids"]);

export default function GamePlayer({ game }: { game: Game }) {
  const router = useRouter();
  const { user, saveScore } = useSession();
  const isAsteroids = HAS_REAL_ENGINE.has(game.id);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [tripleShotSecondsLeft, setTripleShotSecondsLeft] = useState(0);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  // "INVITADO" por defecto: coincide con el primer render en servidor y
  // cliente (el usuario real de localStorage todavía no está disponible).
  const [name, setName] = useState("INVITADO");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const asteroidsRef = useRef<AsteroidsCanvasHandle>(null);

  // Puntaje simulado, solo para los juegos que todavía no tienen motor real.
  useEffect(() => {
    if (isAsteroids || over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220
    );
    return () => clearInterval(t);
  }, [isAsteroids, over, paused]);

  // Precarga las iniciales con el nombre de sesión en cuanto SessionProvider
  // termina de sincronizarlo desde localStorage (ver el comentario en
  // session-context.tsx). No pisa lo que el jugador ya haya escrito.
  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(user.name);
    }
  }, [user]);

  // Nivel derivado de la puntuación, solo para los juegos con puntaje
  // simulado. Asteroids reporta su propio nivel real vía onStateChange.
  const simulatedLevel = Math.floor(score / 2500) + 1;
  const displayLevel = isAsteroids ? level : simulatedLevel;

  // Estado real del motor de Asteroids, reemplazando el HUD/overlay que el
  // canvas original dibujaba (ver lib/games/asteroids/engine.ts).
  const handleAsteroidsStateChange = useCallback((state: AsteroidsState) => {
    setScore(state.score);
    setLives(state.lives);
    setLevel(state.level);
    setTripleShotSecondsLeft(state.tripleShotSecondsLeft);
    if (state.gameOver) {
      setOver(true);
    }
  }, []);

  const endGame = () => setOver(true);
  const restart = () => {
    setPaused(false);
    setOver(false);
    setSaved(false);
    setSaving(false);
    setSaveError(false);
    if (isAsteroids) {
      asteroidsRef.current?.restart();
    } else {
      setScore(0);
    }
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(displayLevel).padStart(2, "0")}</div>
          </div>
          {isAsteroids && tripleShotSecondsLeft > 0 && (
            <div className="hud-stat">
              <div className="l">3X</div>
              <div className="v">{tripleShotSecondsLeft.toFixed(1)}s</div>
            </div>
          )}
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <button
            className="btn ghost"
            onClick={() => router.push(`/game/${game.id}`)}
          >
            SALIR
          </button>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {isAsteroids ? (
            <AsteroidsCanvas
              ref={asteroidsRef}
              paused={paused || over}
              onStateChange={handleAsteroidsStateChange}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                  disabled={saving}
                />
                <button
                  className="btn yellow"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true);
                    setSaveError(false);
                    const { ok } = await saveScore({
                      game: game.id,
                      score,
                      name,
                    });
                    setSaving(false);
                    if (ok) {
                      setSaved(true);
                    } else {
                      setSaveError(true);
                    }
                  }}
                >
                  {saving ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
                </button>
                {saveError && (
                  <div className="toast-error">
                    ▸ NO SE PUDO GUARDAR — REINTENTAR
                  </div>
                )}
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <button
                className="btn magenta"
                onClick={() => router.push("/games")}
              >
                VOLVER AL VAULT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
