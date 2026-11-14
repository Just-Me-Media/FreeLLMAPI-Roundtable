#!/usr/bin/env bash
# notarize.sh — Sign + notarize + staple the Roundtable macOS DMG.
#
# PREREQUISITE (run once, interactive):
#   xcrun notarytool store-credentials "roundtable-notary" \
#     --apple-id "billcommu@icloud.com" \
#     --team-id "C76T5D27A2"
#   (you will be prompted for the app-specific password from appleid.apple.com)
#
# THEN:
#   ./scripts/notarize.sh
#
# ENV OVERRIDES:
#   NOTARY_PROFILE   keychain profile name   (default: roundtable-notary)
#   SIGN_IDENTITY    codesign identity       (default: auto-detect Developer ID Application)
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

NOTARY_PROFILE="${NOTARY_PROFILE:-roundtable-notary}"
APP="src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Roundtable.app"
DMG="src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/Roundtable_0.2.0_aarch64.dmg"
BUNDLE_DMG="src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/bundle_dmg.sh"
ENTITLEMENTS="src-tauri/entitlements.plist"

# ---------- sanity ----------
[ -d "$APP" ] || { echo "❌ $APP not found. Run: cargo tauri build --target aarch64-apple-darwin"; exit 1; }
[ -f "$DMG" ] || { echo "❌ $DMG not found. Run: cargo tauri build --target aarch64-apple-darwin"; exit 1; }

# ---------- identity ----------
# Multiple Developer ID certs can share an identical CN, which makes
# `codesign --sign "<CN>"` fail with "ambiguous". Resolve to a SHA1 fingerprint.
resolve_identity() {
  python3 - <<'PY'
import subprocess, re, sys

ids = subprocess.run(["security", "find-identity", "-v", "-p", "codesigning"],
                     capture_output=True, text=True).stdout
cands = []
for line in ids.splitlines():
    m = re.search(r'\b([0-9A-F]{40})\s+"(Developer ID Application:[^"]+)"', line)
    if m:
        cands.append({"sha1": m.group(1), "cn": m.group(2)})
if not cands:
    sys.exit(1)

# Map certificate SHA1 -> notAfter using every cert in the keychains.
raw = subprocess.run(["security", "find-certificate", "-a", "-p"],
                     capture_output=True, text=True).stdout
pems = re.findall(r"-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----", raw, re.S)
expiry = {}
for pem in pems:
    out = subprocess.run(["openssl", "x509", "-noout", "-fingerprint", "-sha1", "-enddate"],
                         input=pem, capture_output=True, text=True).stdout
    fp = re.search(r'Fingerprint=([0-9A-Fa-f:]+)', out)
    end = re.search(r'notAfter=(.+)', out)
    if not fp or not end:
        continue
    sha1 = fp.group(1).replace(":", "").upper()
    try:
        epoch = subprocess.run(["date", "-j", "-f", "%b %e %H:%M:%S %Y %Z",
                                end.group(1).strip(), "+%s"],
                               capture_output=True, text=True).stdout.strip()
        expiry[sha1] = int(epoch) if epoch.isdigit() else 0
    except ValueError:
        expiry[sha1] = 0

for c in cands:
    c["exp"] = expiry.get(c["sha1"], 0)

# Longest-lived valid cert wins; ties broken by CN for determinism.
cands.sort(key=lambda c: (c["exp"], c["cn"]), reverse=True)
best = cands[0]

for c in cands:
    mark = "->" if c is best else "  "
    print(f"{mark} {c['sha1']}  {c['cn']}", file=sys.stderr)
print(best["sha1"])
PY
}

if [ -z "${SIGN_IDENTITY:-}" ]; then
  SIGN_IDENTITY=$(resolve_identity) || true
fi
[ -n "$SIGN_IDENTITY" ] || { echo "❌ No 'Developer ID Application' certificate found."; exit 1; }
echo "🔏 Identity: $SIGN_IDENTITY"

# ---------- preflight: notary credentials + legal agreement ----------
# Apple intermittently answers 403 on the first call after a period of
# inactivity (stale agreement state at the edge). Retry before failing.
notary_history() {
  local attempt out
  for attempt in 1 2 3 4 5; do
    out=$(xcrun notarytool history --keychain-profile "$NOTARY_PROFILE" 2>&1 || true)
    if ! echo "$out" | grep -q "HTTP status code: 403"; then
      printf '%s\n' "$out"
      return 0
    fi
    [ "$attempt" -lt 5 ] && sleep 3
  done
  printf '%s\n' "$out"
}

echo ""
echo "=== 0/6 Preflight: notary credentials ==="
PREFLIGHT=$(notary_history)
if echo "$PREFLIGHT" | grep -q "HTTP status code: 401"; then
  cat <<EOF
❌ Notary credentials rejected (401).
   Re-create the profile:
   xcrun notarytool store-credentials "$NOTARY_PROFILE" \\
     --apple-id "billcommu@icloud.com" --team-id "C76T5D27A2"
EOF
  exit 1
fi
if echo "$PREFLIGHT" | grep -q "HTTP status code: 403"; then
  cat <<EOF
❌ Notary service returned 403 — a legal agreement is missing or expired.

   Retried 5 times over ~12s; the failure is persistent, not transient.

   The credentials themselves are valid; Apple is refusing the request.

   FIX (Account Holder must do this):
     1. https://appstoreconnect.apple.com  ->  Business  ->  Agreements
        Accept every agreement showing "Action Required" / expired.
     2. https://developer.apple.com/account  ->  check for an agreement banner
        and accept the Apple Developer Program License Agreement.

   If billcommu@icloud.com is not the Account Holder, the Account Holder
   must sign in and accept on the team's behalf.

   Then re-run: ./scripts/notarize.sh
