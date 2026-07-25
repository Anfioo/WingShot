$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$ortLibLocation = Join-Path $projectRoot "lib\onnxruntime\lib"

$env:ORT_LIB_LOCATION = $ortLibLocation
$env:LIB = "$ortLibLocation;$env:LIB"

pnpm exec tauri dev