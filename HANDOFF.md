# Roundtable Cross-Platform HANDOFF & Architecture Status

**Repo:** https://github.com/Just-Me-Media/FreeLLMAPI-Roundtable  

## Current State (v0.2.1)

- **macOS Build:** ✅ **Complete & Verified.**
  - Notarized + stapled Developer ID build installed at `/Applications/Roundtable.app` (0.2.1).
  - `updates.json` published on the `v0.2.1` release with a `darwin-aarch64` entry.
  - Storage architecture (`src/storage/*`) bundled inside the app.
  - Updater signing key: `6E8C99D71D9B2B5A` (same key baked into both configs).

- **Windows Build (ThinkCentre):** ✅ **Built, installed, and verified for 0.2.1.**
  - Built from `main` (9f7c7fe — the `feat/storage-rewrite` tip plus the Windows path/script fixes) with `build-windows.ps1` — no GitHub Actions minutes used.
  - NSIS installer: `src-tauri/target/release/bundle/nsis/Roundtable_0.2.1_x64-setup.exe`
  - MSI: `src-tauri/target/release/bundle/msi/Roundtable_0.2.1_x64_en-US.msi`
  - Staged copies: `C:\Temp\Roundtable\Roundtable-Windows-x64-v0.2.1.exe` / `.msi`
  - Installed on the ThinkCentre; `app.exe` reports file/product version `0.2.1`.
  - Verified via WebView2 remote debugging (port 9222):
    - App launches; window titled `Roundtable`.
    - All storage modules load over `http://tauri.localhost/` (`src/index.js` + 7 modules, HTTP 200) and `window.storage` is initialised — the `dist/src/` copy fix works.
    - FreeLLMAPI `/api/ping` returns 200 → `FreeLLMAPI connected (http://127.0.0.1:31415)`.
    - "Load FreeLLMAPI Models" loaded 385 models.
    - Artifact "Save As…" wrote `my-artifact.md` into the folder picked in the native dialog (not Documents/Roundtable).
    - Updater `check()` reaches `releases/latest/download/updates.json` and returns `null` (the app is already on 0.2.1).
    - Turn Rules tab is the default active tab; prompt textarea `min-height` is 120px.
  - `cargo test` passes (2 Rust tests for safe artifact filenames).

- **Windows release status:** ✅ **Published on `v0.2.1`.**
  - Assets: `Roundtable_0.2.1_x64-setup.exe` (4,317,243 bytes) and `Roundtable_0.2.1_x64_en-US.msi` (6,434,816 bytes).
  - The release's `updates.json` now carries **both** `darwin-aarch64` and `windows-x86_64`, signed with key id `6E8C99D71D9B2B5A`.
  - Signature verified out-of-band against the pubkey baked into `src-tauri/tauri.conf.json`: minisign prehashed mode (`ED`), BLAKE2b-512 over the installer, key id matches. This is the exact check the updater performs on download.
  - The published installer is byte-identical to the locally built and tested one (SHA-256 `456BF28B02E66BC5B6AAFF666D5E26C9C44EA13AD74360F9D6609B4A9465B873`).
  - In-app `updater.check()` returns `null` without error (app is already 0.2.1), so the endpoint is live and the manifest parses.

  **How Windows is published (no self-hosted runner required):**
  1. Build locally: `powershell -ExecutionPolicy Bypass -File .\build-windows.ps1`
  2. Attach the installers to the release:
     ```powershell
     gh release upload v0.2.1 `
       src-tauri\target\release\bundle\nsis\Roundtable_0.2.1_x64-setup.exe `
       src-tauri\target\release\bundle\msi\Roundtable_0.2.1_x64_en-US.msi `
       --repo Just-Me-Media/FreeLLMAPI-Roundtable --clobber
     ```
  3. Dispatch **Sign Windows Release** (`.github/workflows/sign-windows-release.yml`) with
     `tag=v0.2.1` and `asset=Roundtable_0.2.1_x64-setup.exe`:
     ```powershell
     gh workflow run sign-windows-release.yml `
       --repo Just-Me-Media/FreeLLMAPI-Roundtable `
       --ref main -f tag=v0.2.1 -f asset=Roundtable_0.2.1_x64-setup.exe
     ```
     The job downloads the asset, signs it with the repo secret
     `TAURI_SIGNING_PRIVATE_KEY`, merges the `windows-x86_64` entry into the
     release's `updates.json` (keeping `darwin-aarch64`) and re-uploads it.

  **Why not `.github/workflows/release.yml`?** It targets
  `runs-on: [self-hosted, Windows]`, but this repo has **0 registered runners**
  and the workflow is currently `disabled_manually`. The private key exists only
  as the repo secret, so signing must happen inside Actions. GitHub Actions
  minutes are free for public repositories, so the sign job costs nothing.

  **Key gotcha:** `src-tauri/updater.key` in this checkout is **stale**
  (key id `13FADAED9706926B`) and does NOT match the pubkey baked into the app.
  Never sign a release with it — the app would reject the update. The only valid
  private key is the `TAURI_SIGNING_PRIVATE_KEY` repo secret.

  **One-time migration:** the signing key was rotated in 0.2.1 (old key id
  `D2B0F1370F1F4C9D`). Builds of **0.2.0 and older will reject the 0.2.1 update**
  because they still trust the old key, so anyone on 0.2.0 must install 0.2.1
  manually once. From 0.2.1 onward auto-update works normally.

## Build checklist (Windows ThinkCentre)

1. Node server test
   - `node server.js` runs locally, proxies to FreeLLMAPI :31415 ✅
   - `/health` endpoint returns upstream true

2. Frontend dist
   - `dist/index.html` must exist before Tauri bundling
   - `build-windows.ps1` copies `index.html` → `dist/` and `src/` → `dist/src/` (the bundled app imports `./src/index.js`). `tauri.windows.conf.json` repeats this copy in its PowerShell `beforeBuildCommand` so CI builds get it too.

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