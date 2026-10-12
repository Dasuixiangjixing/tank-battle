'use strict';

/* ==========================================================================
   坦克大战 Tank Battle — 基于 Canvas 2D 的经典坦克大战
   ========================================================================== */

/* ----------------------------- 常量 ----------------------------- */

const TILE = 32;
const COLS = 15;
const ROWS = 15;
const W = COLS * TILE;              // 480
const H = ROWS * TILE;              // 480

const TANK_SIZE = 28;
const MARGIN = (TILE - TANK_SIZE) / 2;   // 2px，坦克与瓦片对齐时的偏移
const BULLET_SIZE = 6;

const STEP = 1000 / 60;             // 固定步长，保证不同刷新率下手感一致
const SPAWN_ANIM = 55;              // 出生动画时长（帧），同时也是出生无敌时间
const RESPAWN_DELAY = 70;           // 玩家阵亡到重生的等待帧数

const EMPTY = 0;
const BRICK = 1;
const STEEL = 2;
const BASE = 3;

const BASE_COL = 7;
const BASE_ROW = 13;
const BASE_CX = (BASE_COL + 1) * TILE;   // 基地中心的像素坐标
const BASE_CY = (BASE_ROW + 1) * TILE;

const DIRS = {
  up:    { x: 0,  y: -1, angle: 0 },
  right: { x: 1,  y: 0,  angle: Math.PI / 2 },
  down:  { x: 0,  y: 1,  angle: Math.PI },
  left:  { x: -1, y: 0,  angle: -Math.PI / 2 },
};
const DIR_ORDER = ['up', 'right', 'down', 'left'];
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

/** 敌方坦克出生的瓦片坐标（row 0 在所有关卡中都是空的） */
const SPAWNS = [{ col: 0, row: 0 }, { col: 7, row: 0 }, { col: 14, row: 0 }];
const PLAYER_SPAWN = { col: 4, row: 14 };

/* ----------------------------- 配色 ----------------------------- */

const C = {
  brick: '#b5533a', brickLine: '#5e2a1d',
  steel: '#8d9bb0', steelLight: '#c3cedd', steelDark: '#525d6e',
  base: '#ffd447', baseDark: '#8a6a12', basePlate: '#20262f',
  bullet: '#fdf6e3', bulletHot: '#ffcc4d',
};

const HULL = {
  player:     { hull: '#5fd996', trim: '#2f7a52', dark: '#1b4b32' },
  basic:      { hull: '#b9c4d4', trim: '#7f8ea3', dark: '#4e5a6b' },
  fast:       { hull: '#5ad1ff', trim: '#2b7fa8', dark: '#17475f' },
  armor3:     { hull: '#ffa14a', trim: '#a35a33', dark: '#63351b' },
  armor2:     { hull: '#ff8340', trim: '#a3432a', dark: '#5e2716' },
  armor1:     { hull: '#e8563f', trim: '#8f2b1c', dark: '#4d1710' },
};

/* ----------------------------- 关卡 ----------------------------- */
/* . 空地   B 砖墙（可破坏）   S 钢墙（不可破坏）
   基地固定在 col 7-8 / row 13-14，出生点固定为 row 0 的 col 0、7、14 */

const LEVELS = [
  [
    '...............',
    '..BBB.....BBB..',
    '..BBB.....BBB..',
    '...............',
    '.BB.BBBBBBB.BB.',
    '.BB.BBBBBBB.BB.',
    '...............',
    '.BB.BBBBBBB.BB.',
    '.BB.BBBBBBB.BB.',
    '...............',
    '..BBB.....BBB..',
    '..BBB.....BBB..',
    '......BBBB.....',
    '......B..B.....',
    '......B..B.....',
  ],
  [
    '...SS.....SS...',
    '...SS.....SS...',
    '...............',
    '.BBB.BBBBB.BBB.',
    '.B.B.B...B.B.B.',
    '.B.B.BBBBB.B.B.',
    '.B.B.......B.B.',
    '.B.BBBBBBBBB.B.',
    '.B...........B.',
    '.BBBBBBBBBBBBB.',
    '...............',
    '..SSS.....SSS..',
    '......BBBB.....',
    '......B..B.....',
    '......B..B.....',
  ],
  [
    '...............',
    '.BB.BBBBBBB.BB.',
    '.BB.BBBBBBB.BB.',
    '.BB.........BB.',
    '.BB.BBBBBBB.BB.',
    '.BB.BBBBBBB.BB.',
    '...............',
    'BBBBB.BBB.BBBBB',
    '...............',
    '.BB.BBBBBBB.BB.',
    '.BB.BBBBBBB.BB.',
    '.BB.........BB.',
    '......BBBB.....',
    '......B..B.....',
    '......B..B.....',
  ],
  [
    '...............',
    '.SS.BBBBBBB.SS.',
    '.SS.B.....B.SS.',
    '....B.BBB.B....',
    '.BB.B.BSB.B.BB.',
    '.BB...BSB...BB.',
    '....B.BBB.B....',
    '.SS.B.....B.SS.',
    '.SS.BBBBBBB.SS.',
    '...............',
    '.BBB.BBBBB.BBB.',
    '...B.......B...',
    '......BBBB.....',
    '......B..B.....',
    '......B..B.....',
  ],
];

