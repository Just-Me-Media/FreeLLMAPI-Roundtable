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
ENTITLEMENTS="src-tauri/entitlements.plist"

# ---------- sanity ----------
[ -d "$APP" ] || { echo "❌ $APP not found. Run: cargo tauri build --target aarch64-apple-darwin"; exit 1; }
[ -f "$DMG" ] || { echo "❌ $DMG not found. Run: cargo tauri build --target aarch64-apple-darwin"; exit 1; }

# ---------- identity ----------
if [ -z "${SIGN_IDENTITY:-}" ]; then
  SIGN_IDENTITY=$(security find-identity -v -p codesigning \
    | grep "Developer ID Application:" \
    | head -n1 \
    | sed -E 's/.*"(.*)".*/\1/')
fi
[ -n "$SIGN_IDENTITY" ] || { echo "❌ No 'Developer ID Application' certificate found."; exit 1; }
echo "🔏 Identity: $SIGN_IDENTITY"

# ---------- preflight: notary credentials + legal agreement ----------
echo ""
echo "=== 0/6 Preflight: notary credentials ==="
PREFLIGHT=$(xcrun notarytool history --keychain-profile "$NOTARY_PROFILE" 2>&1 || true)
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
echo "=== 1/6 Signing .app (hardened runtime) ==="
codesign --deep --force --options runtime \
  --entitlements "$ENTITLEMENTS" \
  --sign "$SIGN_IDENTITY" "$APP"
codesign --verify --deep --strict --verbose=2 "$APP"

# ---------- verify entitlements survived ----------
echo ""
echo "=== 2/6 Verifying hardened runtime + entitlements ==="
codesign -dv --verbose=4 "$APP" 2>&1 | grep -E "Authority=|TeamIdentifier|flags=" | head -5
codesign -d --entitlements :- "$APP" 2>/dev/null | grep -c "com.apple.security" \
  | xargs -I{} echo "   entitlements present: {}"

# ---------- sign dmg ----------
echo ""
echo "=== 3/6 Signing .dmg ==="
codesign --force --sign "$SIGN_IDENTITY" "$DMG"

# ---------- notarize ----------
echo ""
echo "=== 4/6 Submitting to Apple Notary Service ==="
echo "    profile: $NOTARY_PROFILE"
xcrun notarytool submit "$DMG" --keychain-profile "$NOTARY_PROFILE" --wait

# ---------- staple ----------
echo ""
echo "=== 5/6 Stapling ticket ==="
xcrun stapler staple "$DMG"
xcrun stapler validate "$DMG"

# ---------- gatekeeper ----------
echo ""
echo "=== 6/6 Gatekeeper assessment ==="
spctl -a -t open --context context:primary-signature -v "$DMG"

echo ""
echo "🎉 Notarized, stapled DMG ready for distribution:"
echo "   $DMG"
