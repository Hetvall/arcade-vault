// Motor de Arkanoid portado 1:1 (mecánicas) desde
// references/started-games/04-arkanoid/game.js y levels.js, ver
// specs/08-juego-arkanoid.md.
//
// Diferencias estructurales respecto al original (no de balance):
// - Todo el estado vive en la instancia de ArkanoidEngine, no en globals de
//   módulo (paddle, ball, blocks, score, ...), para poder montar/desmontar
//   limpiamente con React (incluye StrictMode). Esto incluye el spritesheet
//   cargado (ssImg/ssLoaded), que ya no se comparte entre instancias.
// - No dibuja su propio HUD (Score/Nivel/vidas) ni los overlays de
//   'GAME OVER' / '¡Completaste el juego!' / pausa con selector de nivel
//   (drawOverlay/drawPauseOverlay/PAUSE_BTN_* del original) — ese estado se
//   expone vía el callback onStateChange para que la plataforma lo muestre
//   con su propio HUD/modal.
// - Se elimina el control de paleta por ratón (mousemove) y el handler de
//   click sobre el canvas (selector de nivel en pausa): la plataforma solo
//   soporta teclado para este juego.
// - Se elimina el toggle de pausa por teclado ('p'/'Escape'): pause()/
//   resume() ahora los controla la plataforma (botón PAUSA/REANUDAR), no el
//   propio motor.
// - Se añade un cap de dt (~50ms, mismo patrón que AsteroidsEngine/
//   TetrisEngine) para evitar que un frame largo atraviese la pelota a
//   través de la paleta o un bloque. No es un cambio de balance: solo evita
//   tunneling en frames anómalos.
// - Soporta pause()/resume() reales: update(dt) no avanza en pausa; el loop
//   sigue vivo (rAF sigue pidiéndose) pero no redibuja más que el último
//   frame ni reemite estado.
// - start() es asíncrono: espera a que cargue el spritesheet antes de
//   arrancar el primer requestAnimationFrame, igual que el original
//   (loadSpritesheet(() => {...})), pero comprueba un flag interno de
//   "destruido" para no arrancar el loop si destroy() ya se llamó mientras
//   la imagen cargaba (ver "Riesgos identificados" del spec).

export interface ArkanoidState {
  score: number;
  lives: number;
  level: number; // 1..5
  gameOver: boolean; // true tanto en derrota (lives === 0) como en victoria (nivel 5 superado)
}

export interface ArkanoidCallbacks {
  onStateChange: (state: ArkanoidState) => void;
}

const W = 800;
const H = 600;

const PADDLE_SPEED = 400;
const BLOCK_COLS = 10;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2;
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;

type BlockColor =
  "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green" | "gray";

// ── Contrato de skin ────────────────────────────────────────────────────────
// Arkanoid es sprite-based: todo (paleta, pelota, bloques, explosiones) se
// dibuja desde `spritesheet-breakout.png`, así que una skin de solo color no
// basta. El contrato soporta dos modos:
//   - `useSprites: true` (clásico) → se dibujan los sprites tal cual, sin
//     teñir: réplica 1:1 del look original. Los campos de color se ignoran.
//   - `useSprites: false` (neón/retro) → cada sprite se tiñe: se usa su canal
//     alfa como máscara (globalCompositeOperation "source-in") y se rellena
//     con el color del rol, conservando la silueta del sprite pero cambiando
//     su color. `glow` añade shadowBlur para el bloom neón/fósforo.
// Los bloques mantienen su diferenciación por fila remapeando cada BlockColor
// original a un color de la skin (Record<BlockColor, string>).
export interface ArkanoidPalette {
  background: string; // fondo del canvas
  paddle: string; // tinte de la paleta (raqueta)
  ball: string; // tinte de la pelota
  blocks: Record<BlockColor, string>; // tinte por color de bloque original
  useSprites: boolean; // true = sprites sin teñir (clásico); false = teñidos
  glow: number; // shadowBlur aplicado a cada sprite (0 = sin brillo)
}

