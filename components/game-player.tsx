"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Game } from "@/lib/games";
import { useSession } from "@/context/session-context";
import AsteroidsCanvas, {
  type AsteroidsCanvasHandle,
} from "@/components/games/asteroids-canvas";
import type { AsteroidsState } from "@/lib/games/asteroids/engine";
import TetrisCanvas, {
  type TetrisCanvasHandle,
} from "@/components/games/tetris-canvas";
import type { TetrisState } from "@/lib/games/tetris/engine";
import ArkanoidCanvas, {
  type ArkanoidCanvasHandle,
} from "@/components/games/arkanoid-canvas";
import type { ArkanoidState } from "@/lib/games/arkanoid/engine";
import SnakeCanvas, {
  type SnakeCanvasHandle,
} from "@/components/games/snake-canvas";
import type { SnakeState } from "@/lib/games/snake/engine";
import FroggerGame from "@/components/games/FroggerGame";
import { resolveAsteroidsPalette } from "@/lib/games/asteroids/skins";
import { resolveTetrisPalette } from "@/lib/games/tetris/skins";
import { resolveArkanoidPalette } from "@/lib/games/arkanoid/skins";
import { resolveSnakePalette } from "@/lib/games/snake/skins";
import SkinPicker from "@/components/skin-picker";
import { getStoredSkin, SKINNABLE_GAMES, type SkinId } from "@/lib/skins";
import TouchControls from "@/components/games/touch-controls";

// Detección de dispositivo táctil (spec 10): basada en "(pointer: coarse)",
// reevaluada en cliente tras montar para no romper el render de servidor
// (SSR asume "false" — sin controles táctiles — y el cliente lo corrige tras
// el primer efecto). Un dispositivo táctil con teclado externo sigue
// mostrando el overlay: ambos inputs conviven, ninguno excluye al otro.
function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsTouch(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isTouch;
}

// Juegos con motor real (ver specs/05-juego-asteroides.md,
// specs/07-juego-tetris.md, specs/08-juego-arkanoid.md,
// specs/09-juego-snake.md y specs/game-jam/frogger/01-frogger-core.md). El
// resto del catálogo sigue con la arena placeholder + puntaje simulado.
const HAS_REAL_ENGINE = new Set([
  "asteroids",
  "tetris",
  "arkanoid",
  "snake",
  "frogger",
]);

