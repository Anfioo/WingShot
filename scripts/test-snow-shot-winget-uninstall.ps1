#Requires -Version 7.0
[CmdletBinding()]
param([string]$Winget = 'winget.exe')
$ErrorActionPreference = 'Stop'
if ($env:RUNNER_ENVIRONMENT -ne 'github-hosted' -or $env:RUNNER_OS -ne 'Windows') {
    throw 'Installer registration tests require a disposable GitHub-hosted Windows runner.'
}
$repo = Split-Path -Parent $PSScriptRoot
$root = Join-Path $repo "build/winget-quiet-uninstall-$([guid]::NewGuid().ToString('N'))"
$key = "SnowShotInstallerTest$([guid]::NewGuid().ToString('N'))"
$destination = Join-Path $root 'installed fixture'
cmake -S "$repo/snow_shot/tests/installer_packaging" -B $root -G Ninja "-DCPACK_PACKAGE_INSTALL_REGISTRY_KEY=$key"
if ($LASTEXITCODE -ne 0) { throw 'Quiet uninstall fixture configuration failed.' }
cpack --config "$root/CPackConfig.cmake" -G NSIS -B $root
if ($LASTEXITCODE -ne 0) { throw 'Quiet uninstall fixture packaging failed.' }
$installer = @(Get-ChildItem -LiteralPath $root -Filter '*.exe')[0].FullName
$setup = Start-Process -FilePath $installer -ArgumentList '/S', "/D=$destination" -WindowStyle Hidden -PassThru
if (-not $setup.WaitForExit(30000) -or $setup.ExitCode -ne 0) { throw 'Quiet uninstall fixture setup failed.' }
$registryPaths = @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\$key",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\$key"
)
$entries = @($registryPaths | Where-Object { Test-Path -LiteralPath $_ } | ForEach-Object { Get-ItemProperty -LiteralPath $_ })
if ($entries.Count -ne 1 -or $entries[0].QuietUninstallString -cne ($entries[0].UninstallString + ' /S')) {
    throw 'The generated installer did not register its quoted silent uninstall command.'
}
$sentinel = Join-Path $destination 'unowned-user-file.txt'
[IO.File]::WriteAllText($sentinel, 'preserve me')
& $Winget uninstall --product-code $key --silent --disable-interactivity --accept-source-agreements
if ($LASTEXITCODE -ne 0) { throw 'WinGet could not silently uninstall the generated fixture.' }
$payload = Join-Path $destination 'bin/snow_shot.exe'
$deadline = [DateTime]::UtcNow.AddSeconds(30)
while (((Test-Path -LiteralPath $payload) -or @($registryPaths | Where-Object { Test-Path -LiteralPath $_ }).Count) -and
    [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 100 }
if ((Test-Path -LiteralPath $payload) -or @($registryPaths | Where-Object { Test-Path -LiteralPath $_ }).Count -or
    [IO.File]::ReadAllText($sentinel) -cne 'preserve me') {
    throw 'Silent WinGet uninstall did not remove owned files/registration and preserve user files.'
}
Write-Output 'PASS: the generated CPack installer registers QuietUninstallString and WinGet removes it silently, preserving unowned files.'
