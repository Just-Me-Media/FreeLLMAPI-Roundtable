#!/usr/bin/env bash
# make-cask.sh — write Casks/roundtable.rb from a notarized universal DMG.
#
# The checksum must match the exact file on the GitHub release, so run this
# after build-and-notarize.sh and before publishing:
#
#   ./scripts/make-cask.sh
#   ./scripts/make-cask.sh path/to/Roundtable_x.y.z_universal.dmg
#
# Then copy Casks/roundtable.rb into the tap repo (Just-Me-Media/homebrew-tap)
# so `brew install --cask just-me-media/tap/roundtable` works.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

VERSION="$(python3 -c "import json; print(json.load(open('src-tauri/tauri.conf.json'))['version'])")"
DMG="${1:-releases/v${VERSION}/Roundtable_${VERSION}_universal.dmg}"

[ -f "$DMG" ] || { echo "❌ $DMG not found. Build and notarize first."; exit 1; }

SHA=$(shasum -a 256 "$DMG" | awk '{print $1}')
mkdir -p Casks

cat > Casks/roundtable.rb <<EOF
cask "roundtable" do
  version "${VERSION}"
  sha256 "${SHA}"

  url "https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable/releases/download/v#{version}/Roundtable_#{version}_universal.dmg"
  name "Roundtable"
  desc "Run several AI models in one shared, role-based conversation"
  homepage "https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable"

  livecheck do
    url "https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable/releases/latest"
    strategy :github_latest
  end

  depends_on macos: :monterey

  app "Roundtable.app"

  zap trash: [
    "~/Library/Application Support/media.justme.roundtable",
    "~/Library/Caches/media.justme.roundtable",
    "~/Library/Preferences/media.justme.roundtable.plist",
    "~/Library/Saved Application State/media.justme.roundtable.savedState",
    "~/Library/WebKit/media.justme.roundtable",
  ]
end
EOF

echo "✅ Casks/roundtable.rb — version ${VERSION}"
echo "   sha256 ${SHA}"
echo "   from   $DMG"
