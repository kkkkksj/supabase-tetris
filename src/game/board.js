// 보드 상태와 충돌 판정, 줄 지우기

export const COLS = 10;
export const ROWS = 20; // 보이는 줄 수
export const HIDDEN = 2; // 위쪽 숨은 줄 (블록 생성용)
export const TOTAL_ROWS = ROWS + HIDDEN;

const emptyRow = () => Array(COLS).fill(null);

export class Board {
  constructor() {
    this.reset();
  }

  reset() {
    this.grid = Array.from({ length: TOTAL_ROWS }, emptyRow);
  }

  /** 행렬 m 을 (x, y) 에 놓았을 때 벽·바닥·다른 블록과 겹치는지 */
  collides(m, x, y) {
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        const bx = x + c;
        const by = y + r;
        if (bx < 0 || bx >= COLS || by >= TOTAL_ROWS) return true;
        if (by >= 0 && this.grid[by][bx]) return true;
      }
    }
    return false;
  }

  /** 블록을 보드에 고정한다. 블록 전체가 숨은 줄에 있으면 true (게임 오버 조건) */
  merge(m, x, y, type) {
    let allHidden = true;
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        const by = y + r;
        if (by < 0) continue;
        this.grid[by][x + c] = type;
        if (by >= HIDDEN) allHidden = false;
      }
    }
    return allHidden;
  }

  /** 꽉 찬 줄을 지우고 지운 줄 수를 반환한다 */
  clearLines() {
    const remaining = this.grid.filter((row) => row.some((cell) => !cell));
    const cleared = TOTAL_ROWS - remaining.length;
    while (remaining.length < TOTAL_ROWS) remaining.unshift(emptyRow());
    this.grid = remaining;
    return cleared;
  }
}
