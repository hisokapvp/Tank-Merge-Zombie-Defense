# ci/build_release.ps1 — native Windows PowerShell wrapper.
#
# Mirrors the bash contract of ci/build_release.sh without WSL/Git Bash:
#   pwsh ci/build_release.ps1                         # generic third-party host build
#   pwsh ci/build_release.ps1 -Yandex                 # inject Yandex Games SDK seam
#   $env:OUT_TS='20260428-yandex-1'; pwsh ci/build_release.ps1 -Yandex
#   pwsh ci/build_release.ps1 -NoZip                  # skip zip step
#   pwsh ci/build_release.ps1 -Help
#
# Environment variables honoured (same as bash):
#   OUT_TS    custom timestamp suffix (default: UTC yyyyMMdd-HHmmss)
#   OUT_ROOT  output root (default: <repo>/dist/release)
#
# Hard invariants (mirrored from build_release.sh / build_release.mjs):
#   * dist/release/staging/ is REFUSE-guarded — never used as target.
#   * No minify, no source maps, no bundler — copy-as-is.
#   * node is required to invoke ci/build_release.mjs.

[CmdletBinding()]
param(
    [switch]$Yandex,
    [switch]$NoZip,
    [Alias('h')][switch]$Help
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ($Help) {
    Get-Content -LiteralPath $PSCommandPath |
        Where-Object { $_ -like '# *' -or $_ -eq '#' } |
        ForEach-Object { $_ -replace '^# ?', '' }
    exit 0
}

$ScriptDir = Split-Path -Parent $PSCommandPath
$RootDir   = (Resolve-Path (Join-Path $ScriptDir '..')).Path

$OutRoot = if ($env:OUT_ROOT) { $env:OUT_ROOT } else { Join-Path $RootDir 'dist\release' }
$Ts      = if ($env:OUT_TS)   { $env:OUT_TS   } else { (Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss') }
$OutDir  = Join-Path $OutRoot $Ts

# REFUSE-guard: must never overwrite dist/release/staging/.
$NormalizedOut = ($OutDir -replace '\\', '/')
if ($NormalizedOut -match '/dist/release/staging(/|$)') {
    Write-Error 'REFUSE: dist/release/staging/ is the existing release mirror and must NOT be overwritten.'
    exit 3
}

# node is required to invoke ci/build_release.mjs.
$NodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $NodeCmd) {
    Write-Error 'ERROR: node is required to run ci/build_release.mjs.'
    exit 4
}

$ExtraArgs = @('--root', $RootDir, '--out', $OutDir)
if ($Yandex) { $ExtraArgs += '--yandex' }
# Cross-platform deterministic zip is now produced by ci/build_release.mjs itself
# (solo-pipeline-yandex-vk#1 / item 1). PowerShell Compress-Archive on Windows
# emitted ZIP entries with backslash separators, which Yandex Games CDN treated
# as flat filenames -> mass 404 on /src/**, /assets/**, /vendor/**. The Node
# writer always emits forward-slash entries per APPNOTE.TXT.
if ($NoZip) { $ExtraArgs += '--no-zip' }

Write-Host "[build_release] OUT_DIR=$OutDir"

$BuilderScript = Join-Path $RootDir 'ci\build_release.mjs'
& $NodeCmd.Source $BuilderScript @ExtraArgs
if ($LASTEXITCODE -ne 0) {
    Write-Error "[build_release] node ci/build_release.mjs exited with code $LASTEXITCODE"
    exit $LASTEXITCODE
}

Write-Host '[build_release] done.'
