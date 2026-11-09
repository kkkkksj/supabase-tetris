// 게임 규칙: 이동, 회전, 낙하, 고정, 줄 지우기, 점수, 레벨
import { Board, COLS, HIDDEN } from './board.js';
import { SHAPES, getKicks } from './pieces.js';
import { Bag } from './randomizer.js';

const LINE_SCORES = [0, 100, 300, 500, 800];
const LOCK_DELAY = 0.5; // 초
const MAX_LOCK_RESETS = 15; // 바닥에서 이동/회전으로 고정을 미룰 수 있는 횟수
const SOFT_DROP_INTERVAL = 0.05; // 초
const LINES_PER_LEVEL = 10;

/** 레벨별 한 칸 낙하 간격(초). 레벨 1 = 1초, 레벨 15 ≈ 0.007초 */
export function gravityInterval(level) {
  const lv = Math.min(level, 20);
  return Math.max(Math.pow(0.8 - (lv - 1) * 0.007, lv - 1), 0.005);
}

export class Game {
  /**
   * @param {{sound?: (name: string) => void, level?: (level: number) => void, gameover?: (result: object) => void}} events
   */
  constructor(events = {}) {
    this.events = events;
    this.board = new Board();
    this.state = 'idle'; // idle | playing | paused | over
    this.bag = null;
    this.piece = null;
    this.hold = null;
    this.holdUsed = false;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.elapsed = 0;
  }

  emit(name, ...args) {
    const fn = this.events[name];
    if (fn) fn(...args);
  }

  start() {
    this.board.reset();
    this.bag = new Bag();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.elapsed = 0;
    this.hold = null;
    this.holdUsed = false;
    this.softDropping = false;
    this.state = 'playing';
    this.spawn(this.bag.next());
  }

  pause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.softDropping = false;
    }
  }

  resume() {
    if (this.state === 'paused') this.state = 'playing';
  }

  // ---------- 블록 ----------

  matrix(rot = this.piece.rot) {
    return SHAPES[this.piece.type][rot];
  }

  canPlace(rot, x, y) {
    return !this.board.collides(this.matrix(rot), x, y);
  }

  isGrounded() {
    const p = this.piece;
    return !this.canPlace(p.rot, p.x, p.y + 1);
  }

  spawn(type) {
    const size = SHAPES[type][0].length;
    this.piece = { type, rot: 0, x: Math.floor((COLS - size) / 2), y: HIDDEN - 1 };
    this.gravityTimer = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.lowestY = this.piece.y;
    if (!this.canPlace(0, this.piece.x, this.piece.y)) {
      this.gameOver();
      return false;
    }
    return true;
  }

  /** 이동/회전에 성공했을 때: 바닥에 닿아 있던 상태였다면 고정 타이머를 미룬다 */
  afterMove(wasGrounded) {
    if (wasGrounded) {
      this.lockResets++;
      if (this.lockResets <= MAX_LOCK_RESETS) this.lockTimer = 0;
    }
  }

  move(dx) {
    if (this.state !== 'playing') return false;
    const p = this.piece;
    if (!this.canPlace(p.rot, p.x + dx, p.y)) return false;
    const wasGrounded = this.isGrounded();
    p.x += dx;
    this.afterMove(wasGrounded);
    this.emit('sound', 'move');
    return true;
  }

  rotate(dir) {
    if (this.state !== 'playing') return false;
    const p = this.piece;
    if (p.type === 'O') return false;
    const from = p.rot;
    const to = (from + dir + 4) % 4;
    const wasGrounded = this.isGrounded();
    for (const [kx, ky] of getKicks(p.type, from, to)) {
      if (this.canPlace(to, p.x + kx, p.y + ky)) {
        p.rot = to;
        p.x += kx;
        p.y += ky;
        this.afterMove(wasGrounded);
        this.emit('sound', 'rotate');
        return true;
      }
    }
    return false;
  }

  /** 한 칸 내린다. 내려갔으면 true */
  stepDown() {
    const p = this.piece;
    if (!this.canPlace(p.rot, p.x, p.y + 1)) return false;
    p.y++;
    if (p.y > this.lowestY) {
      this.lowestY = p.y;
      this.lockResets = 0;
      this.lockTimer = 0;
    }
    return true;
  }

  setSoftDrop(on) {
    if (on && !this.softDropping && this.state === 'playing') {
      if (this.stepDown()) this.score += 1;
      this.gravityTimer = 0;
    }
    this.softDropping = on && this.state === 'playing';
  }

  hardDrop() {
    if (this.state !== 'playing') return;
    let n = 0;
    while (this.stepDown()) n++;
    this.score += n * 2;
    this.lock();
  }

  holdPiece() {
    if (this.state !== 'playing' || this.holdUsed) return;
    const current = this.piece.type;
    const next = this.hold || this.bag.next();
    this.hold = current;
    this.holdUsed = true;
    this.emit('sound', 'hold');
    this.spawn(next);
  }

  lock() {
    const p = this.piece;
    const lockedOut = this.board.merge(this.matrix(), p.x, p.y, p.type);
    this.emit('sound', 'drop');

    const cleared = this.board.clearLines();
    if (cleared > 0) {
      this.score += LINE_SCORES[cleared] * this.level;
      this.lines += cleared;
      this.emit('sound', cleared === 4 ? 'tetris' : 'clear');
      const newLevel = Math.floor(this.lines / LINES_PER_LEVEL) + 1;
      if (newLevel > this.level) {
        this.level = newLevel;
        this.emit('sound', 'levelup');
        this.emit('level', this.level);
      }
    }

    if (lockedOut) {
      this.gameOver();
      return;
    }
    this.holdUsed = false;
    this.spawn(this.bag.next());
  }

  gameOver() {
    this.state = 'over';
    this.softDropping = false;
    this.emit('sound', 'gameover');
    this.emit('gameover', {
      score: this.score,
      lines: this.lines,
      level: this.level,
      durationSec: Math.round(this.elapsed),
    });
  }

  // ---------- 매 프레임 ----------

  update(dt) {
    if (this.state !== 'playing') return;
    this.elapsed += dt;

    const base = gravityInterval(this.level);
    const interval = this.softDropping ? Math.min(base, SOFT_DROP_INTERVAL) : base;

    if (!this.isGrounded()) {
      this.gravityTimer += dt;
      while (this.gravityTimer >= interval) {
        this.gravityTimer -= interval;
        if (this.stepDown()) {
          if (this.softDropping) this.score += 1;
        } else {
          break;
        }
      }
    }

    if (this.isGrounded()) {
      this.gravityTimer = 0;
      this.lockTimer += dt;
      if (this.lockTimer >= LOCK_DELAY || this.lockResets > MAX_LOCK_RESETS) {
        this.lock();
      }
    }
  }
}
