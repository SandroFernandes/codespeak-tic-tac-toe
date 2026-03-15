/**
 * UI test for Tic-Tac-Toe
 * Supports both localhost (HTTP) and https://test.pwa (HTTPS / self-signed cert).
 *
 * Environment variables:
 *   BASE_URL  – full URL to test, e.g. "http://localhost" or "https://test.pwa"
 *               Falls back to legacy TARGET_HOST / TARGET_PORT when BASE_URL is not set.
 *
 * Exit 0 = all tests passed, exit 1 = at least one failure.
 */

import puppeteer from 'puppeteer';

function resolveBaseUrl() {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL;
  }
  // Legacy fallback
  const TARGET_PORT = process.env.TARGET_PORT || '443';
  const TARGET_HOST = process.env.TARGET_HOST || 'test.pwa';
  return TARGET_PORT === '443'
    ? `https://${TARGET_HOST}`
    : `https://${TARGET_HOST}:${TARGET_PORT}`;
}

const baseUrl = resolveBaseUrl();

let pass = 0;
let fail = 0;

function ok(name, msg) {
  console.log(`PASS: ${name} - ${msg}`);
  pass++;
}

function notOk(name, msg) {
  console.error(`FAIL: ${name} - ${msg}`);
  fail++;
}

async function runTests() {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--ignore-certificate-errors',
    ],
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(15000);

    // ── UI Test 1: page loads with successful HTTP status ───────────────────
    try {
      const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      const status = response ? response.status() : 0;
      if (status >= 200 && status < 400) {
        ok('UI: page load', `Page loaded with HTTP ${status}.`);
      } else {
        notOk('UI: page load', `Unexpected HTTP status ${status}.`);
      }
    } catch (e) {
      notOk('UI: page load', `Failed to load page: ${e.message}`);
    }

    // ── UI Test 2: <title> contains Tic-Tac-Toe ────────────────────────────
    try {
      const title = await page.title();
      if (/tic.?tac.?toe/i.test(title)) {
        ok('UI: page title', `Title is "${title}".`);
      } else {
        notOk('UI: page title', `Unexpected title: "${title}".`);
      }
    } catch (e) {
      notOk('UI: page title', `Error reading title: ${e.message}`);
    }

    // ── UI Test 3: board has 9 cells ────────────────────────────────────────
    try {
      await page.waitForSelector('.cell', { visible: true });
      const cellCount = await page.$$eval('.cell', cells => cells.length);
      if (cellCount === 9) {
        ok('UI: board cells', `Found ${cellCount} cells on the board.`);
      } else {
        notOk('UI: board cells', `Expected 9 cells, found ${cellCount}.`);
      }
    } catch (e) {
      notOk('UI: board cells', `Error finding cells: ${e.message}`);
    }

    // ── UI Test 4: status message shows human's turn initially ─────────────
    try {
      const statusText = await page.$eval(
        '#status-message',
        el => el.textContent.trim()
      );
      if (/your turn/i.test(statusText) || /\bx\b/i.test(statusText)) {
        ok('UI: initial status', `Status shows "${statusText}".`);
      } else {
        notOk('UI: initial status', `Unexpected initial status: "${statusText}".`);
      }
    } catch (e) {
      notOk('UI: initial status', `Error reading status: ${e.message}`);
    }

    // ── UI Test 5: score panel shows numeric scores ─────────────────────────
    try {
      const humanScore = await page.$eval('#score-human-val', el => el.textContent.trim());
      const halScore   = await page.$eval('#score-hal-val',   el => el.textContent.trim());
      const drawScore  = await page.$eval('#score-draw-val',  el => el.textContent.trim());
      const allNumeric = [humanScore, halScore, drawScore].every(s => /^\d+$/.test(s));
      if (allNumeric) {
        ok('UI: score panel', `Scores are numeric (you:${humanScore}, HAL:${halScore}, draw:${drawScore}).`);
      } else {
        notOk('UI: score panel', `Scores contain non-numeric values.`);
      }
    } catch (e) {
      notOk('UI: score panel', `Error reading scores: ${e.message}`);
    }

    // ── UI Test 6: overlay is hidden at game start ──────────────────────────
    try {
      const overlayHidden = await page.$eval(
        '#overlay',
        el => el.classList.contains('hidden')
      );
      if (overlayHidden) {
        ok('UI: overlay hidden initially', 'Win/draw overlay is hidden at game start.');
      } else {
        notOk('UI: overlay hidden initially', 'Overlay is unexpectedly visible at game start.');
      }
    } catch (e) {
      notOk('UI: overlay hidden initially', `Error checking overlay: ${e.message}`);
    }

    // ── UI Test 7: click New Game to reset, then play a move ───────────────
    try {
      await page.click('#btn-new-game');
      await new Promise(r => setTimeout(r, 200));

      // Board should be empty after new game
      const anyFilled = await page.$$eval('.cell', cells =>
        cells.some(c => c.textContent.trim() !== '')
      );
      if (!anyFilled) {
        ok('UI: new game resets board', 'Board is empty after clicking New Game.');
      } else {
        notOk('UI: new game resets board', 'Board still has content after New Game.');
      }
    } catch (e) {
      notOk('UI: new game resets board', `Error resetting game: ${e.message}`);
    }

    // ── UI Test 8: human can place X and HAL responds with O ───────────────
    try {
      // Ensure fresh board
      await page.click('#btn-new-game');
      await new Promise(r => setTimeout(r, 200));

      // Click center cell (index 4)
      const cellsBefore = await page.$$('.cell');
      await cellsBefore[4].click();

      // After human move: cell 4 should show X
      await page.waitForFunction(
        () => {
          const c = document.querySelectorAll('.cell')[4];
          return c && (
            c.textContent.trim() === 'X' ||
            c.classList.contains('cell--x')
          );
        },
        { timeout: 3000 }
      );
      ok('UI: human places X', 'Human placed X on center cell (index 4).');

      // HAL should respond within ~2s
      await page.waitForFunction(
        () => Array.from(document.querySelectorAll('.cell')).some(
          c => c.textContent.trim() === 'O' || c.classList.contains('cell--o')
        ),
        { timeout: 4000 }
      );
      ok('UI: HAL places O', 'HAL placed O in response to human move.');
    } catch (e) {
      notOk('UI: gameplay (X then O)', `Error during gameplay: ${e.message}`);
    }

  } finally {
    await browser.close();
  }

  console.log('');
  console.log(`UI Test Results for ${baseUrl}: ${pass} passed, ${fail} failed.`);
  process.exit(fail > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Fatal error in UI tests:', err);
  process.exit(1);
});
