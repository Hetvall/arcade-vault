// Motor de Space Invaders construido desde cero (no hay game.js de
// referencia en references/started-games/ para este juego), ver
// specs/15-juego-space-invaders.md. Todas las mecánicas y valores de balance
// (velocidades, puntos, cooldowns, probabilidades) son decisiones de diseño
// fijadas en ese spec, no un porteo 1:1.
//
// Sigue el mismo contrato que AsteroidsEngine/ArkanoidEngine: todo el estado
// vive en la instancia (sin globals de módulo) para poder montar/desmontar
// limpiamente con React (incluye StrictMode); no dibuja su propio HUD/overlay
// (score/vidas/nivel/fin de partida) — eso se expone vía onStateChange para
// que la plataforma lo pinte con su HUD/modal; sin auto-reinicio en game
// over, queda congelado esperando restart(); pause()/resume() controlan si
// update(dt) avanza.

export interface SpaceInvadersState {
  score: number;
  lives: number;
  level: number;
  gameOver: boolean;
}

export interface SpaceInvadersCallbacks {
  onStateChange: (state: SpaceInvadersState) => void;
}

const W = 800;
const H = 600;

// ── Nave del jugador ─────────────────────────────────────────────────────
const SHIP_W = 40;
const SHIP_H = 20;
const SHIP_Y = H - 50;
const SHIP_SPEED = 300; // px/s

const PLAYER_BULLET_W = 4;
const PLAYER_BULLET_H = 14;
const PLAYER_BULLET_SPEED = 480; // px/s, hacia arriba

// ── Cuadrícula de invasores ──────────────────────────────────────────────
const ALIEN_COLS = 11;
const ALIEN_ROWS = 5;
const ALIEN_W = 32;
const ALIEN_H = 20;
const ALIEN_GAP_X = 16;
const ALIEN_GAP_Y = 16;
const ALIEN_CELL_W = ALIEN_W + ALIEN_GAP_X;
const ALIEN_CELL_H = ALIEN_H + ALIEN_GAP_Y;
const GRID_W = ALIEN_COLS * ALIEN_W + (ALIEN_COLS - 1) * ALIEN_GAP_X;
const GRID_ORIGIN_X = (W - GRID_W) / 2;
const GRID_ORIGIN_Y = 60;
const DESCEND_STEP = 18;

// Puntos por fila (0 = fila superior): filas 0-1 valen 30, 2-3 valen 20, 4
// vale 10 (valores clásicos de Space Invaders).
function pointsForRow(row: number): number {
  if (row <= 1) return 30;
  if (row <= 3) return 20;
  return 10;
}

// Velocidad base del bloque por nivel (progresión de dificultad entre
// niveles, independiente de la aceleración por aliens restantes dentro de
// un mismo nivel).
function baseGridSpeedForLevel(level: number): number {
  return 40 + (level - 1) * 18; // px/s
}

const ENEMY_BULLET_W = 4;
const ENEMY_BULLET_H = 14;
const ENEMY_BULLET_SPEED = 240; // px/s, hacia abajo
const ENEMY_FIRE_COOLDOWN_MIN = 350; // ms
const ENEMY_FIRE_COOLDOWN_MAX = 900; // ms

// ── Búnkeres ─────────────────────────────────────────────────────────────
const BUNKER_CELL = 6;
// Forma clásica de búnker (7 columnas x 6 filas), con la base recortada para
// que la nave pueda refugiarse debajo de los "hombros".
const BUNKER_SHAPE: number[][] = [
  [0, 1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 0, 0, 0, 1, 1],
  [1, 1, 0, 0, 0, 1, 1],
];
const BUNKER_ROWS = BUNKER_SHAPE.length;
const BUNKER_COLS = BUNKER_SHAPE[0].length;
const BUNKER_W = BUNKER_COLS * BUNKER_CELL;
const BUNKER_COUNT = 4;
const BUNKER_Y = H - 180;

// ── OVNI bonus ───────────────────────────────────────────────────────────
const UFO_W = 48;
const UFO_H = 20;
const UFO_Y = 30;
const UFO_SPEED = 140; // px/s
const UFO_SPAWN_MIN = 12000; // ms
const UFO_SPAWN_MAX = 20000; // ms
const UFO_POINTS = 100;

const LIVES_START = 3;

interface Bullet {
  x: number;
  y: number;
  w: number;
  h: number;
  vy: number;
}

interface Alien {
  col: number;
  row: number;
  x: number;
  y: number;
  w: number;
  h: number;
  alive: boolean;
  points: number;
}

