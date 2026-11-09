import './styles.css';
import { Game } from './game/game.js';
import { Input } from './game/input.js';
import { Renderer } from './game/renderer.js';
import { Sound } from './audio/sound.js';
import { isConfigured } from './api/supabase.js';
import { saveScore, fetchLeaderboard } from './api/scores.js';
import { submitFeedback, fetchFeedback } from './api/feedback.js';
import { storage, charLength } from './storage.js';

const $ = (sel) => document.querySelector(sel);
const FEEDBACK_COOLDOWN_MS = 30_000;
const NOT_CONFIGURED_MSG = 'Supabase 설정이 없어 불러올 수 없습니다.';

// ---------- 핵심 객체 ----------

const sound = new Sound();
const game = new Game({
  sound: (name) => sound.play(name),
  level: (level) => sound.setTempoLevel(level),
  gameover: (result) => onGameOver(result),
});
const renderer = new Renderer($('#board'), $('#next'), $('#hold'));
const input = new Input(game, { onPause: togglePause, onMute: toggleMute });

// ---------- 화면 전환 ----------

const overlays = {
  start: $('#overlay-start'),
  pause: $('#overlay-pause'),
  gameover: $('#overlay-gameover'),
};

function showOverlay(name) {
  for (const [key, el] of Object.entries(overlays)) el.hidden = key !== name;
}

function blurActive() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

function startGame() {
  sound.init();
  input.reset();
  game.start();
  sound.stopMusic();
  sound.setTempoLevel(1);
  sound.startMusic();
  showOverlay(null);
  $('#btn-pause').disabled = false;
  blurActive();
}

function pauseGame() {
  if (game.state !== 'playing') return;
  game.pause();
  input.reset();
  sound.stopMusic();
  showOverlay('pause');
  $('#btn-pause').textContent = '계속하기';
}

function resumeGame() {
  if (game.state !== 'paused') return;
  sound.init();
  game.resume();
  sound.startMusic();
  showOverlay(null);
  $('#btn-pause').textContent = '일시정지';
  blurActive();
}

function togglePause() {
  if (game.state === 'playing') pauseGame();
  else if (game.state === 'paused') resumeGame();
}

function toggleMute() {
  sound.init();
  sound.toggleMute();
  syncSoundUI();
}

$('#btn-start').addEventListener('click', startGame);
$('#btn-again').addEventListener('click', startGame);
$('#btn-restart').addEventListener('click', startGame);
$('#btn-resume').addEventListener('click', resumeGame);
$('#btn-pause').addEventListener('click', togglePause);
$('#btn-mute').addEventListener('click', toggleMute);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseGame();
});

// ---------- 터치 조작 ----------

document.querySelectorAll('.touch-controls button').forEach((btn) => {
  const action = btn.dataset.action;
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    sound.init();
    input.actionDown(action);
  });
  const release = () => input.actionUp(action);
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('pointerleave', release);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
});

// ---------- 점수 표시 ----------

const statEls = { score: $('#stat-score'), level: $('#stat-level'), lines: $('#stat-lines') };
const shown = { score: -1, level: -1, lines: -1 };

function updateStats() {
  for (const key of Object.keys(statEls)) {
    if (shown[key] !== game[key]) {
      shown[key] = game[key];
      statEls[key].textContent = game[key].toLocaleString('ko-KR');
    }
  }
}

// ---------- 게임 오버와 점수 저장 ----------

let lastResult = null;
let savedId = null;
let saving = false;

const saveBtn = $('#btn-save');
const saveMsg = $('#save-msg');
const nicknameInput = $('#nickname');

function setMsg(el, text, kind = '') {
  el.textContent = text;
  el.className = `form-msg ${kind}`.trim();
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

function onGameOver(result) {
  sound.stopMusic();
  input.reset();
  lastResult = result;
  savedId = null;
  $('#btn-pause').disabled = true;
  $('#btn-pause').textContent = '일시정지';

  $('#final-score').textContent = result.score.toLocaleString('ko-KR');
  $('#final-detail').textContent = `레벨 ${result.level} · ${result.lines}줄 · ${formatDuration(result.durationSec)}`;
  nicknameInput.value = storage.get('nickname') || '';
  saveBtn.textContent = '점수 저장';

  if (!isConfigured) {
    saveBtn.disabled = true;
    setMsg(saveMsg, 'Supabase 설정이 없어 점수를 저장할 수 없습니다.', 'error');
  } else if (result.score <= 0) {
    saveBtn.disabled = true;
    setMsg(saveMsg, '0점은 저장할 수 없습니다.');
  } else {
    saveBtn.disabled = false;
    setMsg(saveMsg, '');
  }

  showOverlay('gameover');
  if (window.matchMedia('(pointer: fine)').matches && !saveBtn.disabled) {
    setTimeout(() => nicknameInput.focus(), 50);
  }
}

$('#score-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (saving || savedId || !lastResult || saveBtn.disabled) return;

  const nickname = nicknameInput.value.trim();
  const len = charLength(nickname);
  if (len < 2 || len > 12) {
    setMsg(saveMsg, '닉네임은 2~12자로 입력해 주세요.', 'error');
    nicknameInput.focus();
    return;
  }

  saving = true;
  saveBtn.disabled = true;
  saveBtn.textContent = '저장 중…';
  setMsg(saveMsg, '');
  try {
    const id = await saveScore({ ...lastResult, nickname });
    savedId = id;
    storage.set('nickname', nickname);
    saveBtn.textContent = '저장됨';
    setMsg(saveMsg, '저장 완료!', 'ok');
    const rows = await loadLeaderboard(id);
    const rank = rows ? rows.findIndex((r) => r.id === id) : -1;
    if (rank >= 0) setMsg(saveMsg, `저장 완료! 현재 ${rank + 1}위입니다.`, 'ok');
    else if (rows) setMsg(saveMsg, '저장 완료! (TOP 20 밖)', 'ok');
  } catch (err) {
    console.error(err);
    saveBtn.disabled = false;
    saveBtn.textContent = '다시 시도';
    setMsg(saveMsg, '저장에 실패했습니다. 네트워크를 확인하고 다시 시도해 주세요.', 'error');
  } finally {
    saving = false;
  }
});

