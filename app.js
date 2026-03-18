/**
 * Tic-Tac-Toe — Human vs HAL (minimax + α-β pruning)
 * Human = 'X'  |  HAL = 'O'
 */

'use strict';

/* ─────────────────────────── Platform detection ────────────────────────── */
(function detectPlatform() {
  const ua = navigator.userAgent || '';
  let platform = 'default';

  if (/android/i.test(ua)) {
    platform = 'android';
  } else if (/macintosh|mac os x/i.test(ua) && !/iphone|ipad/i.test(ua)) {
    platform = 'mac';
  } else if (/windows/i.test(ua)) {
    platform = 'windows';
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    // iOS — use material as fallback
    platform = 'android';
  }

  document.documentElement.setAttribute('data-platform', platform);
})();

/* ──────────────────────────── Game constants ────────────────────────────── */
const HUMAN = 'X';
const HAL   = 'O';
const EMPTY = null;

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],             // diagonals
];

/* ──────────────────────────── Game state ────────────────────────────────── */
let board       = Array(9).fill(EMPTY);
let gameActive  = true;
let scores      = { human: 0, hal: 0, draw: 0 };
let halMoveTimeoutId = null;
let overlayTimeoutId = null;

/* ──────────────────────────── DOM refs ─────────────────────────────────── */
const cells          = Array.from(document.querySelectorAll('.cell'));
const statusMsg      = document.getElementById('status-message');
const btnNewGame     = document.getElementById('btn-new-game');
const btnResetScores = document.getElementById('btn-reset-scores');
const overlay        = document.getElementById('overlay');
const overlayTitle   = document.getElementById('overlay-title');
const overlaySubtitle= document.getElementById('overlay-subtitle');
const overlayBtn     = document.getElementById('overlay-btn');
const scoreHuman     = document.getElementById('score-human-val');
const scoreHal       = document.getElementById('score-hal-val');
const scoreDraw      = document.getElementById('score-draw-val');
const themeBtn       = document.getElementById('theme-button');
const themeMenu      = document.getElementById('theme-menu');
const themeIcon      = document.getElementById('theme-icon');
const soundBtn       = document.getElementById('sound-button');
const soundIcon      = document.getElementById('sound-icon');

/* ──────────────────────────── Minimax helpers ───────────────────────────── */

/**
 * Check if a player has won on the given board snapshot.
 * @param {Array} b - board array
 * @param {string} player
 * @returns {number[]|null} winning line indices or null
 */
function getWinLine(b, player) {
  for (const line of WIN_LINES) {
    if (line.every(i => b[i] === player)) return line;
  }
  return null;
}

function isBoardFull(b) {
  return b.every(cell => cell !== EMPTY);
}

/**
 * Check if a player still has at least one winnable line (i.e., a 3-in-a-row
 * line that does not yet contain the opponent's mark). Useful for early-draw
 * detection when all lines are blocked by mixed X/O before the board is full.
 * @param {Array} b
 * @param {string} player
 * @returns {boolean}
 */
function hasWinnableLine(b, player) {
  const opponent = player === HUMAN ? HAL : HUMAN;
  return WIN_LINES.some(line => line.every(i => b[i] !== opponent));
}

/**
 * Minimax with α-β pruning.
 * @param {Array}   b           - board snapshot
 * @param {boolean} isMaximizing - true when it's HAL's turn
 * @param {number}  alpha
 * @param {number}  beta
 * @param {number}  depth
 * @returns {number} score
 */
function minimax(b, isMaximizing, alpha, beta, depth) {
  // Terminal states
  if (getWinLine(b, HAL))   return 10 - depth;
  if (getWinLine(b, HUMAN)) return depth - 10;
  // Early draw: no side can possibly complete any remaining line
  if (!hasWinnableLine(b, HAL) && !hasWinnableLine(b, HUMAN)) return 0;
  if (isBoardFull(b))       return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i] !== EMPTY) continue;
      b[i] = HAL;
      const score = minimax(b, false, alpha, beta, depth + 1);
      b[i] = EMPTY;
      best  = Math.max(best, score);
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break; // β cutoff
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i] !== EMPTY) continue;
      b[i] = HUMAN;
      const score = minimax(b, true, alpha, beta, depth + 1);
      b[i] = EMPTY;
      best = Math.min(best, score);
      beta = Math.min(beta, best);
      if (beta <= alpha) break; // α cutoff
    }
    return best;
  }
}

/**
 * Find HAL's best move index.
 * @param {Array} b - current board
 * @returns {number} cell index
 */