/* ----------------------------- 音效 ----------------------------- */

const Sfx = {
  ctx: null,
  muted: false,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
  },

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  /** 单音，可带频率滑移 */
  tone(freq, dur, { type = 'square', vol = 0.05, to = null } = {}) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },

  /** 噪声爆破，用于爆炸 */
  noise(dur, vol = 0.18) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, t);
    filter.frequency.exponentialRampToValueAtTime(180, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t);
  },

  shoot(isPlayer) {
    this.tone(isPlayer ? 620 : 380, 0.07, { type: 'square', vol: 0.035, to: isPlayer ? 240 : 160 });
  },
  explode(big) {
    this.noise(big ? 0.5 : 0.26, big ? 0.22 : 0.13);
  },
  clink() {
    this.tone(1400, 0.05, { type: 'square', vol: 0.025, to: 900 });
  },
  powerup() {
    this.tone(660, 0.09, { type: 'sine', vol: 0.07, to: 990 });
    setTimeout(() => this.tone(990, 0.14, { type: 'sine', vol: 0.07, to: 1320 }), 90);
  },
  lose() {
    this.tone(300, 0.6, { type: 'sawtooth', vol: 0.09, to: 70 });
    this.noise(0.6, 0.16);
  },
  levelUp() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.16, { type: 'triangle', vol: 0.07 }), i * 110);
    });
  },
};

/* ----------------------------- 工具函数 ----------------------------- */

const shuffled = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const randInt = (n) => Math.floor(Math.random() * n);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

const overlaps = (a, b, sizeA = TANK_SIZE, sizeB = TANK_SIZE) =>
  a.x < b.x + sizeB && a.x + sizeA > b.x && a.y < b.y + sizeB && a.y + sizeA > b.y;

/* ----------------------------- 游戏状态 ----------------------------- */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ui = {
  level: document.getElementById('hud-level'),
  score: document.getElementById('hud-score'),
  enemies: document.getElementById('hud-enemies'),
  lives: document.getElementById('hud-lives'),
  overlay: document.getElementById('overlay'),
  title: document.getElementById('ov-title'),
  body: document.getElementById('ov-body'),
  keys: document.getElementById('ov-keys'),
  btn: document.getElementById('ov-btn'),
};

let grid = [];
let tanks = [];
let bullets = [];
let powerups = [];
let effects = [];
let particles = [];

let state = 'menu';          // menu | playing | paused | levelclear | gameover | win
let levelIndex = 0;
let score = 0;
let lives = 3;
let enemyQueue = [];
let spawnCooldown = 0;
let spawnSlot = 0;
let baseAlive = true;
let player = null;
let shake = 0;
let tick = 0;
let stateTimer = 0;

const MAX_ON_SCREEN = () => Math.min(4, 3 + Math.floor(levelIndex / 2));

/* ----------------------------- 坦克 ----------------------------- */

class Tank {
  constructor(opts) {
    this.x = 0;
    this.y = 0;
    this.dir = 'up';
    this.speed = 1;
    this.isPlayer = false;
    this.kind = 'basic';       // player | basic | fast | armor
    this.hp = 1;
    this.cooldown = 0;
    this.fireDelay = 60;
    this.bulletSpeed = 5;
    this.bulletPower = 1;
    this.maxBullets = 1;
    this.shield = 0;
    this.spawnTimer = 0;
    this.thinkTimer = 0;
    this.hurtFlash = 0;
    this.dead = false;
    Object.assign(this, opts);
  }

  /** 复活/重生时的无敌保护 */
  get invulnerable() {
    return this.spawnTimer > 0 || this.shield > 0;
  }
}

/* ----------------------------- 地图 ----------------------------- */

function buildGrid(levelIndex) {
  const map = LEVELS[levelIndex % LEVELS.length];
  grid = map.map((row) => {
    const cells = [];
    for (const ch of row) {
      cells.push(ch === 'B' ? BRICK : ch === 'S' ? STEEL : EMPTY);
    }
    return cells;
  });

  // 盖上基地
  for (let r = BASE_ROW; r < BASE_ROW + 2; r++) {
    for (let c = BASE_COL; c < BASE_COL + 2; c++) grid[r][c] = BASE;
  }
  baseAlive = true;
}

const inBounds = (col, row) => col >= 0 && row >= 0 && col < COLS && row < ROWS;
const isSolid = (t) => t === BRICK || t === STEEL || t === BASE;

/** 矩形是否与墙体（或地图外）相交 */
function rectBlocked(x, y, size) {
  if (x < 0 || y < 0 || x + size > W || y + size > H) return true;
  const c0 = Math.floor(x / TILE);
  const c1 = Math.floor((x + size - 1) / TILE);
  const r0 = Math.floor(y / TILE);
  const r1 = Math.floor((y + size - 1) / TILE);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (isSolid(grid[r][c])) return true;
    }
  }
  return false;
}

