cask "roundtable" do
  version "0.2.5"
  sha256 "fe28aad05d108ce742da699aa95c0a27a85ba049ac1a131fee93f1ef4ed61d00"

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
