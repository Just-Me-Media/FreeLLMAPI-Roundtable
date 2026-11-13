-- OpenCode Consensus Desktop Launcher
-- Double-click this file (or the compiled .app) to:
--   1. Launch FreeLLMAPI (if not already running)
--   2. Open OpenCode
--
-- Then inside OpenCode select either model:
--   - 🏛️ Fusion Consensus (Parallel Models + Judge)
--   - 💻 Auto Free-Coding Chain
--
-- Both are registered in ~/.config/opencode/opencode.jsonc under the freellmapi provider.
--
-- Rebuild the .app from this source:
--   osacompile -o ~/Desktop/"OpenCode Consensus.app" scripts/consensus.applescript
--   cp /Applications/OpenCode.app/Contents/Resources/icon.icns \
--      ~/Desktop/"OpenCode Consensus.app"/Contents/Resources/applet.icns

on run
	do shell script "export PATH=/opt/homebrew/bin:$HOME/.local/bin:$PATH; if ! pgrep -f FreeLLMAPI >/dev/null 2>&1; then open -a /Applications/FreeLLMAPI.app; sleep 3; fi; open -a /Applications/OpenCode.app"
end run