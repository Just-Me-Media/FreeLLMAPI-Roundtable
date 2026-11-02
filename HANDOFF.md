# Roundtable Windows HANDOFF

**Canonical path:** `C:\JUST_ME_MEDIA_VAULT\JustMeMedia\01_ACTIVE\Roundtable\roundtable-win`

**Repo:** https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable

**Purpose:** Build and test the Windows desktop installer (MSI / NSIS) for Roundtable, which brings local, cloud, and FreeLLMAPI models into one role-based shared conversation. macOS builds are handled on the M1 Pro.

**Status:** In progress — local build running (`cargo tauri build`).

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

## Links
- CROSS_MACHINE_SYNC.md — sync protocol for Mac/Windows
- `build-windows.ps1` — one-step Windows builder