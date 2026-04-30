<#
.SYNOPSIS
    Imports a single solution into the target environment using the populated
    deploymentSettings.json. Async with resumable status polling.

.DESCRIPTION
    NOTE: --activate-plugins is intentionally OMITTED so cloud flows remain OFF
    after import (per the requirement that all migrated resources must be in OFF
    state until manually activated).

    Idempotent: if the same solution unique name and version already exist, skip.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $TargetEnvUrl,
    [Parameter(Mandatory)][string] $SolutionZip,
    [Parameter(Mandatory)][string] $SettingsFile,
    [int] $MaxWaitMin = 60,
    [string] $AuthProfile = 'pp-target',
    [string] $SolutionUniqueName,
    [string] $StateDir
)

#Requires -Version 5.1
Set-StrictMode -Version 3.0
$ErrorActionPreference = 'Stop'
$PSDefaultParameterValues = @{
    'Out-File:Encoding'    = 'utf8'
    'Set-Content:Encoding' = 'utf8'
    'ConvertTo-Json:Depth' = 100
}

$libDir = Join-Path $PSScriptRoot 'lib'
Import-Module (Join-Path $libDir 'PPMigration.psm1') -Force
Import-Module (Join-Path $libDir 'State-Manager.psm1') -Force

if ($StateDir) { Initialize-PPState -StateDir $StateDir }

if (-not (Test-Path $SolutionZip))  { throw "Zip not found: $SolutionZip" }
if (-not (Test-Path $SettingsFile)) { throw "Settings not found: $SettingsFile" }

& pac auth select --name $AuthProfile | Out-Host

$args = @('solution','import',
          '--path', $SolutionZip,
          '--settings-file', $SettingsFile,
          '--async',
          '--max-async-wait-time', "$MaxWaitMin",
          '--publish-changes',
          '--skip-lower-version')
# NOTE: NO --activate-plugins, NO --activate-flows. Keep imported resources OFF.
Write-PPLog -Level Info -Message ("pac {0}" -f ($args -join ' '))
$out = & pac @args 2>&1
$exit = $LASTEXITCODE
$out | ForEach-Object { Write-Host $_ }
if ($exit -ne 0) {
    if ($SolutionUniqueName) { Write-PPFailure -Phase 'Apply' -Step 'Import' -Resource $SolutionUniqueName -Error "pac import exit $exit" }
    throw "pac solution import failed (exit $exit)"
}

if ($SolutionUniqueName) {
    Add-PPCompletedItem -Phase 'Apply' -Key 'imported' -Item $SolutionUniqueName
}
Write-PPLog -Level Info -Message "Import succeeded: $SolutionZip"