function bestMove(b) {
  let bestScore = -Infinity;
  let move      = -1;

  for (let i = 0; i < 9; i++) {
    if (b[i] !== EMPTY) continue;
    b[i] = HAL;
    const score = minimax(b, false, -Infinity, Infinity, 0);
    b[i] = EMPTY;
    if (score > bestScore) {
      bestScore = score;
      move      = i;
    }
  }
  return move;
}

/* ──────────────────────────── UI helpers ────────────────────────────────── */

function renderBoard() {
  cells.forEach((cell, i) => {
    const val = board[i];
    cell.textContent = val || '';
    cell.classList.toggle('cell--x', val === HUMAN);
    cell.classList.toggle('cell--o', val === HAL);
    cell.disabled = val !== EMPTY || !gameActive;
    cell.setAttribute('aria-label', `Cell ${i + 1}${val ? ', ' + val : ''}`);
  });
}

function highlightWin(line) {
  line.forEach(i => cells[i].classList.add('cell--win'));
}

function setStatus(msg) {
  const withMarks = msg
    .replace(/\(X\)/g, '(<span class="mark-x">X</span>)')
    .replace(/\(O\)/g, '(<span class="mark-o">O</span>)');
  statusMsg.innerHTML = withMarks;
}

function updateScoreboard() {
  scoreHuman.textContent = scores.human;
  scoreHal.textContent   = scores.hal;
  scoreDraw.textContent  = scores.draw;
}