/** 矩形是否与其它坦克相交 */
function tankBlocked(self, x, y) {
  for (const t of tanks) {
    if (t === self || t.dead) continue;
    if (x < t.x + TANK_SIZE && x + TANK_SIZE > t.x &&
        y < t.y + TANK_SIZE && y + TANK_SIZE > t.y) return true;
  }
  return false;
}

const canStand = (self, x, y) => !rectBlocked(x, y, TANK_SIZE) && !tankBlocked(self, x, y);

/** 沿垂直运动轴微调，让坦克自动对齐通道 —— 大幅改善手感 */
function alignAxis(tank, axis) {
  const cur = tank[axis];
  const target = Math.round((cur - MARGIN) / TILE) * TILE + MARGIN;
  const diff = target - cur;
  if (Math.abs(diff) < 0.01) return;

  const stepMax = Math.min(Math.abs(diff), tank.speed);
  const next = cur + Math.sign(diff) * stepMax;
  const nx = axis === 'x' ? next : tank.x;
  const ny = axis === 'y' ? next : tank.y;
  if (canStand(tank, nx, ny)) tank[axis] = next;
}

/** 移动坦克，返回是否真的移动了 */
function moveTank(tank, dir) {
  tank.dir = dir;
  const d = DIRS[dir];
  const nx = tank.x + d.x * tank.speed;
  const ny = tank.y + d.y * tank.speed;

  if (d.x !== 0) alignAxis(tank, 'y');
  else alignAxis(tank, 'x');

  if (canStand(tank, nx, ny)) {
    tank.x = nx;
    tank.y = ny;
    return true;
  }
  return false;
}

/* ----------------------------- 子弹 ----------------------------- */

class Bullet {
  constructor(owner, x, y, dir, speed, power) {
    this.owner = owner;
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.speed = speed;
    this.power = power;
    this.dead = false;
  }
}

function fire(tank) {
  if (tank.cooldown > 0 || tank.spawnTimer > 0 || tank.dead) return;

  const live = bullets.reduce((n, b) => n + (b.owner === tank && !b.dead ? 1 : 0), 0);
  if (live >= tank.maxBullets) return;

  const d = DIRS[tank.dir];
  const cx = tank.x + TANK_SIZE / 2 + d.x * (TANK_SIZE / 2 + 2);
  const cy = tank.y + TANK_SIZE / 2 + d.y * (TANK_SIZE / 2 + 2);
  bullets.push(new Bullet(
    tank,
    cx - BULLET_SIZE / 2,
    cy - BULLET_SIZE / 2,
    tank.dir,
    tank.bulletSpeed,
    tank.bulletPower,
  ));

  tank.cooldown = tank.fireDelay;
  Sfx.shoot(tank.isPlayer);
}

/** 子弹逐段推进，避免高速穿透 */
function updateBullet(b) {
  const d = DIRS[b.dir];
  let left = b.speed;
  while (left > 0 && !b.dead) {
    const step = Math.min(left, 4);
    left -= step;
    b.x += d.x * step;
    b.y += d.y * step;
    resolveBullet(b);
  }
}

function resolveBullet(b) {
  const cx = b.x + BULLET_SIZE / 2;
  const cy = b.y + BULLET_SIZE / 2;

  if (cx < 0 || cy < 0 || cx >= W || cy >= H) {
    b.dead = true;
    addSparks(cx, cy, 4, '#dfe7f2');
    return;
  }

  // 撞坦克
  for (const t of tanks) {
    if (t.dead || t === b.owner) continue;
    if (b.owner && b.owner.isPlayer === t.isPlayer) continue;   // 同阵营不互相伤害
    if (t.spawnTimer > 0) continue;
    if (cx > t.x && cx < t.x + TANK_SIZE && cy > t.y && cy < t.y + TANK_SIZE) {
      b.dead = true;
      damageTank(t, b);
      return;
    }
  }

  // 撞地图
  const col = Math.floor(cx / TILE);
  const row = Math.floor(cy / TILE);
  if (!inBounds(col, row)) return;
  const tile = grid[row][col];

  if (tile === BRICK) {
    b.dead = true;
    damageTile(col, row, b);
  } else if (tile === STEEL) {
    b.dead = true;
    if (b.power >= 2) damageTile(col, row, b);
    else {
      Sfx.clink();
      addSparks(cx, cy, 5, '#dbe4f0');
    }
  } else if (tile === BASE) {
    b.dead = true;
    // 己方子弹不会打掉自己的基地，只溅出火花 —— 否则一路向右开火就会自毁
    if (b.owner && b.owner.isPlayer) {
      Sfx.clink();
      addSparks(cx, cy, 5, C.base);
    } else {
      destroyBase();
    }
  }
}

