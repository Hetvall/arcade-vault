// Motor de Pong escrito desde cero (no hay game.js de referencia para este
// juego), ver specs/14-juego-pong.md. Modo 1 jugador vs CPU, puntuación de
// supervivencia por peloteos. Sigue el mismo contrato que
// AsteroidsEngine/SnakeEngine/ArkanoidEngine para montaje/desmontaje limpio
// con React (incluye StrictMode):
// - Todo el estado vive en la instancia, nada en globals de módulo.
// - No dibuja su propio HUD ni overlay de PAUSA/GAME OVER: esa info sale por
//   onStateChange para que la plataforma la pinte con su propio HUD/modal.
// - Sin auto-reinicio al perder la última vida; el engine se queda en
//   gameOver: true esperando a que algo externo llame a restart().
// - constructor no arranca el loop; start() es idempotente.

export interface PongState {
  score: number;
  lives: number; // vidas restantes del jugador (empieza en 3)
  level: number; // tier de velocidad (empieza en 1)
  gameOver: boolean;
}

export interface PongCallbacks {
  onStateChange: (state: PongState) => void;
}

// ── Contrato de skin ────────────────────────────────────────────────────────
// Paleta inyectada por el constructor (y actualizable en caliente con
// setPalette) y consumida por los métodos draw* en lugar de literales de color.
// Pong es un motor vectorial (fillRect, sin sprites), por lo que una skin de
// solo color basta — mismo enfoque que Asteroids/Tetris. Cada paleta se pinta
// con su propio shadowBlur para el brillo característico de la UI.
export interface PongPalette {
  background: string; // fondo de la cancha
  centerLine: string; // línea central discontinua (incluye su propio alfa)
  playerPaddle: string; // paleta del jugador (izquierda)
  cpuPaddle: string; // paleta de la CPU (derecha)
  ball: string; // relleno de la pelota cuadrada
  ballGlowColor: string; // shadowColor de la pelota (puede diferir del relleno)
  glow: number; // shadowBlur de las paletas; 0 = sin brillo
  ballGlow: number; // shadowBlur de la pelota; 0 = sin brillo
}

// Skin "clásico": réplica 1:1 del look original hardcodeado del engine (cancha
// azul-negro, ambas paletas y línea central cian neón, pelota casi-blanca con
// halo cian). Es el default y nunca debe reinventarse.
export const CLASSIC_PONG_PALETTE: PongPalette = {
  background: "#05070a",
  centerLine: "rgba(0, 229, 255, 0.35)",
  playerPaddle: "#00e5ff",
  cpuPaddle: "#00e5ff",
  ball: "#e6feff",
  ballGlowColor: "#00e5ff",
  glow: 12,
  ballGlow: 14,
};

// ── Constantes de cancha y paletas ──────────────────────────────────────────
const W = 800;
const H = 600;

const PADDLE_W = 14;
const PADDLE_H = 90;
const PADDLE_MARGIN = 24; // distancia del borde de cancha al borde de la paleta
const PLAYER_SPEED = 7; // px/frame

const BALL_SIZE = 14;
const SERVE_DELAY_MS = 800;

const RETURN_SCORE = 10;
const GOAL_BONUS = 50;
const START_LIVES = 3;
const LEVEL_UP_EVERY = 5; // retornos exitosos del jugador por nivel

// Velocidad base de la pelota por nivel (px/frame), tope 11.
const BALL_BASE_START = 5;
const BALL_BASE_STEP = 0.6;
const BALL_BASE_CAP = 11;
const ballBaseSpeed = (level: number) =>
  Math.min(BALL_BASE_START + (level - 1) * BALL_BASE_STEP, BALL_BASE_CAP);

// Velocidad máx de la CPU por nivel (px/frame), tope 9, siempre por debajo de
// la velocidad base de la pelota / del jugador para dejar huecos ganables.
const CPU_BASE_START = 4;
const CPU_STEP = 0.5;
const CPU_CAP = 9;
const cpuMaxSpeed = (level: number) =>
  Math.min(CPU_BASE_START + (level - 1) * CPU_STEP, CPU_CAP);

// Aceleración de la pelota por golpe dentro de un mismo peloteo: +3% de
// magnitud, con tope relativo al nivel actual (base × 1.5) para que el tope
// también escale con la progresión de niveles.
const HIT_ACCEL = 1.03;
const HIT_SPEED_CAP_MULT = 1.5;

