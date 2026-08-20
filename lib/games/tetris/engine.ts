// Motor de Tetris portado 1:1 (mecánicas) desde
// references/started-games/03-tetris/game.js, ver specs/07-juego-tetris.md.
//
// Diferencias estructurales respecto al original (no de balance):
// - Todo el estado vive en la instancia de TetrisEngine, no en globals de
//   módulo, para poder montar/desmontar limpiamente con React (incluye
//   StrictMode).
// - No dibuja su propio HUD (updateHUD) ni el overlay compartido de
//   PAUSA/GAME OVER (overlay/overlayTitle/overlayScore) — ese estado se
//   expone vía el callback onStateChange para que la plataforma lo muestre
//   con su propio HUD/modal.
// - No hay auto-reinicio al perder ni botón #restart-btn; al colisionar en
//   spawn() el engine se queda en gameOver: true esperando a que algo
//   externo llame a restart().
// - Soporta pause()/resume() reales; la tecla P se conserva como atajo de
//   pausa interno además del control por props (ver TetrisCanvas).
// - El toggle de tema claro/oscuro del original no se porta: Arcade Vault
//   ya tiene su propio tema fijo resuelto en app/globals.css.
// - drawGrid() lee la variable CSS --line ya definida en app/globals.css
//   (el original usaba --grid-line, que no existe en el tema de la
//   plataforma; --line cumple el mismo rol de color de línea de grilla).

export interface TetrisState {
  score: number;
  lines: number;
  level: number;
  gameOver: boolean;
}

export interface TetrisCallbacks {
  onStateChange: (state: TetrisState) => void;
}

// ── Contrato de skin ────────────────────────────────────────────────────────
// Paleta inyectada por el constructor y consumida por los métodos draw* en
// lugar de literales de color. `blocks` es un array indexado igual que el
// antiguo COLORS (índice 0 = celda vacía, 1..7 = las 7 piezas, 8 = tuerca
// deshabilitada) para que el sorteo por tipo de pieza siga funcionando 1:1.
// `background` puede ser null para no pintar fondo y dejar ver el CRT detrás
// (comportamiento clásico original, que solo hacía clearRect). `glow` es el
// shadowBlur aplicado a los bloques (0 = sin brillo, como el look clásico).
export interface TetrisPalette {
  background: string | null; // relleno tras clear; null = transparente
  grid: string; // color de las líneas de la rejilla
  blockHighlight: string; // franja de brillo superior de cada bloque
  blocks: (string | null)[]; // color por índice de pieza (0 = vacío)
  glow: number; // shadowBlur de los bloques; 0 = sin brillo
}

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - yellow
  "#ba68c8", // T - purple
  "#81c784", // S - green
  "#e57373", // Z - red
  "#90caf9", // J - pale blue
  "#ffb74d", // L - orange
  "#9e9e9e", // N - tuerca (gris metálico)
];

// Skin "clásico": réplica 1:1 del look original hardcodeado del engine
// (bloques del array COLORS, brillo blanco a 0.12, rejilla = --line #0a0a0f
// cian tenue, sin fondo propio, sin glow). Es el default y nunca se reinventa.
export const CLASSIC_TETRIS_PALETTE: TetrisPalette = {
  background: null,
  grid: "rgba(0, 245, 255, 0.18)", // = --line en app/globals.css
  blockHighlight: "rgba(255,255,255,0.12)",
  blocks: COLORS,
  glow: 0,
};

