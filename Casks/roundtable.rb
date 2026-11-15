cask "roundtable" do
  version "0.2.4"
  sha256 "4626cadc0d46d6edfbe37437200674cac8f118a25d108c11271ebf3fe7183980"

  url "https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable/releases/download/v#{version}/Roundtable_#{version}_universal.dmg",
      verified: "github.com/Just-Me-Media/FreeLLMAPI-Roundtable/"
  name "Roundtable"
  desc "Run several AI models in one shared, role-based conversation"
  homepage "https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable"

  livecheck do
    url "https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable/releases/latest"
    strategy :github_latest
  end

  depends_on macos: ">= :monterey"

  app "Roundtable.app"

  zap trash: [
    "~/Library/Application Support/media.justme.roundtable",
    "~/Library/Caches/media.justme.roundtable",
    "~/Library/Preferences/media.justme.roundtable.plist",
    "~/Library/Saved Application State/media.justme.roundtable.savedState",
    "~/Library/WebKit/media.justme.roundtable",
  ]
end
