// Motor de Snake escrito desde cero (no hay game.js de referencia para este
// juego), ver specs/09-juego-snake.md. Sigue el mismo contrato que
// AsteroidsEngine/TetrisEngine/ArkanoidEngine para montaje/desmontaje limpio
// con React (incluye StrictMode):
// - Todo el estado vive en la instancia, nada en globals de módulo.
// - No dibuja su propio HUD ni overlay de PAUSA/GAME OVER: esa info sale por
//   onStateChange para que la plataforma la pinte con su propio HUD/modal.
// - Sin auto-reinicio al perder; al chocar el engine se queda en
//   gameOver: true esperando a que algo externo llame a restart().
// - constructor no arranca el loop; start() es idempotente.

export interface SnakeState {
  score: number;
  length: number; // nº de segmentos de la serpiente
  level: number; // tier de velocidad (empieza en 1)
  gameOver: boolean;
}

export interface SnakeCallbacks {
  onStateChange: (state: SnakeState) => void;
}

// ── Contrato de skin ────────────────────────────────────────────────────────
// Paleta inyectada por el constructor y consumida por los métodos draw* en
// lugar de literales de color.
//
// Snake es sprite-based (la comida se dibuja desde /snake-assets/fruits.png),
// así que una skin de solo color no basta para la fruta. Enfoque: la serpiente,
// el tablero y la rejilla se recolorean con tokens planos; la fruta se **tiñe**
// dibujándola en un canvas offscreen y superponiendo el color de la skin con
// `globalCompositeOperation = "source-atop"` (respeta la silueta y el sombreado
// del sprite pero desplaza su tono hacia el acento de la skin). `foodTint: null`
// (clásico) deja el sprite intacto.
export interface SnakePalette {
  background: string; // fondo del tablero
  grid: string; // líneas de rejilla (incluye su propio alfa)
  snakeHead: string; // primer segmento
  snakeBody: string; // resto de segmentos
  snakeGlow: string; // shadowColor de la serpiente
  glowHead: number; // shadowBlur de la cabeza (0 = sin brillo)
  glowBody: number; // shadowBlur del cuerpo
  foodTint: string | null; // color de tinte del sprite de fruta; null = intacto
  foodTintAlpha: number; // intensidad del tinte (0..1); ignorado si foodTint null
  foodFallback: string; // color del rombo mientras carga fruits.png
}

// Skin "clásico": réplica 1:1 de los literales que el engine ya usaba (fondo
// verde-negro, cabeza verde clara, cuerpo verde, fruta sin teñir). Es el
// default y nunca debe reinventarse.
export const CLASSIC_SNAKE_PALETTE: SnakePalette = {
  background: "#0a0f0a",
  grid: "rgba(0, 255, 128, 0.08)",
  snakeHead: "#7cff7c",
  snakeBody: "#22e06a",
  snakeGlow: "#22e06a",
  glowHead: 12,
  glowBody: 6,
  foodTint: null,
  foodTintAlpha: 0,
  foodFallback: "#ff4d6d",
};

const GRID = 20; // celdas por lado
const CELL = 40; // px lógicos por celda (canvas 800x800)
const CANVAS_SIZE = GRID * CELL;

const START_LENGTH = 3;
const TICK_START_MS = 140;
const TICK_STEP_MS = 12;
const TICK_FLOOR_MS = 60;
const LEVEL_UP_EVERY = 5; // frutas por nivel
const FRUIT_SCORE = 10;

interface Vec {
  x: number;
  y: number;
}

