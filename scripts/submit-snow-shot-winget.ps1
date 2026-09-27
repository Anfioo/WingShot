#Requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Tag,
    [Parameter(Mandatory)][string]$ManifestDirectory,
    [string]$WingetCreate = 'wingetcreate.exe'
)
. (Join-Path $PSScriptRoot 'snow-shot-winget.ps1')
Submit-SnowShotWingetManifest -Tag $Tag -ManifestDirectory $ManifestDirectory -WingetCreate $WingetCreate
