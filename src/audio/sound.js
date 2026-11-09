// Web Audio API로 배경음과 효과음을 직접 합성한다 (외부 음원 파일 없음).
import { storage } from '../storage.js';

const DEFAULTS = { muted: false, musicVolume: 0.5, sfxVolume: 0.7 };

const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// ---- 배경음 (오리지널 곡): 8마디 × 8분음표 8개 = 64스텝 ----
// 코드 진행: Am - F - C - G - Am - F - G - E
const CHORDS = [
  { root: 45, tones: [57, 60, 64] }, // Am
  { root: 41, tones: [57, 60, 65] }, // F
  { root: 48, tones: [55, 60, 64] }, // C
  { root: 43, tones: [55, 59, 62] }, // G
  { root: 45, tones: [57, 60, 64] }, // Am
  { root: 41, tones: [57, 60, 65] }, // F
  { root: 43, tones: [55, 59, 62] }, // G
  { root: 40, tones: [56, 59, 64] }, // E
];
// 숫자 = 음 시작(MIDI), -1 = 앞 음 유지, 0 = 쉼표
const MELODY = [
  76, -1, 81, -1, 79, 76, 74, 76,
  72, -1, -1, 69, 72, 74, -1, -1,
  76, -1, 79, -1, 76, 74, 72, 74,
  74, -1, 71, -1, 67, -1, -1, -1,
  69, 72, 76, 81, 79, -1, 76, -1,
  77, -1, 76, -1, 72, -1, 69, -1,
  71, -1, 74, -1, 79, -1, 77, 76,
  76, -1, -1, -1, 68, -1, 71, -1,
];
const STEPS = MELODY.length;

export class Sound {
  constructor() {
    this.ctx = null;
    this.settings = storage.getJSON('sound', DEFAULTS);
    this.musicPlaying = false;
    this.bpm = 116;
    this.timer = null;
  }

  /** 사용자 동작(클릭·키 입력) 안에서 호출해야 소리가 난다 */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.master);

    const len = Math.floor(this.ctx.sampleRate * 0.5);
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this.applyVolumes(true);
  }

  // ---------- 설정 ----------

  save() {
    storage.setJSON('sound', this.settings);
  }

  applyVolumes(immediate = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const set = (param, v) => (immediate ? param.setValueAtTime(v, t) : param.setTargetAtTime(v, t, 0.02));
    set(this.master.gain, this.settings.muted ? 0 : 1);
    set(this.musicGain.gain, this.settings.musicVolume * 0.6);
    set(this.sfxGain.gain, this.settings.sfxVolume);
  }

  setMuted(muted) {
    this.settings.muted = muted;
    this.applyVolumes();
    this.save();
  }

  toggleMute() {
    this.setMuted(!this.settings.muted);
    return this.settings.muted;
  }

  setMusicVolume(v) {
    this.settings.musicVolume = v;
    this.applyVolumes();
    this.save();
  }

  setSfxVolume(v) {
    this.settings.sfxVolume = v;
    this.applyVolumes();
    this.save();
  }

  // ---------- 합성 도구 ----------

  tone({ f, type = 'square', dur = 0.1, vol = 0.2, slideTo = null, when = 0, dest = this.sfxGain, attack = 0.005 }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise({ dur = 0.08, vol = 0.2, when = 0, filter = 'lowpass', cutoff = 1200, dest = this.sfxGain }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const biquad = ctx.createBiquadFilter();
    biquad.type = filter;
    biquad.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(biquad).connect(g).connect(dest);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // ---------- 효과음 ----------

  play(name) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    switch (name) {
      case 'move':
        this.tone({ f: 260, type: 'square', dur: 0.035, vol: 0.05 });
        break;
      case 'rotate':
        this.tone({ f: 520, slideTo: 780, type: 'triangle', dur: 0.06, vol: 0.12 });
        break;
      case 'hold':
        this.tone({ f: 392, slideTo: 330, type: 'triangle', dur: 0.08, vol: 0.12 });
        break;
      case 'drop':
        this.noise({ dur: 0.07, vol: 0.18, cutoff: 900 });
        this.tone({ f: 140, slideTo: 60, type: 'sine', dur: 0.12, vol: 0.3 });
        break;
      case 'clear':
        [523, 659, 784].forEach((f, i) => this.tone({ f, type: 'triangle', dur: 0.12, vol: 0.18, when: i * 0.05 }));
        break;
      case 'tetris':
        [523, 659, 784, 1047, 1319].forEach((f, i) =>
          this.tone({ f, type: 'square', dur: 0.16, vol: 0.1, when: i * 0.06 }),
        );
        this.noise({ dur: 0.35, vol: 0.08, filter: 'highpass', cutoff: 5000, when: 0.24 });
        break;
      case 'levelup':
        [392, 494, 587, 784].forEach((f, i) => this.tone({ f, type: 'square', dur: 0.1, vol: 0.1, when: i * 0.07 }));
        break;
      case 'gameover':
        [392, 330, 277, 196].forEach((f, i) =>
          this.tone({ f, slideTo: f * 0.94, type: 'sawtooth', dur: 0.32, vol: 0.1, when: i * 0.26 }),
        );
        break;
    }
  }

  // ---------- 배경음 ----------

  setTempoLevel(level) {
    this.bpm = Math.min(116 + (level - 1) * 4, 172);
  }

  startMusic() {
    if (!this.ctx || this.musicPlaying) return;
    this.musicPlaying = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stopMusic() {
    this.musicPlaying = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  schedule() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.nextTime < now - 0.2) this.nextTime = now + 0.02; // 탭 전환 등으로 밀렸을 때
    const stepDur = 60 / this.bpm / 2; // 8분음표
    while (this.nextTime < now + 0.12) {
      this.playStep(this.step, this.nextTime - now, stepDur);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % STEPS;
    }
  }

  playStep(step, when, stepDur) {
    const dest = this.musicGain;
    const chord = CHORDS[Math.floor(step / 8)];
    const beat = step % 8;

    // 베이스: 근음 ↔ 옥타브
    const bassNote = beat % 2 === 0 ? chord.root : chord.root + 12;
    this.tone({ f: freq(bassNote), type: 'triangle', dur: stepDur * 0.9, vol: 0.22, when, dest });

    // 아르페지오 (작게)
    const arp = chord.tones[[0, 1, 2, 1][beat % 4]] + 12;
    this.tone({ f: freq(arp), type: 'square', dur: stepDur * 0.5, vol: 0.025, when, dest });

    // 리듬: 킥(1·3박), 하이햇(엇박)
    if (beat % 4 === 0) this.tone({ f: 120, slideTo: 45, type: 'sine', dur: 0.14, vol: 0.28, when, dest });
    if (beat % 2 === 1) this.noise({ dur: 0.03, vol: 0.05, filter: 'highpass', cutoff: 7000, when, dest });

    // 멜로디
    const note = MELODY[step];
    if (note > 0) {
      let len = 1;
      while (MELODY[(step + len) % STEPS] === -1 && len < STEPS) len++;
      this.tone({ f: freq(note), type: 'square', dur: stepDur * len * 0.92, vol: 0.06, when, dest, attack: 0.01 });
    }
  }
}