// Coordenadas del atlas de frutas (fila y=136, alto 160), tomadas de
// references/source-assets/snake-assets/sprites.js. Solo se usa esta fila;
// el resto del atlas de fruits.png no se porta (fuera de alcance).
interface FruitFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FRUITS: FruitFrame[] = [
  { x: 34, y: 136, w: 110, h: 160 }, // banana
  { x: 186, y: 136, w: 150, h: 160 }, // orange
  { x: 378, y: 136, w: 110, h: 160 }, // grape
  { x: 540, y: 136, w: 130, h: 160 }, // garlic
  { x: 712, y: 136, w: 130, h: 160 }, // eggplant
  { x: 894, y: 136, w: 110, h: 160 }, // strawberry
  { x: 1066, y: 136, w: 110, h: 160 }, // cherry
  { x: 1228, y: 136, w: 130, h: 160 }, // carrot
  { x: 1400, y: 136, w: 130, h: 160 }, // mushroom
  { x: 1582, y: 136, w: 110, h: 160 }, // broccoli
  { x: 1734, y: 136, w: 150, h: 160 }, // watermelon
  { x: 1906, y: 136, w: 150, h: 160 }, // pepper
  { x: 2068, y: 136, w: 170, h: 160 }, // kiwi
  { x: 2250, y: 136, w: 140, h: 160 }, // lemon
  { x: 2432, y: 136, w: 130, h: 160 }, // peach
  { x: 2604, y: 136, w: 130, h: 160 }, // peanut
  { x: 2786, y: 136, w: 110, h: 160 }, // apple
  { x: 2948, y: 136, w: 130, h: 160 }, // tomato
  { x: 3110, y: 136, w: 150, h: 160 }, // berries
  { x: 3302, y: 136, w: 110, h: 160 }, // grapes2
  { x: 3454, y: 136, w: 150, h: 160 }, // pineapple
  { x: 3637, y: 136, w: 130, h: 160 }, // melon
];

const DIR_UP: Vec = { x: 0, y: -1 };
const DIR_DOWN: Vec = { x: 0, y: 1 };
const DIR_LEFT: Vec = { x: -1, y: 0 };
const DIR_RIGHT: Vec = { x: 1, y: 0 };

export class SnakeEngine {
  private ctx: CanvasRenderingContext2D;
  private callbacks: SnakeCallbacks;
  private palette: SnakePalette;
  private image: HTMLImageElement;
  private imageLoaded = false;

  // Canvas offscreen reutilizable para teñir el sprite de fruta sin afectar al
  // resto del tablero (ver comentario en SnakePalette). Se crea perezosamente.
  private tintCanvas: HTMLCanvasElement | null = null;
  private tintCtx: CanvasRenderingContext2D | null = null;

  private snake!: Vec[];
  private direction!: Vec;
  private queuedDirection!: Vec;
  private food!: { pos: Vec; frame: FruitFrame };
  private fruitsEaten = 0;

  private score = 0;
  private length = START_LENGTH;
  private level = 1;
  private gameOver = false;

  private paused = false;
  private lastTime: number | null = null;
  private tickAccum = 0;
  private tickInterval = TICK_START_MS;
  private rafId: number | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    callbacks: SnakeCallbacks,
    palette: SnakePalette = CLASSIC_SNAKE_PALETTE
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas.");
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.palette = palette;

    this.image = new Image();
    this.image.onload = () => {
      this.imageLoaded = true;
    };
    this.image.src = "/snake-assets/fruits.png";

    window.addEventListener("keydown", this.onKeyDown);

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

  // Cambio de skin en caliente: el reproductor lo llama sin recrear el motor ni
  // reiniciar la partida. El próximo frame ya se dibuja con la nueva paleta.
  setPalette(palette: SnakePalette) {
    this.palette = palette;
  }

