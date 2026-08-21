"use client";

// Frogger construido desde cero (canvas puro, sin engine/lib separado — ver
// Decisions en specs/game-jam/frogger/01-frogger-core.md). Cuadrícula de
// 16x14 celdas de 40px: fila 0 = bocas destino, filas 1-6 = río, fila 7 =
// zona segura media, filas 8-12 = carretera, fila 13 = inicio.

import { useCallback, useEffect, useRef } from "react";

export interface FroggerGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

const COLS = 16;
const ROWS = 14;
const CELL = 40; // px
const CANVAS_W = COLS * CELL; // 640
const CANVAS_H = ROWS * CELL; // 560

// Zonas (índice de fila, 0 = arriba)
const ROW_GOALS = 0;
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6;
const ROW_SAFE_MID = 7;
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12;
const ROW_START = 13;

type Direction = "up" | "down" | "left" | "right";

interface Lane {
  row: number;
  speed: number;
  dir: 1 | -1;
  entities: Entity[];
}

interface Entity {
  col: number;
  width: number;
  type: "car" | "truck" | "log" | "turtle";
  submerged?: boolean;
}

interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number;
  targetCol: number;
  targetRow: number;
}

// Cada nivel incrementa todas las velocidades un 15% respecto al anterior.
function levelSpeedFactor(level: number): number {
  return Math.pow(1.15, level - 1);
}

// Coches (ancho 1-2) y camiones (ancho 2-3), con huecos de 2-4 celdas para
// que el carril sea siempre atravesable.
function placeRoadEntities(): Entity[] {
  const entities: Entity[] = [];
  let col = Math.floor(Math.random() * 3);
  while (col < COLS + 4) {
    const isTruck = Math.random() < 0.35;
    const width = isTruck
      ? 2 + Math.floor(Math.random() * 2)
      : 1 + Math.floor(Math.random() * 2);
    entities.push({ col, width, type: isTruck ? "truck" : "car" });
    const gap = 2 + Math.floor(Math.random() * 3);
    col += width + gap;
  }
  return entities;
}

// Troncos (ancho 2-4) o grupos de tortugas (ancho 2-3, dibujados como
// tortugas individuales dentro del ancho en el paso de draw), con huecos de
// al menos 1 celda. `submerged` arranca en `false`; el ciclo de inmersión de
// las tortugas se calcula en update() a partir del tiempo transcurrido.
function placeRiverEntities(type: "log" | "turtle"): Entity[] {
  const entities: Entity[] = [];
  let col = Math.floor(Math.random() * 3);
  while (col < COLS + 4) {
    const width =
      type === "log"
        ? 2 + Math.floor(Math.random() * 3)
        : 2 + Math.floor(Math.random() * 2);
    entities.push({ col, width, type, submerged: false });
    const gap = 1 + Math.floor(Math.random() * 3);
    col += width + gap;
  }
  return entities;
}

// Construye los 11 carriles del nivel: 6 de río (filas 1-6, alternando
// tronco/tortuga) y 5 de carretera (filas 8-12). Sentidos alternos por
// carril; velocidades escaladas por `levelSpeedFactor(level)`.
//
// `lane.speed` está en celdas/segundo (no px/frame): a estas velocidades un
// carril tarda entre ~10 y ~27s en cruzar el tablero de 16 columnas a
// nivel 1, dando tiempo real a reaccionar.
function buildLanes(level: number): Lane[] {
  const factor = levelSpeedFactor(level);
  const lanes: Lane[] = [];

  for (let i = 0; i <= ROW_RIVER_BOT - ROW_RIVER_TOP; i++) {
    const row = ROW_RIVER_TOP + i;
    const dir: 1 | -1 = i % 2 === 0 ? 1 : -1;
    const baseSpeed = 0.5 + i * 0.15; // 0.5..1.25 celdas/seg
    const type: "log" | "turtle" = i % 2 === 0 ? "log" : "turtle";
    lanes.push({
      row,
      speed: baseSpeed * factor,
      dir,
      entities: placeRiverEntities(type),
    });
  }

  for (let i = 0; i <= ROW_ROAD_BOT - ROW_ROAD_TOP; i++) {
    const row = ROW_ROAD_TOP + i;
    const dir: 1 | -1 = i % 2 === 0 ? 1 : -1;
    const baseSpeed = 0.8 + i * 0.3; // 0.8..2 celdas/seg
    lanes.push({
      row,
      speed: baseSpeed * factor,
      dir,
      entities: placeRoadEntities(),
    });
  }

  return lanes;
}

