# Roundtable Cross-Platform HANDOFF & Architecture Status

**Canonical path (Windows):** `C:\JUST_ME_MEDIA_VAULT\JustMeMedia\01_ACTIVE\Roundtable\roundtable-win`  
**Canonical path (macOS):** `/Users/williamcommu/Desktop/JUST_ME_MEDIA_VAULT/JustMeMedia/01_ACTIVE/FreeLLMAPI/Roundtable/roundtable`  
**Repo:** https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable  

## Current State (v0.2.0)

- **macOS Build:** ✅ **Complete & Verified.**
  - Installed and verified locally at `/Applications/Roundtable.app`.
  - Built official Apple Silicon disk image: `src-tauri/target/release/bundle/dmg/Roundtable_0.2.0_aarch64.dmg` (6.1 MB).
  - Native HTTP plugin fully operational via `__TAURI_PLUGIN_HTTP__` (bypasses WKWebView loopback sandbox issues).
  - Verification suite active: `npm run verify` passes all 9 health checks.
  - Rust security audit fixes applied (safe file naming with unit tests, restricted HTTP capability scopes).
  - Updater plugin registered in `src-tauri/src/lib.rs` and Windows public key fixed.

- **Windows Build (ThinkCentre):**
  - Run `build-windows.ps1` or `cargo tauri build --config tauri.windows.conf.json`.
  - GitHub Actions `release.yml` is configured for manual dispatch (`workflow_dispatch`) so you can trigger builds on the ThinkCentre self-hosted runner on-demand.

## Build checklist (Windows ThinkCentre)

1. Node server test
   - `node server.js` runs locally, proxies to FreeLLMAPI :31415 ✅
   - `/health` endpoint returns upstream true

2. Frontend dist
   - `dist/index.html` must exist before Tauri bundling
   - `build-windows.ps1` copies `index.html` → `dist/`. `beforeBuildCommand` cleared to avoid POSIX commands.

3. Tauri Windows config
   - `src-tauri/tauri.windows.conf.json` used
   - `bundle.targets: ["msi","nsis"]` only — no macOS targets
   - Build command: `cargo tauri build --config tauri.windows.conf.json` (release is default)

4. Artifacts
   - Expected output: `src-tauri/target/release/bundle/...`
     - `Roundtable_<version>_x64_en-US.msi`
     - `Roundtable_<version>_x64-setup.exe` (NSIS)

   - For Windows installs, copy to a short path to avoid long-path issues:
     - `C:\Temp\Roundtable\Roundtable.msi`
     - `C:\Temp\Roundtable\RoundtableSetup.exe`

5. Test locally
   - Launch `.exe` from `target/release/bundle/nsis/`
   - Verify window launches, Setup drawer opens, FreeLLMAPI detection works
   - Console: no Rust panic, no CSP errors

## Do NOT push changes
- GitHub Actions not used for this build
- Zero GitHub minutes consumed — build locally
- After local test, create a commit and push Windows artifacts (or note release in README). M1 Pro will handle macOS `.dmg` / Linux builds.

## Notes
- CRLF vs LF: repo uses LF, Windows build works fine.
- ExecutionPolicy bypass required for `build-windows.ps1` (`powershell -ExecutionPolicy Bypass -File .\build-windows.ps1`).
- `beforeBuildCommand` removed from Windows config to avoid `mkdir -p` / `cp` POSIX failures.

## Server Recovery & User Self-Service

### Restarting Server After Crash/Interruption
Chat history persists in browser localStorage, so users won't lose conversations even if the server restarts. To restore server access:

**Quick Restart:**
1. Double-click `Restart-Server.bat` in the project root
2. Server will restart on port 5173
3. Refresh browser at http://localhost:5173

**Check Status:**
- Run `Check-Server.bat` to verify server is listening

**Auto-Recovery:**
- Run `server-monitor.bat` to keep server running automatically
- Monitors port 5173 every 30 seconds and restarts if needed

**Files:**
- `Restart-Server.bat` - One-click server restart
- `Check-Server.bat` - Status check
- `server-monitor.bat` - Auto-recovery monitor
- `Roundtable-Start.bat` - Full launch (server + Tauri app)

## OpenCode Consensus Desktop Launcher (macOS)

A no-terminal desktop launcher lives on the Desktop:

**`~/Desktop/OpenCode Consensus.app`**

Double-click it to:
1. Launch FreeLLMAPI (if not already running)
2. Open OpenCode

Then select either model inside OpenCode:
- **`🏛️ Fusion Consensus (Parallel Models + Judge)`** — fan-out to all models, judge synthesizes
- **`💻 Auto Free-Coding Chain`** — multi-model coding pipeline

Both models are registered in `~/.config/opencode/opencode.jsonc` under the `freellmapi` provider.

To rebuild the launcher (e.g. if Desktop icon is lost):
```bash
# Paste into Terminal
osacompile -o ~/Desktop/"OpenCode Consensus.app" /tmp/consensus.applescript
cp /Applications/OpenCode.app/Contents/Resources/icon.icns ~/Desktop/"OpenCode Consensus.app"/Contents/Resources/applet.icns
```

The source script is at `/tmp/consensus.applescript` (ephemeral — recreate from HANDOFF if needed):
```applescript
on run
    do shell script "export PATH=/opt/homebrew/bin:$HOME/.local/bin:$PATH; if ! pgrep -f FreeLLMAPI >/dev/null 2>&1; then open -a /Applications/FreeLLMAPI.app; sleep 3; fi; open -a /Applications/OpenCode.app"
end run
```

## Links
- CROSS_MACHINE_SYNC.md — sync protocol for Mac/Windows
- `build-windows.ps1` — one-step Windows builder