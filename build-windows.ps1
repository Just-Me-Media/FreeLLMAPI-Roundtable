# Roundtable Windows Build (ThinkCentre / Windows PC)
# Builds the standalone Tauri .exe / .msi for Windows.
# Run from repository root:
#   powershell -ExecutionPolicy Bypass -File .\build-windows.ps1
#
# Prerequisites on the Windows machine:
#   - Rust toolchain (rustup / cargo) in PATH
#   - Node.js 18+ in PATH
#   - cargo-tauri installed: cargo install tauri-cli
#   - FreeLLMAPI running on localhost:31415 (needed at runtime, not build time)

param(
    [string]$Config = "windows",
    [switch]$SkipDistCheck = $false
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Definition
$SrcTauri = Join-Path $Root "src-tauri"

Write-Host "=== Roundtable Windows Build ===" -ForegroundColor Cyan
Write-Host "Root: $Root"
Write-Host "Config: $Config"

# 0. Sanity checks
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Error "cargo not found in PATH. Install Rust: https://rustup.rs"
    exit 1
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "node not found in PATH. Install Node.js 18+: https://nodejs.org"
    exit 1
}

# 1. Ensure frontend dist exists (Tauri needs ../dist/index.html AND ../dist/src/)
$Dist = Join-Path $Root "dist"
$IndexHtml = Join-Path $Dist "index.html"
$SrcIndex = Join-Path $Root "index.html"
$SrcDir = Join-Path $Root "src"
$DistSrc = Join-Path $Dist "src"

New-Item -ItemType Directory -Force -Path $Dist | Out-Null

if (-not $SkipDistCheck) {
    if (-not (Test-Path $IndexHtml)) {
        Write-Host "Copying index.html -> dist/" -ForegroundColor Yellow
        Copy-Item $SrcIndex $IndexHtml
    } else {
        # Keep dist in sync with the source so stale builds can't happen
        $srcHash = (Get-FileHash $SrcIndex -Algorithm SHA256).Hash
        $dstHash = (Get-FileHash $IndexHtml -Algorithm SHA256).Hash
        if ($srcHash -ne $dstHash) {
            Write-Host "index.html changed since last dist sync — updating dist/" -ForegroundColor Yellow
            Copy-Item $SrcIndex $IndexHtml -Force
        }
    }

    # index.html does `import { StorageFactory } from './src/index.js'`.
    # dist/ is gitignored, so a fresh clone has NO dist/src — without this copy
    # the bundled app's module import 404s and storage never initialises.
    if (-not (Test-Path $SrcDir)) {
        Write-Error "src/ directory not found at $SrcDir"
        exit 1
    }
    Write-Host "Syncing src/ -> dist/src/" -ForegroundColor Yellow
    if (Test-Path $DistSrc) { Remove-Item $DistSrc -Recurse -Force }
    Copy-Item $SrcDir $DistSrc -Recurse -Force
}

# 2. Resolve config file
$ConfFile = if ($Config -eq "windows") { "tauri.windows.conf.json" } else { "tauri.conf.json" }
$ConfPath = Join-Path $SrcTauri $ConfFile
if (-not (Test-Path $ConfPath)) {
    Write-Error "Config not found: $ConfPath"
    exit 1
}

# 3. Build
Write-Host "Running: cargo tauri build --config $ConfFile" -ForegroundColor Yellow
Set-Location $SrcTauri
cargo tauri build --config $ConfFile
if ($LASTEXITCODE -ne 0) {
    Write-Error "cargo tauri build failed (exit $LASTEXITCODE)"
    exit $LASTEXITCODE
}

# 4. Report artifacts
$Bundle = Join-Path $SrcTauri "target\release\bundle"
Write-Host "`n=== Build artifacts ===" -ForegroundColor Green
$found = $false
Get-ChildItem $Bundle -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension -in ".exe", ".msi" } |
    ForEach-Object {
        $found = $true
        $size = [math]::Round($_.Length / 1MB, 2)
        Write-Host ("  {0,-6} {1,8} MB  {2}" -f $_.Extension, $size, $_.FullName)
    }
if (-not $found) {
    Write-Host "  (no .exe/.msi found under $Bundle)" -ForegroundColor Yellow
}

Write-Host "`nDone." -ForegroundColor Green
Write-Host "`nNext: run Roundtable-Windows-Start.bat to launch the app with the server."