# Roundtable Windows Build (ThinkCentre)
# Builds the standalone Tauri .exe / .msi for Windows.
# Run from: C:\JUST_ME_MEDIA_VAULT\JustMeMedia\01_ACTIVE\Roundtable\roundtable-win

param(
    [string]$Config = "windows"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Definition
$SrcTauri = Join-Path $Root "src-tauri"

Write-Host "=== Roundtable Windows Build ===" -ForegroundColor Cyan
Write-Host "Root: $Root"
Write-Host "Config: $Config"

# 1. Ensure frontend dist exists (Tauri needs ../dist/index.html)
$Dist = Join-Path $Root "dist"
$IndexHtml = Join-Path $Dist "index.html"
if (-not (Test-Path $IndexHtml)) {
    Write-Host "Copying index.html -> dist/" -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $Dist | Out-Null
    Copy-Item (Join-Path $Root "index.html") $IndexHtml
}

# 2. Resolve config file
$ConfFile = if ($Config -eq "windows") { "tauri.windows.conf.json" } else { "tauri.conf.json" }
$ConfPath = Join-Path $SrcTauri $ConfFile
if (-not (Test-Path $ConfPath)) {
    Write-Error "Config not found: $ConfPath"
    exit 1
}

# 3. Build
Write-Host "Running: cargo tauri build --config $ConfFile -- --release" -ForegroundColor Yellow
Set-Location $SrcTauri
cargo tauri build --config $ConfFile -- --release
if ($LASTEXITCODE -ne 0) {
    Write-Error "cargo tauri build failed (exit $LASTEXITCODE)"
    exit $LASTEXITCODE
}

# 4. Report artifacts
$Bundle = Join-Path $SrcTauri "target\release\bundle"
Write-Host "`n=== Build artifacts ===" -ForegroundColor Green
Get-ChildItem $Bundle -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension -in ".exe", ".msi", ".nsis" } |
    ForEach-Object {
        $size = [math]::Round($_.Length / 1MB, 2)
        Write-Host ("  {0,-6} {1,8} MB  {2}" -f $_.Extension, $size, $_.FullName)
    }

Write-Host "`nDone." -ForegroundColor Green