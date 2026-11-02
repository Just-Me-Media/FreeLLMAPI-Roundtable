# Roundtable Windows HANDOFF

**Canonical path:** `C:\JUST_ME_MEDIA_VAULT\JustMeMedia\01_ACTIVE\Roundtable\roundtable-win`

**Repo:** https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable

**Purpose:** Build and test Windows desktop installer (MSI / NSIS) for Roundtable. Mac/Linux builds handled on M1 Pro.

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

## Links
- CROSS_MACHINE_SYNC.md — sync protocol for Mac/Windows
- `build-windows.ps1` — one-step Windows builder