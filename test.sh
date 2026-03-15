#!/usr/bin/env bash
# Tests for tic-tac-toe app
# Test 1: verify Docker is running
# Test 2: verify the hosts domain test.pwa responds over HTTPS

set -uo pipefail

PASS=0
FAIL=0

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

# ── Test 1: Docker is running ─────────────────────────────────────────────────
echo ""
echo "=== Test 1: Verify Docker is running ==="

RUNNING=$(docker compose ps --status running --quiet 2>/dev/null | wc -l | tr -d ' ')
if [ "$RUNNING" -ge 1 ]; then
  run_test "Docker running" 0 "At least one container is up (found ${RUNNING})."
else
  run_test "Docker running" 1 "No running Docker containers found for this project."
fi

# ── Test 2: test.pwa responds over HTTPS ──────────────────────────────────────
echo ""
echo "=== Test 2: Verify test.pwa is responding over HTTPS ==="

TARGET_HOST="test.pwa"
TARGET_PORT="${TARGET_PORT:-8443}"
TARGET_URL="https://${TARGET_HOST}:${TARGET_PORT}"
HTTP_CODE=$(curl --silent --insecure --max-time 10 --output /dev/null \
  --write-out "%{http_code}" "${TARGET_URL}" 2>/dev/null)
if ! [[ "$HTTP_CODE" =~ ^[0-9]{3}$ ]]; then
  HTTP_CODE="000"
fi

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 400 ]; then
  run_test "HTTPS domain" 0 "${TARGET_URL} responded with HTTP ${HTTP_CODE}."
else
  run_test "HTTPS domain" 1 "${TARGET_URL} responded with unexpected HTTP code ${HTTP_CODE}."
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "Results: ${PASS} passed, ${FAIL} failed."

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi

echo "All tests passed."
