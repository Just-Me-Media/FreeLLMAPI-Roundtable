#!/usr/bin/env bash
# install-app.sh — copies the freshly built Roundtable.app to /Applications
# Run after `npm run build:mac` succeeds.
set -euo pipefail

BUNDLE="$(cd "$(dirname "$0")/.." && pwd)/src-tauri/target/release/bundle/macos/Roundtable.app"
DEST="/Applications/Roundtable.app"

if [ ! -d "$BUNDLE" ]; then
  echo "❌ Bundle not found: $BUNDLE"
  echo "   Run: npm run build:mac  first."
  exit 1
fi

echo "🛑 Closing running Roundtable instances…"
killall -9 app 2>/dev/null || true
pkill -f "Roundtable.app" 2>/dev/null || true
sleep 1

echo "🗑  Removing old bundle at $DEST …"
rm -rf "$DEST"

echo "📦 Copying $BUNDLE → $DEST …"
cp -R "$BUNDLE" "$DEST"

echo "✅ Installed: $DEST"
echo "   Run 'npm run verify' to confirm everything is correct."