/** 破坏砖墙；强化弹还会炸掉垂直方向各一块，形成更宽的缺口 */
function damageTile(col, row, bullet) {
  grid[row][col] = EMPTY;
  const cx = col * TILE + TILE / 2;
  const cy = row * TILE + TILE / 2;
  addSparks(cx, cy, 6, C.brick);
  Sfx.clink();

  if (bullet.power >= 2) {
    const d = DIRS[bullet.dir];
    const holes = d.x !== 0 ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
    for (const [dc, dr] of holes) {
      const c = col + dc;
      const r = row + dr;
      if (inBounds(c, r) && grid[r][c] === BRICK) {
        grid[r][c] = EMPTY;
        addSparks(c * TILE + TILE / 2, r * TILE + TILE / 2, 5, C.brick);
      }
    }
  }
}

function damageTank(tank, bullet) {
  if (tank.isPlayer && tank.invulnerable) {
    addSparks(bullet.x, bullet.y, 8, '#5ad1ff');
    Sfx.clink();
    return;
  }

  if (tank.isPlayer) {
    killPlayer();
    return;
  }

  tank.hp -= 1;
  tank.hurtFlash = 10;
  if (tank.hp > 0) {
    addSparks(bullet.x, bullet.y, 6, '#ffd447');
    Sfx.clink();
    return;
  }

  tank.dead = true;
  const points = { basic: 100, fast: 200, armor: 400 }[tank.kind] || 100;
  addScore(points);

  const cx = tank.x + TANK_SIZE / 2;
  const cy = tank.y + TANK_SIZE / 2;
  explode(cx, cy, 30, true);
  Sfx.explode(true);

  if (Math.random() < 0.22) dropPowerup(cx, cy);
}

/* ----------------------------- 爆炸与粒子 ----------------------------- */

function explode(x, y, size, big) {
  effects.push({ x, y, size, life: big ? 26 : 16, t: 0, big: !!big });
  shake = Math.min(10, shake + (big ? 7 : 3));
}

function addSparks(x, y, count, color) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 0.6 + Math.random() * 2.2;
    particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 12 + randInt(12),
      t: 0,
      color,
    });
  }
}

/* ----------------------------- 道具 ----------------------------- */

const POWERUPS = ['star', 'shield', 'life', 'bomb'];

function dropPowerup(x, y) {
  if (powerups.length > 0) return;   // 场上最多一个
  powerups.push({
    x: clamp(x - 14, 4, W - 32),
    y: clamp(y - 14, 4, H - 32),
    kind: POWERUPS[randInt(POWERUPS.length)],
    t: 0,
    life: 60 * 16,
  });
}

function collectPowerup(p) {
  const c = { x: p.x, y: p.y };
  p.dead = true;
  Sfx.powerup();
  addSparks(c.x + 14, c.y + 14, 14, '#ffd447');

  switch (p.kind) {
    case 'star':
      player.power = Math.min(2, player.power + 1);
      applyPlayerPower();
      break;
    case 'shield':
      player.shield = 60 * 10;
      break;
    case 'life':
      lives = Math.min(9, lives + 1);
      break;
    case 'bomb':
      for (const t of tanks.slice()) {
        if (t.isPlayer || t.dead) continue;
        t.dead = true;
        explode(t.x + TANK_SIZE / 2, t.y + TANK_SIZE / 2, 30, true);
        addScore(50);
      }
      Sfx.explode(true);
      shake = 10;
      break;
  }
}

function applyPlayerPower() {
  const lvl = player.power;
  player.fireDelay = [24, 18, 14][lvl];
  player.bulletSpeed = [7, 8, 9][lvl];
  player.maxBullets = lvl === 0 ? 1 : 2;
  player.bulletPower = lvl >= 2 ? 2 : 1;
}

/* ----------------------------- 玩家 ----------------------------- */

function spawnPlayer() {
  player = new Tank({
    isPlayer: true,
    kind: 'player',
    speed: 1.9,
    hp: 1,
    shield: 60 * 3,
    spawnTimer: SPAWN_ANIM,
    power: 0,
  });
  player.x = PLAYER_SPAWN.col * TILE + MARGIN;
  player.y = PLAYER_SPAWN.row * TILE + MARGIN;
  applyPlayerPower();
  tanks.push(player);
}

function killPlayer() {
  explode(player.x + TANK_SIZE / 2, player.y + TANK_SIZE / 2, 34, true);
  Sfx.lose();
  player.dead = true;
  player = null;
  lives -= 1;

  if (lives <= 0) {
    gameOver('坦克全部损毁');
    return;
  }
  // 稍后重生
  effects.push({ x: 0, y: 0, size: 0, life: 0, t: 0, big: false, respawnIn: RESPAWN_DELAY });
}

function destroyBase() {
  if (!baseAlive) return;
  baseAlive = false;
  for (let r = BASE_ROW; r < BASE_ROW + 2; r++) {
    for (let c = BASE_COL; c < BASE_COL + 2; c++) grid[r][c] = EMPTY;
  }
  explode(BASE_CX, BASE_CY, 46, true);
  explode(BASE_CX - 16, BASE_CY + 10, 30, true);
  explode(BASE_CX + 16, BASE_CY - 6, 30, true);
  Sfx.explode(true);
  shake = 12;
  gameOver('基地被摧毁');
}

