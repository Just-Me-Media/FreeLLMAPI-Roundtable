#!/usr/bin/env bash
# build-and-notarize.sh — one-shot macOS release build.
#
#   1. build the .app + .dmg with Tauri (universal by default)
#   2. sign, notarize and staple with scripts/notarize.sh
#   3. copy the artifacts into releases/v<version>/ and write updates.json
#
# All signing/notarization logic lives in notarize.sh — this script only
# sequences it and assembles the release directory.
#
# TARGET
#   Default: universal-apple-darwin (arm64 + x86_64 in one app). This is what
#   gets published, so Intel Macs are supported too.
#
#   NATIVE=1 ./scripts/build-and-notarize.sh
#     build only the machine's own architecture (faster; useful for a quick
#     local check, but NOT suitable for release — Intel Macs would be left out).
#
# PREREQUISITE (run once, interactive):
#   rustup target add aarch64-apple-darwin x86_64-apple-darwin   # universal only
#   xcrun notarytool store-credentials "roundtable-notary" \
#     --apple-id "billcommu@icloud.com" --team-id "C76T5D27A2"
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

VERSION="$(python3 -c "import json; print(json.load(open('src-tauri/tauri.conf.json'))['version'])")"

# ---------- choose the Rust build target ----------
if [ "${NATIVE:-0}" = "1" ]; then
  RAW_ARCH="$(uname -m)"
  case "$RAW_ARCH" in
    arm64|aarch64) ARCH="aarch64" ;;
    x86_64)        ARCH="x86_64"  ;;
    *)             ARCH="$RAW_ARCH" ;;
  esac
  TARGET="${ARCH}-apple-darwin"        # Rust build target
else
  TARGET="universal-apple-darwin"      # lipo'd arm64 + x86_64
  ARCH="universal"                     # how Tauri names the artifacts
  for t in aarch64-apple-darwin x86_64-apple-darwin; do
    if ! rustup target list --installed | grep -qx "$t"; then
      echo "❌ Missing Rust target: $t"
      echo "   rustup target add aarch64-apple-darwin x86_64-apple-darwin"
      exit 1
    fi
  done
fi

DMG="src-tauri/target/${TARGET}/release/bundle/dmg/Roundtable_${VERSION}_${ARCH}.dmg"
TAG="v${VERSION}"
RELEASE_DIR="releases/${TAG}"

echo "=== Building Roundtable ${VERSION} (${TARGET}) ==="
# RUSTC_WRAPPER='' avoids sccache/rustc wrapper failures on cross-compiled slices.
RUSTC_WRAPPER='' cargo tauri build --target "$TARGET"

echo ""
echo "=== Signing + notarizing + stapling ==="
# notarize.sh resolves the same target so both scripts always agree on paths.
TAURI_TARGET="$TARGET" ./scripts/notarize.sh

[ -f "$DMG" ] || { echo "❌ $DMG not found after notarization"; exit 1; }

echo ""
echo "=== Assembling release directory ==="
mkdir -p "$RELEASE_DIR"
cp "$DMG" "$RELEASE_DIR/"

# Merges against the published manifest so other platforms survive. Only
# entries for this exact version are carried over (see updates-manifest.js).
#
# A universal DMG serves both Mac architectures, so it is listed twice: the
# updater looks up darwin-aarch64 on Apple Silicon and darwin-x86_64 on Intel.
# The signature is over the same bytes, so both entries share it.
if [ "$TARGET" = "universal-apple-darwin" ]; then
  PLATFORM_ARGS=(
    --platform "darwin-aarch64=${RELEASE_DIR}/$(basename "$DMG")"
    --platform "darwin-x86_64=${RELEASE_DIR}/$(basename "$DMG")"
  )
else
  PLATFORM_ARGS=(--platform "darwin-${ARCH}=${RELEASE_DIR}/$(basename "$DMG")")
fi

node scripts/updates-manifest.js \
  --version "$VERSION" \
  --base "https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable/releases/latest/download/updates.json" \
  "${PLATFORM_ARGS[@]}" \
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
