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

/* ──────────────────────────── Game logic ────────────────────────────────── */

function checkEndState() {
  const humanWin = getWinLine(board, HUMAN);
  const halWin   = getWinLine(board, HAL);

  if (humanWin) {
    highlightWin(humanWin);
    scores.human++;
    updateScoreboard();
    setStatus('You win! 🎉');
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
    gameActive = false;
    if (overlayTimeoutId !== null) clearTimeout(overlayTimeoutId);
    overlayTimeoutId = setTimeout(() => {
      showOverlay("HAL Wins! 🤖", "I'm sorry Dave, I'm afraid you lost.");
      overlayTimeoutId = null;
    }, 400);
    return true;
  }

  if (isBoardFull(board)) {
    scores.draw++;
    updateScoreboard();
    setStatus("It's a draw! 🤝");
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