export default function GamePlayer({ game }: { game: Game }) {
  const router = useRouter();
  const { user, saveScore } = useSession();
  const isAsteroids = game.id === "asteroids";
  const isTetris = game.id === "tetris";
  const isArkanoid = game.id === "arkanoid";
  const isSnake = game.id === "snake";
  const isFrogger = game.id === "frogger";
  const hasRealEngine = HAS_REAL_ENGINE.has(game.id);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [lines, setLines] = useState(0);
  const [length, setLength] = useState(0);
  const [level, setLevel] = useState(1);
  const [tripleShotSecondsLeft, setTripleShotSecondsLeft] = useState(0);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  // Skin del juego (persistido por juego en localStorage, ver lib/skins.ts).
  // Arranca en "classic" para coincidir con el render de servidor; el
  // SkinPicker lo sincroniza tras montar.
  const [skin, setSkin] = useState<SkinId>(() => getStoredSkin(game.id));
  const asteroidsPalette = resolveAsteroidsPalette(skin);
  const tetrisPalette = resolveTetrisPalette(skin);
  const arkanoidPalette = resolveArkanoidPalette(skin);
  const snakePalette = resolveSnakePalette(skin);
  const showSkinPicker = SKINNABLE_GAMES.has(game.id);
  // "INVITADO" por defecto: coincide con el primer render en servidor y
  // cliente (el usuario real de localStorage todavía no está disponible).
  const [name, setName] = useState("INVITADO");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  // FroggerGame no expone un handle imperativo (no tiene restart()/pressKey()
  // como los demás motores): "JUGAR DE NUEVO" fuerza un remount cambiando
  // esta key, que reinicia todo su estado interno desde cero.
  const [frogKey, setFrogKey] = useState(0);

  const asteroidsRef = useRef<AsteroidsCanvasHandle>(null);
  const tetrisRef = useRef<TetrisCanvasHandle>(null);
  const arkanoidRef = useRef<ArkanoidCanvasHandle>(null);
  const snakeRef = useRef<SnakeCanvasHandle>(null);

  const isTouchDevice = useIsTouchDevice();

  // Auto-scroll al canvas en desktop (fuera de spec 10, fix rápido pedido
  // aparte): al entrar a un juego el HUD superior puede dejar el canvas
  // fuera del viewport, haciendo perder partida por no verlo a tiempo. Solo
  // en pointer: fine — en táctil el layout ya deja el canvas visible de
  // entrada. Se ejecuta una sola vez al montar.
  const crtRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    crtRef.current?.scrollIntoView({ block: "center" });
  }, []);

  // Marca en <body> que hay una partida activa en pantalla mientras este
  // componente está montado (spec 11): pausa la animación gridscroll del
  // fondo compartido para no sumar coste de composición continuo al de
  // renderizar el juego. Se limpia al desmontar (salir del reproductor).
  useEffect(() => {
    document.body.classList.add("av-game-active");
    return () => {
      document.body.classList.remove("av-game-active");
    };
  }, []);

  // Puntaje simulado, solo para los juegos que todavía no tienen motor real.
  useEffect(() => {
    if (hasRealEngine || over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220
    );
    return () => clearInterval(t);
  }, [hasRealEngine, over, paused]);

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
  // simulado. Asteroids y Tetris reportan su propio nivel real vía
  // onStateChange.
  const simulatedLevel = Math.floor(score / 2500) + 1;
  const displayLevel = hasRealEngine ? level : simulatedLevel;

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

  // Estado real del motor de Tetris, reemplazando el HUD/overlay que el
  // canvas original dibujaba (ver lib/games/tetris/engine.ts).
  const handleTetrisStateChange = useCallback((state: TetrisState) => {
    setScore(state.score);
    setLines(state.lines);
    setLevel(state.level);
    if (state.gameOver) {
      setOver(true);
    }
  }, []);

  // Estado real del motor de Arkanoid, reemplazando el HUD/overlay que el
  // canvas original dibujaba (ver lib/games/arkanoid/engine.ts). Arkanoid
  // tiene vidas como Asteroids, así que reutiliza el estado `lives`
  // existente y cae en la misma rama "Vidas" del HUD.
  const handleArkanoidStateChange = useCallback((state: ArkanoidState) => {
    setScore(state.score);
    setLives(state.lives);
    setLevel(state.level);
    if (state.gameOver) {
      setOver(true);
    }
  }, []);

  // Estado real del motor de Snake, reemplazando el HUD/overlay que el
  // canvas original dibujaba (ver lib/games/snake/engine.ts). Snake es de
  // una sola vida: no usa `lives`, reporta `length` en su lugar.
  const handleSnakeStateChange = useCallback((state: SnakeState) => {
    setScore(state.score);
    setLength(state.length);
    setLevel(state.level);
    if (state.gameOver) {
      setOver(true);
    }
  }, []);

  // Estado real del motor de Frogger (ver components/games/FroggerGame.tsx).
  // Frogger no reporta un único onStateChange combinado como los demás
  // motores: expone 4 callbacks separados (score/lives/level/gameOver).
  // Reutiliza `lives` (cae en la misma rama "Vidas" del HUD que Asteroids y
  // Arkanoid) y `level`.
  const handleFroggerScoreChange = useCallback((s: number) => {
    setScore(s);
  }, []);
  const handleFroggerLivesChange = useCallback((l: number) => {
    setLives(l);
  }, []);
  const handleFroggerLevelChange = useCallback((l: number) => {
    setLevel(l);
  }, []);
  const handleFroggerGameOver = useCallback((finalScore: number) => {
    setScore(finalScore);
    setOver(true);
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
    } else if (isTetris) {
      tetrisRef.current?.restart();
    } else if (isArkanoid) {
      arkanoidRef.current?.restart();
    } else if (isSnake) {
      snakeRef.current?.restart();
    } else if (isFrogger) {
      setScore(0);
      setLives(3);
      setLevel(1);
      setFrogKey((k) => k + 1);
    } else {
      setScore(0);
    }
  };

  return (
    <>
      <div className="av-player fade-in" data-skin={skin}>
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
              <div className="l">
                {isTetris ? "Líneas" : isSnake ? "Longitud" : "Vidas"}
              </div>
              <div className="v">
                {isTetris
                  ? lines
                  : isSnake
                    ? length
                    : "♥ ".repeat(lives).trim() || "—"}
              </div>
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
          {showSkinPicker && (
            <SkinPicker
              gameId={game.id}
              gameTitle={game.title}
              onChange={setSkin}
            />
          )}
        </div>

        <div className="crt" ref={crtRef}>
          <div className="crt-screen">
            {isAsteroids ? (
              <AsteroidsCanvas
                ref={asteroidsRef}
                paused={paused || over}
                palette={asteroidsPalette}
                onStateChange={handleAsteroidsStateChange}
              />
            ) : isTetris ? (
              <TetrisCanvas
                ref={tetrisRef}
                paused={paused || over}
                palette={tetrisPalette}
                onStateChange={handleTetrisStateChange}
              />
            ) : isArkanoid ? (
              <ArkanoidCanvas
                ref={arkanoidRef}
                paused={paused || over}
                palette={arkanoidPalette}
                onStateChange={handleArkanoidStateChange}
              />
            ) : isSnake ? (
              <SnakeCanvas
                ref={snakeRef}
                paused={paused || over}
                palette={snakePalette}
                onStateChange={handleSnakeStateChange}
              />
            ) : isFrogger ? (
              <FroggerGame
                key={frogKey}
                paused={paused || over}
                onScoreChange={handleFroggerScoreChange}
                onLivesChange={handleFroggerLivesChange}
                onLevelChange={handleFroggerLevelChange}
                onGameOver={handleFroggerGameOver}
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
      {isTouchDevice && (
        <>
          {isAsteroids && (
            <TouchControls
              layout="asteroids"
              onKey={(code, pressed) =>
                asteroidsRef.current?.setKey(code, pressed)
              }
            />
          )}
          {isTetris && (
            <TouchControls
              layout="tetris"
              onKey={(code) => tetrisRef.current?.pressKey(code)}
            />
          )}
          {isArkanoid && (
            <TouchControls
              layout="arkanoid"
              onKey={(code, pressed) =>
                arkanoidRef.current?.setKey(code, pressed)
              }
            />
          )}
          {isSnake && (
            <TouchControls
              layout="snake"
              onKey={(code) => snakeRef.current?.pressKey(code)}
            />
          )}
        </>
      )}
    </>
  );
}
