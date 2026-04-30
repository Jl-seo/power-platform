<#
.SYNOPSIS
    Phase 1 (PreFlight): exports source-environment solutions and builds the
    deployment-settings seed plus a source-id inventory used by GUID repair.

.DESCRIPTION
    For each solution listed in config.solutions:
      - pac solution export (Unmanaged ONLY) with --async
      - pac solution create-settings to produce a seed deploymentSettings.json
    Then calls Build-SourceIdInventory.ps1 to capture connection refs, env vars,
    workflows, msdyn_ai* rows, botcomponents, and any URLs found in topic YAML.

.PARAMETER Config
    Path to config.psd1.
.PARAMETER OnlySolutions
    Optional filter; export only the named solutions.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $Config,
    [string[]] $OnlySolutions
)

#Requires -Version 5.1
Set-StrictMode -Version 3.0
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ErrorActionPreference = 'Stop'
$ProgressPreference   = 'SilentlyContinue'
$PSDefaultParameterValues = @{
    'Out-File:Encoding'                 = 'utf8'
    'Set-Content:Encoding'              = 'utf8'
    'ConvertTo-Json:Depth'              = 100
    'Invoke-RestMethod:UseBasicParsing' = $true
    'Invoke-WebRequest:UseBasicParsing' = $true
}
Add-Type -AssemblyName System.Web

$libDir = Join-Path $PSScriptRoot 'lib'
Import-Module (Join-Path $libDir 'PPMigration.psm1') -Force
Import-Module (Join-Path $libDir 'State-Manager.psm1') -Force

$cfg = Read-PPConfig -Path $Config
Initialize-PPLogging -LogDir (Join-Path $cfg.outDir 'logs')
Initialize-PPState -StateDir (Join-Path $cfg.outDir 'state')

$sourceDir = Join-Path $cfg.outDir 'source'
if (-not (Test-Path $sourceDir)) { New-Item -ItemType Directory -Path $sourceDir -Force | Out-Null }

# Authenticate to source via pac CLI device code (one-time)
$authProfile = 'pp-source'
Write-PPLog -Level Info -Message "Selecting pac auth profile $authProfile (create with: pac auth create -n $authProfile --url $($cfg.sourceEnvUrl) --deviceCode)"
$authList = & pac auth list 2>&1
if ($authList -notmatch [Regex]::Escape($authProfile)) {
    Write-PPLog -Level Info -Message "Creating pac auth profile $authProfile"
    & pac auth create --name $authProfile --url $cfg.sourceEnvUrl --deviceCode | Out-Host
}
& pac auth select --name $authProfile | Out-Host

$solutions = $cfg.solutions
if ($OnlySolutions) { $solutions = @($solutions | Where-Object { $OnlySolutions -contains $_ }) }
if (-not $solutions) { throw "No solutions to export" }

foreach ($sln in $solutions) {
    Write-PPLog -Level Info -Message "Exporting solution: $sln"
    $zipPath = Join-Path $sourceDir ("{0}_unmanaged.zip" -f $sln)
    $seedPath = Join-Path $sourceDir ("{0}.deploymentSettings.seed.json" -f $sln)

    $args = @('solution','export',
              '--name', $sln,
              '--path', $zipPath,
              '--overwrite',
              '--async',
              '--max-async-wait-time', '60')
    Write-PPLog -Level Debug -Message ("pac {0}" -f ($args -join ' '))
    & pac @args
    if ($LASTEXITCODE -ne 0) {
        Write-PPFailure -Phase 'PreFlight' -Step 'Export' -Resource $sln -Error "pac solution export exit $LASTEXITCODE"
        throw "pac solution export failed for $sln"
    }
    Add-PPCompletedItem -Phase 'PreFlight' -Key 'exported' -Item $sln

    # Generate seed deployment settings
    & pac solution create-settings --solution-zip $zipPath --settings-file $seedPath
    if ($LASTEXITCODE -ne 0) {
        Write-PPLog -Level Warn -Message "pac solution create-settings failed for $sln (exit $LASTEXITCODE) — continuing"
    } else {
        Write-PPLog -Level Info -Message "Seed settings written: $seedPath"
    }
}

# Build the source ID inventory in a separate step
$inventoryScript = Join-Path $PSScriptRoot 'Build-SourceIdInventory.ps1'
& $inventoryScript -Config $Config

Set-PPStateField -Phase 'PreFlight' -Key 'completedUtc' -Value ((Get-Date).ToUniversalTime().ToString('o'))
Write-PPLog -Level Info -Message "Export-PPResources complete"
