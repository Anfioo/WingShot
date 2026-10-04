<#
.SYNOPSIS
    Snow Shot development loop: pin the environment, build incrementally, restart the app.

.DESCRIPTION
    The project is hand-written Qt Widgets C++ with no hot reload, so the loop is
    edit -> rebuild -> restart. This script folds that into one command and pins
    everything the build and the runtime need:

      * WindowsSdkDir / WindowsSDKVersion - the SDK is installed outside the path
                                            that scripts/snow-build-environment.ps1
                                            probes by default
      * SNOW_QT_ROOT                      - the Qt 6.11.1 kit location
      * PATH += <Qt bin>                  - the official Qt kit is a dynamic build,
                                            so its DLLs are not staged next to
                                            WingShot.exe (missing Qt6Cored.dll)
      * HTTP_PROXY / HTTPS_PROXY          - the working proxy port is not stable

    Unlike scripts/build.ps1 this does NOT re-run bootstrap.ps1, which would fetch
    vcpkg, reinstall the Rust toolchain and run cargo metadata on every iteration.

.PARAMETER Preset
    Configure preset to build. Defaults to windows-msvc-debug.

.PARAMETER Target
    CMake target to build and launch. Defaults to snow_shot.

.PARAMETER NoBuild
    Skip the compile step and only restart the existing executable.

.EXAMPLE
    .\dev.ps1
    Rebuild snow_shot incrementally and restart it.

.EXAMPLE
    .\dev.ps1 -NoBuild
    Restart the current executable without compiling.

.NOTES
    The app is tray-resident: it starts with no main window.
#>
[CmdletBinding()]
param(
    [ValidateSet('windows-msvc-debug', 'windows-msvc-performance', 'snow-shot-msvc-release', 'snow-shot-msvc-fast')]
    [string]$Preset = 'windows-msvc-debug',

    [string]$Target = 'snow_shot',

    [string]$ExecutableName = 'WingShot',

    [switch]$NoBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'CMakePresets.json') -PathType Leaf)) {
    throw "dev.ps1 must live in the repository root (no CMakePresets.json in $repoRoot)."
}

# --- Environment -------------------------------------------------------------
# This machine installs the Windows SDK and Qt outside their default locations,
# so pin them before the shared environment helper probes for them. Keep these
# in sync with scripts/snow-build-environment.ps1.
$env:WindowsSdkDir = 'C:\Windows Kits\10\'
$env:WindowsSDKVersion = '10.0.26100.0'
$env:SNOW_QT_ROOT = 'C:\Envs\Qt'

# Reuse the canonical build environment so the compiler sees the same
# INCLUDE/LIB/SDK/Qt layout that scripts/build.ps1 establishes. Setting the SDK
# paths alone is not enough: without MSVC's INCLUDE/LIB variables, the vcpkg
# ffmpeg portfile runs cl.exe and link.exe bare and fails with C1034 (windows.h
# not found) / LNK1104 (MSVCRT.lib not found) during CMake's manifest install.
. (Join-Path $repoRoot 'scripts\snow-build-environment.ps1')
Set-SnowBuildEnvironment -Preset $Preset | Out-Null

# The system IE proxy is often a broken HTTPS proxy (Watt Toolkit), and Clash picks
# a different port on restart, so probe for a port that actually reaches GitHub.
if ([string]::IsNullOrWhiteSpace($env:HTTPS_PROXY) -and (Get-Command curl.exe -ErrorAction SilentlyContinue)) {
    foreach ($port in 7897, 7890, 7891) {
        $code = & curl.exe -x "http://127.0.0.1:$port" -s -o NUL -w "%{http_code}" `
            --max-time 5 https://github.com 2>$null
        if ($code -in @('200', '301', '302')) {
            $env:HTTP_PROXY = "http://127.0.0.1:$port"
            $env:HTTPS_PROXY = $env:HTTP_PROXY
            Write-Host "Using proxy $env:HTTPS_PROXY"
            break
        }
    }
}

# --- Paths -------------------------------------------------------------------
$buildDirectory = Join-Path $repoRoot "build\$Preset"
$configuration = switch ($Preset) {
    'windows-msvc-debug' { 'Debug' }
    default { 'Release' }
}
$executablePath = Join-Path $buildDirectory "$Target\$configuration\$ExecutableName.exe"

# --- Stop the previous instance ---------------------------------------------
# Tray applications keep running, and the linker cannot overwrite a loaded exe.
Get-Process -Name $ExecutableName -ErrorAction SilentlyContinue | ForEach-Object {
    $process = $_
    $processPath = $null
    try { $processPath = $process.Path } catch { return }
    if ([string]::IsNullOrWhiteSpace($processPath) -or
        -not $processPath.StartsWith($buildDirectory, [System.StringComparison]::OrdinalIgnoreCase)) {
        return
    }

    Write-Host "Stopping the running instance (PID $($process.Id))..."
    if (-not $process.CloseMainWindow() -or -not $process.WaitForExit(1500)) {
        $process.Refresh()
        if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force }
    }
}

# --- Build -------------------------------------------------------------------
if (-not $NoBuild) {
    $cachePath = Join-Path $buildDirectory 'CMakeCache.txt'
    if (-not (Test-Path -LiteralPath $cachePath -PathType Leaf)) {
        Write-Host "Preset $Preset is not configured yet; running scripts\build.ps1 once..."
        & (Join-Path $repoRoot 'scripts\build.ps1') -Preset $Preset -Target $Target
        if ($LASTEXITCODE -ne 0) { throw "Initial build failed with exit code $LASTEXITCODE." }
    }
    else {
        if (-not (Get-Command cmake -ErrorAction SilentlyContinue)) {
            throw "cmake was not found on PATH; install CMake 4.2+ or run scripts\build.ps1."
        }
        Write-Host "Incremental build: $Preset / $Target"
        & cmake --build --preset "build-$Preset" --target $Target --parallel
        if ($LASTEXITCODE -ne 0) { throw "Build failed with exit code $LASTEXITCODE." }
    }
}

# --- Launch ------------------------------------------------------------------
if (-not (Test-Path -LiteralPath $executablePath -PathType Leaf)) {
    throw "Executable not found: $executablePath"
}
Write-Host "Starting $executablePath (tray-resident: no main window on launch)."
Start-Process -FilePath $executablePath -WorkingDirectory (Split-Path -Parent $executablePath)