// ---------- 리더보드 ----------

const lbList = $('#leaderboard-list');
const lbStatus = $('#leaderboard-status');
let highlightId = null;

function renderLeaderboard(rows) {
  lbList.replaceChildren();
  rows.forEach((row, i) => {
    const li = document.createElement('li');
    if (row.id === highlightId) li.classList.add('me');

    const rank = document.createElement('span');
    rank.className = 'rank';
    rank.textContent = String(i + 1);

    const nameWrap = document.createElement('span');
    nameWrap.className = 'name';
    nameWrap.textContent = row.nickname;
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = `Lv.${row.level} · ${row.lines}줄`;
    nameWrap.appendChild(meta);

    const score = document.createElement('span');
    score.className = 'score';
    score.textContent = row.score.toLocaleString('ko-KR');

    li.append(rank, nameWrap, score);
    lbList.appendChild(li);
  });
}

async function loadLeaderboard(newHighlightId) {
  if (newHighlightId !== undefined) highlightId = newHighlightId;
  if (!isConfigured) {
    lbStatus.textContent = NOT_CONFIGURED_MSG;
    return null;
  }
  lbStatus.textContent = '불러오는 중…';
  try {
    const rows = await fetchLeaderboard(20);
    renderLeaderboard(rows);
    lbStatus.textContent = rows.length ? '' : '아직 기록이 없습니다. 첫 번째 주인공이 되어 보세요!';
    return rows;
  } catch (err) {
    console.error(err);
    lbStatus.textContent = '랭킹을 불러올 수 없습니다.';
    return null;
  }
}

$('#btn-refresh').addEventListener('click', () => loadLeaderboard());

// ---------- 다이얼로그 공통 ----------

function openDialog(dlg) {
  pauseGame();
  input.reset();
  if (!dlg.open) dlg.showModal();
}

document.querySelectorAll('dialog').forEach((dlg) => {
  dlg.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', () => dlg.close()));
  // 바깥(배경) 클릭 시 닫기
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close();
  });
});

// ---------- 사운드 설정 ----------

const dlgSettings = $('#dlg-settings');
const setMute = $('#set-mute');
const setMusic = $('#set-music');
const setSfx = $('#set-sfx');

function syncSoundUI() {
  const s = sound.settings;
  const muteBtn = $('#btn-mute');
  muteBtn.textContent = s.muted ? '🔇' : '🔊';
  muteBtn.setAttribute('aria-label', s.muted ? '음소거 해제' : '음소거');
  muteBtn.setAttribute('aria-pressed', String(s.muted));
  setMute.checked = s.muted;
  setMusic.value = String(Math.round(s.musicVolume * 100));
  setSfx.value = String(Math.round(s.sfxVolume * 100));
  $('#set-music-val').textContent = setMusic.value;
  $('#set-sfx-val').textContent = setSfx.value;
}

function openSettings() {
  sound.init();
  syncSoundUI();
  openDialog(dlgSettings);
}

$('#btn-settings').addEventListener('click', openSettings);
$('#btn-pause-settings').addEventListener('click', openSettings);

setMute.addEventListener('change', () => {
  sound.setMuted(setMute.checked);
  syncSoundUI();
});
setMusic.addEventListener('input', () => {
  sound.setMusicVolume(Number(setMusic.value) / 100);
  $('#set-music-val').textContent = setMusic.value;
});
setSfx.addEventListener('input', () => {
  sound.setSfxVolume(Number(setSfx.value) / 100);
  $('#set-sfx-val').textContent = setSfx.value;
});
setSfx.addEventListener('change', () => sound.play('rotate')); // 미리 듣기

