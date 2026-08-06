$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$ortLibLocation = Join-Path $projectRoot "lib\onnxruntime\lib"

$env:ORT_LIB_LOCATION = $ortLibLocation
$env:LIB = "$ortLibLocation;$env:LIB"

$temporaryConfigPath = Join-Path ([IO.Path]::GetTempPath()) "wingshot-tauri-dev-$PID-$([Guid]::NewGuid().ToString('N')).json"

try {
	# The checked-in platform configs use build-time updater placeholders. Keep
	# the updater plugin valid but inactive while running the development app.
	@{
		plugins = @{
			updater = @{
				pubkey = "__TAURI_UPDATER_PUBKEY__"
				endpoints = @()
			}
		}
	} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $temporaryConfigPath -Encoding utf8

	& pnpm exec tauri dev --config $temporaryConfigPath
	if ($LASTEXITCODE -ne 0) {
		throw "Tauri dev failed with exit code $LASTEXITCODE"
	}
}
finally {
	if (Test-Path -LiteralPath $temporaryConfigPath) {
		Remove-Item -LiteralPath $temporaryConfigPath -Force
	}
}
