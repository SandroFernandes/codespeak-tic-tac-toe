#!/usr/bin/env bash
# Tests for tic-tac-toe app (HTTP-only; share via Tailscale if desired)
# Test 1: verify Docker is running
# Test 2: verify HTTP endpoint responds (BASE_URL or localhost:8080)
# Test 3: UI test on tic-tac-toe game – BASE_URL
# Test 4: UI test on tic-tac-toe game – localhost:8080 (if different)

set -uo pipefail

PASS=0
FAIL=0

# Default local URL. Override by exporting BASE_URL, e.g. your Tailscale URL.
DEFAULT_LOCAL_URL="http://localhost:8080"
BASE_URL="${BASE_URL:-$DEFAULT_LOCAL_URL}"

run_test() {
  local name="$1"
  local result="$2"
  local message="$3"
  if [ "$result" -eq 0 ]; then
    echo "PASS: ${name} - ${message}"
    PASS=$((PASS + 1))
  else
    echo "FAIL: ${name} - ${message}"
    FAIL=$((FAIL + 1))
  fi
}

normalize_http_code() {
  local code="$1"
  if [[ "$code" =~ ^[0-9]{3}$ ]]; then
    echo "$code"
  else
    echo "000"
  fi
}

# ── Test 1: Docker is running ─────────────────────────────────────────────────
echo ""
echo "=== Test 1: Verify Docker is running ==="

RUNNING=$(docker compose ps --status running --quiet 2>/dev/null | wc -l | tr -d ' ')
if [ "$RUNNING" -ge 1 ]; then
  run_test "Docker running" 0 "At least one container is up (found ${RUNNING})."
else
  run_test "Docker running" 1 "No running Docker containers found for this project."
fi

## ── Test 2: HTTP endpoint responds ───────────────────────────────────────────
echo ""
echo "=== Test 2: Verify ${BASE_URL} is reachable over HTTP ==="

HTTP_CODE=$(curl --silent --max-time 10 --output /dev/null \
  --write-out "%{http_code}" "${BASE_URL}" 2>/dev/null)
HTTP_CODE=$(normalize_http_code "$HTTP_CODE")

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 400 ]; then
  run_test "HTTP reachability" 0 "${BASE_URL} responded with HTTP ${HTTP_CODE}."
else
  run_test "HTTP reachability" 1 "${BASE_URL} responded with unexpected HTTP code ${HTTP_CODE}."
fi

# ── Helper: run the puppeteer UI test script against a given BASE_URL ─────────
run_ui_test() {
  local label="$1"
  local url="$2"

  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  UI_TEST_SCRIPT="${SCRIPT_DIR}/ui-test.mjs"
  UI_DEPS_DIR="${SCRIPT_DIR}/ui-test-deps"

  if [ ! -f "$UI_TEST_SCRIPT" ]; then
    run_test "$label" 1 "UI test script not found at ${UI_TEST_SCRIPT}."
    return
  fi

  # Install puppeteer locally if needed
  if [ ! -d "${UI_DEPS_DIR}/node_modules/puppeteer" ]; then
    echo "  Installing puppeteer for UI tests..."
    mkdir -p "$UI_DEPS_DIR"
    (cd "$UI_DEPS_DIR" && npm init -y > /dev/null 2>&1 && npm install puppeteer > /dev/null 2>&1)
  fi

  if [ ! -d "${UI_DEPS_DIR}/node_modules/puppeteer" ]; then
    run_test "$label" 1 "puppeteer installation failed."
    return
  fi

  # Copy the test script to the deps dir so it can import puppeteer naturally
  cp "$UI_TEST_SCRIPT" "${UI_DEPS_DIR}/ui-test.mjs"

  UI_OUTPUT=$(cd "$UI_DEPS_DIR" && BASE_URL="${url}" node ui-test.mjs 2>&1)
  UI_EXIT=$?

  echo "$UI_OUTPUT"

  if [ "$UI_EXIT" -eq 0 ]; then
    run_test "$label" 0 "All UI tests passed."
  else
    run_test "$label" 1 "One or more UI tests failed (exit code ${UI_EXIT})."
  fi
}

## ── Test 3: UI test – BASE_URL ─────────────────────────────────────────────
echo ""
echo "=== Test 3: UI test on tic-tac-toe – ${BASE_URL} ==="
run_ui_test "UI tests (${BASE_URL})" "${BASE_URL}"

## ── Test 4: UI test – localhost (if different) ─────────────────────────────
if [ "$BASE_URL" != "$DEFAULT_LOCAL_URL" ]; then
  echo ""
  echo "=== Test 4: UI test on tic-tac-toe – ${DEFAULT_LOCAL_URL} ==="
  run_ui_test "UI tests (${DEFAULT_LOCAL_URL})" "${DEFAULT_LOCAL_URL}"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "Results: ${PASS} passed, ${FAIL} failed."

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi

echo "All tests passed."
