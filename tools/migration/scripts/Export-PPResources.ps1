<#
.SYNOPSIS
    Phase 1 (PreFlight). Hybrid mode:
      - if pac CLI is available, uses `pac solution export` + `pac solution create-settings`
      - if pac is not installed, uses Dataverse Web API (ExportSolutionAsync)
        and a pure-PowerShell create-settings replacement.
    Then runs Build-SourceIdInventory.ps1.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $Config,
    [string[]] $OnlySolutions,
    [switch] $ForceRest
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
Import-Module (Join-Path $libDir 'PPMigration.psm1')   -Force
Import-Module (Join-Path $libDir 'PPThrottle.psm1')    -Force
Import-Module (Join-Path $libDir 'PPSecrets.psm1')     -Force
Import-Module (Join-Path $libDir 'PPAuth.psm1')        -Force
Import-Module (Join-Path $libDir 'PPSolution.psm1')    -Force
Import-Module (Join-Path $libDir 'PPSolutionPack.psm1') -Force
Import-Module (Join-Path $libDir 'State-Manager.psm1') -Force

$cfg = Read-PPConfig -Path $Config
Initialize-PPLogging -LogDir (Join-Path $cfg.outDir 'logs')
Initialize-PPSecrets -Config $cfg
Initialize-PPState   -StateDir (Join-Path $cfg.outDir 'state')

$sourceDir = Join-Path $cfg.outDir 'source'
if (-not (Test-Path $sourceDir)) { New-Item -ItemType Directory -Path $sourceDir -Force | Out-Null }

$usePac = (-not $ForceRest) -and (Test-PPPacAvailable)
Write-PPLog -Level Info -Message ("Mode: {0}" -f ($(if ($usePac) {'pac CLI'} else {'REST (Web API)'})))

if ($usePac) {
    $authProfile = 'pp-source'
    $authList = & pac auth list 2>&1
    if ($authList -notmatch [Regex]::Escape($authProfile)) {
        Write-PPLog -Level Info -Message "Creating pac auth profile $authProfile (device code)"
        & pac auth create --name $authProfile --url $cfg.sourceEnvUrl --deviceCode | Out-Host
    }
    & pac auth select --name $authProfile | Out-Host
} else {
    # No pac: use SPN token directly against the Dataverse Web API
    $secret = Get-PPSecret -Name $cfg.secrets.spnClientSecret
    $sourceToken = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId `
        -Resource $cfg.sourceEnvUrl -ClientSecret $secret
}

$solutions = $cfg.solutions
if ($OnlySolutions) { $solutions = @($solutions | Where-Object { $OnlySolutions -contains $_ }) }
if (-not $solutions) { throw "No solutions to export" }

foreach ($sln in $solutions) {
    Write-PPLog -Level Info -Message "Exporting solution: $sln"
    $zipPath  = Join-Path $sourceDir ("{0}_unmanaged.zip" -f $sln)
    $seedPath = Join-Path $sourceDir ("{0}.deploymentSettings.seed.json" -f $sln)

    if ($usePac) {
        $args = @('solution','export','--name',$sln,'--path',$zipPath,'--overwrite','--async','--max-async-wait-time','60')
        & pac @args
        if ($LASTEXITCODE -ne 0) {
            Write-PPFailure -Phase 'PreFlight' -Step 'Export' -Resource $sln -Error "pac solution export exit $LASTEXITCODE"
            throw "pac solution export failed for $sln"
        }
        & pac solution create-settings --solution-zip $zipPath --settings-file $seedPath
        if ($LASTEXITCODE -ne 0) {
            Write-PPLog -Level Warn -Message "pac solution create-settings failed for $sln; falling back to REST seed"
            New-PPDeploymentSettingsSeed -SolutionZipPath $zipPath -OutFile $seedPath
        }
    }
    else {
        Export-PPSolutionRest -EnvironmentUrl $cfg.sourceEnvUrl -Token $sourceToken `
            -SolutionName $sln -OutZipPath $zipPath -TimeoutMin 60 | Out-Null
        New-PPDeploymentSettingsSeed -SolutionZipPath $zipPath -OutFile $seedPath
    }
    Add-PPCompletedItem -Phase 'PreFlight' -Key 'exported' -Item $sln
}

$inventoryScript = Join-Path $PSScriptRoot 'Build-SourceIdInventory.ps1'
& $inventoryScript -Config $Config

Set-PPStateField -Phase 'PreFlight' -Key 'completedUtc' -Value ((Get-Date).ToUniversalTime().ToString('o'))
Write-PPLog -Level Info -Message "Export-PPResources complete"
