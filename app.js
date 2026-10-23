'use strict';

const SAVE_KEY = 'letter-rip:v1';
const BEST_KEY = 'letter-rip:best';

const COLS = 10;
const ROWS = 20;
const START_ROWS = 3;
const MIN_WORD = 3;

// A new row falls every FIRST_DROP ms at the start, DROP_STEP ms sooner after
// each row, but never faster than FASTEST_DROP.
const FIRST_DROP = 12000;
const DROP_STEP = 250;
const FASTEST_DROP = 5000;

// Scrabble letter values and tile counts (without the two blanks).
const VALUES = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
  N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
};
const COUNTS = {
  A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1, K: 1, L: 4, M: 2,
  N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1,
};

const $ = (sel) => document.querySelector(sel);

const els = {
  startScreen: $('#startScreen'),
  playScreen: $('#playScreen'),
  bestLabel: $('#bestLabel'),
  resumeBtn: $('#resumeBtn'),
  startBtn: $('#startBtn'),
  howBtn: $('#howBtn'),
  howDialog: $('#howDialog'),
  pauseBtn: $('#pauseBtn'),
  pauseDialog: $('#pauseDialog'),
  overDialog: $('#overDialog'),
  score: $('#score'),
  rows: $('#rows'),
  best: $('#best'),
  word: $('#word'),
  timerBar: $('#timerBar'),
  boardWrap: $('#boardWrap'),
  board: $('#board'),
  finalScore: $('#finalScore'),
  newBest: $('#newBest'),
  sumWords: $('#sumWords'),
  sumRows: $('#sumRows'),
  sumBestWord: $('#sumBestWord'),
};

let dictionary = null;
let game = null;        // the game in progress (see newGame)
let running = false;    // false while paused, on the title screen or after game over
let size = 0;           // tile size in px
let lastFrame = 0;
let path = [];          // tiles being dragged through
let wordTimer = 0;

const tileEls = new Map(); // tile id -> element
const line = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
line.classList.add('path-line');
line.innerHTML = '<polyline fill="none" />';
els.board.append(line);

// ---------- Storage ----------

function loadBest() {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
}

function saveBest(score) {
  try { localStorage.setItem(BEST_KEY, String(score)); } catch { /* private mode */ }
}

function saveGame() {
  if (!game) return;
  const data = { ...game, cols: game.cols.map((col) => col.map((t) => t.letter)) };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* private mode */ }
}

function loadGame() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    // Ignore saves from a different board size.
    if (!data || !Array.isArray(data.cols) || data.cols.length !== COLS) return null;
    if (data.cols.some((col) => col.length > ROWS)) return null;
    data.nextId = 0;
    data.cols = data.cols.map((col) => col.map((letter) => ({ id: data.nextId++, letter })));
    return data;
  } catch {
    return null;
  }
}

function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* private mode */ }
}

// ---------- Letters ----------

function draw() {
  if (!game.bag.length) {
    game.bag = Object.entries(COUNTS).flatMap(([letter, n]) => Array(n).fill(letter));
  }
  const i = Math.floor(Math.random() * game.bag.length);
  return game.bag.splice(i, 1)[0];
}

function newTile() {
  return { id: game.nextId++, letter: draw() };
}

const wordPoints = (tiles) => tiles.reduce((sum, t) => sum + VALUES[t.letter], 0);
const wordText = (tiles) => tiles.map((t) => t.letter).join('');
const isWord = (tiles) => tiles.length >= MIN_WORD && dictionary.has(wordText(tiles).toLowerCase());

// ---------- Game flow ----------

function newGame() {
  game = {
    cols: Array.from({ length: COLS }, () => []),
    bag: [],
    nextId: 0,
    score: 0,
    words: 0,
    rows: 0,
    bestWord: null,
    interval: FIRST_DROP,
    timeLeft: FIRST_DROP,
  };
  for (let r = 0; r < START_ROWS; r++) {
    for (const col of game.cols) col.push(newTile());
  }
  startPlaying();
}

function startPlaying() {
  for (const el of tileEls.values()) el.remove();
  tileEls.clear();
  path = [];
  els.startScreen.hidden = true;
  els.playScreen.hidden = false;
  els.best.textContent = Math.max(loadBest(), game.score);
  showWord('');
  layout();
  render(true);
  updateStats();
  resume();
}

function resume() {
  running = true;
  els.board.classList.remove('paused');
  lastFrame = performance.now();
  requestAnimationFrame(tick);
}

function pause() {
  if (!running) return;
  running = false;
  cancelDrag();
  els.board.classList.add('paused');
  saveGame();
  els.pauseDialog.showModal();
}