/* ----------------------------- 敌人 ----------------------------- */

function makeEnemy(kind) {
  const base = {
    basic: { speed: 1.05, hp: 1, fireDelay: 78, bulletSpeed: 4.6 },
    fast:  { speed: 1.85, hp: 1, fireDelay: 84, bulletSpeed: 5.2 },
    armor: { speed: 0.95, hp: 3, fireDelay: 64, bulletSpeed: 5.6 },
  }[kind];

  const tank = new Tank({
    ...base,
    isPlayer: false,
    kind,
    maxBullets: 1,
    bulletPower: 1,
    spawnTimer: SPAWN_ANIM,
  });
  const s = SPAWNS[spawnSlot % SPAWNS.length];
  spawnSlot++;
  tank.x = s.col * TILE + MARGIN;
  tank.y = s.row * TILE + MARGIN;
  tank.dir = 'down';
  tank.thinkTimer = 30 + randInt(50);
  return tank;
}

function buildQueue(level) {
  const total = 10 + level * 2;
  const q = [];
  for (let i = 0; i < total; i++) {
    const r = Math.random();
    if (level >= 2 && r < 0.14 + level * 0.04) q.push('armor');
    else if (level >= 1 && r < 0.42 + level * 0.04) q.push('fast');
    else q.push('basic');
  }
  return q;
}

function chooseEnemyDir(e) {
  const target = player && !player.dead ? player : { x: BASE_CX, y: BASE_CY };
  const dx = target.x - e.x;
  const dy = target.y - e.y;

  const toward = Math.abs(dx) > Math.abs(dy)
    ? (dx > 0 ? 'right' : 'left')
    : (dy > 0 ? 'down' : 'up');

  // 六成概率朝目标推进，否则随机游走
  const candidates = Math.random() < 0.6
    ? [toward, ...shuffled(DIR_ORDER.filter((d) => d !== OPPOSITE[toward]))]
    : shuffled(DIR_ORDER);

  const probe = 4;
  for (const d of candidates) {
    const v = DIRS[d];
    if (!rectBlocked(e.x + v.x * probe, e.y + v.y * probe, TANK_SIZE)) return d;
  }
  return e.dir;
}

function updateEnemy(e) {
  if (e.spawnTimer > 0) {
    e.spawnTimer--;
    return;
  }
  if (e.cooldown > 0) e.cooldown--;
  if (e.hurtFlash > 0) e.hurtFlash--;

  e.thinkTimer--;
  const moved = moveTank(e, e.dir);
  if (!moved || e.thinkTimer <= 0) {
    e.dir = chooseEnemyDir(e);
    e.thinkTimer = 26 + randInt(60);
  }

  // 开火：与玩家或基地位于同一条线上时更积极
  const alignedWithPlayer = player && !player.dead &&
    ((Math.abs(e.y - player.y) < TILE && Math.sign(player.x - e.x) === DIRS[e.dir].x && DIRS[e.dir].x !== 0) ||
     (Math.abs(e.x - player.x) < TILE && Math.sign(player.y - e.y) === DIRS[e.dir].y && DIRS[e.dir].y !== 0));
  const alignedWithBase =
    (Math.abs(e.x - BASE_CX) < TILE && DIRS[e.dir].y === 1) ||
    (Math.abs(e.y - BASE_CY) < TILE && Math.sign(BASE_CX - e.x) === DIRS[e.dir].x && DIRS[e.dir].x !== 0);

  const chance = alignedWithPlayer ? 0.10 : alignedWithBase ? 0.06 : 0.012;
  if (Math.random() < chance) fire(e);
}

/* ----------------------------- 生成器 ----------------------------- */

function updateSpawner() {
  if (enemyQueue.length === 0) return;
  const alive = tanks.reduce((n, t) => n + (!t.isPlayer && !t.dead ? 1 : 0), 0);
  if (alive >= MAX_ON_SCREEN()) return;

  spawnCooldown--;
  if (spawnCooldown > 0) return;

  const kind = enemyQueue.shift();
  tanks.push(makeEnemy(kind));
  spawnCooldown = 110;
}

/* ----------------------------- 更新 ----------------------------- */