// Skin "clásico": réplica 1:1 del look original (fondo negro, sprites del
// spritesheet sin teñir). Es el default y nunca debe reinventarse. Los colores
// declarados son solo de referencia/fallback: con `useSprites: true` no se
// aplican, el dibujo usa directamente el spritesheet.
export const CLASSIC_ARKANOID_PALETTE: ArkanoidPalette = {
  background: "#000000",
  paddle: "#c0c0c0",
  ball: "#ffffff",
  blocks: {
    red: "#ff0000",
    yellow: "#ffff00",
    cyan: "#00ffff",
    magenta: "#ff00ff",
    hotpink: "#ff69b4",
    green: "#00ff00",
    gray: "#808080",
  },
  useSprites: true,
  glow: 0,
};

interface Paddle {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Ball {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
}

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  alive: boolean;
}

interface Explosion {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  elapsed: number;
}

interface Level {
  speed: number;
  blocks: { col: number; row: number; color: BlockColor }[];
}

// ── Niveles (porteados 1:1 desde levels.js) ─────────────────────────────
const LEVELS: Level[] = (() => {
  const rowColors1: BlockColor[] = [
    "red",
    "yellow",
    "cyan",
    "magenta",
    "hotpink",
    "green",
  ];
  const rowColors2: BlockColor[] = [
    "gray",
    "cyan",
    "hotpink",
    "yellow",
    "magenta",
    "green",
  ];
  const rowColors4: BlockColor[] = [
    "cyan",
    "magenta",
    "green",
    "yellow",
    "hotpink",
    "red",
  ];

  const l1: Level["blocks"] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      l1.push({ col, row, color: rowColors1[row] });

  const l2: Level["blocks"] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < 6; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      l2.push({ col, row, color: rowColors2[row] });

  const l3: Level["blocks"] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if ((col + row) % 2 === 0)
        l3.push({ col, row, color: row < 3 ? "yellow" : "magenta" });

  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: Level["blocks"] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if (!gaps4[row].includes(col))
        l4.push({ col, row, color: rowColors4[row] });

  const l5: Level["blocks"] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross)
        l5.push({
          col,
          row,
          color: isCross && !isFrame ? "hotpink" : "cyan",
        });
    }

  return [
    { speed: 1.0, blocks: l1 },
    { speed: 1.1, blocks: l2 },
    { speed: 1.21, blocks: l3 },
    { speed: 1.33, blocks: l4 },
    { speed: 1.46, blocks: l5 },
  ];
})();

// ── Spritesheet (porteado 1:1 desde assets/spritesheet.js) ─────────────
interface SpriteRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

const EXPLOSION_FRAMES: Record<BlockColor, SpriteRect[]> = {
  red: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
  cyan: [
    { sx: 256, sy: 192, sw: 32, sh: 16 },
    { sx: 288, sy: 192, sw: 32, sh: 16 },
    { sx: 320, sy: 192, sw: 32, sh: 16 },
    { sx: 352, sy: 192, sw: 32, sh: 16 },
  ],
  green: [
    { sx: 256, sy: 208, sw: 32, sh: 16 },
    { sx: 288, sy: 208, sw: 32, sh: 16 },
    { sx: 320, sy: 208, sw: 32, sh: 16 },
    { sx: 352, sy: 208, sw: 32, sh: 16 },
  ],
  magenta: [
    { sx: 256, sy: 224, sw: 32, sh: 16 },
    { sx: 288, sy: 224, sw: 32, sh: 16 },
    { sx: 320, sy: 224, sw: 32, sh: 16 },
    { sx: 352, sy: 224, sw: 32, sh: 16 },
  ],
  yellow: [
    { sx: 256, sy: 240, sw: 32, sh: 16 },
    { sx: 288, sy: 240, sw: 32, sh: 16 },
    { sx: 320, sy: 240, sw: 32, sh: 16 },
    { sx: 352, sy: 240, sw: 32, sh: 16 },
  ],
  hotpink: [
    { sx: 256, sy: 256, sw: 32, sh: 16 },
    { sx: 288, sy: 256, sw: 32, sh: 16 },
    { sx: 320, sy: 256, sw: 32, sh: 16 },
    { sx: 352, sy: 256, sw: 32, sh: 16 },
  ],
  gray: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
};