// Deflexión máxima al golpear una paleta: cuanto más lejos del centro de la
// paleta impacta la pelota, más ángulo gana la componente Y.
const MAX_BOUNCE_ANGLE = (Math.PI / 180) * 55; // 55°

interface Vec {
  x: number;
  y: number;
}

export class PongEngine {
  private ctx: CanvasRenderingContext2D;
  private callbacks: PongCallbacks;
  private palette: PongPalette;

  private playerY!: number;
  private cpuY!: number;
  private ball!: Vec; // esquina superior izquierda del cuadrado de la pelota
  private ballVel!: Vec;

  private serving = true;
  private serveTimer = 0; // ms restantes de la pausa de saque
  private serveDirection = 1; // 1 = hacia la CPU, -1 = hacia el jugador

  private totalReturns = 0;
  private score = 0;
  private lives = START_LIVES;
  private level = 1;
  private gameOver = false;

  // Última emisión enviada a onStateChange, para no re-emitir (y no forzar un
  // re-render de React) cuando nada cambió respecto al frame anterior. Ver
  // emitState() y lib/games/snake/engine.ts.
  private lastEmitted: PongState | null = null;

  private keysDown = new Set<string>();

  private paused = false;
  private lastTime: number | null = null;
  private rafId: number | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    callbacks: PongCallbacks,
    palette: PongPalette = CLASSIC_PONG_PALETTE
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas.");
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.palette = palette;

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);

    this.initGame();
  }

  start() {
    if (this.rafId === null) {
      this.lastTime = null;
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  restart() {
    this.initGame();
  }

  // Cambio de skin en caliente: solo reemplaza la paleta consumida por los
  // métodos draw*; no toca el estado de la partida en curso.
  setPalette(palette: PongPalette) {
    this.palette = palette;
  }

  destroy() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }

  // ── Ciclo de vida de la partida ─────────────────────────────────────────
  private initGame() {
    this.playerY = (H - PADDLE_H) / 2;
    this.cpuY = (H - PADDLE_H) / 2;
    this.totalReturns = 0;
    this.score = 0;
    this.lives = START_LIVES;
    this.level = 1;
    this.gameOver = false;
    this.paused = false;
    this.keysDown.clear();
    this.lastTime = null;

    this.serveBall(Math.random() < 0.5 ? -1 : 1);
  }

  // Coloca la pelota en el centro y arma la pausa de saque; el lanzamiento
  // real ocurre cuando serveTimer llega a 0 (ver update()).
  private serveBall(direction: number) {
    this.ball = { x: (W - BALL_SIZE) / 2, y: (H - BALL_SIZE) / 2 };
    this.ballVel = { x: 0, y: 0 };
    this.serveDirection = direction;
    this.serving = true;
    this.serveTimer = SERVE_DELAY_MS;
  }

  private launchBall() {
    const speed = ballBaseSpeed(this.level);
    // Ángulo inicial aleatorio y moderado para que el primer peloteo no
    // arranque ya en un ángulo extremo.
    const angle = (Math.random() * 2 - 1) * (MAX_BOUNCE_ANGLE * 0.4);
    this.ballVel = {
      x: Math.cos(angle) * speed * this.serveDirection,
      y: Math.sin(angle) * speed,
    };
    this.serving = false;
  }

  // ── Input ─────────────────────────────────────────────────────────────
  private static readonly GAME_KEYS = new Set([
    "ArrowUp",
    "ArrowDown",
    "KeyW",
    "KeyS",
  ]);

  private onKeyDown = (e: KeyboardEvent) => {
    // El guard de paused/gameOver va antes del preventDefault: al terminar la
    // partida el modal de fin de juego pide las iniciales por teclado
    // (incluye W/S), y si se llamara preventDefault() sin importar el estado
    // del juego, esas teclas nunca llegarían al <input> del modal.
    if (this.paused || this.gameOver) return;
    if (PongEngine.GAME_KEYS.has(e.code)) e.preventDefault();
    this.setKey(e.code, true);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.setKey(e.code, false);
  };

  // Inyección sintética de input (spec 10/14): mismo estado continuo que ya
  // consumen onKeyDown/onKeyUp (this.keysDown, leído cada frame en
  // updatePlayer), reutilizado por los botones táctiles vía el ref del
  // canvas. El guard de paused/gameOver solo aplica al presionar — soltar
  // siempre se permite para no dejar una tecla "pegada" si la partida termina
  // mientras el botón sigue tocado.
  setKey(code: string, pressed: boolean) {
    if (pressed) {
      if (this.paused || this.gameOver) return;
      this.keysDown.add(code);
    } else {
      this.keysDown.delete(code);
    }
  }

  // ── Simulación ────────────────────────────────────────────────────────
  private updatePlayer() {
    let dy = 0;
    if (this.keysDown.has("ArrowUp") || this.keysDown.has("KeyW")) dy -= 1;
    if (this.keysDown.has("ArrowDown") || this.keysDown.has("KeyS")) dy += 1;
    this.playerY = clamp(this.playerY + dy * PLAYER_SPEED, 0, H - PADDLE_H);
  }

  private updateCpu() {
    const ballCenterY = this.ball.y + BALL_SIZE / 2;
    const paddleCenterY = this.cpuY + PADDLE_H / 2;
    const diff = ballCenterY - paddleCenterY;
    const maxSpeed = cpuMaxSpeed(this.level);
    const step = clamp(diff, -maxSpeed, maxSpeed);
    this.cpuY = clamp(this.cpuY + step, 0, H - PADDLE_H);
  }

  private recomputeLevel() {
    this.level = Math.floor(this.totalReturns / LEVEL_UP_EVERY) + 1;
  }

  // Rebote contra una paleta: refleja la componente X, deflecta la Y según el
  // punto de impacto (más lejos del centro = más ángulo), y acelera +3% la
  // magnitud hasta el tope relativo al nivel actual (base × 1.5).
  private bounceOffPaddle(paddleY: number, towardSign: number) {
    const relative =
      (this.ball.y + BALL_SIZE / 2 - (paddleY + PADDLE_H / 2)) / (PADDLE_H / 2); // -1..1
    const clampedRelative = clamp(relative, -1, 1);
    const angle = clampedRelative * MAX_BOUNCE_ANGLE;

    const currentSpeed = Math.hypot(this.ballVel.x, this.ballVel.y);
    const cap = ballBaseSpeed(this.level) * HIT_SPEED_CAP_MULT;
    const newSpeed = Math.min(currentSpeed * HIT_ACCEL, cap);

    this.ballVel = {
      x: Math.cos(angle) * newSpeed * towardSign,
      y: Math.sin(angle) * newSpeed,
    };
  }

  private updateBall() {
    this.ball.x += this.ballVel.x;
    this.ball.y += this.ballVel.y;

    // Rebote contra el techo/suelo.
    if (this.ball.y <= 0) {
      this.ball.y = 0;
      this.ballVel.y = Math.abs(this.ballVel.y);
    } else if (this.ball.y + BALL_SIZE >= H) {
      this.ball.y = H - BALL_SIZE;
      this.ballVel.y = -Math.abs(this.ballVel.y);
    }

    const playerPaddleX = PADDLE_MARGIN;
    const cpuPaddleX = W - PADDLE_MARGIN - PADDLE_W;

    // Colisión con la paleta del jugador (izquierda): solo si se mueve hacia
    // ella y el cuadrado de la pelota se solapa en X e Y con la paleta.
    if (
      this.ballVel.x < 0 &&
      this.ball.x <= playerPaddleX + PADDLE_W &&
      this.ball.x + BALL_SIZE >= playerPaddleX &&
      this.ball.y + BALL_SIZE >= this.playerY &&
      this.ball.y <= this.playerY + PADDLE_H
    ) {
      this.ball.x = playerPaddleX + PADDLE_W;
      this.bounceOffPaddle(this.playerY, 1);
      this.score += RETURN_SCORE;
      this.totalReturns++;
      this.recomputeLevel();
      return;
    }

    // Colisión con la paleta de la CPU (derecha).
    if (
      this.ballVel.x > 0 &&
      this.ball.x + BALL_SIZE >= cpuPaddleX &&
      this.ball.x <= cpuPaddleX + PADDLE_W &&
      this.ball.y + BALL_SIZE >= this.cpuY &&
      this.ball.y <= this.cpuY + PADDLE_H
    ) {
      this.ball.x = cpuPaddleX - BALL_SIZE;
      this.bounceOffPaddle(this.cpuY, -1);
      return;
    }

    // La pelota rebasa a la CPU por la derecha: gol del jugador.
    if (this.ball.x > W) {
      this.score += GOAL_BONUS;
      this.serveBall(-1); // re-saque hacia el jugador
      return;
    }

    // La pelota rebasa la paleta del jugador por la izquierda: pierde vida.
    if (this.ball.x + BALL_SIZE < 0) {
      this.lives -= 1;
      if (this.lives <= 0) {
        this.lives = 0;
        this.gameOver = true;
      } else {
        this.serveBall(1); // re-saque hacia la CPU
      }
    }
  }

  private update(dt: number) {
    this.updatePlayer();
    this.updateCpu();

    if (this.serving) {
      this.serveTimer -= dt;
      if (this.serveTimer <= 0) this.launchBall();
      return;
    }

    this.updateBall();
  }

  // ── Draw ──────────────────────────────────────────────────────────────
  // Sin HUD/overlay propio: esa info sale por onStateChange (ver
  // specs/14-juego-pong.md). Todos los colores salen de this.palette (skin),
  // sin sprites: motor puramente vectorial.
  private drawBoard() {
    const ctx = this.ctx;
    const p = this.palette;
    ctx.fillStyle = p.background;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = p.centerLine;
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 14]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // El halo de cada paleta usa su propio color de relleno como shadowColor
  // (en clásico ambas son cian, replicando 1:1 el look original).
  private drawPaddle(x: number, y: number, color: string) {
    const ctx = this.ctx;
    const p = this.palette;
    ctx.fillStyle = color;
    if (p.glow > 0) {
      ctx.shadowColor = color;
      ctx.shadowBlur = p.glow;
    }
    ctx.fillRect(x, y, PADDLE_W, PADDLE_H);
    ctx.shadowBlur = 0;
  }

  private drawBall() {
    if (this.serving) return; // sin pelota visible durante la pausa de saque
    const ctx = this.ctx;
    const p = this.palette;
    ctx.fillStyle = p.ball;
    if (p.ballGlow > 0) {
      ctx.shadowColor = p.ballGlowColor;
      ctx.shadowBlur = p.ballGlow;
    }
    ctx.fillRect(this.ball.x, this.ball.y, BALL_SIZE, BALL_SIZE);
    ctx.shadowBlur = 0;
  }

  private draw() {
    this.drawBoard();
    this.drawPaddle(PADDLE_MARGIN, this.playerY, this.palette.playerPaddle);
    this.drawPaddle(
      W - PADDLE_MARGIN - PADDLE_W,
      this.cpuY,
      this.palette.cpuPaddle
    );
    this.drawBall();
  }

  private emitState() {
    const state: PongState = {
      score: this.score,
      lives: this.lives,
      level: this.level,
      gameOver: this.gameOver,
    };
    // Dedupe: el loop corre a 60fps pero score/lives/level/gameOver solo
    // cambian en eventos puntuales. Sin esta comparación, onStateChange
    // dispara un re-render de React 60 veces por segundo aunque nada haya
    // cambiado. Replica 1:1 el patrón de lib/games/snake/engine.ts.
    const last = this.lastEmitted;
    if (
      last &&
      last.score === state.score &&
      last.lives === state.lives &&
      last.level === state.level &&
      last.gameOver === state.gameOver
    ) {
      return;
    }
    this.lastEmitted = state;
    this.callbacks.onStateChange(state);
  }

  // ── Loop principal ───────────────────────────────────────────────────
  // En pausa el rAF sigue vivo (para poder reanudar sin recrear el motor)
  // pero no se avanza la simulación ni se redibuja el movimiento: queda
  // congelado en el último frame dibujado.
  private loop = (ts: number) => {
    if (this.paused) {
      this.rafId = requestAnimationFrame(this.loop);
      return;
    }

    const dt = this.lastTime === null ? 0 : ts - this.lastTime;
    this.lastTime = ts;

    if (!this.gameOver) {
      this.update(dt);
    }

    this.draw();
    this.emitState();
    this.rafId = requestAnimationFrame(this.loop);
  };
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));