  destroy() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener("keydown", this.onKeyDown);
  }

  // ── Ciclo de vida de la partida ─────────────────────────────────────────
  private initGame() {
    const midY = Math.floor(GRID / 2);
    const midX = Math.floor(GRID / 2);
    // Cabeza a la derecha, cola hacia la izquierda, avanzando a la derecha.
    this.snake = [
      { x: midX, y: midY },
      { x: midX - 1, y: midY },
      { x: midX - 2, y: midY },
    ];
    this.direction = { ...DIR_RIGHT };
    this.queuedDirection = { ...DIR_RIGHT };
    this.fruitsEaten = 0;
    this.score = 0;
    this.length = START_LENGTH;
    this.level = 1;
    this.gameOver = false;
    this.paused = false;
    this.tickInterval = TICK_START_MS;
    this.tickAccum = 0;
    this.lastTime = null;

    this.placeFood();
  }

  private placeFood() {
    const occupied = new Set(this.snake.map((s) => `${s.x},${s.y}`));
    const free: Vec[] = [];
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if (!occupied.has(`${x},${y}`)) free.push({ x, y });
      }
    }
    // Sin celdas libres (victoria teórica): no hay comida que colocar.
    if (free.length === 0) return;
    const pos = free[Math.floor(Math.random() * free.length)];
    const frame = FRUITS[Math.floor(Math.random() * FRUITS.length)];
    this.food = { pos, frame };
  }

  // ── Input ─────────────────────────────────────────────────────────────
  // Flechas y WASD cambian de dirección; el giro opuesto directo (180°) se
  // ignora comparando contra la dirección actual del tick (no la encolada),
  // igual que el clásico.
  private static readonly GAME_KEYS = new Set([
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
  ]);

  private isOpposite(a: Vec, b: Vec): boolean {
    return a.x === -b.x && a.y === -b.y;
  }

  private queueDirection(next: Vec) {
    if (this.isOpposite(next, this.direction)) return;
    this.queuedDirection = next;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    // El guard de paused/gameOver va antes del preventDefault: al terminar
    // la partida el modal de fin de juego pide las iniciales por teclado
    // (incluye letras WASD), y si se llamara preventDefault() sin importar
    // el estado del juego, esas teclas nunca llegarían al <input> del modal.
    if (this.paused || this.gameOver) return;
    if (SnakeEngine.GAME_KEYS.has(e.code)) e.preventDefault();

    this.handleAction(e.code);
  };

  // Seam de input sintético (spec 10): reutilizado por el listener real de
  // teclado (onKeyDown) y por pressKey (controles táctiles). El guard de
  // paused/gameOver ya lo aplica onKeyDown antes de llamar aquí; pressKey
  // lo repite para que el táctil respete la misma regla sin pasar por el
  // listener de teclado.
  private handleAction(code: string) {
    if (this.paused || this.gameOver) return;
    switch (code) {
      case "ArrowUp":
      case "KeyW":
        this.queueDirection(DIR_UP);
        break;
      case "ArrowDown":
      case "KeyS":
        this.queueDirection(DIR_DOWN);
        break;
      case "ArrowLeft":
      case "KeyA":
        this.queueDirection(DIR_LEFT);
        break;
      case "ArrowRight":
      case "KeyD":
        this.queueDirection(DIR_RIGHT);
        break;
    }
  }

  // Controles táctiles (spec 10): una pulsación = una acción (cambia la
  // dirección encolada); la serpiente sigue avanzando sola en el próximo
  // tick, igual que con el teclado.
  pressKey(code: string) {
    this.handleAction(code);
  }

  // ── Simulación ────────────────────────────────────────────────────────
  private tick() {
    if (this.gameOver) return;

    this.direction = this.queuedDirection;
    const head = this.snake[0];
    const newHead: Vec = {
      x: head.x + this.direction.x,
      y: head.y + this.direction.y,
    };

    if (
      newHead.x < 0 ||
      newHead.x >= GRID ||
      newHead.y < 0 ||
      newHead.y >= GRID
    ) {
      this.gameOver = true;
      return;
    }
    if (this.snake.some((s) => s.x === newHead.x && s.y === newHead.y)) {
      this.gameOver = true;
      return;
    }

    this.snake.unshift(newHead);

    const ateFood =
      newHead.x === this.food.pos.x && newHead.y === this.food.pos.y;
    if (ateFood) {
      this.score += FRUIT_SCORE;
      this.fruitsEaten++;
      this.length = this.snake.length;
      this.level = Math.floor(this.fruitsEaten / LEVEL_UP_EVERY) + 1;
      this.tickInterval = Math.max(
        TICK_FLOOR_MS,
        TICK_START_MS - (this.level - 1) * TICK_STEP_MS
      );
      this.placeFood();
    } else {
      this.snake.pop();
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────────
  // Sin HUD/overlay propio: esa info sale por onStateChange (ver
  // specs/09-juego-snake.md).
  private drawBoard() {
    const ctx = this.ctx;
    ctx.fillStyle = this.palette.background;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.strokeStyle = this.palette.grid;
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL, 0);
      ctx.lineTo(i * CELL, CANVAS_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL);
      ctx.lineTo(CANVAS_SIZE, i * CELL);
      ctx.stroke();
    }
  }

  private drawSnake() {
    const ctx = this.ctx;
    const pal = this.palette;
    this.snake.forEach((seg, i) => {
      const isHead = i === 0;
      ctx.fillStyle = isHead ? pal.snakeHead : pal.snakeBody;
      ctx.shadowColor = pal.snakeGlow;
      ctx.shadowBlur = isHead ? pal.glowHead : pal.glowBody;
      ctx.fillRect(seg.x * CELL + 2, seg.y * CELL + 2, CELL - 4, CELL - 4);
      ctx.shadowBlur = 0;
    });
  }

  // Devuelve (creándolo perezosamente) el canvas offscreen de tinte de fruta.
  private getTintCtx(size: number): CanvasRenderingContext2D | null {
    if (!this.tintCanvas) {
      this.tintCanvas = document.createElement("canvas");
      this.tintCanvas.width = size;
      this.tintCanvas.height = size;
      this.tintCtx = this.tintCanvas.getContext("2d");
    }
    return this.tintCtx;
  }

  private drawFood() {
    if (!this.food) return;
    const ctx = this.ctx;
    const pal = this.palette;
    const pad = 4;
    const dx = this.food.pos.x * CELL + pad;
    const dy = this.food.pos.y * CELL + pad;
    const size = CELL - pad * 2;

    if (this.imageLoaded) {
      const f = this.food.frame;
      const octx = pal.foodTint ? this.getTintCtx(size) : null;
      if (pal.foodTint && octx && this.tintCanvas) {
        // Teñir el sprite en el offscreen: dibujar la fruta y superponer el
        // color de la skin solo donde el sprite es opaco (source-atop). Se
        // conserva la silueta y el sombreado del sprite; el tono se desplaza
        // hacia el acento de la skin.
        octx.clearRect(0, 0, size, size);
        octx.globalCompositeOperation = "source-over";
        octx.globalAlpha = 1;
        octx.drawImage(this.image, f.x, f.y, f.w, f.h, 0, 0, size, size);
        octx.globalCompositeOperation = "source-atop";
        octx.globalAlpha = pal.foodTintAlpha;
        octx.fillStyle = pal.foodTint;
        octx.fillRect(0, 0, size, size);
        octx.globalCompositeOperation = "source-over";
        octx.globalAlpha = 1;
        ctx.drawImage(this.tintCanvas, dx, dy);
      } else {
        ctx.drawImage(this.image, f.x, f.y, f.w, f.h, dx, dy, size, size);
      }
    } else {
      // Respaldo mientras carga fruits.png: rombo de color plano.
      ctx.fillStyle = pal.foodFallback;
      ctx.beginPath();
      ctx.moveTo(dx + size / 2, dy);
      ctx.lineTo(dx + size, dy + size / 2);
      ctx.lineTo(dx + size / 2, dy + size);
      ctx.lineTo(dx, dy + size / 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  private draw() {
    this.drawBoard();
    this.drawFood();
    this.drawSnake();
  }

  private emitState() {
    this.callbacks.onStateChange({
      score: this.score,
      length: this.length,
      level: this.level,
      gameOver: this.gameOver,
    });
  }

  // ── Loop principal ───────────────────────────────────────────────────
  // En pausa el rAF sigue vivo (para poder reanudar sin recrear el motor)
  // pero no se avanza el tick ni se redibuja el movimiento: queda congelado
  // en el último frame dibujado.
  private loop = (ts: number) => {
    if (this.paused) {
      this.rafId = requestAnimationFrame(this.loop);
      return;
    }

    const dt = this.lastTime === null ? 0 : ts - this.lastTime;
    this.lastTime = ts;

    if (!this.gameOver) {
      this.tickAccum += dt;
      if (this.tickAccum >= this.tickInterval) {
        this.tickAccum = 0;
        this.tick();
      }
    }

    this.draw();
    this.emitState();
    this.rafId = requestAnimationFrame(this.loop);
  };
}