const EXPLOSION_DURATION = 150; // ms

const SPRITES = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 } as SpriteRect,
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 } as SpriteRect,
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  } as Record<BlockColor, SpriteRect>,
};

type GameState = "playing" | "gameover" | "win";

export class ArkanoidEngine {
  private ctx: CanvasRenderingContext2D;
  private callbacks: ArkanoidCallbacks;

  private paddle: Paddle = { x: 0, y: 560, w: 81, h: 14 };
  private ball: Ball = { x: 0, y: 0, w: 16, h: 16, vx: 200, vy: -300 };
  private blocks: Block[] = [];
  private explosions: Explosion[] = [];
  private lives = 3;
  private score = 0;
  private gameState: GameState = "playing";
  private currentLevel = 1;

  private keys = { ArrowLeft: false, ArrowRight: false };

  private bounceSound: HTMLAudioElement;
  private breakSound: HTMLAudioElement;

  // Spritesheet: estado propio de la instancia (no compartido entre
  // engines, a diferencia del original que usaba variables de módulo).
  private ssImg: HTMLCanvasElement | null = null;
  private ssLoaded = false;

  // Paleta de skin inyectada por el constructor (ver ArkanoidPalette). Se puede
  // cambiar en caliente con setPalette sin reiniciar la partida.
  private palette: ArkanoidPalette;
  // Canvas de trabajo reutilizado para teñir sprites (modo no-clásico).
  private tintCanvas: HTMLCanvasElement | null = null;
  private tintCtx: CanvasRenderingContext2D | null = null;

  private started = false;
  private destroyed = false;
  private paused = false;
  private lastTime: number | null = null;
  private rafId: number | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    callbacks: ArkanoidCallbacks,
    palette: ArkanoidPalette = CLASSIC_ARKANOID_PALETTE
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas.");
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.palette = palette;

    this.bounceSound = new Audio("/games/arkanoid/ball-bounce.mp3");
    this.breakSound = new Audio("/games/arkanoid/break-sound.mp3");

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.loadSpritesheet(() => {
      if (this.destroyed) return;
      this.initPaddle();
      this.loadLevel(1);
      this.rafId = requestAnimationFrame(this.loop);
    });
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  // Cambia la skin en caliente. El siguiente frame ya dibuja con la nueva
  // paleta; si el juego está en pausa (sin redibujar), repinta una vez para
  // reflejar el cambio de inmediato.
  setPalette(palette: ArkanoidPalette) {
    this.palette = palette;
    if (this.started && this.paused) this.draw();
  }

  restart() {
    this.score = 0;
    this.lives = 3;
    this.gameState = "playing";
    this.lastTime = null;
    this.initPaddle();
    this.loadLevel(1);
  }

  destroy() {
    this.destroyed = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }

