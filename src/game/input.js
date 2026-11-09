// 키보드와 터치 입력. 좌우 이동은 누르고 있으면 반복(DAS/ARR)된다.

const DAS = 0.17; // 반복 이동이 시작되기까지 걸리는 시간(초)
const ARR = 0.05; // 반복 이동 간격(초)

const KEY_MAP = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowDown: 'soft',
  Space: 'hard',
  ArrowUp: 'cw',
  KeyX: 'cw',
  KeyZ: 'ccw',
  KeyC: 'hold',
  ShiftLeft: 'hold',
  ShiftRight: 'hold',
  KeyP: 'pause',
  Escape: 'pause',
  KeyM: 'mute',
};

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export class Input {
  /**
   * @param {import('./game.js').Game} game
   * @param {{onPause: () => void, onMute: () => void}} handlers
   */
  constructor(game, handlers) {
    this.game = game;
    this.handlers = handlers;
    this.reset();

    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('blur', () => this.reset());
  }

  reset() {
    this.leftHeld = false;
    this.rightHeld = false;
    this.dir = 0;
    this.dasTimer = 0;
    this.arrTimer = 0;
    if (this.game) this.game.setSoftDrop(false);
  }

  onKeyDown(e) {
    const action = KEY_MAP[e.code];
    if (!action) return;
    if (isTypingTarget(e.target) || document.querySelector('dialog[open]')) return;

    const playing = this.game.state === 'playing';
    if (playing || action === 'pause') e.preventDefault();
    if (e.repeat) return; // 반복은 직접 처리한다
    this.actionDown(action);
  }

  onKeyUp(e) {
    const action = KEY_MAP[e.code];
    if (action) this.actionUp(action);
  }

  /** 키 또는 터치 버튼을 눌렀을 때 */
  actionDown(action) {
    if (action === 'mute') return this.handlers.onMute();
    if (action === 'pause') return this.handlers.onPause();
    if (this.game.state !== 'playing') return;

    switch (action) {
      case 'left':
        this.leftHeld = true;
        this.startDir(-1);
        break;
      case 'right':
        this.rightHeld = true;
        this.startDir(1);
        break;
      case 'soft':
        this.game.setSoftDrop(true);
        break;
      case 'hard':
        this.game.hardDrop();
        break;
      case 'cw':
        this.game.rotate(1);
        break;
      case 'ccw':
        this.game.rotate(-1);
        break;
      case 'hold':
        this.game.holdPiece();
        break;
    }
  }

  /** 키 또는 터치 버튼을 뗐을 때 */
  actionUp(action) {
    if (action === 'left') {
      this.leftHeld = false;
      if (this.dir === -1) this.switchDir(this.rightHeld ? 1 : 0);
    } else if (action === 'right') {
      this.rightHeld = false;
      if (this.dir === 1) this.switchDir(this.leftHeld ? -1 : 0);
    } else if (action === 'soft') {
      this.game.setSoftDrop(false);
    }
  }

  startDir(dir) {
    this.switchDir(dir);
    this.game.move(dir);
  }

  switchDir(dir) {
    this.dir = dir;
    this.dasTimer = 0;
    this.arrTimer = 0;
  }

  update(dt) {
    if (!this.dir || this.game.state !== 'playing') return;
    this.dasTimer += dt;
    if (this.dasTimer < DAS) return;
    this.arrTimer += dt;
    while (this.arrTimer >= ARR) {
      this.arrTimer -= ARR;
      if (!this.game.move(this.dir)) {
        this.arrTimer = 0;
        break;
      }
    }
  }
}
