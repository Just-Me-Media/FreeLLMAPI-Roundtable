#!/usr/bin/env bash
# verify-install.sh — Roundtable post-build verification
# Usage: bash scripts/verify-install.sh
# Exits 0 if everything is healthy, 1 otherwise.
set -euo pipefail

PASS=0; FAIL=0
APP="/Applications/Roundtable.app"
BINARY="$APP/Contents/MacOS/app"
DIST="$(cd "$(dirname "$0")/.." && pwd)/dist/index.html"
SRC="$(cd "$(dirname "$0")/.." && pwd)/index.html"
FREELLM_PORT=31415
BAD_PORT=5173

ok()   { echo "  ✅  $*"; PASS=$((PASS+1)); }
fail() { echo "  ❌  $*"; FAIL=$((FAIL+1)); }
info() { echo "  ℹ️   $*"; }

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Roundtable Install Verification"
echo "═══════════════════════════════════════════════════"

# ── 1. App bundle exists ────────────────────────────────
echo ""
echo "1. App bundle"
if [ -d "$APP" ]; then
  ok "Bundle exists: $APP"
else
  fail "Bundle MISSING: $APP"
fi

# ── 2. Binary exists and is executable ─────────────────
echo ""
echo "2. Binary"
if [ -x "$BINARY" ]; then
  BINARY_MOD=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$BINARY")
  ok "Binary is executable (modified: $BINARY_MOD)"
else
  fail "Binary missing or not executable: $BINARY"
fi

# ── 3. dist/index.html has no port 5173 ────────────────
echo ""
echo "3. dist/index.html port check"
if [ -f "$DIST" ]; then
  # Port 5173 is allowed inside the stale-config migration guard (regex and comment)
  # but must NOT appear as a bare default URL like "http://127.0.0.1:5173"
  COUNT_BAD=$(grep -c "127\.0\.0\.1:$BAD_PORT" "$DIST" 2>/dev/null || true)
  COUNT_GOOD=$(grep -c "$FREELLM_PORT" "$DIST" 2>/dev/null || true)
  if [ "$COUNT_BAD" -eq 0 ]; then
    ok "dist/index.html: no bare 127.0.0.1:$BAD_PORT URLs (migration guard references OK)"
  else
    fail "dist/index.html: $COUNT_BAD bare 127.0.0.1:$BAD_PORT URLs found (should be 0)"
  fi
  ok "dist/index.html: $COUNT_GOOD references to correct port $FREELLM_PORT"
else
  fail "dist/index.html not found"
fi

# ── 4. src/index.html has no port 5173 (default URL) ──
echo ""
echo "4. src/index.html port check"
if [ -f "$SRC" ]; then
  # Port 5173 is allowed inside the stale-config migration guard (regex and comment)
  # but must NOT appear as a bare default URL like "http://127.0.0.1:5173"
  COUNT_BAD_SRC=$(grep -c "127\.0\.0\.1:$BAD_PORT" "$SRC" 2>/dev/null || true)
  if [ "$COUNT_BAD_SRC" -eq 0 ]; then
    ok "src/index.html: no bare 127.0.0.1:$BAD_PORT URLs (migration guard references OK)"
  else
    fail "src/index.html: $COUNT_BAD_SRC bare 127.0.0.1:$BAD_PORT URLs found"
  fi
  # Verify stale-config migration code is present
  if grep -q "Stale freellmUrl detected" "$SRC"; then
    ok "Stale config migration guard is present"
  else
    fail "Stale config migration guard is MISSING from src/index.html"
  fi
else
  fail "src/index.html not found"
fi

# ── 5. FreeLLMAPI is reachable ─────────────────────────
echo ""
echo "5. FreeLLMAPI connectivity"
HTTP_CODE=$(curl --noproxy "*" -s --max-time 4 -o /dev/null -w "%{http_code}" \
  "http://127.0.0.1:$FREELLM_PORT/api/ping" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  ok "FreeLLMAPI /api/ping → HTTP $HTTP_CODE"
else
  fail "FreeLLMAPI /api/ping → HTTP $HTTP_CODE (expected 200 — is FreeLLMAPI running?)"
fi

# ── 6. Binary age vs source age ───────────────────────
echo ""
echo "6. Build freshness"
if [ -f "$BINARY" ] && [ -f "$SRC" ]; then
  BINARY_TS=$(stat -f "%m" "$BINARY")
  SRC_TS=$(stat -f "%m" "$SRC")
  if [ "$BINARY_TS" -ge "$SRC_TS" ]; then
    ok "Binary is newer than or equal to src/index.html"
  else
    fail "Binary is OLDER than src/index.html — rebuild needed (run: npm run build:mac)"
    info "src/index.html: $(stat -f '%Sm' -t '%Y-%m-%d %H:%M' "$SRC")"
    info "Binary:         $(stat -f '%Sm' -t '%Y-%m-%d %H:%M' "$BINARY")"
  fi
fi

# ── 7. No duplicate Roundtable app running ────────────
echo ""
echo "7. Running processes"
PROCS=$(ps aux | grep -c "[/]Applications/Roundtable.app" 2>/dev/null || echo "0")
PROCS=$(echo "$PROCS" | tr -d ' \r\n')
if [ "$PROCS" -eq 0 ]; then
  info "Roundtable is not currently running from /Applications"
elif [ "$PROCS" -eq 1 ]; then
  ok "Exactly 1 Roundtable process running from /Applications (no duplicates)"
else
  fail "$PROCS Roundtable processes running — duplicates detected!"
fi

# ── Summary ────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
if [ "$FAIL" -eq 0 ]; then
  echo "  ✅  ALL $PASS CHECKS PASSED"
else
  echo "  ❌  $FAIL FAILED / $PASS PASSED"
fi
echo "═══════════════════════════════════════════════════"
echo ""

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