  // ── Input ─────────────────────────────────────────────────────────────
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") e.preventDefault();
    if (e.key in this.keys) this.keys[e.key as keyof typeof this.keys] = true;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.key in this.keys) this.keys[e.key as keyof typeof this.keys] = false;
  };

  // ── Spritesheet ───────────────────────────────────────────────────────
  private loadSpritesheet(cb: () => void) {
    if (this.ssLoaded) {
      cb();
      return;
    }
    const rawImg = new Image();
    rawImg.onload = () => {
      if (this.destroyed) return;
      const oc = document.createElement("canvas");
      oc.width = rawImg.width;
      oc.height = rawImg.height;
      const octx = oc.getContext("2d");
      if (!octx) return;
      octx.drawImage(rawImg, 0, 0);
      this.ssImg = oc;
      this.ssLoaded = true;
      cb();
    };
    rawImg.onerror = () => console.error("Failed to load spritesheet");
    rawImg.src = "/games/arkanoid/spritesheet-breakout.png";
  }

  // Dibuja un frame del spritesheet. Si `tint` es null (skin clásico) lo copia
  // tal cual; si trae color (neón/retro) tiñe el sprite usando su alfa como
  // máscara (source-in), conservando la silueta pero cambiando el color, más un
  // shadowBlur opcional para el bloom.
  private drawFrame(
    frame: SpriteRect,
    x: number,
    y: number,
    w: number,
    h: number,
    tint: string | null = null
  ) {
    if (!this.ssLoaded || !this.ssImg) return;
    const ctx = this.ctx;

    if (!tint) {
      ctx.drawImage(
        this.ssImg,
        frame.sx,
        frame.sy,
        frame.sw,
        frame.sh,
        x,
        y,
        w,
        h
      );
      return;
    }

    if (!this.tintCanvas) {
      this.tintCanvas = document.createElement("canvas");
      this.tintCtx = this.tintCanvas.getContext("2d");
    }
    const tc = this.tintCanvas;
    const tctx = this.tintCtx;
    if (!tctx) return;

    tc.width = frame.sw;
    tc.height = frame.sh;
    tctx.clearRect(0, 0, frame.sw, frame.sh);
    tctx.globalCompositeOperation = "source-over";
    tctx.drawImage(
      this.ssImg,
      frame.sx,
      frame.sy,
      frame.sw,
      frame.sh,
      0,
      0,
      frame.sw,
      frame.sh
    );
    // Rellena solo donde el sprite tiene alfa: silueta teñida.
    tctx.globalCompositeOperation = "source-in";
    tctx.fillStyle = tint;
    tctx.fillRect(0, 0, frame.sw, frame.sh);
    tctx.globalCompositeOperation = "source-over";

    const glow = this.palette.glow;
    if (glow > 0) {
      ctx.shadowBlur = glow;
      ctx.shadowColor = tint;
    }
    ctx.drawImage(tc, 0, 0, frame.sw, frame.sh, x, y, w, h);
    ctx.shadowBlur = 0;
  }

  private drawBlockSprite(
    color: BlockColor,
    x: number,
    y: number,
    w: number,
    h: number
  ) {
    const tint = this.palette.useSprites ? null : this.palette.blocks[color];
    this.drawFrame(SPRITES.blocks[color], x, y, w, h, tint);
  }

  // ── Ciclo de vida de la partida ─────────────────────────────────────────
  private initPaddle() {
    this.paddle.x = (W - this.paddle.w) / 2;
  }

  private initBall() {
    const speed = LEVELS[this.currentLevel - 1].speed;
    this.ball.x = this.paddle.x + (this.paddle.w - this.ball.w) / 2;
    this.ball.y = this.paddle.y - this.ball.h;
    this.ball.vx = BASE_BALL_VX * speed;
    this.ball.vy = BASE_BALL_VY * speed;
  }

  private loadLevel(n: number) {
    this.currentLevel = n;
    const level = LEVELS[n - 1];
    this.blocks = level.blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    this.explosions = [];
    this.ball.x = this.paddle.x + (this.paddle.w - this.ball.w) / 2;
    this.ball.y = this.paddle.y - this.ball.h;
    this.ball.vx = BASE_BALL_VX * level.speed;
    this.ball.vy = BASE_BALL_VY * level.speed;
  }

  // Clona el elemento de audio antes de reproducirlo para permitir solape
  // de instancias simultáneas (varios rebotes/roturas en el mismo frame),
  // igual que bounceSound.cloneNode().play() del original.
  private playSound(audio: HTMLAudioElement) {
    (audio.cloneNode(false) as HTMLAudioElement).play();
  }

  private collideAABB(block: Block): boolean {
    const ball = this.ball;
    return (
      ball.x < block.x + block.w &&
      ball.x + ball.w > block.x &&
      ball.y < block.y + block.h &&
      ball.y + ball.h > block.y
    );
  }

  // ── Update ────────────────────────────────────────────────────────────
  private update(dt: number) {
    if (this.gameState !== "playing") return;

    const paddle = this.paddle;
    const ball = this.ball;

    // Paddle
    if (this.keys.ArrowLeft)
      paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (this.keys.ArrowRight)
      paddle.x = Math.min(W - paddle.w, paddle.x + PADDLE_SPEED * dt);

    // Ball movement
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Wall bounces (left, right, top)
    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
      this.playSound(this.bounceSound);
    }
    if (ball.x + ball.w >= W) {
      ball.x = W - ball.w;
      ball.vx = -Math.abs(ball.vx);
      this.playSound(this.bounceSound);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
      this.playSound(this.bounceSound);
    }

    // Paddle bounce
    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
      this.playSound(this.bounceSound);
    }

    // Block collisions
    for (const block of this.blocks) {
      if (!block.alive) continue;
      if (this.collideAABB(block)) {
        block.alive = false;
        this.explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        this.score += 10;
        ball.vy = -ball.vy;
        this.playSound(this.breakSound);
        if (this.blocks.every((b) => !b.alive)) {
          if (this.currentLevel < 5) this.loadLevel(this.currentLevel + 1);
          else this.gameState = "win";
        }
        break; // un bloque por frame
      }
    }

    // Explosions
    for (const exp of this.explosions) exp.elapsed += dt * 1000;
    this.explosions = this.explosions.filter(
      (exp) => exp.elapsed < EXPLOSION_DURATION
    );

    // Ball lost
    if (ball.y > H) {
      this.lives--;
      if (this.lives <= 0) {
        this.lives = 0;
        this.gameState = "gameover";
      } else {
        this.initBall();
      }
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────────
  // Sin HUD ni overlays (drawOverlay/drawPauseOverlay del original): ese
  // estado se expone vía onStateChange para que la plataforma lo muestre
  // con su propio HUD/modal (ver specs/08-juego-arkanoid.md).
  private draw() {
    const ctx = this.ctx;
    const palette = this.palette;
    const sprites = palette.useSprites;
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, W, H);

    for (const block of this.blocks) {
      if (block.alive)
        this.drawBlockSprite(block.color, block.x, block.y, block.w, block.h);
    }

    for (const exp of this.explosions) {
      const frameIndex = Math.min(
        Math.floor((exp.elapsed / EXPLOSION_DURATION) * 4),
        3
      );
      this.drawFrame(
        EXPLOSION_FRAMES[exp.color][frameIndex],
        exp.x,
        exp.y,
        exp.w,
        exp.h,
        sprites ? null : palette.blocks[exp.color]
      );
    }

    this.drawFrame(
      SPRITES.paddle,
      this.paddle.x,
      this.paddle.y,
      this.paddle.w,
      this.paddle.h,
      sprites ? null : palette.paddle
    );
    this.drawFrame(
      SPRITES.ball,
      this.ball.x,
      this.ball.y,
      this.ball.w,
      this.ball.h,
      sprites ? null : palette.ball
    );
  }

  private emitState() {
    this.callbacks.onStateChange({
      score: this.score,
      lives: this.lives,
      level: this.currentLevel,
      gameOver: this.gameState === "gameover" || this.gameState === "win",
    });
  }

  // ── Loop principal ───────────────────────────────────────────────────
  private loop = (ts: number) => {
    if (this.paused) {
      this.rafId = requestAnimationFrame(this.loop);
      return;
    }

    const dt =
      this.lastTime === null ? 0 : Math.min((ts - this.lastTime) / 1000, 0.05);
    this.lastTime = ts;
    this.update(dt);
    this.draw();
    this.emitState();
    this.rafId = requestAnimationFrame(this.loop);
  };
}
