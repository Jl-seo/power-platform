<#
.SYNOPSIS
    Joins the bot inventory with the developer-env inventory by AAD ObjectId
    (fallback: email) and produces the migration plan.

    Output: out/inventory/migration-plan.json
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $Config
)

#Requires -Version 5.1
Set-StrictMode -Version 3.0
$ErrorActionPreference = 'Stop'
$PSDefaultParameterValues = @{
    'Out-File:Encoding'        = 'utf8'
    'Set-Content:Encoding'     = 'utf8'
    'ConvertTo-Json:Depth'     = 100
}

$libDir = Join-Path $PSScriptRoot 'lib'
Import-Module (Join-Path $libDir 'PPMigration.psm1') -Force

$cfg = Read-PPConfig -Path $Config
Initialize-PPLogging -LogDir (Join-Path $cfg.outDir 'logs')

$invDir = Join-Path $cfg.outDir 'inventory'
$bots    = (Read-PPJson -Path (Join-Path $invDir 'bots.json')      -AsHashtable).bots
$devEnvs = (Read-PPJson -Path (Join-Path $invDir 'dev-envs.json')  -AsHashtable).developerEnvs

# Index dev envs by ownerObjectId (lowercase) and email
$envByObj   = @{}
$envByEmail = @{}
foreach ($e in $devEnvs) {
    if ($e.ownerObjectId) { $envByObj[$e.ownerObjectId.ToLower()]   = $e }
    if ($e.ownerEmail)    { $envByEmail[$e.ownerEmail.ToLower()]    = $e }
}

# Optional filters
$onlyBots    = if ($cfg.ContainsKey('onlyBotSchemaNames')) { $cfg.onlyBotSchemaNames } else { @() }
$onlyOwners  = if ($cfg.ContainsKey('onlyOwnerEmails'))    { $cfg.onlyOwnerEmails }    else { @() }
$excludeOwners = if ($cfg.ContainsKey('excludeOwnerEmails')) { $cfg.excludeOwnerEmails } else { @() }

$plan = @{
    generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
    sourceEnv    = @{ url = $cfg.sourceEnvUrl; id = $cfg.sourceEnvId }
    summary      = @{ total = 0; ready = 0; skipNoEnv = 0; skipFiltered = 0; skipExcluded = 0 }
    entries      = @()
}

foreach ($b in $bots) {
    $plan.summary.total++

    if ($onlyBots.Count -gt 0 -and ($onlyBots -notcontains $b.schemaname)) {
        $plan.summary.skipFiltered++; continue
    }
    if ($onlyOwners.Count -gt 0 -and ($onlyOwners -notcontains $b.ownerEmail)) {
        $plan.summary.skipFiltered++; continue
    }
    if ($excludeOwners.Count -gt 0 -and ($excludeOwners -contains $b.ownerEmail)) {
        $plan.summary.skipExcluded++; continue
    }

    $tgt = $null
    if ($b.ownerObjectId -and $envByObj.ContainsKey($b.ownerObjectId.ToLower())) {
        $tgt = $envByObj[$b.ownerObjectId.ToLower()]
    } elseif ($b.ownerEmail -and $envByEmail.ContainsKey($b.ownerEmail.ToLower())) {
        $tgt = $envByEmail[$b.ownerEmail.ToLower()]
    }

    $entry = @{
        bot = @{
            id = $b.botId; schemaname = $b.schemaname; name = $b.name
            componentstate = $b.componentstate; publishedon = $b.publishedon
        }
        owner = @{
            email = $b.ownerEmail; aadObjectId = $b.ownerObjectId
            systemuserId = $b.ownerSystemUserId; name = $b.ownerName
        }
        target = if ($tgt) {
                    @{ envId = $tgt.envId; envUrl = $tgt.envUrl; name = $tgt.envName }
                 } else { $null }
        status = if ($tgt) { 'ready' } else { 'skip-no-env' }
        deps   = $null            # filled in Phase a (per-bot)
        solutionUniqueName = $null
        importJobId        = $null
        errorMessage       = $null
        startedUtc         = $null
        completedUtc       = $null
    }
    if ($tgt) { $plan.summary.ready++ } else { $plan.summary.skipNoEnv++ }
    $plan.entries += $entry
}

$outPath = Join-Path $invDir 'migration-plan.json'
Write-PPJson -InputObject $plan -Path $outPath
Write-PPLog -Level Info -Message ("Plan: total={0} ready={1} skipNoEnv={2} skipFiltered={3} skipExcluded={4} -> {5}" -f `
    $plan.summary.total, $plan.summary.ready, $plan.summary.skipNoEnv, $plan.summary.skipFiltered, $plan.summary.skipExcluded, $outPath)
