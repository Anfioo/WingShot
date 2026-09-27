#Requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Tag,
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '../build/winget')
)
. (Join-Path $PSScriptRoot 'snow-shot-winget.ps1')
New-SnowShotWingetManifest -Tag $Tag -OutputDirectory $OutputDirectory
