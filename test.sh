#!/usr/bin/env bash
# Tests for tic-tac-toe app
# Test 1: verify Docker is running
# Test 2: verify host resolves locally
# Test 3: verify HTTPS endpoint responds (transport check)
# Test 4: verify HTTPS certificate using container CA/cert (strict, no --insecure)
# Test 5: UI test on tic-tac-toe game – localhost
# Test 6: UI test on tic-tac-toe game – https://test.pwa

set -uo pipefail

PASS=0
FAIL=0
TARGET_HOST="test.pwa"
TARGET_PORT="${TARGET_PORT:-443}"
LOCALHOST_PORT="${LOCALHOST_PORT:-80}"

if [ "$TARGET_PORT" -eq 443 ]; then
  TARGET_URL="https://${TARGET_HOST}"
else
  TARGET_URL="https://${TARGET_HOST}:${TARGET_PORT}"
fi

if [ "$LOCALHOST_PORT" -eq 80 ]; then
  LOCALHOST_URL="http://localhost"
else
  LOCALHOST_URL="http://localhost:${LOCALHOST_PORT}"
fi

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

# ── Test 2: host resolves locally ─────────────────────────────────────────────
echo ""
echo "=== Test 2: Verify host resolution for test.pwa ==="

RESOLVED_IP="$(python3 - "$TARGET_HOST" <<'PY' 2>/dev/null || true
import socket
import sys

host = sys.argv[1]
try:
    print(socket.gethostbyname(host))
except Exception:
    pass
PY
)"

if [ -n "$RESOLVED_IP" ]; then
  run_test "Host resolution" 0 "${TARGET_HOST} resolves to ${RESOLVED_IP}."
else
  run_test "Host resolution" 1 "${TARGET_HOST} does not resolve. Check your hosts file."
fi

# ── Test 3: HTTPS endpoint responds (insecure transport check) ────────────────
echo ""
echo "=== Test 3: Verify ${TARGET_URL} is reachable over HTTPS ==="

HTTP_CODE_INSECURE=$(curl --silent --insecure --max-time 10 --output /dev/null \
  --write-out "%{http_code}" "${TARGET_URL}" 2>/dev/null)
HTTP_CODE_INSECURE=$(normalize_http_code "$HTTP_CODE_INSECURE")

if [ "$HTTP_CODE_INSECURE" -ge 200 ] && [ "$HTTP_CODE_INSECURE" -lt 400 ]; then
  run_test "HTTPS reachability" 0 "${TARGET_URL} responded with HTTP ${HTTP_CODE_INSECURE}."
else
  run_test "HTTPS reachability" 1 "${TARGET_URL} responded with unexpected HTTP code ${HTTP_CODE_INSECURE}."
fi

# ── Test 4: HTTPS certificate validation (strict) ─────────────────────────────
echo ""
echo "=== Test 4: Verify TLS certificate for ${TARGET_URL} (docker cert) ==="

CERT_FILE="$(mktemp)"
docker compose exec -T tic-tac-toe sh -c 'cat /etc/nginx/ssl/selfsigned.crt' > "$CERT_FILE" 2>/dev/null
CERT_FETCH_EXIT=$?

if [ "$CERT_FETCH_EXIT" -ne 0 ] || [ ! -s "$CERT_FILE" ]; then
  run_test "TLS trust" 1 "Could not read TLS certificate from running docker container."
else
  STRICT_HTTP_CODE=$(curl --silent --cacert "$CERT_FILE" --max-time 10 --output /dev/null \
    --write-out "%{http_code}" "${TARGET_URL}" 2>/dev/null)
  STRICT_EXIT=$?
  STRICT_HTTP_CODE=$(normalize_http_code "$STRICT_HTTP_CODE")

  if [ "$STRICT_EXIT" -eq 0 ] && [ "$STRICT_HTTP_CODE" -ge 200 ] && [ "$STRICT_HTTP_CODE" -lt 400 ]; then
    run_test "TLS trust" 0 "Certificate valid against docker cert and endpoint responded with HTTP ${STRICT_HTTP_CODE}."
  else
    STRICT_ERR=$(curl --silent --show-error --cacert "$CERT_FILE" --max-time 10 --output /dev/null "${TARGET_URL}" 2>&1 || true)
    run_test "TLS trust" 1 "TLS validation failed against docker cert: ${STRICT_ERR}"
  fi
fi

rm -f "$CERT_FILE"

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

# ── Test 5: UI test on tic-tac-toe game – localhost ───────────────────────────
echo ""
echo "=== Test 5: UI test on tic-tac-toe game – ${LOCALHOST_URL} ==="
run_ui_test "UI tests (localhost)" "${LOCALHOST_URL}"

# ── Test 6: UI test on tic-tac-toe game – https://test.pwa ───────────────────
echo ""
echo "=== Test 6: UI test on tic-tac-toe game – ${TARGET_URL} ==="
run_ui_test "UI tests (https://test.pwa)" "${TARGET_URL}"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "Results: ${PASS} passed, ${FAIL} failed."

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi

echo "All tests passed."