function update() {
  if (state !== 'playing') return;
  tick++;

  updateSpawner();

  // 玩家
  if (player && !player.dead) {
    if (player.spawnTimer > 0) {
      player.spawnTimer--;
    } else {
      if (player.cooldown > 0) player.cooldown--;
      if (player.shield > 0) player.shield--;

      let dir = null;
      if (keys.has('ArrowUp') || keys.has('KeyW')) dir = 'up';
      else if (keys.has('ArrowDown') || keys.has('KeyS')) dir = 'down';
      else if (keys.has('ArrowLeft') || keys.has('KeyA')) dir = 'left';
      else if (keys.has('ArrowRight') || keys.has('KeyD')) dir = 'right';

      if (dir) moveTank(player, dir);
      if (keys.has('Space') || keys.has('KeyJ')) fire(player);
    }
  }

  // 敌人
  for (const t of tanks) {
    if (t.dead || t.isPlayer) continue;
    updateEnemy(t);
  }

  // 子弹
  for (const b of bullets) {
    if (!b.dead) updateBullet(b);
  }

  // 道具
  for (const p of powerups) {
    p.t++;
    p.life--;
    if (p.life <= 0) p.dead = true;
    if (player && !player.dead && p.x + 28 > player.x && p.x < player.x + TANK_SIZE &&
        p.y + 28 > player.y && p.y < player.y + TANK_SIZE) {
      collectPowerup(p);
    }
  }

  // 特效 / 粒子
  for (const e of effects) {
    e.t++;
    if (e.respawnIn) {
      e.respawnIn--;
      if (e.respawnIn <= 0) {
        e.dead = true;
        spawnPlayer();
      }
    } else if (e.t >= e.life) {
      e.dead = true;
    }
  }
  for (const p of particles) {
    p.t++;
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.93;
    p.vy *= 0.93;
    if (p.t >= p.life) p.dead = true;
  }

  if (shake > 0) shake *= 0.86;
  if (shake < 0.2) shake = 0;

  // 清理
  tanks = tanks.filter((t) => !t.dead);
  bullets = bullets.filter((b) => !b.dead);
  powerups = powerups.filter((p) => !p.dead);
  effects = effects.filter((e) => !e.dead);
  particles = particles.filter((p) => !p.dead);

  // 关卡完成
  if (state === 'playing' && enemyQueue.length === 0 &&
      !tanks.some((t) => !t.isPlayer)) {
    levelClear();
  }
}

/* ----------------------------- 流程控制 ----------------------------- */

function addScore(n) {
  score += n;
  ui.score.classList.remove('flash');
  void ui.score.offsetWidth;
  ui.score.classList.add('flash');
}

function updateHud() {
  const alive = tanks.reduce((n, t) => n + (!t.isPlayer && !t.dead ? 1 : 0), 0);
  ui.level.textContent = String(levelIndex + 1);
  ui.score.textContent = String(score);
  ui.enemies.textContent = String(enemyQueue.length + alive);
  ui.lives.textContent = String(Math.max(0, lives));
}

function showOverlay(title, bodyText, btnText, cls = '') {
  ui.title.className = cls;
  ui.title.textContent = title;
  ui.body.textContent = bodyText;
  ui.btn.textContent = btnText;
  ui.keys.style.display = state === 'menu' ? '' : 'none';
  ui.overlay.classList.remove('hidden');
}

function hideOverlay() {
  ui.overlay.classList.add('hidden');
}

function loadLevel(index) {
  levelIndex = index;
  buildGrid(index);
  tanks = [];
  bullets = [];
  powerups = [];
  effects = [];
  particles = [];
  enemyQueue = buildQueue(index);
  spawnCooldown = 40;
  spawnSlot = 0;
  shake = 0;
  spawnPlayer();
  updateHud();
  state = 'playing';
  hideOverlay();
}

function nextLevel() {
  if (levelIndex + 1 >= LEVELS.length) {
    winGame();
    return;
  }
  loadLevel(levelIndex + 1);
}

function levelClear() {
  state = 'levelclear';
  stateTimer = 90;
  Sfx.levelUp();
}

function gameOver(reason) {
  if (state === 'gameover' || state === 'win') return;
  state = 'gameover';
  Sfx.lose();
  showOverlay('游戏结束', `${reason} · 最终得分 ${score}`, '再来一局', 'lose');
}

function winGame() {
  state = 'win';
  Sfx.levelUp();
  showOverlay('全部通关！', `你守住了所有基地 · 最终得分 ${score}`, '再玩一次', 'win');
}

function startGame() {
  score = 0;
  lives = 3;
  Sfx.resume();
  loadLevel(0);
}

function togglePause() {
  if (state === 'playing') {
    state = 'paused';
    showOverlay('已暂停', '喘口气，敌人不会等你太久。', '继续', '');
  } else if (state === 'paused') {
    state = 'playing';
    hideOverlay();
  }
}

/* ----------------------------- 输入 ----------------------------- */

const keys = new Set();

const BLOCKED = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
]);

window.addEventListener('keydown', (e) => {
  if (BLOCKED.has(e.code)) e.preventDefault();
  if (e.repeat) return;

  keys.add(e.code);
  Sfx.resume();

  if (e.code === 'KeyP' && (state === 'playing' || state === 'paused')) {
    togglePause();
  } else if (e.code === 'KeyM') {
    Sfx.muted = !Sfx.muted;
  } else if (e.code === 'KeyR') {
    if (state !== 'menu') startGame();
  } else if (e.code === 'Enter' || e.code === 'Space') {
    if (state === 'menu' || state === 'gameover' || state === 'win') startGame();
    else if (state === 'paused') togglePause();
  }
});

