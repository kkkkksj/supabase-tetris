// Canvas 그리기 (고스트 피스·그림자 효과 없음)
import { COLS, ROWS, HIDDEN, TOTAL_ROWS } from './board.js';
import { SHAPES, COLORS } from './pieces.js';

const BOARD_BG = '#0e1122';
const GRID_LINE = 'rgba(255, 255, 255, 0.05)';
const DIM_COLOR = '#4a5068';

function fitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function drawCell(ctx, x, y, w, h, color) {
  const gap = Math.max(1, Math.round(w * 0.05));
  const iw = w - gap * 2;
  const ih = h - gap * 2;
  ctx.fillStyle = color;
  ctx.fillRect(x + gap, y + gap, iw, ih);
  // 위쪽 밝은 띠 (평면 하이라이트, 그림자 아님)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillRect(x + gap, y + gap, iw, Math.max(1, ih * 0.16));
}

function bounds(m) {
  let minR = Infinity, maxR = -1, minC = Infinity, maxC = -1;
  m.forEach((row, r) =>
    row.forEach((v, c) => {
      if (!v) return;
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
      minC = Math.min(minC, c);
      maxC = Math.max(maxC, c);
    }),
  );
  return { minR, maxR, minC, maxC };
}

export class Renderer {
  constructor(boardCanvas, nextCanvas, holdCanvas) {
    this.canvases = { board: boardCanvas, next: nextCanvas, hold: holdCanvas };
    this.ctx = {
      board: boardCanvas.getContext('2d'),
      next: nextCanvas.getContext('2d'),
      hold: holdCanvas.getContext('2d'),
    };
    this.resize();
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(() => this.resize());
      Object.values(this.canvases).forEach((c) => ro.observe(c));
    } else {
      window.addEventListener('resize', () => this.resize());
    }
  }

  resize() {
    Object.values(this.canvases).forEach(fitCanvas);
  }

  draw(game) {
    this.drawBoard(game);
    const active = game.state !== 'idle' && game.bag;
    this.drawPreview('next', active ? game.bag.peek(3) : [], 3, false);
    this.drawPreview('hold', active && game.hold ? [game.hold] : [], 1, game.holdUsed);
  }

  drawBoard(game) {
    const canvas = this.canvases.board;
    const ctx = this.ctx.board;
    const W = canvas.width;
    const H = canvas.height;
    const cw = W / COLS;
    const ch = H / ROWS;

    ctx.fillStyle = BOARD_BG;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < COLS; c++) {
      const x = Math.round(c * cw) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    for (let r = 1; r < ROWS; r++) {
      const y = Math.round(r * ch) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();

    const over = game.state === 'over';
    const grid = game.board.grid;
    for (let r = HIDDEN; r < TOTAL_ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = grid[r][c];
        if (t) drawCell(ctx, c * cw, (r - HIDDEN) * ch, cw, ch, over ? DIM_COLOR : COLORS[t]);
      }
    }

    const p = game.piece;
    if (p && (game.state === 'playing' || game.state === 'paused')) {
      const m = SHAPES[p.type][p.rot];
      for (let r = 0; r < m.length; r++) {
        for (let c = 0; c < m[r].length; c++) {
          const by = p.y + r;
          if (!m[r][c] || by < HIDDEN) continue;
          drawCell(ctx, (p.x + c) * cw, (by - HIDDEN) * ch, cw, ch, COLORS[p.type]);
        }
      }
    }
  }

  drawPreview(name, types, slots, dim) {
    const canvas = this.canvases[name];
    const ctx = this.ctx[name];
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const slotH = H / slots;
    const cs = Math.min(W / 5, slotH / 3);
    types.forEach((t, i) => {
      const m = SHAPES[t][0];
      const b = bounds(m);
      const pw = (b.maxC - b.minC + 1) * cs;
      const ph = (b.maxR - b.minR + 1) * cs;
      const ox = (W - pw) / 2;
      const oy = i * slotH + (slotH - ph) / 2;
      for (let r = b.minR; r <= b.maxR; r++) {
        for (let c = b.minC; c <= b.maxC; c++) {
          if (!m[r][c]) continue;
          drawCell(ctx, ox + (c - b.minC) * cs, oy + (r - b.minR) * cs, cs, cs, dim ? DIM_COLOR : COLORS[t]);
        }
      }
    });
  }
}