// ---- Bocas destino: col0 y col15 son muros; cada boca ocupa 2 columnas con
// 1 columna de hueco entre ellas (1+2+1+2+1+2+1+2+1+2+1 = 16). ----
const GOAL_COLS: [number, number][] = [
  [1, 2],
  [4, 5],
  [7, 8],
  [10, 11],
  [13, 14],
];

function getGoalIndex(col: number): number | null {
  const rounded = Math.round(col);
  for (let i = 0; i < GOAL_COLS.length; i++) {
    const [a, b] = GOAL_COLS[i];
    if (rounded === a || rounded === b) return i;
  }
  return null;
}

const ROUND_TIME_BASE = 15; // s
const ROUND_TIME_MIN = 6; // s
const JUMP_DURATION = 120; // ms
const TURTLE_VISIBLE_MS = 3000;
const TURTLE_SUBMERGED_MS = 1500;
const TURTLE_CYCLE_MS = TURTLE_VISIBLE_MS + TURTLE_SUBMERGED_MS;

function roundTimeForLevel(level: number): number {
  return Math.max(ROUND_TIME_MIN, ROUND_TIME_BASE - (level - 1));
}

function startCol(): number {
  return Math.floor(COLS / 2); // columna central
}

function makeFrog(): Frog {
  return {
    col: startCol(),
    row: ROW_START,
    animating: false,
    animT: 0,
    targetCol: startCol(),
    targetRow: ROW_START,
  };
}

interface GameState {
  lanes: Lane[];
  frog: Frog;
  goals: boolean[];
  score: number;
  lives: number;
  level: number;
  timer: number;
  bestRowThisRound: number;
  pendingDir: Direction | null;
  elapsedMs: number;
  over: boolean;
}

function makeInitialState(): GameState {
  return {
    lanes: buildLanes(1),
    frog: makeFrog(),
    goals: [false, false, false, false, false],
    score: 0,
    lives: 3,
    level: 1,
    timer: roundTimeForLevel(1),
    bestRowThisRound: ROW_START,
    pendingDir: null,
    elapsedMs: 0,
    over: false,
  };
}

// Colisión con vehículo: la rana está sobre un carril de carretera ocupado.
function checkRoadCollision(frog: Frog, lanes: Lane[]): boolean {
  for (const lane of lanes) {
    if (lane.row !== frog.row) continue;
    if (lane.row < ROW_ROAD_TOP || lane.row > ROW_ROAD_BOT) continue;
    for (const entity of lane.entities) {
      if (frog.col >= entity.col && frog.col < entity.col + entity.width) {
        return true;
      }
    }
  }
  return false;
}

// Soporte en el río: tronco o grupo de tortugas visible bajo la rana.
// Tortugas sumergidas (`submerged === true`) no dan soporte.
function getSupport(
  frog: Frog,
  lanes: Lane[]
): { lane: Lane; entity: Entity } | null {
  for (const lane of lanes) {
    if (lane.row !== frog.row) continue;
    if (lane.row < ROW_RIVER_TOP || lane.row > ROW_RIVER_BOT) continue;
    for (const entity of lane.entities) {
      if (frog.col >= entity.col && frog.col < entity.col + entity.width) {
        if (entity.type === "turtle" && entity.submerged) return null;
        return { lane, entity };
      }
    }
  }
  return null;
}

type GoalResult = "filled" | "occupied" | "wall";

// Resuelve el aterrizaje en la fila de bocas destino. Marca la boca y suma
// puntos si estaba libre; si ya estaba ocupada o cae en un muro, es muerte.
function checkGoal(frog: Frog, goals: boolean[]): GoalResult {
  const idx = getGoalIndex(frog.col);
  if (idx === null) return "wall";
  if (goals[idx]) return "occupied";
  goals[idx] = true;
  return "filled";
}

