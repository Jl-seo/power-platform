<#
.SYNOPSIS
    Orchestrates per-owner Copilot Studio agent migration from the source
    (default) environment to each owner's personal Developer environment.

    Pipeline:
      1. Inventory bots in source (Get-PPCopilotInventory)
      2. Inventory developer envs in tenant (Get-PPDeveloperEnvironments)
      3. Resolve owner -> dev env (Resolve-PPOwnerToDevEnv)
      4. Per bot:
         a. Get dependencies
         b. Build per-target connection-bootstrap
         c. New per-owner solution in source + add components
         d. Disable owner notifications on target env
         e. Export the source solution (REST)
         f. Bootstrap target connections (New-PPConnections)
         g. Build id-map per target
         h. Unpack -> Repair GUIDs -> Pack -> Set deployment settings -> Import (REST)
         i. AI model rebind, post-import patch, OFF assert, knowledge files copy
         j. Update plan entry status
      5. Build report
      6. (Optional) Cleanup source temp solutions
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $Config,
    [ValidateSet('All','Inventory','Plan','Migrate','Report','Cleanup')]
    [string] $Phase = 'All',
    [string[]] $OnlyBots,
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
}
Add-Type -AssemblyName System.Web

$libDir = Join-Path $PSScriptRoot 'lib'
Import-Module (Join-Path $libDir 'PPMigration.psm1')      -Force
Import-Module (Join-Path $libDir 'PPThrottle.psm1')       -Force
Import-Module (Join-Path $libDir 'PPSecrets.psm1')        -Force
Import-Module (Join-Path $libDir 'PPAuth.psm1')           -Force
Import-Module (Join-Path $libDir 'PPSolution.psm1')       -Force
Import-Module (Join-Path $libDir 'PPSolutionPack.psm1')   -Force
Import-Module (Join-Path $libDir 'PPSolutionAuthor.psm1') -Force
Import-Module (Join-Path $libDir 'PPDataverseQuery.psm1') -Force
Import-Module (Join-Path $libDir 'State-Manager.psm1')    -Force

$cfg = Read-PPConfig -Path $Config
Initialize-PPLogging -LogDir (Join-Path $cfg.outDir 'logs')
Initialize-PPSecrets -Config $cfg
Initialize-PPState   -StateDir (Join-Path $cfg.outDir 'state')

$planPath = Join-Path $cfg.outDir 'inventory\migration-plan.json'

function Run-Step {
    param([string] $Name, [scriptblock] $Action)
    if ($DryRun) { Write-PPLog -Level Info -Message "[DryRun] $Name"; return }
    Write-PPLog -Level Info -Message ">>> $Name"
    & $Action
}

function Invoke-Inventory {
    Write-PPLog -Level Info -Message "===== Inventory ====="
    Run-Step 'Get-PPCopilotInventory'      { & (Join-Path $PSScriptRoot 'Get-PPCopilotInventory.ps1')      -Config $Config }
    Run-Step 'Get-PPDeveloperEnvironments' { & (Join-Path $PSScriptRoot 'Get-PPDeveloperEnvironments.ps1') -Config $Config }
}

function Invoke-Plan {
    Write-PPLog -Level Info -Message "===== Plan ====="
    Run-Step 'Resolve-PPOwnerToDevEnv' { & (Join-Path $PSScriptRoot 'Resolve-PPOwnerToDevEnv.ps1') -Config $Config }
}

function _Update-PlanEntry {
    param([string] $BotId, [hashtable] $Patch)
    $plan = Read-PPJson -Path $planPath -AsHashtable
    foreach ($e in $plan.entries) {
        if ($e.bot.id -eq $BotId) {
            foreach ($k in $Patch.Keys) { $e[$k] = $Patch[$k] }
            break
        }
    }
    Write-PPJson -InputObject $plan -Path $planPath
}

