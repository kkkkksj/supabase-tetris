// 7-bag 방식: 7종 블록을 한 묶음으로 섞어서 차례로 내보낸다.
import { TYPES } from './pieces.js';

export class Bag {
  constructor() {
    this.queue = [];
  }

  refill() {
    const bag = [...TYPES];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    this.queue.push(...bag);
  }

  next() {
    if (this.queue.length <= TYPES.length) this.refill();
    return this.queue.shift();
  }

  peek(n) {
    while (this.queue.length < n) this.refill();
    return this.queue.slice(0, n);
  }
}