export default function FroggerGame({
  paused,
  onScoreChange,
  onLivesChange,
  onLevelChange,
  onGameOver,
}: FroggerGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const pausedRef = useRef(paused);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  // Callbacks en refs: el efecto de montaje no debe reiniciar el juego cada
  // vez que GamePlayer pasa una nueva identidad de función (mismo patrón que
  // SnakeCanvas/AsteroidsCanvas).
  const onScoreChangeRef = useRef(onScoreChange);
  const onLivesChangeRef = useRef(onLivesChange);
  const onLevelChangeRef = useRef(onLevelChange);
  const onGameOverRef = useRef(onGameOver);
  useEffect(() => {
    onScoreChangeRef.current = onScoreChange;
  }, [onScoreChange]);
  useEffect(() => {
    onLivesChangeRef.current = onLivesChange;
  }, [onLivesChange]);
  useEffect(() => {
    onLevelChangeRef.current = onLevelChange;
  }, [onLevelChange]);
  useEffect(() => {
    onGameOverRef.current = onGameOver;
  }, [onGameOver]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Gestión de muerte: resta una vida y notifica. A 0 vidas termina la
  // partida; si quedan vidas, respawnea a la rana en la fila de inicio.
  const killFrog = useCallback(() => {
    const state = stateRef.current;
    if (!state || state.over) return;
    state.lives -= 1;
    onLivesChangeRef.current(state.lives);
    if (state.lives <= 0) {
      state.over = true;
      onGameOverRef.current(state.score);
      return;
    }
    state.frog = makeFrog();
    state.timer = roundTimeForLevel(state.level);
  }, []);

  // Ronda completada: bonus de +200, reset de bocas y rana, sube de nivel y
  // reconstruye los carriles con la nueva velocidad/temporizador.
  const completeRound = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    state.score += 200;
    onScoreChangeRef.current(state.score);
    state.goals = [false, false, false, false, false];
    state.frog = makeFrog();
    state.bestRowThisRound = ROW_START;
    state.level += 1;
    onLevelChangeRef.current(state.level);
    state.lanes = buildLanes(state.level);
    state.timer = roundTimeForLevel(state.level);
  }, []);

  // Se ejecuta al completar un salto: resuelve meta/colisión/soporte de la
  // celda destino y otorga los +10 pts por avance de fila inédito.
  const resolveArrival = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    const frog = state.frog;

    if (frog.row === ROW_GOALS) {
      const result = checkGoal(frog, state.goals);
      if (result === "wall" || result === "occupied") {
        killFrog();
        return;
      }
      const timeBonus = Math.round(state.timer) * 10;
      state.score += 50 + timeBonus;
      onScoreChangeRef.current(state.score);
      if (state.goals.every(Boolean)) {
        completeRound();
      } else {
        state.frog = makeFrog();
        state.timer = roundTimeForLevel(state.level);
      }
      return;
    }

    if (frog.row >= ROW_ROAD_TOP && frog.row <= ROW_ROAD_BOT) {
      if (checkRoadCollision(frog, state.lanes)) {
        killFrog();
        return;
      }
    }

    if (frog.row >= ROW_RIVER_TOP && frog.row <= ROW_RIVER_BOT) {
      if (!getSupport(frog, state.lanes)) {
        killFrog();
        return;
      }
    }

    if (frog.row < state.bestRowThisRound) {
      state.score += (state.bestRowThisRound - frog.row) * 10;
      state.bestRowThisRound = frog.row;
      onScoreChangeRef.current(state.score);
    }
  }, [killFrog, completeRound]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rawCtx = canvas.getContext("2d");
    if (!rawCtx) return;
    // Reasignado a un binding cuyo tipo estático ya no es nullable: dentro
    // de las funciones anidadas (update/draw/loop) TS no conserva el
    // estrechamiento de `rawCtx` a través del cierre.
    const ctx: CanvasRenderingContext2D = rawCtx;

    stateRef.current = makeInitialState();
    lastTsRef.current = null;
    onScoreChangeRef.current(0);
    onLivesChangeRef.current(3);
    onLevelChangeRef.current(1);

    function handleKeyDown(e: KeyboardEvent) {
      const state = stateRef.current;
      if (!state || state.over) return;
      let dir: Direction | null = null;
      switch (e.code) {
        case "ArrowUp":
        case "KeyW":
          dir = "up";
          break;
        case "ArrowDown":
        case "KeyS":
          dir = "down";
          break;
        case "ArrowLeft":
        case "KeyA":
          dir = "left";
          break;
        case "ArrowRight":
        case "KeyD":
          dir = "right";
          break;
        default:
          return; // P/Esc y demás teclas no se manejan aquí (paused es prop).
      }
      e.preventDefault();
      state.pendingDir = dir;
    }
    document.addEventListener("keydown", handleKeyDown);

    function update(dt: number) {
      const state = stateRef.current;
      if (!state || state.over) return;

      state.elapsedMs += dt;

      for (const lane of state.lanes) {
        for (const entity of lane.entities) {
          // lane.speed está en celdas/segundo; dt está en ms.
          entity.col += (lane.speed * lane.dir * dt) / 1000;
          if (lane.dir > 0 && entity.col > COLS) {
            entity.col = -entity.width;
          } else if (lane.dir < 0 && entity.col + entity.width < 0) {
            entity.col = COLS;
          }
          if (entity.type === "turtle") {
            const phase = (state.elapsedMs + entity.col * 47) % TURTLE_CYCLE_MS;
            entity.submerged = phase >= TURTLE_VISIBLE_MS;
          }
        }
      }

      const frog = state.frog;

      if (!frog.animating) {
        if (state.pendingDir) {
          const dir = state.pendingDir;
          state.pendingDir = null;
          let dCol = 0;
          let dRow = 0;
          if (dir === "up") dRow = -1;
          else if (dir === "down") dRow = 1;
          else if (dir === "left") dCol = -1;
          else if (dir === "right") dCol = 1;
          const fromCol = Math.round(frog.col);
          const targetCol = Math.min(COLS - 1, Math.max(0, fromCol + dCol));
          const targetRow = Math.min(ROW_START, Math.max(0, frog.row + dRow));
          if (targetCol !== fromCol || targetRow !== frog.row) {
            frog.targetCol = targetCol;
            frog.targetRow = targetRow;
            frog.animating = true;
            frog.animT = 0;
          }
        }

        if (
          !frog.animating &&
          frog.row >= ROW_RIVER_TOP &&
          frog.row <= ROW_RIVER_BOT
        ) {
          const support = getSupport(frog, state.lanes);
          if (!support) {
            killFrog();
          } else {
            frog.col += (support.lane.speed * support.lane.dir * dt) / 1000;
            if (frog.col < 0 || frog.col > COLS - 1) {
              killFrog();
            }
          }
        } else if (
          !frog.animating &&
          frog.row >= ROW_ROAD_TOP &&
          frog.row <= ROW_ROAD_BOT
        ) {
          if (checkRoadCollision(frog, state.lanes)) {
            killFrog();
          }
        }
      } else {
        frog.animT += dt;
        if (frog.animT >= JUMP_DURATION) {
          frog.col = frog.targetCol;
          frog.row = frog.targetRow;
          frog.animating = false;
          frog.animT = 0;
          resolveArrival();
        }
      }

      if (!state.over) {
        state.timer -= dt / 1000;
        if (state.timer <= 0) {
          state.timer = 0;
          killFrog();
        }
      }
    }

    function draw() {
      const state = stateRef.current;
      if (!state) return;

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // Fondos por zona.
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(
        0,
        ROW_ROAD_TOP * CELL,
        CANVAS_W,
        (ROW_ROAD_BOT - ROW_ROAD_TOP + 1) * CELL
      );
      ctx.fillStyle = "#001d3d";
      ctx.fillRect(
        0,
        ROW_RIVER_TOP * CELL,
        CANVAS_W,
        (ROW_RIVER_BOT - ROW_RIVER_TOP + 1) * CELL
      );
      ctx.fillStyle = "#062b13";
      ctx.fillRect(0, ROW_SAFE_MID * CELL, CANVAS_W, CELL);
      ctx.fillRect(0, ROW_START * CELL, CANVAS_W, CELL);
      ctx.fillStyle = "#0b3d1f";
      ctx.fillRect(0, ROW_GOALS * CELL, CANVAS_W, CELL);

      // Bocas destino.
      for (let i = 0; i < GOAL_COLS.length; i++) {
        const [a, b] = GOAL_COLS[i];
        const x = a * CELL;
        const w = (b - a + 1) * CELL;
        ctx.fillStyle = state.goals[i] ? "#0f5c2e" : "#0b3d1f";
        ctx.fillRect(x, ROW_GOALS * CELL, w, CELL);
        ctx.strokeStyle = "#d4af37";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, ROW_GOALS * CELL + 1, w - 2, CELL - 2);
        if (state.goals[i]) {
          ctx.fillStyle = "#39ff88";
          ctx.beginPath();
          ctx.ellipse(
            x + w / 2,
            ROW_GOALS * CELL + CELL / 2,
            12,
            10,
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }

      // Entidades de carretera y río.
      for (const lane of state.lanes) {
        for (const entity of lane.entities) {
          const x = entity.col * CELL;
          const y = lane.row * CELL;
          const w = entity.width * CELL;

          if (entity.type === "car" || entity.type === "truck") {
            ctx.fillStyle =
              entity.type === "truck"
                ? "#8a8a8a"
                : lane.row % 2 === 0
                  ? "#ff3b3b"
                  : "#3b7bff";
            ctx.fillRect(x + 2, y + 6, w - 4, CELL - 12);
            ctx.fillStyle = "#111";
            ctx.beginPath();
            ctx.arc(x + 8, y + CELL - 8, 4, 0, Math.PI * 2);
            ctx.arc(x + w - 8, y + CELL - 8, 4, 0, Math.PI * 2);
            ctx.fill();
          } else if (entity.type === "log") {
            ctx.fillStyle = "#7a4a24";
            ctx.fillRect(x + 1, y + 8, w - 2, CELL - 16);
            ctx.strokeStyle = "#5a350f";
            ctx.lineWidth = 1;
            for (let lx = x + 6; lx < x + w - 4; lx += 8) {
              ctx.beginPath();
              ctx.moveTo(lx, y + 8);
              ctx.lineTo(lx, y + CELL - 8);
              ctx.stroke();
            }
          } else if (entity.type === "turtle") {
            const count = Math.max(1, Math.round(entity.width));
            for (let t = 0; t < count; t++) {
              const cx = x + t * CELL + CELL / 2;
              const cy = y + CELL / 2;
              if (entity.submerged) {
                ctx.strokeStyle = "rgba(0,200,120,0.35)";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(cx, cy, 14, 0, Math.PI * 2);
                ctx.stroke();
              } else {
                ctx.fillStyle = "#1fbf5c";
                ctx.beginPath();
                ctx.arc(cx, cy, 14, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = "#0b5c28";
                ctx.lineWidth = 2;
                ctx.stroke();
              }
            }
          }
        }
      }

      // Rana (con interpolación de salto entre col/row y target durante la
      // animación de 120ms).
      const frog = state.frog;
      let drawCol = frog.col;
      let drawRow = frog.row;
      let jumpLift = 0;
      if (frog.animating) {
        const t = Math.min(1, frog.animT / JUMP_DURATION);
        drawCol = frog.col + (frog.targetCol - frog.col) * t;
        drawRow = frog.row + (frog.targetRow - frog.row) * t;
        jumpLift = -Math.sin(t * Math.PI) * 6;
      }
      const fx = drawCol * CELL + CELL / 2;
      const fy = drawRow * CELL + CELL / 2 + jumpLift;

      ctx.fillStyle = "#39ff14";
      ctx.beginPath();
      ctx.ellipse(fx, fy, 14, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(fx - 5, fy - 6, 3, 0, Math.PI * 2);
      ctx.arc(fx + 5, fy - 6, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(fx - 5, fy - 6, 1.5, 0, Math.PI * 2);
      ctx.arc(fx + 5, fy - 6, 1.5, 0, Math.PI * 2);
      ctx.fill();
      if (frog.animating) {
        ctx.strokeStyle = "#39ff14";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(fx - 12, fy + 10);
        ctx.lineTo(fx - 18, fy + 16);
        ctx.moveTo(fx + 12, fy + 10);
        ctx.lineTo(fx + 18, fy + 16);
        ctx.stroke();
      }

      // HUD interno (score top-left, nivel top-center, vidas top-right,
      // barra de tiempo en la fila 0).
      const maxTimer = roundTimeForLevel(state.level);
      const timeRatio = Math.max(0, Math.min(1, state.timer / maxTimer));
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, CANVAS_W, 6);
      ctx.fillStyle =
        timeRatio > 0.5 ? "#39ff14" : timeRatio > 0.25 ? "#ffe14d" : "#ff3b3b";
      ctx.fillRect(0, 0, CANVAS_W * timeRatio, 6);

      ctx.font = "bold 16px monospace";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.fillText(`${state.score}`, 8, 10);
      ctx.textAlign = "center";
      ctx.fillText(`NIVEL ${state.level}`, CANVAS_W / 2, 10);
      for (let i = 0; i < state.lives; i++) {
        ctx.fillStyle = "#39ff14";
        ctx.beginPath();
        ctx.arc(CANVAS_W - 14 - i * 20, 20, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function loop(ts: number) {
      // En pausa el rAF sigue vivo (para poder reanudar sin recrear el
      // motor) pero no se avanza el tick ni se redibuja: queda congelado en
      // el último frame dibujado, igual que Snake/Arkanoid (spec 11).
      if (pausedRef.current) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      if (lastTsRef.current === null) lastTsRef.current = ts;
      const dt = Math.min(50, ts - lastTsRef.current);
      lastTsRef.current = ts;

      update(dt);
      draw();

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      stateRef.current = null;
      lastTsRef.current = null;
    };
  }, [killFrog, resolveArrival]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      className="frogger-canvas"
    />
  );
}
