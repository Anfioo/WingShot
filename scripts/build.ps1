$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$ortLibLocation = Join-Path $projectRoot "lib\onnxruntime\lib"
$defaultSigningPrivateKeyPath = Join-Path $projectRoot ".key\keys"

$env:ORT_LIB_LOCATION = $ortLibLocation
$env:LIB = "$ortLibLocation;$env:LIB"

if ([string]::IsNullOrWhiteSpace($env:TAURI_SIGNING_PRIVATE_KEY_PATH)) {
	$env:TAURI_SIGNING_PRIVATE_KEY_PATH = $defaultSigningPrivateKeyPath
}

if ([string]::IsNullOrWhiteSpace($env:TAURI_SIGNING_PRIVATE_KEY) -and (Test-Path $env:TAURI_SIGNING_PRIVATE_KEY_PATH -PathType Leaf)) {
	$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Raw $env:TAURI_SIGNING_PRIVATE_KEY_PATH
}

if ($null -eq $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
	$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
}

pnpm exec tauri build