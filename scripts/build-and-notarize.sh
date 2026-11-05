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

# ==============================================================================
# 8. Build the Self-Update Package (updates.json + signed artifacts)
#    Users never need to re-download — the Tauri updater handles this.
# ==============================================================================
echo ""
echo "=== 8. Building Self-Update Package ==="

VERSION=$(python3 -c "import json; print(json.load(open('src-tauri/tauri.conf.json'))['version'])")

# Map uname -m output to the arch string Tauri uses in bundle filenames.
# macOS: arm64 → aarch64, Intel: x86_64 → x86_64
RAW_ARCH=$(uname -m)
case "$RAW_ARCH" in
  arm64|aarch64) ARCH="aarch64" ;;
  x86_64)        ARCH="x86_64"  ;;
  *)             ARCH="$RAW_ARCH" ;;
esac

# The updater plugin resolves the target string itself at runtime ({os}-{arch}).
# macOS → darwin, Windows → windows, Linux → linux.
OS_NAME="darwin"
TARGET="${OS_NAME}-${ARCH}"

TAG="v${VERSION}"
RELEASE_DIR="releases/${TAG}"
mkdir -p "$RELEASE_DIR"

# Copy the freshly built DMG into the release directory
RELEASE_DMG="${RELEASE_DIR}/Roundtable_${VERSION}_${ARCH}.dmg"
cp "$DMG_PATH" "$RELEASE_DMG"

# Generate updates.json manifest.
# The updater plugin resolves the target string itself (darwin-aarch64, windows-x86_64, etc.)
# and looks up that exact key in the platforms object — so a Windows user can never
# receive a Mac DMG, and vice versa.
UPDATES_JSON="${RELEASE_DIR}/updates.json"
PUB_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
python3 - "$VERSION" "$TARGET" "$ARCH" "$RELEASE_DMG" "$PUB_DATE" > "$UPDATES_JSON" <<'PYEOF'
import json, sys
version, target, arch, dmg_path, pub_date = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]

with open(dmg_path, 'rb') as f:
    data = f.read()

manifest = {
    "version": version,
    "pubDate": pub_date,
    "notes": "Automatic update — see the changelog on GitHub for details.",
    "platforms": {
        target: {
            "url": f"https://github.com/justme-media/roundtable/releases/download/v{version}/Roundtable_{version}_{arch}.dmg",
            "signature": "PLACEHOLDER_SIGNATURE"
        }
    }
}

print(json.dumps(manifest, indent=2))
PYEOF

# Sign the update artifacts with the updater private key
if [ -f "updater.key" ]; then
    echo "Signing update artifacts with updater.key…"
    export TAURI_SIGNING_PRIVATE_KEY_PATH="$(pwd)/updater.key"
    export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""

    # Sign the DMG and capture the signature
    SIG=$(cargo tauri signer sign --key-path "$(pwd)/updater.key" "$RELEASE_DMG" 2>/dev/null || echo "")
    if [ -n "$SIG" ]; then
        python3 -c "
import json
with open('$UPDATES_JSON') as f: m = json.load(f)
m['platforms']['$TARGET']['signature'] = '$SIG'
with open('$UPDATES_JSON', 'w') as f: json.dump(m, f, indent=2)
"
        echo "✅ Update package signed (target: $TARGET)."
    else
        echo "⚠️  Could not sign update artifacts. Updates will not work."
    fi
else
    echo "⚠️  updater.key not found. Run 'cargo tauri signer generate --ci --write-keys updater.key' first."
fi

echo ""
echo "🎉 SUCCESS! Your notarized, stapled DMG is ready for distribution:"
echo "   $DMG_PATH"
echo ""
echo "📦 Self-update package ready at:"
echo "   $UPDATES_JSON"
echo "   $RELEASE_DMG"
echo ""
echo "🚀 To publish, run:"
echo "   gh release create $TAG $RELEASE_DMG $UPDATES_JSON --generate-notes"

