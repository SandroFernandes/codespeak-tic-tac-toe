#!/usr/bin/env bash
# Tests for tic-tac-toe app
# Test 1: verify Docker is running
# Test 2: verify host resolves locally
# Test 3: verify HTTPS endpoint responds (transport check)
# Test 4: verify HTTPS certificate is trusted (browser-like check)

set -uo pipefail

PASS=0
FAIL=0
TARGET_HOST="test.pwa"
TARGET_PORT="${TARGET_PORT:-443}"

if [ "$TARGET_PORT" -eq 443 ]; then
  TARGET_URL="https://${TARGET_HOST}"
else
  TARGET_URL="https://${TARGET_HOST}:${TARGET_PORT}"
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
echo "=== Test 4: Verify TLS certificate trust for ${TARGET_URL} ==="

STRICT_HTTP_CODE=$(curl --silent --max-time 10 --output /dev/null \
  --write-out "%{http_code}" "${TARGET_URL}" 2>/dev/null)
STRICT_EXIT=$?
STRICT_HTTP_CODE=$(normalize_http_code "$STRICT_HTTP_CODE")

if [ "$STRICT_EXIT" -eq 0 ]; then
  if [ "$STRICT_HTTP_CODE" -ge 200 ] && [ "$STRICT_HTTP_CODE" -lt 400 ]; then
    run_test "TLS trust" 0 "Certificate trusted and endpoint responded with HTTP ${STRICT_HTTP_CODE}."
  else
    run_test "TLS trust" 1 "Certificate trusted but endpoint returned unexpected HTTP ${STRICT_HTTP_CODE}."
  fi
else
  STRICT_ERR=$(curl --silent --show-error --max-time 10 --output /dev/null "${TARGET_URL}" 2>&1 || true)
  run_test "TLS trust" 1 "TLS validation failed: ${STRICT_ERR}"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "Results: ${PASS} passed, ${FAIL} failed."

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi

echo "All tests passed."