interface BunkerCell {
  x: number;
  y: number;
  size: number;
  alive: boolean;
}

interface Ufo {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  active: boolean;
}

const ROW_COLORS = ["#ff4d6d", "#ff4d6d", "#ffd23f", "#ffd23f", "#4dff88"];

export class SpaceInvadersEngine {
  private ctx: CanvasRenderingContext2D;
  private callbacks: SpaceInvadersCallbacks;

  private shipX = (W - SHIP_W) / 2;
  private playerBullet: Bullet | null = null;

  private aliens: Alien[] = [];
  private gridOffsetX = 0;
  private gridOffsetY = 0;
  private gridDirection: 1 | -1 = 1;
  private enemyBullets: Bullet[] = [];
  private enemyFireTimer = ENEMY_FIRE_COOLDOWN_MAX;

  private bunkers: BunkerCell[][] = [];

  private ufo: Ufo | null = null;
  private ufoSpawnTimer = this.randomUfoInterval();

  private score = 0;
  private lives = LIVES_START;
  private level = 1;
  private gameOver = false;

  private keys = { ArrowLeft: false, ArrowRight: false, Space: false };

  private lastEmitted: SpaceInvadersState | null = null;

  private started = false;
  private destroyed = false;
  private paused = false;
  private lastTime: number | null = null;
  private rafId: number | null = null;

