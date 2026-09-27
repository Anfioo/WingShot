#Requires -Version 7.0
# Read-only preflight. Never print or pass the submission token on a command line.
$ErrorActionPreference = 'Stop'
if (-not $env:WINGET_CREATE_GITHUB_TOKEN) { throw 'WINGET_CREATE_GITHUB_TOKEN is not configured.' }
$headers = @{
    Authorization = "Bearer $env:WINGET_CREATE_GITHUB_TOKEN"
    Accept = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2022-11-28'
}
$response = Invoke-WebRequest -Uri 'https://api.github.com/user' -Headers $headers
$account = $response.Content | ConvertFrom-Json
$scopes = ($response.Headers['X-OAuth-Scopes'] -join ',') -split ',\s*'
if ('public_repo' -notin $scopes -and 'repo' -notin $scopes) {
    throw 'WinGetCreate requires a classic token with public_repo scope.'
}
$fork = Invoke-RestMethod -Uri "https://api.github.com/repos/$($account.login)/winget-pkgs" -Headers $headers
if (-not $fork.fork -or $fork.parent.full_name -cne 'microsoft/winget-pkgs' -or -not $fork.permissions.push) {
    throw 'The submission account needs a writable fork of microsoft/winget-pkgs named winget-pkgs.'
}
Write-Output "PASS: submission token authenticates as $($account.login), has repository scope, and can write to $($fork.full_name). No submission performed."
