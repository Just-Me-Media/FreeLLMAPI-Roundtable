#!/usr/bin/env bash
set -e

# ==============================================================================
# Roundtable macOS Build, Sign, Notarize & Staple Script
# ==============================================================================
# Prerequisites:
# 1. Developer ID Application certificate installed in Keychain.
# 2. Apple Notarytool keychain profile stored via:
#    xcrun notarytool store-credentials "notarytool-profile" \
#      --apple-id "your-apple-id@email.com" \
#      --team-id "YOUR_TEAM_ID" \
#      --password "app-specific-password"
# ==============================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "=== 1. Checking Code Signing Identity ==="
if [ -n "$APPLE_SIGNING_IDENTITY" ]; then
    IDENTITY="$APPLE_SIGNING_IDENTITY"
else
    # Auto-detect Developer ID Application certificate
    IDENTITY=$(security find-identity -v -p codesigning | grep "Developer ID Application:" | head -n 1 | awk -F'"' '{print $2}')
fi

if [ -z "$IDENTITY" ]; then
    echo "⚠️  No 'Developer ID Application:' certificate found automatically."
    echo "   Pass your identity explicitly:"
    echo "   APPLE_SIGNING_IDENTITY=\"Developer ID Application: Your Name (TEAM_ID)\" ./scripts/build-and-notarize.sh"
    echo ""
    read -p "Enter your Signing Identity (or press Enter to build unsigned): " USER_IDENTITY
    IDENTITY="$USER_IDENTITY"
fi

KEYCHAIN_PROFILE="${NOTARY_PROFILE:-notarytool-profile}"

echo "=== 2. Building Native macOS App with Tauri ==="
cargo tauri build

APP_PATH="src-tauri/target/release/bundle/macos/Roundtable.app"
DMG_PATH=$(find src-tauri/target/release/bundle/dmg -name "*.dmg" | head -n 1)

if [ ! -d "$APP_PATH" ]; then
    echo "❌ Build failed: $APP_PATH not found."
    exit 1
fi

echo "✅ App built at: $APP_PATH"
echo "✅ DMG built at: $DMG_PATH"

if [ -z "$IDENTITY" ]; then
    echo "⚠️  Skipping signing and notarization (no identity provided)."
    echo "Your unsigned DMG is ready at: $DMG_PATH"
    exit 0
fi

echo "=== 3. Code Signing .app with Hardened Runtime ==="
codesign --deep --force --verify --verbose \
    --options runtime \
    --entitlements "src-tauri/entitlements.plist" \
    --sign "$IDENTITY" \
    "$APP_PATH"

codesign --verify --deep --strict --verbose=2 "$APP_PATH"
echo "✅ .app successfully signed."

echo "=== 4. Code Signing .dmg ==="
if [ -f "$DMG_PATH" ]; then
    codesign --force --sign "$IDENTITY" "$DMG_PATH"
    echo "✅ .dmg successfully signed."
fi

echo "=== 5. Submitting to Apple Notary Service ==="
echo "Using notarytool profile: $KEYCHAIN_PROFILE"
echo "(If you have not created this profile yet, run: xcrun notarytool store-credentials \"$KEYCHAIN_PROFILE\")"
echo ""

xcrun notarytool submit "$DMG_PATH" --keychain-profile "$KEYCHAIN_PROFILE" --wait

echo "=== 6. Stapling Notarization Ticket to DMG ==="
xcrun stapler staple "$DMG_PATH"
xcrun stapler validate "$DMG_PATH"

echo "=== 7. Verifying Gatekeeper Acceptance ==="
spctl -a -t open --context context:primary-signature -v "$DMG_PATH"

echo ""
echo "🎉 SUCCESS! Your notarized, stapled DMG is ready for distribution:"
echo "   $DMG_PATH"