function tick(now) {
  if (!running) return;
  game.timeLeft -= now - lastFrame;
  lastFrame = now;
  if (game.timeLeft <= 0) dropRow();
  if (!running) return;
  els.timerBar.style.transform = `scaleX(${Math.max(0, game.timeLeft / game.interval)})`;
  requestAnimationFrame(tick);
}

function dropRow() {
  if (game.cols.some((col) => col.length >= ROWS)) {
    gameOver();
    return;
  }
  for (const col of game.cols) col.push(newTile());
  game.rows++;
  game.interval = Math.max(FASTEST_DROP, FIRST_DROP - game.rows * DROP_STEP);
  game.timeLeft = game.interval;
  render();
  updateStats();
  saveGame();
}

function gameOver() {
  running = false;
  cancelDrag();
  clearSave();
  const best = loadBest();
  const isBest = game.score > best;
  if (isBest) saveBest(game.score);
  els.board.classList.add('over');
  els.finalScore.textContent = game.score;
  els.newBest.hidden = !isBest || game.score === 0;
  els.sumWords.textContent = game.words;
  els.sumRows.textContent = game.rows;
  els.sumBestWord.textContent = game.bestWord ? `${game.bestWord.word} (${game.bestWord.points})` : '—';
  setTimeout(() => els.overDialog.showModal(), 600);
}

function showHome() {
  running = false;
  els.playScreen.hidden = true;
  els.startScreen.hidden = false;
  const best = loadBest();
  els.bestLabel.textContent = best ? `Best score: ${best}` : '';
  els.resumeBtn.hidden = !loadGame();
}

function updateStats() {
  els.score.textContent = game.score;
  els.rows.textContent = game.rows;
  if (game.score > Number(els.best.textContent)) els.best.textContent = game.score;
}

// ---------- Board ----------

function layout() {
  const w = els.boardWrap.clientWidth;
  const h = els.boardWrap.clientHeight;
  size = Math.max(16, Math.floor(Math.min(w / COLS, h / ROWS)));
  els.board.style.setProperty('--size', `${size}px`);
  els.board.style.width = `${size * COLS}px`;
  els.board.style.height = `${size * ROWS}px`;
  line.setAttribute('viewBox', `0 0 ${size * COLS} ${size * ROWS}`);
}

const place = (c, i) => `translate(${c * size}px, ${(ROWS - 1 - i) * size}px)`;

// Puts every tile where it belongs. New tiles start above the board and fall
// in; tiles whose column shrank slide down because of the CSS transition.
function render(instant = false) {
  const seen = new Set();
  game.cols.forEach((col, c) => {
    col.forEach((tile, i) => {
      seen.add(tile.id);
      let el = tileEls.get(tile.id);
      if (!el) {
        el = document.createElement('div');
        el.className = 'tile';
        el.innerHTML = `<span class="letter">${tile.letter}</span><span class="value">${VALUES[tile.letter]}</span>`;
        el.style.transform = instant ? place(c, i) : `translate(${c * size}px, ${-size}px)`;
        if (instant) el.classList.add('no-anim');
        els.board.append(el);
        tileEls.set(tile.id, el);
        el.getBoundingClientRect(); // so the fall animates from above
        el.classList.remove('no-anim');
      }
      el.style.transform = place(c, i);
    });
  });
  for (const [id, el] of tileEls) {
    if (!seen.has(id)) { el.remove(); tileEls.delete(id); }
  }
  const tallest = Math.max(...game.cols.map((col) => col.length));
  els.board.classList.toggle('danger', tallest >= ROWS - 2);
  els.board.classList.remove('over');
}

function positionOf(tile) {
  for (let c = 0; c < COLS; c++) {
    const i = game.cols[c].indexOf(tile);
    if (i >= 0) return { c, i };
  }
  return null;
}

// The tile under the pointer. While dragging, only the middle of a tile counts
// so a diagonal move through a corner doesn't pick up a neighbor by accident.
function tileAt(e, strict) {
  const rect = els.board.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const c = Math.floor(x / size);
  const r = Math.floor(y / size);
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
  const tile = game.cols[c][ROWS - 1 - r];
  if (!tile) return null;
  if (strict && Math.hypot(x - (c + 0.5) * size, y - (r + 0.5) * size) > size * 0.45) return null;
  return tile;
}

function adjacent(a, b) {
  const pa = positionOf(a);
  const pb = positionOf(b);
  return Math.abs(pa.c - pb.c) <= 1 && Math.abs(pa.i - pb.i) <= 1;
}

// ---------- Dragging ----------

els.board.addEventListener('pointerdown', (e) => {
  if (!running) return;
  const tile = tileAt(e, false);
  if (!tile) return;
  e.preventDefault();
  els.board.setPointerCapture(e.pointerId);
  path = [tile];
  showPath();
});

