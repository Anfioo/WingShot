[CmdletBinding()]
param(
	[string]$PrivateKeyPath,
	[string]$PublicKeyPath,
	[string]$UpdaterEndpoint = "https://github.com/Anfioo/WingShot/releases/latest/download/latest.json",
	[string]$CustomUpdaterEndpoint
)

$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$ortLibLocation = Join-Path $projectRoot "lib\onnxruntime\lib"
$defaultSigningPrivateKeyPath = Join-Path $projectRoot ".key\keys"
$defaultSigningPublicKeyPath = Join-Path $projectRoot ".key\keys.pub"

if ([string]::IsNullOrWhiteSpace($PrivateKeyPath)) {
	$PrivateKeyPath = if ([string]::IsNullOrWhiteSpace($env:TAURI_SIGNING_PRIVATE_KEY_PATH)) {
		$defaultSigningPrivateKeyPath
	} else {
		$env:TAURI_SIGNING_PRIVATE_KEY_PATH
	}
}
if ([string]::IsNullOrWhiteSpace($PublicKeyPath)) {
	$PublicKeyPath = if ([string]::IsNullOrWhiteSpace($env:TAURI_SIGNING_PUBLIC_KEY_PATH)) {
		$defaultSigningPublicKeyPath
	} else {
		$env:TAURI_SIGNING_PUBLIC_KEY_PATH
	}
}

$env:ORT_LIB_LOCATION = $ortLibLocation
$env:LIB = "$ortLibLocation;$env:LIB"

if (-not [Uri]::IsWellFormedUriString($UpdaterEndpoint, [UriKind]::Absolute)) {
	throw "UpdaterEndpoint must be an absolute URL: $UpdaterEndpoint"
}

function Read-SigningKey([string]$Path, [string]$Name) {
	if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
		throw "$Name file not found: $Path"
	}
	$value = (Get-Content -LiteralPath $Path -Raw).Trim()
	if ([string]::IsNullOrWhiteSpace($value)) {
		throw "$Name file is empty: $Path"
	}
	return $value
}

$privateKey = Read-SigningKey $PrivateKeyPath "Updater private key"
$publicKey = Read-SigningKey $PublicKeyPath "Updater public key"
$previousPrivateKey = $env:TAURI_SIGNING_PRIVATE_KEY
$previousPassword = $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD
$temporaryConfigPath = Join-Path ([IO.Path]::GetTempPath()) "wingshot-tauri-$PID-$([Guid]::NewGuid().ToString('N')).json"

$env:TAURI_SIGNING_PRIVATE_KEY = $privateKey

if ($null -eq $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
	$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
}

try {
	$endpoints = @($UpdaterEndpoint, $CustomUpdaterEndpoint) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
	$overlay = @{ plugins = @{ updater = @{ pubkey = $publicKey; endpoints = $endpoints } }; bundle = @{ createUpdaterArtifacts = $true } }
	$json = $overlay | ConvertTo-Json -Depth 6

	# ConvertTo-Json 会把「单元素数组」展开为标量（例如 endpoints 只有一个
	# URL 时输出 "endpoints": "https://..."），而 Tauri updater 插件要求
	# endpoints 是数组（sequence），反序列化失败会导致应用启动 panic。
	# 这里把展开后的标量修复回数组形式；已是数组（多元素）时不受影响。
	$json = [regex]::Replace($json, '"endpoints":\s*"(.*?)"', '"endpoints": ["$1"]')

	$json | Set-Content -LiteralPath $temporaryConfigPath -Encoding utf8
	& pnpm exec tauri build --config $temporaryConfigPath
	if ($LASTEXITCODE -ne 0) { throw "Tauri build failed with exit code $LASTEXITCODE" }
}
finally {
	if (Test-Path -LiteralPath $temporaryConfigPath) { Remove-Item -LiteralPath $temporaryConfigPath -Force }
	$env:TAURI_SIGNING_PRIVATE_KEY = $previousPrivateKey
	$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $previousPassword
}