// ---------- 피드백 ----------

const dlgFeedback = $('#dlg-feedback');
const fbForm = $('#feedback-form');
const fbNickname = $('#fb-nickname');
const fbMessage = $('#fb-message');
const fbCount = $('#fb-count');
const fbMsg = $('#fb-msg');
const fbSubmit = $('#btn-fb-submit');
const fbList = $('#feedback-list');
const fbStatus = $('#feedback-status');
const starButtons = [...document.querySelectorAll('#fb-stars button')];
let rating = 0;

function setRating(value) {
  rating = value;
  starButtons.forEach((btn) => {
    const on = Number(btn.dataset.rating) <= rating;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(Number(btn.dataset.rating) === rating));
  });
}

starButtons.forEach((btn) =>
  btn.addEventListener('click', () => {
    const value = Number(btn.dataset.rating);
    setRating(value === rating ? 0 : value); // 같은 별을 다시 누르면 해제
  }),
);

fbMessage.addEventListener('input', () => {
  fbCount.textContent = `${charLength(fbMessage.value)} / 500`;
});

function openFeedback() {
  if (!fbNickname.value) fbNickname.value = storage.get('nickname') || '';
  setMsg(fbMsg, isConfigured ? '' : 'Supabase 설정이 없어 피드백을 보낼 수 없습니다.', isConfigured ? '' : 'error');
  fbSubmit.disabled = !isConfigured;
  openDialog(dlgFeedback);
  loadFeedback();
}

$('#btn-feedback').addEventListener('click', openFeedback);
$('#btn-go-feedback').addEventListener('click', openFeedback);

function renderFeedback(rows) {
  fbList.replaceChildren();
  for (const row of rows) {
    const li = document.createElement('li');
    const head = document.createElement('div');
    head.className = 'fb-head';

    const name = document.createElement('span');
    name.className = 'fb-name';
    name.textContent = row.nickname;
    head.appendChild(name);

    if (row.rating) {
      const stars = document.createElement('span');
      stars.className = 'fb-stars';
      stars.textContent = '★'.repeat(row.rating) + '☆'.repeat(5 - row.rating);
      stars.setAttribute('aria-label', `${row.rating}점`);
      head.appendChild(stars);
    }

    const date = document.createElement('time');
    date.dateTime = row.created_at;
    date.textContent = new Date(row.created_at).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    head.appendChild(date);

    const body = document.createElement('p');
    body.className = 'fb-body';
    body.textContent = row.message; // XSS 방지: 항상 textContent

    li.append(head, body);
    fbList.appendChild(li);
  }
}

async function loadFeedback() {
  if (!isConfigured) {
    fbStatus.textContent = NOT_CONFIGURED_MSG;
    return;
  }
  fbStatus.textContent = '불러오는 중…';
  try {
    const rows = await fetchFeedback(20);
    renderFeedback(rows);
    fbStatus.textContent = rows.length ? '' : '아직 피드백이 없습니다.';
  } catch (err) {
    console.error(err);
    fbStatus.textContent = '피드백을 불러올 수 없습니다.';
  }
}

fbForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (fbSubmit.disabled) return;

  const message = fbMessage.value.trim();
  const msgLen = charLength(message);
  if (msgLen < 1 || msgLen > 500) {
    setMsg(fbMsg, '내용을 1~500자로 입력해 주세요.', 'error');
    fbMessage.focus();
    return;
  }
  const nickname = fbNickname.value.trim();
  if (charLength(nickname) > 12) {
    setMsg(fbMsg, '닉네임은 12자 이하로 입력해 주세요.', 'error');
    return;
  }

  const lastAt = Number(storage.get('feedbackAt')) || 0;
  const wait = FEEDBACK_COOLDOWN_MS - (Date.now() - lastAt);
  if (wait > 0) {
    setMsg(fbMsg, `${Math.ceil(wait / 1000)}초 후에 다시 보낼 수 있어요.`, 'error');
    return;
  }

  fbSubmit.disabled = true;
  setMsg(fbMsg, '보내는 중…');
  try {
    await submitFeedback({ nickname, rating, message });
    storage.set('feedbackAt', Date.now());
    fbMessage.value = '';
    fbCount.textContent = '0 / 500';
    setRating(0);
    setMsg(fbMsg, '소중한 의견 감사합니다!', 'ok');
    loadFeedback();
  } catch (err) {
    console.error(err);
    setMsg(fbMsg, '보내기에 실패했습니다. 잠시 후 다시 시도해 주세요.', 'error');
  } finally {
    fbSubmit.disabled = false;
  }
});

// ---------- 게임 루프 ----------

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  input.update(dt);
  game.update(dt);
  renderer.draw(game);
  updateStats();
  requestAnimationFrame(frame);
}

// ---------- 시작 ----------

syncSoundUI();
showOverlay('start');
loadLeaderboard();
requestAnimationFrame(frame);
