# Roundtable Cross-Platform HANDOFF & Architecture Status

**Repo:** https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable  

## Current State (v0.2.0)

- **macOS Build:** ✅ **Complete & Verified.**
  - Installed and verified locally at `/Applications/Roundtable.app`.
  - Built official Apple Silicon disk image: `src-tauri/target/release/bundle/dmg/Roundtable_0.2.0_aarch64.dmg` (6.1 MB).
  - Native HTTP plugin fully operational via `__TAURI_PLUGIN_HTTP__` (bypasses WKWebView loopback sandbox issues).
  - Verification suite active: `npm run verify` passes all 9 health checks.
  - Rust security audit fixes applied (safe file naming with unit tests, restricted HTTP capability scopes).
  - Updater plugin registered in `src-tauri/src/lib.rs` and Windows public key fixed.

- **Windows Build (ThinkCentre):** ✅ **Built, installed, and verified.**
  - Built from `main` with `build-windows.ps1` (no GitHub Actions minutes used).
  - NSIS installer: `src-tauri/target/release/bundle/nsis/Roundtable_0.2.0_x64-setup.exe`
  - MSI: `src-tauri/target/release/bundle/msi/Roundtable_0.2.0_x64_en-US.msi`
  - Staged copies: `C:\Temp\Roundtable\Roundtable-Windows-x64-v0.2.0.exe` / `.msi`
  - Installed on the ThinkCentre; shortcut points directly at `app.exe`.
  - Verified via WebView2 remote debugging:
    - App launches and responds.
    - FreeLLMAPI `/api/ping` returns 200 and the UI shows `FreeLLMAPI connected (http://127.0.0.1:31415)`.
    - "Load FreeLLMAPI Models" loaded 327 models.
    - Artifact "Save As…" writes a file successfully (Windows backslash path fix included).
    - New chat resets preview/artifact state as intended.
  - `cargo test` passes (2 Rust tests for safe artifact filenames).
  - GitHub Actions `release.yml` remains manual-dispatch for optional runner builds.

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
   - Optional headless UI check: launch with
     `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222`
     and drive the page through the Chrome DevTools Protocol.

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

#### Rebuild the launcher

The AppleScript source is now committed to the repo at `scripts/consensus.applescript`.
To rebuild the .app:

```bash
osacompile -o ~/Desktop/"OpenCode Consensus.app" scripts/consensus.applescript
cp /Applications/OpenCode.app/Contents/Resources/icon.icns ~/Desktop/"OpenCode Consensus.app"/Contents/Resources/applet.icns
```

## Roundtable → OpenCode Export

Click **🚀 Export to OpenCode** in the artifact pane to copy a ready-to-run prompt built
from the current synthesized artifact and your lineup. Paste into OpenCode — no retyping.
Deliberate in Roundtable, then hand the converged plan to OpenCode to build websites,
PDFs, repos, or apps using the same FreeLLMAPI backend.

## Links
- `build-windows.ps1` — one-step Windows builder (syncs `dist/`, runs `cargo tauri build`)
- `Roundtable-Windows-Start.bat` — post-build launcher (checks FreeLLMAPI, starts proxy, runs app)
- `scripts/consensus.applescript` — OpenCode Consensus desktop launcher source
- CROSS_MACHINE_SYNC.md — sync protocol for Mac/Windows