els.board.addEventListener('pointermove', (e) => {
  if (!path.length) return;
  const tile = tileAt(e, true);
  const last = path[path.length - 1];
  if (!tile || tile === last) return;
  if (tile === path[path.length - 2]) {
    path.pop();
  } else if (!path.includes(tile) && adjacent(last, tile)) {
    path.push(tile);
  } else {
    return;
  }
  showPath();
});

els.board.addEventListener('pointerup', () => finishDrag());
els.board.addEventListener('pointercancel', () => cancelDrag());

function cancelDrag() {
  path = [];
  showPath();
  showWord('');
}

function finishDrag() {
  if (!path.length) return;
  const tiles = path;
  path = [];
  showPath();

  if (tiles.length < 2) { showWord(''); return; }
  if (!isWord(tiles)) {
    showWord(wordText(tiles), 'bad', tiles.length < MIN_WORD ? 'Too short' : 'Not a word');
    return;
  }

  const points = wordPoints(tiles);
  const word = wordText(tiles);
  floatScore(tiles[tiles.length - 1], points);
  for (const tile of tiles) {
    const el = tileEls.get(tile.id);
    el.classList.add('pop');
    tileEls.delete(tile.id);
    setTimeout(() => el.remove(), 250);
  }
  for (const col of game.cols) {
    for (let i = col.length - 1; i >= 0; i--) if (tiles.includes(col[i])) col.splice(i, 1);
  }
  game.score += points;
  game.words++;
  if (!game.bestWord || points > game.bestWord.points) game.bestWord = { word, points };
  if (navigator.vibrate) navigator.vibrate(15);
  showWord(word, 'good', `+${points}`);
  render();
  updateStats();
  saveGame();
}

function showPath() {
  const selected = new Set(path.map((t) => t.id));
  for (const [id, el] of tileEls) el.classList.toggle('sel', selected.has(id));

  const points = path.map((t) => {
    const { c, i } = positionOf(t);
    return `${(c + 0.5) * size},${(ROWS - 1 - i + 0.5) * size}`;
  });
  line.firstChild.setAttribute('points', points.join(' '));

  if (path.length) {
    const valid = isWord(path);
    showWord(wordText(path), valid ? 'live' : '', valid ? `+${wordPoints(path)}` : '');
    for (const t of path) tileEls.get(t.id).classList.toggle('valid', valid);
  }
  for (const el of tileEls.values()) if (!el.classList.contains('sel')) el.classList.remove('valid');
}

function showWord(text, kind = '', note = '') {
  clearTimeout(wordTimer);
  els.word.className = `word ${kind}`;
  els.word.innerHTML = text ? `${text}${note ? ` <span class="note">${note}</span>` : ''}` : '';
  if (kind === 'good' || kind === 'bad') {
    wordTimer = setTimeout(() => { if (!path.length) showWord(''); }, 1400);
  }
}

function floatScore(tile, points) {
  const { c, i } = positionOf(tile);
  const el = document.createElement('div');
  el.className = 'float-score';
  el.textContent = `+${points}`;
  el.style.left = `${(c + 0.5) * size}px`;
  el.style.top = `${(ROWS - 1 - i) * size}px`;
  els.board.append(el);
  setTimeout(() => el.remove(), 900);
}

// ---------- Wiring ----------

els.startBtn.addEventListener('click', () => { clearSave(); newGame(); });
els.resumeBtn.addEventListener('click', () => {
  game = loadGame();
  if (game) startPlaying(); else showHome();
});
els.howBtn.addEventListener('click', () => els.howDialog.showModal());
els.pauseBtn.addEventListener('click', pause);

els.pauseDialog.addEventListener('close', () => {
  if (els.pauseDialog.returnValue === 'quit') {
    clearSave();
    showHome();
  } else {
    resume();
  }
  els.pauseDialog.returnValue = '';
});

els.overDialog.addEventListener('close', () => {
  if (els.overDialog.returnValue === 'again') newGame(); else showHome();
  els.overDialog.returnValue = '';
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && running) pause();
});

window.addEventListener('resize', () => {
  if (els.playScreen.hidden || !game) return;
  layout();
  for (const el of tileEls.values()) el.classList.add('no-anim');
  render();
  showPath();
  requestAnimationFrame(() => { for (const el of tileEls.values()) el.classList.remove('no-anim'); });
});

fetch('words.txt')
  .then((res) => res.text())
  .then((text) => {
    dictionary = new Set(text.split('\n'));
    els.startBtn.disabled = false;
    els.resumeBtn.disabled = false;
    els.startBtn.textContent = 'New game';
  })
  .catch(() => { els.startBtn.textContent = 'Couldn’t load words'; });

showHome();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}