window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

ui.btn.addEventListener('click', () => {
  Sfx.resume();
  if (state === 'paused') togglePause();
  else startGame();
});

/* ----------------------------- 渲染 ----------------------------- */

function drawBrickTile(px, py) {
  ctx.fillStyle = C.brick;
  ctx.fillRect(px, py, TILE, TILE);

  ctx.strokeStyle = C.brickLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < 4; i++) {
    const y = py + i * 8 + 0.5;
    ctx.moveTo(px, y);
    ctx.lineTo(px + TILE, y);
  }
  // 错缝：偶数行在中间竖切一刀
  for (let r = 0; r < 4; r += 2) {
    const x = px + 16.5;
    ctx.moveTo(x, py + r * 8);
    ctx.lineTo(x, py + r * 8 + 8);
  }
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,.10)';
  ctx.fillRect(px, py, TILE, 2);
}

function drawSteelTile(px, py) {
  ctx.fillStyle = C.steelDark;
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = C.steel;
  ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
  ctx.fillStyle = C.steelLight;
  ctx.fillRect(px + 4, py + 4, TILE - 12, TILE - 12);
  ctx.fillStyle = C.steel;
  ctx.fillRect(px + 7, py + 7, TILE - 18, TILE - 18);
}

function drawBase() {
  const px = BASE_COL * TILE;
  const py = BASE_ROW * TILE;
  const size = TILE * 2;

  ctx.fillStyle = C.basePlate;
  ctx.fillRect(px, py, size, size);

  ctx.strokeStyle = C.baseDark;
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 1, py + 1, size - 2, size - 2);

  if (!baseAlive) {
    ctx.strokeStyle = 'rgba(150,120,60,.5)';
    ctx.beginPath();
    ctx.moveTo(px + 10, py + 12);
    ctx.lineTo(px + 26, py + 30);
    ctx.lineTo(px + 20, py + 46);
    ctx.moveTo(px + size - 10, py + 16);
    ctx.lineTo(px + size - 28, py + 34);
    ctx.stroke();
    return;
  }

  // 金色五角星徽记
  const cx = px + size / 2;
  const cy = py + size / 2;
  const outer = 22;
  const inner = 9;

  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();

  const grad = ctx.createLinearGradient(px, py, px, py + size);
  grad.addColorStop(0, '#ffe98a');
  grad.addColorStop(1, C.base);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = C.baseDark;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawTank(t) {
  const cx = t.x + TANK_SIZE / 2;
  const cy = t.y + TANK_SIZE / 2;
  const half = TANK_SIZE / 2;

  // 出生动画：旋转的星形护罩
  if (t.spawnTimer > 0) {
    const p = 1 - t.spawnTimer / SPAWN_ANIM;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(p * Math.PI * 4);
    ctx.strokeStyle = `rgba(140,220,255,${0.35 + p * 0.5})`;
    ctx.lineWidth = 2;
    const r = half + 6 - p * 4;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    return;
  }

  const pal = t.isPlayer
    ? HULL.player
    : t.kind === 'fast'
      ? HULL.fast
      : t.kind === 'armor'
        ? HULL[`armor${clamp(t.hp, 1, 3)}`]
        : HULL.basic;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(DIRS[t.dir].angle);

  const flash = t.hurtFlash > 0 && (t.hurtFlash % 4 < 2);
  const hull = flash ? '#ffffff' : pal.hull;

  // 履带
  ctx.fillStyle = pal.dark;
  ctx.fillRect(-half, -half, 6, TANK_SIZE);
  ctx.fillRect(half - 6, -half, 6, TANK_SIZE);
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  for (let i = -half + 2; i < half - 1; i += 5) {
    ctx.fillRect(-half + 1, i, 4, 2);
    ctx.fillRect(half - 5, i, 4, 2);
  }

  // 车体
  ctx.fillStyle = hull;
  ctx.fillRect(-half + 6, -half + 1, TANK_SIZE - 12, TANK_SIZE - 2);

  ctx.fillStyle = pal.trim;
  ctx.fillRect(-half + 6, -half + 1, TANK_SIZE - 12, 3);
  ctx.fillRect(-half + 6, half - 4, TANK_SIZE - 12, 3);

  // 炮塔
  ctx.fillStyle = pal.trim;
  ctx.beginPath();
  ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  // 炮管
  ctx.fillStyle = pal.dark;
  ctx.fillRect(-2, -half - 5, 4, half + 2);

  ctx.restore();

  // 护盾
  if (t.shield > 0) {
    const pulse = 0.55 + 0.45 * Math.sin(tick * 0.25);
    ctx.strokeStyle = `rgba(90,209,255,${pulse * 0.9})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, half + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawBullet(b) {
  const cx = b.x + BULLET_SIZE / 2;
  const cy = b.y + BULLET_SIZE / 2;
  const d = DIRS[b.dir];

  ctx.fillStyle = 'rgba(255,204,77,.35)';
  ctx.beginPath();
  ctx.arc(cx - d.x * 5, cy - d.y * 5, BULLET_SIZE / 2 + 1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = b.power >= 2 ? C.bulletHot : C.bullet;
  ctx.beginPath();
  ctx.arc(cx, cy, BULLET_SIZE / 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawPowerup(p) {
  const s = 28;
  const cx = p.x + s / 2;
  const cy = p.y + s / 2;

  // 即将消失时闪烁
  if (p.life < 180 && p.t % 12 < 6) return;

  const colors = { star: '#ffd447', shield: '#55c8ff', life: '#6ee7a8', bomb: '#ff6b6b' };
  const col = colors[p.kind];

  const pulse = 1 + 0.08 * Math.sin(p.t * 0.15);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pulse, pulse);

  ctx.fillStyle = 'rgba(9,13,19,.85)';
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.strokeRect(-s / 2 + 1, -s / 2 + 1, s - 2, s - 2);

  ctx.fillStyle = col;
  ctx.beginPath();
  if (p.kind === 'star') {
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 9 : 4;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  } else if (p.kind === 'shield') {
    ctx.moveTo(0, -9);
    ctx.lineTo(8, -5);
    ctx.lineTo(8, 3);
    ctx.lineTo(0, 9);
    ctx.lineTo(-8, 3);
    ctx.lineTo(-8, -5);
  } else if (p.kind === 'life') {
    ctx.moveTo(0, -9);
    ctx.lineTo(9, -3);
    ctx.lineTo(9, 9);
    ctx.lineTo(-9, 9);
    ctx.lineTo(-9, -3);
  } else {
    ctx.arc(0, 2, 7, 0, Math.PI * 2);
  }
  ctx.closePath();
  ctx.fill();

  if (p.kind === 'life') {
    ctx.fillStyle = '#06210f';
    ctx.fillRect(-2, 1, 4, 5);
    ctx.fillRect(-5, 3, 10, 2);
  }
  if (p.kind === 'bomb') {
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(2, -5);
    ctx.lineTo(7, -10);
    ctx.stroke();
  }

  ctx.restore();
}

function drawEffects() {
  for (const e of effects) {
    if (!e.life || e.respawnIn) continue;
    const p = e.t / e.life;
    const r = e.size * (0.35 + p * 0.75);

    ctx.globalAlpha = Math.max(0, 1 - p);
    const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
    grad.addColorStop(0, '#fffbe8');
    grad.addColorStop(0.35, '#ffcc4d');
    grad.addColorStop(0.7, '#ff7a2f');
    grad.addColorStop(1, 'rgba(160,40,10,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  for (const p of particles) {
    const a = 1 - p.t / p.life;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = p.color;
    const s = 2 + a * 2;
    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
}

function render() {
  ctx.save();

  if (shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  }

  ctx.fillStyle = '#05070b';
  ctx.fillRect(-20, -20, W + 40, H + 40);

  // 场地网格纹理
  ctx.strokeStyle = 'rgba(255,255,255,.028)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 1; c < COLS; c++) {
    ctx.moveTo(c * TILE + 0.5, 0);
    ctx.lineTo(c * TILE + 0.5, H);
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.moveTo(0, r * TILE + 0.5);
    ctx.lineTo(W, r * TILE + 0.5);
  }
  ctx.stroke();

  // 瓦片
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = grid[r][c];
      if (t === BRICK) drawBrickTile(c * TILE, r * TILE);
      else if (t === STEEL) drawSteelTile(c * TILE, r * TILE);
    }
  }

  drawBase();

  for (const p of powerups) drawPowerup(p);
  for (const b of bullets) drawBullet(b);
  for (const t of tanks) if (!t.dead) drawTank(t);
  drawEffects();

  // 敌人来袭的方向提示
  if (state === 'playing' && enemyQueue.length > 0 && tick % 90 < 45) {
    ctx.fillStyle = 'rgba(255,95,86,.75)';
    for (const s of SPAWNS) {
      const x = s.col * TILE + TILE / 2;
      ctx.beginPath();
      ctx.moveTo(x - 7, 2);
      ctx.lineTo(x + 7, 2);
      ctx.lineTo(x, 12);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore();
}

/* ----------------------------- 主循环 ----------------------------- */

let lastTime = 0;
let accumulator = 0;

function frame(time) {
  requestAnimationFrame(frame);

  if (!lastTime) lastTime = time;
  let dt = time - lastTime;
  lastTime = time;
  if (dt > 250) dt = 250;          // 切回标签页时不要一次性补上几千帧

  accumulator += dt;
  let guard = 0;
  while (accumulator >= STEP && guard++ < 5) {
    accumulator -= STEP;
    update();
    if (state === 'levelclear') {
      stateTimer--;
      if (stateTimer <= 0) nextLevel();
    }
  }

  render();
  if (state === 'playing') updateHud();
}

/* ----------------------------- 启动 ----------------------------- */

buildGrid(0);          // 菜单背景先摆好地图
render();
requestAnimationFrame(frame);