function Invoke-MigrateOne {
    param([hashtable] $Entry)
    $botId       = $Entry.bot.id
    $botSchema   = $Entry.bot.schemaname
    $ownerEmail  = $Entry.owner.email
    $tgtEnvId    = $Entry.target.envId
    $tgtEnvUrl   = $Entry.target.envUrl

    Write-PPLog -Level Info -Message ("===== Bot {0} ({1}) -> {2} =====" -f $botSchema, $ownerEmail, $tgtEnvUrl)

    $perBotDir = Join-Path $cfg.outDir ("per-bot\$botId")
    if (-not (Test-Path $perBotDir)) { New-Item -ItemType Directory -Path $perBotDir -Force | Out-Null }

    $started = (Get-Date).ToUniversalTime().ToString('o')
    _Update-PlanEntry -BotId $botId -Patch @{ status = 'in-progress'; startedUtc = $started; errorMessage = $null }

    try {
        # a. deps
        Run-Step "Deps[$botSchema]" { & (Join-Path $PSScriptRoot 'Get-PPCopilotDependencies.ps1') -Config $Config -BotId $botId }

        # b. connection bootstrap (per target)
        Run-Step "Bootstrap-Plan[$botSchema]" { & (Join-Path $PSScriptRoot 'Build-PPConnectionBootstrap.ps1') -Config $Config -BotId $botId -TargetEnvId $tgtEnvId }

        # c. per-owner solution in SOURCE
        $slnUnique = $null
        Run-Step "NewSolution[$botSchema]" {
            $slnUnique = & (Join-Path $PSScriptRoot 'New-PPPerOwnerSolution.ps1') -Config $Config `
                -BotId $botId -OwnerEmail $ownerEmail -BotSchemaName $botSchema | Select-Object -Last 1
            _Update-PlanEntry -BotId $botId -Patch @{ solutionUniqueName = $slnUnique }
        }
        $meta = Read-PPJson -Path (Join-Path $perBotDir 'solution.meta.json') -AsHashtable
        $slnUnique = $meta.solutionUniqueName

        # d. notifications OFF (target side; idempotent)
        Run-Step "DisableNotifs[$tgtEnvId]" {
            & (Join-Path $PSScriptRoot 'Disable-PPOwnerNotifications.ps1') -Config $Config -EnvironmentUrls @($tgtEnvUrl)
        }

        # e. export source solution via REST
        $secret = Get-PPSecret -Name $cfg.secrets.spnClientSecret
        $srcTok = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId -Resource $cfg.sourceEnvUrl -ClientSecret $secret
        $zipPath = Join-Path $perBotDir ("$slnUnique.zip")
        Run-Step "Export[$slnUnique]" {
            Export-PPSolutionRest -EnvironmentUrl $cfg.sourceEnvUrl -Token $srcTok `
                -SolutionName $slnUnique -OutZipPath $zipPath -TimeoutMin 30 | Out-Null
        }

        # seed deployment settings
        $seedPath = Join-Path $perBotDir 'deploymentSettings.seed.json'
        Run-Step "SeedSettings[$slnUnique]" {
            New-PPDeploymentSettingsSeed -SolutionZipPath $zipPath -OutFile $seedPath
        }

        # f. bootstrap target connections — overlay config to point at this bot's bootstrap file + tgt env
        $overlayCfg = $Config + '.overlay-' + $botId + '.psd1'
        $overlayContent = @"
@{
    sourceEnvUrl   = '$($cfg.sourceEnvUrl -replace "'", "''")'
    sourceEnvId    = '$($cfg.sourceEnvId)'
    targetEnvUrl   = '$($tgtEnvUrl -replace "'", "''")'
    targetEnvId    = '$tgtEnvId'
    tenantId       = '$($cfg.tenantId)'
    spnAppId       = '$($cfg.spnAppId)'
    secretBackend  = '$($cfg.secretBackend)'
    secretPrefix   = '$($cfg.secretPrefix)'
    secrets        = @{ spnClientSecret = '$($cfg.secrets.spnClientSecret)' }
    solutions      = @('$slnUnique')
    outDir         = '$($cfg.outDir -replace "'", "''")'
}
"@
        Set-Content -Path $overlayCfg -Value $overlayContent -Encoding utf8
        $bootstrapFile = Join-Path $perBotDir "$tgtEnvId.connection-bootstrap.json"
        Run-Step "Bootstrap[$tgtEnvId]" {
            & (Join-Path $PSScriptRoot 'New-PPConnections.ps1') -Config $overlayCfg -BootstrapFile $bootstrapFile
        }

        # g. build id map (target side)
        Run-Step "TargetInventory[$tgtEnvId]" { & (Join-Path $PSScriptRoot 'Build-TargetIdInventory.ps1') -Config $overlayCfg }
        Run-Step "IdMap[$tgtEnvId]"           { & (Join-Path $PSScriptRoot 'Build-IdMap.ps1')             -Config $overlayCfg }

        # h. unpack -> repair -> pack -> populate -> import
        $repairDir = Join-Path $perBotDir 'repair'
        if (Test-Path $repairDir) { Remove-Item -LiteralPath $repairDir -Recurse -Force }
        $repairedZip = Join-Path $perBotDir "$slnUnique.repaired.zip"
        $populated   = Join-Path $perBotDir "$slnUnique.deploymentSettings.json"
        $idMapPath   = Join-Path $cfg.outDir 'target\id-map.json'

        Run-Step "Unpack[$slnUnique]"  { Expand-PPSolutionZip -ZipPath $zipPath -DestDir $repairDir }
        Run-Step "RepairGuids[$slnUnique]" { & (Join-Path $PSScriptRoot 'Repair-PPSolutionGuids.ps1') -Folder $repairDir -IdMap $idMapPath }
        Run-Step "Pack[$slnUnique]"    { Compress-PPSolutionFolder -FolderPath $repairDir -OutZipPath $repairedZip }
        Run-Step "Settings[$slnUnique]" {
            & (Join-Path $PSScriptRoot 'Set-DeploymentSettings.ps1') -SeedFile $seedPath -ConnectionMap (Join-Path $cfg.outDir 'target\connection-map.json') -OutFile $populated
        }
        $importJobId = $null
        Run-Step "Import[$slnUnique]" {
            & (Join-Path $PSScriptRoot 'Import-PPSolution.ps1') -Config $overlayCfg `
                -SolutionZip $repairedZip -SettingsFile $populated -SolutionUniqueName $slnUnique
        }

        # i. post-import: AI rebind, ref patch, OFF assert, knowledge files
        Run-Step "AIBind[$slnUnique]" { & (Join-Path $PSScriptRoot 'Set-AIBuilderModelBinding.ps1') -Config $overlayCfg }
        Run-Step "Patch[$slnUnique]"  { & (Join-Path $PSScriptRoot 'Patch-PostImportReferences.ps1') -Config $overlayCfg }
        Run-Step "AssertOff[$slnUnique]" { & (Join-Path $PSScriptRoot 'Assert-PPResourcesOff.ps1') -Config $overlayCfg -SolutionUniqueNames @($slnUnique) }
        Run-Step "KnowledgeFiles[$botId]" { & (Join-Path $PSScriptRoot 'Copy-PPKnowledgeFiles.ps1') -Config $Config -BotId $botId -TargetEnvUrl $tgtEnvUrl -IdMapPath $idMapPath }

        $completed = (Get-Date).ToUniversalTime().ToString('o')
        _Update-PlanEntry -BotId $botId -Patch @{ status = 'success'; completedUtc = $completed; importJobId = $importJobId }
        Add-PPCompletedItem -Phase 'Migrate' -Key 'success' -Item $botId
        Write-PPLog -Level Info -Message ("=== {0}: SUCCESS ===" -f $botSchema)
    }
    catch {
        $msg = $_.Exception.Message
        Write-PPLog -Level Error -Message ("=== {0}: FAIL ({1}) ===" -f $botSchema, $msg)
        Write-PPFailure -Phase 'Migrate' -Step 'PerBot' -Resource $botSchema -Error $msg
        _Update-PlanEntry -BotId $botId -Patch @{ status = 'fail'; errorMessage = $msg; completedUtc = (Get-Date).ToUniversalTime().ToString('o') }
    }
}

function Invoke-Migrate {
    Write-PPLog -Level Info -Message "===== Migrate ====="
    if (-not (Test-Path $planPath)) { throw "migration-plan.json not found; run -Phase Plan first" }
    $plan = Read-PPJson -Path $planPath -AsHashtable

    foreach ($entry in $plan.entries) {
        if ($entry.status -in @('success','fail') -and -not $Resume) { continue }
        if ($entry.status -eq 'success') { continue }
        if ($entry.status -eq 'skip-no-env') { continue }
        if ($OnlyBots -and ($OnlyBots -notcontains $entry.bot.id)) { continue }
        if ($entry.status -eq 'fail' -and $Resume) { } # retry on resume
        Invoke-MigrateOne -Entry $entry
    }
}

function Invoke-Report {
    Write-PPLog -Level Info -Message "===== Report ====="
    Run-Step 'Build-PPMigrationReport' { & (Join-Path $PSScriptRoot 'Build-PPMigrationReport.ps1') -Config $Config }
}

function Invoke-Cleanup {
    if (-not ($cfg.ContainsKey('cleanupSourceSolutions') -and $cfg.cleanupSourceSolutions)) {
        Write-PPLog -Level Info -Message "cleanupSourceSolutions = false (skip)"
        return
    }
    Write-PPLog -Level Info -Message "===== Cleanup (source temp solutions) ====="
    $secret = Get-PPSecret -Name $cfg.secrets.spnClientSecret
    $srcTok = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId -Resource $cfg.sourceEnvUrl -ClientSecret $secret
    $plan = Read-PPJson -Path $planPath -AsHashtable
    foreach ($e in $plan.entries) {
        if ($e.status -eq 'success' -and $e.solutionUniqueName) {
            try {
                Remove-PPSolution -EnvironmentUrl $cfg.sourceEnvUrl -Token $srcTok -UniqueName $e.solutionUniqueName -Confirm:$false
            } catch {
                Write-PPLog -Level Warn -Message ("Cleanup failed for {0}: {1}" -f $e.solutionUniqueName, $_.Exception.Message)
            }
        }
    }
}

switch ($Phase) {
    'Inventory' { Invoke-Inventory }
    'Plan'      { Invoke-Plan }
    'Migrate'   { Invoke-Migrate }
    'Report'    { Invoke-Report }
    'Cleanup'   { Invoke-Cleanup }
    'All' {
        Invoke-Inventory
        Invoke-Plan
        Invoke-Migrate
        Invoke-Report
        # Cleanup is opt-in only; not part of All
    }
}

Write-PPLog -Level Info -Message "Run complete."