EOF
  exit 1
fi
echo "✅ Credentials accepted by Apple"

# ---------- sign app ----------
echo ""
echo "=== 1/7 Signing .app (hardened runtime + secure timestamp) ==="
codesign --force --deep --options runtime --timestamp \
  --entitlements "$ENTITLEMENTS" \
  --sign "$SIGN_IDENTITY" "$APP"
codesign --verify --deep --strict --verbose=2 "$APP"

# ---------- verify hardened runtime, timestamp, entitlements survived ----------
echo ""
echo "=== 2/7 Verifying signature properties ==="
SIGINFO=$(codesign -dv --verbose=4 "$APP" 2>&1)
echo "$SIGINFO" | grep -E "Authority=|TeamIdentifier=" | head -4
echo "$SIGINFO" | grep -q "flags=.*runtime" \
  && echo "   ✅ hardened runtime enabled" \
  || { echo "   ❌ hardened runtime NOT enabled"; exit 1; }
echo "$SIGINFO" | grep -q "^Timestamp=" \
  && echo "   ✅ secure timestamp present" \
  || { echo "   ❌ secure timestamp missing (notary will reject)"; exit 1; }
ENT_CNT=$(codesign -d --entitlements :- "$APP" 2>/dev/null | grep -c "com.apple.security" || true)
echo "   ✅ entitlements present: $ENT_CNT"

# ---------- rebuild dmg FROM THE SIGNED APP ----------
# Critical: `cargo tauri build` seals the DMG before we sign, so the DMG would
# otherwise ship an adhoc-signed app and Apple rejects it. Rebuild it here.
echo ""
echo "=== 3/7 Rebuilding .dmg from signed .app ==="
[ -f "$BUNDLE_DMG" ] || { echo "❌ $BUNDLE_DMG not found (run cargo tauri build first)"; exit 1; }
STAGING=$(mktemp -d)
trap 'rm -rf "$STAGING"' EXIT
cp -R "$APP" "$STAGING/"
rm -f "$DMG"
bash "$BUNDLE_DMG" \
  --volname "Roundtable" \
  --volicon "src-tauri/icons/icon.icns" \
  --window-size 600 380 \
  --icon-size 128 \
  --icon "Roundtable.app" 160 180 \
  --hide-extension "Roundtable.app" \
  --app-drop-link 440 180 \
  --codesign "$SIGN_IDENTITY" \
  "$DMG" "$STAGING" >/dev/null
[ -f "$DMG" ] || { echo "❌ DMG rebuild failed"; exit 1; }

# Confirm the copy inside the DMG is really signed (catches the classic mistake).
echo "   verifying app inside DMG…"
MP=$(mktemp -d)
hdiutil attach -nobrowse -readonly -mountpoint "$MP" "$DMG" >/dev/null 2>&1
if codesign --verify --deep --strict "$MP/Roundtable.app" >/dev/null 2>&1; then
  echo "   ✅ app inside DMG is signed and valid"
else
  hdiutil detach "$MP" >/dev/null 2>&1
  echo "   ❌ app inside DMG failed signature verification"; exit 1
fi
hdiutil detach "$MP" >/dev/null 2>&1
rmdir "$MP" 2>/dev/null || true

# ---------- sign dmg ----------
echo ""
echo "=== 4/7 Signing .dmg ==="
codesign --force --timestamp --sign "$SIGN_IDENTITY" "$DMG"

# ---------- notarize ----------
echo ""
echo "=== 5/7 Submitting to Apple Notary Service ==="
echo "    profile: $NOTARY_PROFILE"
# Transient 403s happen on the first call after idle; retry. Also treat a
# completed submission with status Invalid as a failure so we surface logs.
SUBMIT_OK=0
for attempt in 1 2 3 4 5; do
  OUT=$(xcrun notarytool submit "$DMG" --keychain-profile "$NOTARY_PROFILE" --wait 2>&1 || true)
  printf '%s\n' "$OUT" | tail -8
  if printf '%s\n' "$OUT" | grep -q "status: Accepted"; then
    SUBMIT_OK=1
    break
  fi
  if printf '%s\n' "$OUT" | grep -q "status: Invalid"; then
    SID=$(printf '%s\n' "$OUT" | sed -n 's/^ *id: *//p' | tail -1)
    echo ""
    echo "❌ Apple rejected the archive (status: Invalid)."
    echo "   Submission ID: ${SID:-unknown}"
    [ -n "$SID" ] && xcrun notarytool log "$SID" --keychain-profile "$NOTARY_PROFILE" 2>/dev/null | head -60
    exit 1
  fi
  echo "   attempt $attempt failed; retrying in 5s…"
  sleep 5
done
[ "$SUBMIT_OK" -eq 1 ] || { echo "❌ Notarization failed after 5 attempts."; exit 1; }

# ---------- staple ----------
echo ""
echo "=== 6/7 Stapling ticket ==="
xcrun stapler staple "$DMG"
xcrun stapler validate "$DMG"

# The app bundle's CDHash is part of the accepted submission, so it can carry
# the same ticket. This makes the on-disk build valid offline too (e.g. when
# installed straight to /Applications rather than dragged out of the DMG).
if xcrun stapler staple "$APP" >/dev/null 2>&1; then
  echo "   ✅ .app also stapled (offline-valid)"
else
  echo "   ⚠️  could not staple .app (DMG staple is authoritative)"
fi

# ---------- gatekeeper ----------
echo ""
echo "=== 7/7 Gatekeeper assessment ==="
spctl -a -t open --context context:primary-signature -v "$DMG"

echo ""
echo "🎉 Notarized, stapled DMG ready for distribution:"
echo "   $DMG"
