<#
.SYNOPSIS
    Creates a temporary per-owner solution in the source environment and adds
    the bot + all of its dependencies as solution components.

    Returns the solution unique name (also written to plan entry).
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $Config,
    [Parameter(Mandatory)][string] $BotId,
    [Parameter(Mandatory)][string] $OwnerEmail,
    [Parameter(Mandatory)][string] $BotSchemaName
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
}
Add-Type -AssemblyName System.Web

$libDir = Join-Path $PSScriptRoot 'lib'
Import-Module (Join-Path $libDir 'PPMigration.psm1')      -Force
Import-Module (Join-Path $libDir 'PPThrottle.psm1')       -Force
Import-Module (Join-Path $libDir 'PPSecrets.psm1')        -Force
Import-Module (Join-Path $libDir 'PPAuth.psm1')           -Force
Import-Module (Join-Path $libDir 'PPDataverseQuery.psm1') -Force
Import-Module (Join-Path $libDir 'PPSolutionAuthor.psm1') -Force

$cfg = Read-PPConfig -Path $Config
Initialize-PPLogging -LogDir (Join-Path $cfg.outDir 'logs')
Initialize-PPSecrets -Config $cfg

$secret = Get-PPSecret -Name $cfg.secrets.spnClientSecret
$tok = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId `
    -Resource $cfg.sourceEnvUrl -ClientSecret $secret

# Load deps for this bot
$depsPath = Join-Path $cfg.outDir ("per-bot\$BotId\deps.json")
if (-not (Test-Path $depsPath)) { throw "deps.json missing for bot $BotId — run Get-PPCopilotDependencies first" }
$deps = Read-PPJson -Path $depsPath -AsHashtable

# Build solution unique name: cr_AgentMig_<ownerSlug>_<botSchemaSlug>_<yyyyMMddHHmm>
function _Slug([string] $s) {
    if (-not $s) { return 'unknown' }
    $local = ($s -split '@')[0]
    return ([regex]::Replace($local, '[^A-Za-z0-9]', '')).ToLower()
}
$prefix       = if ($cfg.ContainsKey('solutionPrefix'))     { $cfg.solutionPrefix }     else { 'cr_AgentMig' }
$pubUnique    = if ($cfg.ContainsKey('publisherUniqueName')){ $cfg.publisherUniqueName } else { 'pp_migration' }
$pubDisplay   = if ($cfg.ContainsKey('publisherDisplayName')){ $cfg.publisherDisplayName } else { 'PP Migration' }
$pubPrefix    = if ($cfg.ContainsKey('publisherPrefix'))    { $cfg.publisherPrefix }    else { 'pp' }
$ownerSlug    = _Slug $OwnerEmail
$botSlug      = ($BotSchemaName -replace '[^A-Za-z0-9_]','').ToLower()
$ts           = Get-Date -Format 'yyyyMMddHHmm'
$slnUnique    = ("{0}_{1}_{2}_{3}" -f $prefix, $ownerSlug, $botSlug, $ts)
$slnFriendly  = "Migration: $BotSchemaName for $OwnerEmail"

# Ensure publisher exists
$pubId = Get-PPMigrationPublisher -EnvironmentUrl $cfg.sourceEnvUrl -Token $tok `
    -UniqueName $pubUnique -DisplayName $pubDisplay -Prefix $pubPrefix

# Create solution
$slnUnique = New-PPSolution -EnvironmentUrl $cfg.sourceEnvUrl -Token $tok `
    -UniqueName $slnUnique -FriendlyName $slnFriendly -PublisherId $pubId

$ct = Get-PPComponentType

# Add components in dependency-friendly order: leaf first, bot last
$queue = New-Object System.Collections.ArrayList

foreach ($cc in $deps.customConnectors) { $null = $queue.Add(@{ id = $cc.id;            type = $ct.Connector }) }
foreach ($ev in $deps.envVars)          { $null = $queue.Add(@{ id = $ev.id;            type = $ct.EnvironmentVariableDefinition }) }
foreach ($cr in $deps.connRefs)         { $null = $queue.Add(@{ id = $cr.id;            type = $ct.ConnectionReference }) }
foreach ($wf in $deps.workflows)        { $null = $queue.Add(@{ id = $wf.id;            type = $ct.Workflow }) }
foreach ($ai in $deps.aiplugins)        { $null = $queue.Add(@{ id = $ai.id;            type = $ct.AIPlugin }) }
foreach ($ks in $deps.knowledgeSources) { $null = $queue.Add(@{ id = $ks.id;            type = $ct.KnowledgeSource }) }
foreach ($bc in $deps.botComponentIds)  { $null = $queue.Add(@{ id = $bc;               type = $ct.BotComponent }) }
$null = $queue.Add(@{ id = $BotId; type = $ct.Bot; addRequired = $true })

$added = 0; $failed = 0
foreach ($item in $queue) {
    try {
        $req = if ($item.ContainsKey('addRequired') -and $item.addRequired) { $true } else { $false }
        Add-PPSolutionComponent -EnvironmentUrl $cfg.sourceEnvUrl -Token $tok `
            -SolutionUniqueName $slnUnique -ComponentId $item.id -ComponentType $item.type `
            -AddRequiredComponents:$req | Out-Null
        $added++
    } catch {
        $failed++
        Write-PPLog -Level Warn -Message ("Add component failed: {0} ({1}): {2}" -f $item.id, $item.type, $_.Exception.Message)
    }
}

Write-PPLog -Level Info -Message ("Solution {0}: added={1} failed={2}" -f $slnUnique, $added, $failed)

# Write per-bot meta
$meta = @{
    botId              = $BotId
    botSchemaName      = $BotSchemaName
    ownerEmail         = $OwnerEmail
    solutionUniqueName = $slnUnique
    publisherId        = $pubId
    componentsAdded    = $added
    componentsFailed   = $failed
    createdUtc         = (Get-Date).ToUniversalTime().ToString('o')
}
$metaPath = Join-Path $cfg.outDir ("per-bot\$BotId\solution.meta.json")
Write-PPJson -InputObject $meta -Path $metaPath

# Echo unique name for caller
Write-Output $slnUnique