const PIECES: (number[][] | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  // [
  //   [8, 8, 8],
  //   [8, 0, 8],
  //   [8, 8, 8],
  // ], // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

interface Piece {
  type: number;
  shape: number[][];
  x: number;
  y: number;
}

export class TetrisEngine {
  private ctx: CanvasRenderingContext2D;
  private nextCtx: CanvasRenderingContext2D;
  private callbacks: TetrisCallbacks;
  private palette: TetrisPalette;

  private board!: number[][];
  private current!: Piece;
  private next!: Piece;
  private score = 0;
  private lines = 0;
  private level = 1;
  private gameOver = false;

  private paused = false;
  private lastTime: number | null = null;
  private dropAccum = 0;
  private dropInterval = 1000;
  private rafId: number | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    nextCanvas: HTMLCanvasElement,
    callbacks: TetrisCallbacks,
    palette: TetrisPalette = CLASSIC_TETRIS_PALETTE
  ) {
    const ctx = canvas.getContext("2d");
    const nextCtx = nextCanvas.getContext("2d");
    if (!ctx || !nextCtx)
      throw new Error("No se pudo obtener el contexto 2D de los canvases.");
    this.ctx = ctx;
    this.nextCtx = nextCtx;
    this.callbacks = callbacks;
    this.palette = palette;

    window.addEventListener("keydown", this.onKeyDown);

    this.initGame();
  }

  // Cambia la paleta en caliente (cambio de skin sin recrear el motor ni
  // reiniciar la partida). El siguiente frame ya se dibuja con ella; la
  // preview de la siguiente pieza se redibuja de inmediato.
  setPalette(palette: TetrisPalette) {
    this.palette = palette;
    this.drawNext();
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

  destroy() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener("keydown", this.onKeyDown);
  }

  // ── Input ─────────────────────────────────────────────────────────────
  // Teclas de control del juego: se les hace preventDefault() para que el
  // navegador no las interprete como scroll de la página (sobre todo
  // ArrowDown/ArrowUp/Space), igual que GAME_KEYS en AsteroidsEngine
  // (ver lib/games/asteroids/engine.ts).
  private static readonly GAME_KEYS = new Set([
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Space",
  ]);

  private togglePause() {
    if (this.gameOver) return;
    this.paused = !this.paused;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (TetrisEngine.GAME_KEYS.has(e.code)) e.preventDefault();

    if (e.code === "KeyP") {
      this.togglePause();
      return;
    }
    this.handleAction(e.code);
  };

  // Seam de input sintético (spec 10): reutilizado por el listener real de
  // teclado (onKeyDown) y por pressKey (controles táctiles). No incluye
  // KeyP/pausa (fuera de alcance de este spec, sigue siendo exclusivo de
  // teclado). El guard de paused/gameOver se preserva intacto porque vive
  // dentro de esta función compartida.
  private handleAction(code: string) {
    if (this.paused || this.gameOver) return;
    switch (code) {
      case "ArrowLeft":
        if (
          !this.collide(this.current.shape, this.current.x - 1, this.current.y)
        )
          this.current.x--;
        break;
      case "ArrowRight":
        if (
          !this.collide(this.current.shape, this.current.x + 1, this.current.y)
        )
          this.current.x++;
        break;
      case "ArrowDown":
        this.softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        this.tryRotate();
        break;
      case "Space":
        this.hardDrop();
        break;
    }
  }

  // Controles táctiles (spec 10): una pulsación = una acción, igual que el
  // teclado en modo discreto.
  pressKey(code: string) {
    this.handleAction(code);
  }

  // ── Ciclo de vida de la partida ─────────────────────────────────────────
  private initGame() {
    this.board = this.createBoard();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.paused = false;
    this.gameOver = false;
    this.dropInterval = 1000;
    this.dropAccum = 0;
    this.lastTime = null;
    this.next = this.randomPiece();
    this.spawn();
  }

  private createBoard(): number[][] {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  }

  private randomPiece(): Piece {
    // NOTA: la pieza N/"tuerca" (type 8) está deshabilitada a pedido
    // explícito del usuario durante la implementación de SPEC 07 — el sorteo
    // se limita a 7 piezas (1-7) en vez de las 8 del original. Esto es una
    // desviación consciente del criterio de aceptación "8 piezas incluida la
    // tuerca"; queda pendiente reflejarlo en specs/07-juego-tetris.md.
    const type = Math.floor(Math.random() * 7) + 1;
    const shape = (PIECES[type] as number[][]).map((row) => [...row]);
    return {
      type,
      shape,
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };
  }

  private collide(shape: number[][], ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && this.board[ny][nx]) return true;
      }
    }
    return false;
  }

  private rotateCW(shape: number[][]): number[][] {
    const rows = shape.length,
      cols = shape[0].length;
    const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
    return result;
  }

  private tryRotate() {
    const rotated = this.rotateCW(this.current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!this.collide(rotated, this.current.x + kick, this.current.y)) {
        this.current.shape = rotated;
        this.current.x += kick;
        return;
      }
    }
  }

  private merge() {
    for (let r = 0; r < this.current.shape.length; r++)
      for (let c = 0; c < this.current.shape[r].length; c++)
        if (this.current.shape[r][c])
          this.board[this.current.y + r][this.current.x + c] =
            this.current.shape[r][c];
  }

  private clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r].every((v) => v !== 0)) {
        this.board.splice(r, 1);
        this.board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      this.lines += cleared;
      this.score += (LINE_SCORES[cleared] || 0) * this.level;
      this.level = Math.floor(this.lines / 10) + 1;
      this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 90);
    }
  }

  private ghostY(): number {
    let gy = this.current.y;
    while (!this.collide(this.current.shape, this.current.x, gy + 1)) gy++;
    return gy;
  }

  private hardDrop() {
    const gy = this.ghostY();
    this.score += (gy - this.current.y) * 2;
    this.current.y = gy;
    this.lockPiece();
  }

  private softDrop() {
    if (!this.collide(this.current.shape, this.current.x, this.current.y + 1)) {
      this.current.y++;
      this.score += 1;
    } else {
      this.lockPiece();
    }
  }

  private lockPiece() {
    this.merge();
    this.clearLines();
    this.spawn();
  }

  private spawn() {
    this.current = this.next;
    this.next = this.randomPiece();
    if (this.collide(this.current.shape, this.current.x, this.current.y)) {
      this.gameOver = true;
    }
    this.drawNext();
  }

  // ── Draw ──────────────────────────────────────────────────────────────
  // Sin updateHUD() ni overlay('PAUSA'/'GAME OVER', ...): esa información
  // se expone vía onStateChange para que la plataforma la muestre con su
  // propio HUD/modal (ver specs/07-juego-tetris.md).
  private drawBlock(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    alpha?: number
  ) {
    if (!colorIndex) return;
    const color = this.palette.blocks[colorIndex];
    if (!color) return;
    context.globalAlpha = alpha ?? 1;
    if (this.palette.glow > 0) {
      context.shadowBlur = this.palette.glow;
      context.shadowColor = color;
    }
    context.fillStyle = color;
    context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    context.shadowBlur = 0;
    // highlight
    context.fillStyle = this.palette.blockHighlight;
    context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    context.globalAlpha = 1;
  }

  private drawGrid() {
    this.ctx.strokeStyle = this.palette.grid;
    this.ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      this.ctx.beginPath();
      this.ctx.moveTo(c * BLOCK, 0);
      this.ctx.lineTo(c * BLOCK, ROWS * BLOCK);
      this.ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, r * BLOCK);
      this.ctx.lineTo(COLS * BLOCK, r * BLOCK);
      this.ctx.stroke();
    }
  }

  private draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, COLS * BLOCK, ROWS * BLOCK);
    // Fondo propio de la skin (clásico = null: se deja ver el CRT detrás,
    // como el original que solo hacía clearRect).
    if (this.palette.background) {
      ctx.fillStyle = this.palette.background;
      ctx.fillRect(0, 0, COLS * BLOCK, ROWS * BLOCK);
    }
    this.drawGrid();

    // board
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        this.drawBlock(ctx, c, r, this.board[r][c], BLOCK);

    // ghost
    const gy = this.ghostY();
    for (let r = 0; r < this.current.shape.length; r++)
      for (let c = 0; c < this.current.shape[r].length; c++)
        if (this.current.shape[r][c])
          this.drawBlock(
            ctx,
            this.current.x + c,
            gy + r,
            this.current.shape[r][c],
            BLOCK,
            0.2
          );

    // current piece
    for (let r = 0; r < this.current.shape.length; r++)
      for (let c = 0; c < this.current.shape[r].length; c++)
        this.drawBlock(
          ctx,
          this.current.x + c,
          this.current.y + r,
          this.current.shape[r][c],
          BLOCK
        );
  }

  private drawNext() {
    const NB = 30;
    const nextCtx = this.nextCtx;
    nextCtx.clearRect(0, 0, 120, 120);
    if (this.palette.background) {
      nextCtx.fillStyle = this.palette.background;
      nextCtx.fillRect(0, 0, 120, 120);
    }
    const shape = this.next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        this.drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
  }

  private emitState() {
    this.callbacks.onStateChange({
      score: this.score,
      lines: this.lines,
      level: this.level,
      gameOver: this.gameOver,
    });
  }

  // ── Loop principal ───────────────────────────────────────────────────
  // En pausa el rAF sigue vivo (para poder reanudar sin recrear el motor)
  // pero no se redibuja ni se avanza el auto-drop: se queda congelado en
  // el último frame dibujado.
  private loop = (ts: number) => {
    if (this.paused) {
      this.rafId = requestAnimationFrame(this.loop);
      return;
    }

    const dt = this.lastTime === null ? 0 : ts - this.lastTime;
    this.lastTime = ts;

    if (!this.gameOver) {
      this.dropAccum += dt;
      if (this.dropAccum >= this.dropInterval) {
        this.dropAccum = 0;
        if (
          !this.collide(this.current.shape, this.current.x, this.current.y + 1)
        ) {
          this.current.y++;
        } else {
          this.lockPiece();
        }
      }
    }

    this.draw();
    this.emitState();
    this.rafId = requestAnimationFrame(this.loop);
  };
}