function showOverlay(title, subtitle) {
  overlayTitle.textContent    = title;
  overlaySubtitle.textContent = subtitle;
  overlay.classList.remove('hidden');
  overlayBtn.focus();
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

function clearPendingTimers() {
  if (halMoveTimeoutId !== null) {
    clearTimeout(halMoveTimeoutId);
    halMoveTimeoutId = null;
  }
  if (overlayTimeoutId !== null) {
    clearTimeout(overlayTimeoutId);
    overlayTimeoutId = null;
  }
}

/* ──────────────────────────── Theme controls ────────────────────────────── */
const THEME_KEY = 'theme-preference'; // 'light' | 'dark' | 'system'
const SOUND_KEY = 'sound-enabled';     // 'on' | 'off'

function updateThemeButtonIcon(mode) {
  if (!themeIcon) return;
  const icon = (name) => {
    switch (name) {
      case 'dark':
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z"/></svg>';
      case 'light':
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0 4a1 1 0 0 1-1-1v-1.1a1 1 0 1 1 2 0V21a1 1 0 0 1-1 1Zm0-18a1 1 0 0 1-1-1V2.1a1 1 0 1 1 2 0V3a1 1 0 0 1-1 1Zm10 9a1 1 0 0 1-1 1h-1.1a1 1 0 1 1 0-2H21a1 1 0 0 1 1 1ZM4.1 12a1 1 0 0 1-1 1H2a1 1 0 1 1 0-2h1.1a1 1 0 0 1 1 1ZM18.36 18.36a1 1 0 0 1-1.41 0l-.78-.78a1 1 0 1 1 1.41-1.41l.78.78a1 1 0 0 1 0 1.41ZM7.83 7.83a1 1 0 0 1-1.41 0l-.78-.78A1 1 0 0 1 7.05 5.6l.78.78a1 1 0 0 1 0 1.41Zm10.53-4.24a1 1 0 0 1 0 1.41l-.78.78a1 1 0 1 1-1.41-1.41l.78-.78a1 1 0 0 1 1.41 0ZM6.22 17.58a1 1 0 1 1-1.41 1.41l-.78-.78a1 1 0 1 1 1.41-1.41l.78.78Z"/></svg>';
      default:
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-4 4V5Zm3 2h10v7H7V7Z"/></svg>';
    }
  };
  const name = mode === 'dark' ? 'dark' : mode === 'light' ? 'light' : 'system';
  themeIcon.innerHTML = icon(name);
  if (themeBtn) {
    const label = name === 'dark' ? 'Theme: Dark' : name === 'light' ? 'Theme: Light' : 'Theme: System';
    themeBtn.title = label;
    themeBtn.setAttribute('aria-label', label);
  }
}

function updateThemeMenu(mode) {
  if (!themeMenu) return;
  const items = themeMenu.querySelectorAll('[data-theme]');
  items.forEach(btn => {
    const checked = btn.dataset.theme === mode || (mode === 'system' && btn.dataset.theme === 'system');
    btn.setAttribute('aria-checked', String(checked));
  });
}

function applyTheme(mode, persist = true) {
  if (mode === 'dark' || mode === 'light') {
    document.documentElement.setAttribute('data-theme', mode);
  } else {
    // system
    document.documentElement.removeAttribute('data-theme');
    mode = 'system';
  }
  if (persist) {
    try { localStorage.setItem(THEME_KEY, mode); } catch (e) {}
  }
  updateThemeButtonIcon(mode);
  updateThemeMenu(mode);
}

function getStoredTheme() {
  try { return localStorage.getItem(THEME_KEY) || 'dark'; } catch (e) { return 'dark'; }
}

function closeThemeMenu() {
  if (!themeMenu || !themeBtn) return;
  themeMenu.classList.add('hidden');
  themeBtn.setAttribute('aria-expanded', 'false');
}

function toggleThemeMenu() {
  if (!themeMenu || !themeBtn) return;
  const isOpen = !themeMenu.classList.contains('hidden');
  if (isOpen) closeThemeMenu();
  else {
    themeMenu.classList.remove('hidden');
    themeBtn.setAttribute('aria-expanded', 'true');
  }
}

/* ──────────────────────────── Game logic ────────────────────────────────── */

/* ──────────────────────────── Sound controls ────────────────────────────── */
let soundEnabled = true;
let audioCtx = null;

function updateSoundIcon(enabled) {
  if (!soundIcon || !soundBtn) return;
  // Clean, consistent icons; Off = speaker only (no waves, no slash)
  const svgOn = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9v6h3l5 4V5l-5 4H4z" fill="currentColor"/>
      <path d="M16 9c1.6 1 1.6 5 0 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M19 7c2.8 2.4 2.8 8.6 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
  const svgOff = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9v6h3l5 4V5l-5 4H4z" fill="currentColor"/>
    </svg>`;
  soundIcon.innerHTML = enabled ? svgOn : svgOff;
  soundBtn.setAttribute('aria-pressed', String(enabled));
  soundBtn.setAttribute('aria-label', enabled ? 'Sound on' : 'Sound off');
  soundBtn.title = enabled ? 'Sound: On' : 'Sound: Off';
  soundBtn.classList.toggle('is-muted', !enabled);
}

function ensureAudioContext() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  return audioCtx;
}

async function resumeAudioIfNeeded() {
  const ctx = ensureAudioContext();
  if (ctx && ctx.state === 'suspended') {
    try { await ctx.resume(); } catch (e) {}
  }
}

function setSound(enabled, persist = true) {
  soundEnabled = !!enabled;
  updateSoundIcon(soundEnabled);
  if (persist) {
    try { localStorage.setItem(SOUND_KEY, soundEnabled ? 'on' : 'off'); } catch (e) {}
  }
  if (soundEnabled) ensureAudioContext();
}

function getStoredSoundEnabled() {
  try {
    const v = localStorage.getItem(SOUND_KEY);
    return v === null ? true : v === 'on';
  } catch (e) {
    return true;
  }
}

function beep(freq = 440, durationMs = 120, volume = 0.04, type = 'sine') {
  if (!soundEnabled) return;
  const ctx = ensureAudioContext();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.01;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  gain.gain.value = volume;
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + durationMs / 1000);
}

function playEventSound(kind) {
  if (!soundEnabled) return;
  // Simple palette of sounds per event
  switch (kind) {
    case 'human':
      beep(660, 110, 0.045, 'sine');
      break;
    case 'hal':
      beep(440, 110, 0.045, 'sine');
      break;
    case 'win-human':
      beep(880, 160, 0.05, 'sine');
      setTimeout(() => beep(1175, 160, 0.05, 'sine'), 140);
      break;
    case 'win-hal':
      beep(392, 160, 0.05, 'sine');
      setTimeout(() => beep(523, 160, 0.05, 'sine'), 140);
      break;
    case 'draw':
      beep(330, 160, 0.045, 'triangle');
      break;
  }
}

function checkEndState() {
  const humanWin = getWinLine(board, HUMAN);
  const halWin   = getWinLine(board, HAL);

  if (humanWin) {
    highlightWin(humanWin);
    scores.human++;
    updateScoreboard();
    setStatus('You win! 🎉');
    playEventSound('win-human');
    gameActive = false;
    if (overlayTimeoutId !== null) clearTimeout(overlayTimeoutId);
    overlayTimeoutId = setTimeout(() => {
      showOverlay('You Win! 🎉', 'Great move, human.');
      overlayTimeoutId = null;
    }, 400);
    return true;
  }

  if (halWin) {
    highlightWin(halWin);
    scores.hal++;
    updateScoreboard();
    setStatus("HAL wins! 🤖");
    playEventSound('win-hal');
    gameActive = false;
    if (overlayTimeoutId !== null) clearTimeout(overlayTimeoutId);
    overlayTimeoutId = setTimeout(() => {
      showOverlay("HAL Wins! 🤖", "I'm sorry Dave, I'm afraid you lost.");
      overlayTimeoutId = null;
    }, 400);
    return true;
  }

  // Early draw: no remaining line can be completed by either player
  if (!hasWinnableLine(board, HAL) && !hasWinnableLine(board, HUMAN)) {
    scores.draw++;
    updateScoreboard();
    setStatus("It's a draw! 🤝");
    playEventSound('draw');
    gameActive = false;
    if (overlayTimeoutId !== null) clearTimeout(overlayTimeoutId);
    overlayTimeoutId = setTimeout(() => {
      showOverlay("It's a Draw! 🤝", 'A perfect game from both sides.');
      overlayTimeoutId = null;
    }, 400);
    return true;
  }

  if (isBoardFull(board)) {
    scores.draw++;
    updateScoreboard();
    setStatus("It's a draw! 🤝");
    playEventSound('draw');
    gameActive = false;
    if (overlayTimeoutId !== null) clearTimeout(overlayTimeoutId);
    overlayTimeoutId = setTimeout(() => {
      showOverlay("It's a Draw! 🤝", 'A perfect game from both sides.');
      overlayTimeoutId = null;
    }, 400);
    return true;
  }

  return false;
}

function halMove() {
  if (!gameActive) return;

  setStatus('HAL is thinking…');
  cells.forEach(c => { c.disabled = true; });

  // Small delay for UX — makes HAL feel "alive"
  if (halMoveTimeoutId !== null) clearTimeout(halMoveTimeoutId);
  halMoveTimeoutId = setTimeout(() => {
    halMoveTimeoutId = null;
    if (!gameActive) return;

    const idx = bestMove(board);
    if (idx === -1) return; // safety guard

    board[idx] = HAL;
    renderBoard();
    playEventSound('hal');

    if (!checkEndState()) {
      setStatus('Your turn (X)');
      cells.forEach((c, i) => {
        c.disabled = board[i] !== EMPTY || !gameActive;
      });
    }
  }, 300);
}

function handleCellClick(event) {
  const idx = parseInt(event.currentTarget.dataset.index, 10);
  if (!gameActive || board[idx] !== EMPTY) return;
  resumeAudioIfNeeded();
  playEventSound('human');
  board[idx] = HUMAN;
  renderBoard();

  if (!checkEndState()) {
    halMove();
  }
}

function newGame() {
  clearPendingTimers();
  board      = Array(9).fill(EMPTY);
  gameActive = true;

  cells.forEach(cell => {
    cell.classList.remove('cell--win', 'cell--x', 'cell--o');
    cell.textContent = '';
    cell.disabled    = false;
  });

  setStatus('Your turn (X)');
  hideOverlay();
}

function resetScores() {
  scores = { human: 0, hal: 0, draw: 0 };
  updateScoreboard();
}

/* ──────────────────────────── Event listeners ───────────────────────────── */

cells.forEach(cell => cell.addEventListener('click', handleCellClick));
btnNewGame.addEventListener('click', newGame);
btnResetScores.addEventListener('click', resetScores);
overlayBtn.addEventListener('click', newGame);

/* ──────────────────────────── Service Worker ────────────────────────────── */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .catch(err => console.warn('SW registration failed:', err));
  });
}

/* ──────────────────────────── Init ─────────────────────────────────────── */
updateScoreboard();
renderBoard();

/* ──────────────────────────── Init theme controls ───────────────────────── */
// Apply stored theme to UI state (document attribute is already set early in head)
applyTheme(getStoredTheme(), false);

if (themeBtn && themeMenu) {
  themeBtn.addEventListener('click', toggleThemeMenu);
  document.addEventListener('click', (e) => {
    if (!themeMenu.contains(e.target) && !themeBtn.contains(e.target)) closeThemeMenu();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeThemeMenu(); });

  themeMenu.querySelectorAll('[data-theme]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.theme;
      applyTheme(mode, true);
      closeThemeMenu();
    });
  });
}

/* ──────────────────────────── Init sound controls ───────────────────────── */
setSound(getStoredSoundEnabled(), false);

if (soundBtn) {
  soundBtn.addEventListener('click', () => {
    setSound(!soundEnabled, true);
    resumeAudioIfNeeded();
  });
}

// Attempt to unlock/resume audio on first user interactions
document.addEventListener('pointerdown', resumeAudioIfNeeded, { passive: true });
document.addEventListener('keydown', resumeAudioIfNeeded, { passive: true });
