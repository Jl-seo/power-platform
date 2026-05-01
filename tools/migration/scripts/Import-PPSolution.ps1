<#
.SYNOPSIS
    Imports a solution into the target environment. Hybrid:
      - pac CLI present  -> `pac solution import --async --publish-changes --skip-lower-version`
      - pac CLI missing  -> ImportSolutionAsync REST (PublishWorkflows=false)

    Either way: NO --activate-plugins, NO PublishWorkflows. Cloud flows stay OFF.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $Config,
    [Parameter(Mandatory)][string] $SolutionZip,
    [Parameter(Mandatory)][string] $SettingsFile,
    [string] $SolutionUniqueName,
    [int] $MaxWaitMin = 60,
    [string] $AuthProfile = 'pp-target',
    [switch] $ForceRest
)

#Requires -Version 5.1
Set-StrictMode -Version 3.0
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ErrorActionPreference = 'Stop'
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
Import-Module (Join-Path $libDir 'State-Manager.psm1') -Force

$cfg = Read-PPConfig -Path $Config
Initialize-PPLogging -LogDir (Join-Path $cfg.outDir 'logs')
Initialize-PPSecrets -Config $cfg

if (-not (Test-Path $SolutionZip))  { throw "Zip not found: $SolutionZip" }
if (-not (Test-Path $SettingsFile)) { throw "Settings not found: $SettingsFile" }

$usePac = (-not $ForceRest) -and (Test-PPPacAvailable)
Write-PPLog -Level Info -Message ("Import mode: {0}" -f ($(if ($usePac) {'pac CLI'} else {'REST'})))

if ($usePac) {
    & pac auth select --name $AuthProfile | Out-Host
    $args = @('solution','import',
              '--path', $SolutionZip,
              '--settings-file', $SettingsFile,
              '--async',
              '--max-async-wait-time', "$MaxWaitMin",
              '--publish-changes',
              '--skip-lower-version')
    Write-PPLog -Level Info -Message ("pac {0}" -f ($args -join ' '))
    $out = & pac @args 2>&1
    $exit = $LASTEXITCODE
    $out | ForEach-Object { Write-Host $_ }
    if ($exit -ne 0) {
        if ($SolutionUniqueName) { Write-PPFailure -Phase 'Apply' -Step 'Import' -Resource $SolutionUniqueName -Error "pac import exit $exit" }
        throw "pac solution import failed (exit $exit)"
    }
} else {
    $secret = Get-PPSecret -Name $cfg.secrets.spnClientSecret
    $token = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId `
        -Resource $cfg.targetEnvUrl -ClientSecret $secret
    $jobId = Import-PPSolutionRest -EnvironmentUrl $cfg.targetEnvUrl -Token $token `
                -SolutionZipPath $SolutionZip -DeploymentSettingsPath $SettingsFile `
                -OverwriteUnmanagedCustomizations -TimeoutMin $MaxWaitMin
    Write-PPLog -Level Info -Message "REST import job: $jobId"
}

if ($SolutionUniqueName) {
    Add-PPCompletedItem -Phase 'Apply' -Key 'imported' -Item $SolutionUniqueName
}
Write-PPLog -Level Info -Message "Import succeeded: $SolutionZip"
