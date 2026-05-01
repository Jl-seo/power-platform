#Requires -Version 5.1
<#
.SYNOPSIS
    Prepends vendor\modules to PSModulePath and vendor\pac to PATH for the
    current session, so the toolkit runs without internet access.

.DESCRIPTION
    Auto-invoked by Invoke-FullMigration.ps1 if the vendor folder is present.
    Safe to dot-source manually:

        . .\vendor\Initialize-OfflineEnv.ps1
#>
[CmdletBinding()]
param(
    [string] $VendorDir = $PSScriptRoot
)

$modulesDir = Join-Path $VendorDir 'modules'
$pacDir     = Join-Path $VendorDir 'pac'

if (Test-Path $modulesDir) {
    $sep = [IO.Path]::PathSeparator
    if (-not (($env:PSModulePath -split [Regex]::Escape($sep)) -contains $modulesDir)) {
        $env:PSModulePath = "$modulesDir$sep$env:PSModulePath"
        Write-Host "[offline] PSModulePath += $modulesDir" -ForegroundColor DarkGray
    }
}

if (Test-Path (Join-Path $pacDir 'pac.exe')) {
    if (-not (($env:PATH -split ';') -contains $pacDir)) {
        $env:PATH = "$pacDir;$env:PATH"
        Write-Host "[offline] PATH += $pacDir" -ForegroundColor DarkGray
    }
}

# Quick sanity probes
$probes = @{
    'pac.exe'                                          = (Get-Command pac -ErrorAction SilentlyContinue)
    'CredentialManager'                                = (Get-Module -ListAvailable -Name CredentialManager)
    'MSAL.PS'                                          = (Get-Module -ListAvailable -Name MSAL.PS)
    'Microsoft.PowerApps.Administration.PowerShell'    = (Get-Module -ListAvailable -Name 'Microsoft.PowerApps.Administration.PowerShell')
    'Microsoft.Graph.Applications'                     = (Get-Module -ListAvailable -Name 'Microsoft.Graph.Applications')
}
foreach ($k in $probes.Keys) {
    $present = if ($probes[$k]) { 'OK' } else { 'MISSING' }
    Write-Host ("[offline] {0,-50} : {1}" -f $k, $present) -ForegroundColor DarkGray
}
