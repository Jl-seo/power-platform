<#
.SYNOPSIS
    Orchestrates the full migration. Drives Phase 0..4 with checkpointing,
    resume support, and per-phase / per-solution filters.

.PARAMETER Config
    Path to config.psd1.
.PARAMETER Phase
    All | Notifications | PreFlight | Bootstrap | Apply | PostFlight | Restore
.PARAMETER OnlySolutions
    Limit Apply to these solutions.
.PARAMETER Resume
    Resume from state.json checkpoint.
.PARAMETER DryRun
    Print intended commands without executing pac/Web API calls (best-effort).
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $Config,
    [ValidateSet('All','Notifications','PreFlight','Bootstrap','Apply','PostFlight','Restore')]
    [string] $Phase = 'All',
    [string[]] $OnlySolutions,
    [switch] $Resume,
    [switch] $DryRun
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

# Auto-load vendored modules + pac CLI if a vendor folder is present (offline / air-gapped support).
$vendorInit = Join-Path $PSScriptRoot '..\vendor\Initialize-OfflineEnv.ps1'
if (Test-Path $vendorInit) { . $vendorInit }

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

$state = Get-PPState
Write-PPLog -Level Info -Message ("Run started. Phase={0} Resume={1} DryRun={2}" -f $Phase, $Resume.IsPresent, $DryRun.IsPresent)

function Run-Step {
    param([string] $Name, [scriptblock] $Action)
    if ($DryRun) { Write-PPLog -Level Info -Message "[DryRun] $Name"; return }
    try { & $Action } catch {
        Write-PPFailure -Phase ($Phase) -Step $Name -Resource '' -Error $_.Exception.Message
        throw
    }
}

function Phase-Notifications {
    Write-PPLog -Level Info -Message "===== Phase 0: Notifications ====="
    Run-Step 'Disable-PPOwnerNotifications' { & (Join-Path $PSScriptRoot 'Disable-PPOwnerNotifications.ps1') -Config $Config }
}

function Phase-PreFlight {
    Write-PPLog -Level Info -Message "===== Phase 1: PreFlight ====="
    $params = @{ Config = $Config }
    if ($OnlySolutions) { $params.OnlySolutions = $OnlySolutions }
    Run-Step 'Export-PPResources' { & (Join-Path $PSScriptRoot 'Export-PPResources.ps1') @params }
}

function Phase-Bootstrap {
    Write-PPLog -Level Info -Message "===== Phase 2: Bootstrap ====="
    Run-Step 'New-PPConnections' { & (Join-Path $PSScriptRoot 'New-PPConnections.ps1') -Config $Config }
}

function Phase-Apply {
    Write-PPLog -Level Info -Message "===== Phase 3: Apply ====="
    Run-Step 'Build-TargetIdInventory' { & (Join-Path $PSScriptRoot 'Build-TargetIdInventory.ps1') -Config $Config }
    Run-Step 'Build-IdMap'             { & (Join-Path $PSScriptRoot 'Build-IdMap.ps1')             -Config $Config }

    $solutions = $cfg.solutions
    if ($OnlySolutions) { $solutions = @($solutions | Where-Object { $OnlySolutions -contains $_ }) }

    foreach ($sln in $solutions) {
        Write-PPLog -Level Info -Message "----- Apply: $sln -----"
        $sourceZip = Join-Path $cfg.outDir ("source\{0}_unmanaged.zip" -f $sln)
        $repairFolder = Join-Path $cfg.outDir ("target\repair\{0}" -f $sln)
        $repairedZip = Join-Path $cfg.outDir ("target\{0}_unmanaged_repaired.zip" -f $sln)
        $seed = Join-Path $cfg.outDir ("source\{0}.deploymentSettings.seed.json" -f $sln)
        $cm   = Join-Path $cfg.outDir 'target\connection-map.json'
        $ev   = Join-Path $cfg.outDir 'target\env-var-values.json'   # optional, operator provides
        $populated = Join-Path $cfg.outDir ("target\{0}.deploymentSettings.json" -f $sln)
        $idMap = Join-Path $cfg.outDir 'target\id-map.json'

        if (Test-Path $repairFolder) { Remove-Item -LiteralPath $repairFolder -Recurse -Force }
        New-Item -ItemType Directory -Path $repairFolder -Force | Out-Null

        Run-Step "Unpack:$sln" {
            if (Test-PPPacAvailable) {
                & pac solution unpack --zipfile $sourceZip --folder $repairFolder --packagetype Unmanaged | Out-Host
                if ($LASTEXITCODE -ne 0) { throw "pac solution unpack failed for $sln" }
            } else {
                Expand-PPSolutionZip -ZipPath $sourceZip -DestDir $repairFolder
            }
        }
        Run-Step "RepairGuids:$sln" {
            $params = @{ Folder = $repairFolder; IdMap = $idMap }
            & (Join-Path $PSScriptRoot 'Repair-PPSolutionGuids.ps1') @params
        }
        Run-Step "Pack:$sln" {
            if (Test-PPPacAvailable) {
                & pac solution pack --zipfile $repairedZip --folder $repairFolder --packagetype Unmanaged | Out-Host
                if ($LASTEXITCODE -ne 0) { throw "pac solution pack failed for $sln" }
            } else {
                Compress-PPSolutionFolder -FolderPath $repairFolder -OutZipPath $repairedZip
            }
        }
        Run-Step "Settings:$sln" {
            $sParams = @{ SeedFile = $seed; ConnectionMap = $cm; OutFile = $populated }
            if (Test-Path $ev) { $sParams.EnvVarFile = $ev }
            & (Join-Path $PSScriptRoot 'Set-DeploymentSettings.ps1') @sParams
        }
        Run-Step "Import:$sln" {
            & (Join-Path $PSScriptRoot 'Import-PPSolution.ps1') `
                -Config $Config `
                -SolutionZip $repairedZip `
                -SettingsFile $populated `
                -SolutionUniqueName $sln
        }
    }

    Run-Step 'Set-AIBuilderModelBinding' { & (Join-Path $PSScriptRoot 'Set-AIBuilderModelBinding.ps1') -Config $Config }
}

function Phase-PostFlight {
    Write-PPLog -Level Info -Message "===== Phase 4: PostFlight ====="
    Run-Step 'Patch-PostImportReferences' { & (Join-Path $PSScriptRoot 'Patch-PostImportReferences.ps1') -Config $Config }
    Run-Step 'Assert-PPResourcesOff'      { & (Join-Path $PSScriptRoot 'Assert-PPResourcesOff.ps1')      -Config $Config }
    Run-Step 'Test-PPMigration'           { & (Join-Path $PSScriptRoot 'Test-PPMigration.ps1')           -Config $Config }
}

function Phase-Restore {
    Write-PPLog -Level Info -Message "===== Restore ====="
    Run-Step 'Restore-PPOwnerNotifications' { & (Join-Path $PSScriptRoot 'Restore-PPOwnerNotifications.ps1') -Config $Config }
}

switch ($Phase) {
    'Notifications' { Phase-Notifications }
    'PreFlight'     { Phase-PreFlight }
    'Bootstrap'     { Phase-Bootstrap }
    'Apply'         { Phase-Apply }
    'PostFlight'    { Phase-PostFlight }
    'Restore'       { Phase-Restore }
    'All' {
        Phase-Notifications
        Phase-PreFlight
        Phase-Bootstrap
        Phase-Apply
        Phase-PostFlight
        # 'Restore' is intentionally NOT part of All — operator decides when to re-enable notifications
    }
}

Write-PPLog -Level Info -Message "Run complete."