  constructor(canvas: HTMLCanvasElement, callbacks: SpaceInvadersCallbacks) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas.");
    this.ctx = ctx;
    this.callbacks = callbacks;

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);

    this.setupNewGame();
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.rafId = requestAnimationFrame(this.loop);
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  restart() {
    this.score = 0;
    this.lives = LIVES_START;
    this.level = 1;
    this.gameOver = false;
    this.lastTime = null;
    this.setupNewGame();
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
    if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.code === "Space")
      e.preventDefault();
    this.setKeyFromEvent(e, true);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.setKeyFromEvent(e, false);
  };

  private setKeyFromEvent(e: KeyboardEvent, pressed: boolean) {
    if (e.key === "ArrowLeft") this.keys.ArrowLeft = pressed;
    else if (e.key === "ArrowRight") this.keys.ArrowRight = pressed;
    else if (e.code === "Space") this.keys.Space = pressed;
  }

  // ── Setup ─────────────────────────────────────────────────────────────
  private setupNewGame() {
    this.shipX = (W - SHIP_W) / 2;
    this.playerBullet = null;
    this.enemyBullets = [];
    this.ufo = null;
    this.ufoSpawnTimer = this.randomUfoInterval();
    this.buildGrid();
    this.buildBunkers();
  }

  private buildGrid() {
    this.gridOffsetX = 0;
    this.gridOffsetY = 0;
    this.gridDirection = 1;
    const aliens: Alien[] = [];
    for (let row = 0; row < ALIEN_ROWS; row++) {
      for (let col = 0; col < ALIEN_COLS; col++) {
        aliens.push({
          col,
          row,
          x: GRID_ORIGIN_X + col * ALIEN_CELL_W,
          y: GRID_ORIGIN_Y + row * ALIEN_CELL_H,
          w: ALIEN_W,
          h: ALIEN_H,
          alive: true,
          points: pointsForRow(row),
        });
      }
    }
    this.aliens = aliens;
    this.enemyFireTimer = this.randomEnemyFireCooldown();
  }

  private buildBunkers() {
    const spacing = (W - BUNKER_COUNT * BUNKER_W) / (BUNKER_COUNT + 1);
    const bunkers: BunkerCell[][] = [];
    for (let i = 0; i < BUNKER_COUNT; i++) {
      const originX = spacing * (i + 1) + BUNKER_W * i;
      const cells: BunkerCell[] = [];
      for (let row = 0; row < BUNKER_ROWS; row++) {
        for (let col = 0; col < BUNKER_COLS; col++) {
          if (!BUNKER_SHAPE[row][col]) continue;
          cells.push({
            x: originX + col * BUNKER_CELL,
            y: BUNKER_Y + row * BUNKER_CELL,
            size: BUNKER_CELL,
            alive: true,
          });
        }
      }
      bunkers.push(cells);
    }
    this.bunkers = bunkers;
  }

  private randomEnemyFireCooldown(): number {
    // Se reduce ligeramente con el nivel para subir la dificultad entre
    // niveles, sin bajar del mínimo base.
    const levelReduction = Math.min((this.level - 1) * 30, 300);
    const min = Math.max(150, ENEMY_FIRE_COOLDOWN_MIN - levelReduction);
    const max = Math.max(min + 100, ENEMY_FIRE_COOLDOWN_MAX - levelReduction);
    return min + Math.random() * (max - min);
  }

  private randomUfoInterval(): number {
    return UFO_SPAWN_MIN + Math.random() * (UFO_SPAWN_MAX - UFO_SPAWN_MIN);
  }

  // ── Update ────────────────────────────────────────────────────────────
  private update(dt: number) {
    if (this.gameOver) return;

    this.updateShip(dt);
    this.updatePlayerBullet(dt);
    this.updateGrid(dt);
    this.updateEnemyFire(dt);
    this.updateEnemyBullets(dt);
    this.updateUfo(dt);
    this.checkInvasion();
  }

  private updateShip(dt: number) {
    if (this.keys.ArrowLeft)
      this.shipX = Math.max(0, this.shipX - SHIP_SPEED * dt);
    if (this.keys.ArrowRight)
      this.shipX = Math.min(W - SHIP_W, this.shipX + SHIP_SPEED * dt);

    if (this.keys.Space && !this.playerBullet) {
      this.playerBullet = {
        x: this.shipX + SHIP_W / 2 - PLAYER_BULLET_W / 2,
        y: SHIP_Y - PLAYER_BULLET_H,
        w: PLAYER_BULLET_W,
        h: PLAYER_BULLET_H,
        vy: -PLAYER_BULLET_SPEED,
      };
    }
  }

  private updatePlayerBullet(dt: number) {
    const bullet = this.playerBullet;
    if (!bullet) return;

    bullet.y += bullet.vy * dt;

    if (bullet.y + bullet.h < 0) {
      this.playerBullet = null;
      return;
    }

    if (this.hitBunker(bullet)) {
      this.playerBullet = null;
      return;
    }

    for (const alien of this.aliens) {
      if (!alien.alive) continue;
      const alienBox = {
        x: alien.x + this.gridOffsetX,
        y: alien.y + this.gridOffsetY,
        w: alien.w,
        h: alien.h,
      };
      if (this.aabb(bullet, alienBox)) {
        alien.alive = false;
        this.score += alien.points;
        this.playerBullet = null;
        break;
      }
    }

    if (this.playerBullet && this.ufo?.active) {
      if (this.aabb(bullet, this.ufo)) {
        this.score += UFO_POINTS;
        this.ufo = null;
        this.playerBullet = null;
      }
    }

    if (this.playerBullet && this.aliveAliens().length === 0) {
      this.levelUp();
    }
  }

  private updateGrid(dt: number) {
    const alive = this.aliveAliens();
    if (alive.length === 0) return; // levelUp() ya se dispara desde el impacto

    const total = ALIEN_COLS * ALIEN_ROWS;
    const aliveRatio = alive.length / total;
    const accelMultiplier = 1 + (1 - aliveRatio) * 4;
    const speed = baseGridSpeedForLevel(this.level) * accelMultiplier;

    const delta = speed * dt * this.gridDirection;
    const newOffsetX = this.gridOffsetX + delta;

    let minX = Infinity;
    let maxX = -Infinity;
    for (const alien of alive) {
      const x = alien.x + newOffsetX;
      if (x < minX) minX = x;
      if (x + alien.w > maxX) maxX = x + alien.w;
    }

    if (minX < 0 || maxX > W) {
      this.gridDirection = this.gridDirection === 1 ? -1 : 1;
      this.gridOffsetY += DESCEND_STEP;
    } else {
      this.gridOffsetX = newOffsetX;
    }
  }

  private updateEnemyFire(dt: number) {
    this.enemyFireTimer -= dt * 1000;
    if (this.enemyFireTimer > 0) return;
    this.enemyFireTimer = this.randomEnemyFireCooldown();

    const columns = new Map<number, Alien>();
    for (const alien of this.aliens) {
      if (!alien.alive) continue;
      const current = columns.get(alien.col);
      if (!current || alien.row > current.row) columns.set(alien.col, alien);
    }
    const shooters = Array.from(columns.values());
    if (shooters.length === 0) return;

    const shooter = shooters[Math.floor(Math.random() * shooters.length)];
    const x = shooter.x + this.gridOffsetX;
    const y = shooter.y + this.gridOffsetY;
    this.enemyBullets.push({
      x: x + shooter.w / 2 - ENEMY_BULLET_W / 2,
      y: y + shooter.h,
      w: ENEMY_BULLET_W,
      h: ENEMY_BULLET_H,
      vy: ENEMY_BULLET_SPEED,
    });
  }

  private updateEnemyBullets(dt: number) {
    const ship = { x: this.shipX, y: SHIP_Y, w: SHIP_W, h: SHIP_H };
    const remaining: Bullet[] = [];

    for (const bullet of this.enemyBullets) {
      bullet.y += bullet.vy * dt;

      if (bullet.y > H) continue;
      if (this.hitBunker(bullet)) continue;

      if (this.aabb(bullet, ship)) {
        this.loseLife();
        continue;
      }

      remaining.push(bullet);
    }

    this.enemyBullets = remaining;
  }

  private updateUfo(dt: number) {
    if (this.ufo) {
      this.ufo.x += this.ufo.vx * dt;
      if (this.ufo.x + this.ufo.w < 0 || this.ufo.x > W) {
        this.ufo = null; // cruzó sin ser destruido: desaparece sin penalización
      }
      return;
    }

    this.ufoSpawnTimer -= dt * 1000;
    if (this.ufoSpawnTimer > 0) return;
    this.ufoSpawnTimer = this.randomUfoInterval();

    const fromLeft = Math.random() < 0.5;
    this.ufo = {
      x: fromLeft ? -UFO_W : W,
      y: UFO_Y,
      w: UFO_W,
      h: UFO_H,
      vx: fromLeft ? UFO_SPEED : -UFO_SPEED,
      active: true,
    };
  }

  // Invasión exitosa: algún invasor vivo alcanza la fila de la nave.
  private checkInvasion() {
    const shipTop = SHIP_Y;
    for (const alien of this.aliens) {
      if (!alien.alive) continue;
      const y = alien.y + this.gridOffsetY;
      if (y + alien.h >= shipTop) {
        this.loseLife();
        this.gridOffsetX = 0;
        this.gridOffsetY = 0;
        this.gridDirection = 1;
        return;
      }
    }
  }

  private loseLife() {
    if (this.gameOver) return;
    this.lives -= 1;
    if (this.lives <= 0) {
      this.lives = 0;
      this.gameOver = true;
    }
  }

  private levelUp() {
    this.level += 1;
    this.buildGrid();
  }

  private aliveAliens(): Alien[] {
    return this.aliens.filter((a) => a.alive);
  }

  private hitBunker(bullet: Bullet): boolean {
    for (const cells of this.bunkers) {
      for (const cell of cells) {
        if (!cell.alive) continue;
        if (
          bullet.x < cell.x + cell.size &&
          bullet.x + bullet.w > cell.x &&
          bullet.y < cell.y + cell.size &&
          bullet.y + bullet.h > cell.y
        ) {
          cell.alive = false;
          return true;
        }
      }
    }
    return false;
  }

  private aabb(
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number }
  ): boolean {
    return (
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
    );
  }

  // ── Draw ──────────────────────────────────────────────────────────────
  // Sin HUD ni overlay de fin de partida: ese estado sale solo por
  // onStateChange (ver specs/15-juego-space-invaders.md).
  private draw() {
    const ctx = this.ctx;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, W, H);

    // Nave
    ctx.fillStyle = "#4dff88";
    ctx.fillRect(this.shipX, SHIP_Y, SHIP_W, SHIP_H);
    ctx.fillRect(this.shipX + SHIP_W / 2 - 3, SHIP_Y - 8, 6, 8);

    // Búnkeres
    ctx.fillStyle = "#4dff88";
    for (const cells of this.bunkers) {
      for (const cell of cells) {
        if (cell.alive) ctx.fillRect(cell.x, cell.y, cell.size, cell.size);
      }
    }

    // Invasores
    for (const alien of this.aliens) {
      if (!alien.alive) continue;
      ctx.fillStyle = ROW_COLORS[alien.row] ?? "#ffffff";
      ctx.fillRect(
        alien.x + this.gridOffsetX,
        alien.y + this.gridOffsetY,
        alien.w,
        alien.h
      );
    }

    // OVNI
    if (this.ufo) {
      ctx.fillStyle = "#ff4dff";
      ctx.fillRect(this.ufo.x, this.ufo.y, this.ufo.w, this.ufo.h);
    }

    // Balas
    ctx.fillStyle = "#ffffff";
    if (this.playerBullet) {
      const b = this.playerBullet;
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    ctx.fillStyle = "#ffd23f";
    for (const b of this.enemyBullets) {
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
  }

  private emitState() {
    const state: SpaceInvadersState = {
      score: this.score,
      lives: this.lives,
      level: this.level,
      gameOver: this.gameOver,
    };
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
