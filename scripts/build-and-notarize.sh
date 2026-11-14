#!/usr/bin/env bash
# build-and-notarize.sh — one-shot macOS release build.
#
#   1. build the .app + .dmg with Tauri
#   2. sign, notarize and staple with scripts/notarize.sh
#   3. copy the artifacts into releases/v<version>/ and write updates.json
#
# All signing/notarization logic lives in notarize.sh — this script only
# sequences it and assembles the release directory.
#
# PREREQUISITE (run once, interactive):
#   xcrun notarytool store-credentials "roundtable-notary" \
#     --apple-id "billcommu@icloud.com" --team-id "C76T5D27A2"
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

VERSION="$(python3 -c "import json; print(json.load(open('src-tauri/tauri.conf.json'))['version'])")"
RAW_ARCH="$(uname -m)"
case "$RAW_ARCH" in
  arm64|aarch64) ARCH="aarch64" ;;
  x86_64)        ARCH="x86_64"  ;;
  *)             ARCH="$RAW_ARCH" ;;
esac
TARGET="${ARCH}-apple-darwin"
DMG="src-tauri/target/${TARGET}/release/bundle/dmg/Roundtable_${VERSION}_${ARCH}.dmg"
TAG="v${VERSION}"
RELEASE_DIR="releases/${TAG}"

echo "=== Building Roundtable ${VERSION} (${TARGET}) ==="
cargo tauri build --target "$TARGET"

echo ""
echo "=== Signing + notarizing + stapling ==="
./scripts/notarize.sh

[ -f "$DMG" ] || { echo "❌ $DMG not found after notarization"; exit 1; }

echo ""
echo "=== Assembling release directory ==="
mkdir -p "$RELEASE_DIR"
cp "$DMG" "$RELEASE_DIR/"

# Merges against the published manifest so other platforms survive. Only
# entries for this exact version are carried over (see updates-manifest.js).
node scripts/updates-manifest.js \
  --version "$VERSION" \
  --base "https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable/releases/latest/download/updates.json" \
  --platform "${TARGET}=${RELEASE_DIR}/$(basename "$DMG")" \
  --out "${RELEASE_DIR}/updates.json"

echo ""
echo "🎉 Release artifacts ready:"
ls -lh "$RELEASE_DIR"
echo ""
echo "🚀 Publish with:"
echo "   gh release create ${TAG} \"${RELEASE_DIR}/$(basename "$DMG")\" \"${RELEASE_DIR}/updates.json\" --generate-notes"
echo ""
echo "⚠️  updates.json must be attached to every release, or"
echo "    releases/latest/download/updates.json 404s and auto-update dies."
