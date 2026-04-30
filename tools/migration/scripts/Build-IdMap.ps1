<#
.SYNOPSIS
    Composes id-map.json (sourceGuid -> targetGuid) and url-map.json (sourceUrl -> targetUrl)
    by joining source-ids.json + target-ids.json + connection-map.json + (optional) url-map override.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $Config,
    [string] $UrlOverrideFile
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

$sourceIds   = Read-PPJson -Path (Join-Path $cfg.outDir 'source\source-ids.json')   -AsHashtable
$targetIds   = Read-PPJson -Path (Join-Path $cfg.outDir 'target\target-ids.json')   -AsHashtable
$connectionMap = $null
$cmPath = Join-Path $cfg.outDir 'target\connection-map.json'
if (Test-Path $cmPath) { $connectionMap = Read-PPJson -Path $cmPath -AsHashtable }

$idMap = @{
    capturedUtc = (Get-Date).ToUniversalTime().ToString('o')
    guids       = @{}      # sourceGuid -> targetGuid
    byKind      = @{
        workflows      = @{}
        aimodels       = @{}
        aiplugins      = @{}
        bots           = @{}
        envVars        = @{}
        connectors     = @{}
        connectionRefs = @{}
        connections    = @{}
    }
    urls        = @{}
    unmapped    = @()
}

function Add-Guid {
    param($Kind, $Key, $Source, $Target)
    if (-not $Source) { return }
    if (-not $Target) { $idMap.unmapped += @{ kind = $Kind; key = $Key; sourceGuid = $Source }; return }
    $idMap.guids[$Source.ToLower()] = $Target.ToLower()
    $idMap.byKind[$Kind][$Key] = @{ source = $Source; target = $Target }
}

# 1. Workflows (matched by uniquename)
foreach ($k in $sourceIds.workflows.Keys) {
    Add-Guid 'workflows' $k $sourceIds.workflows[$k] $targetIds.workflows[$k]
}

# 2. AI Builder plugins / models
foreach ($k in $sourceIds.aiplugins.Keys) { Add-Guid 'aiplugins' $k $sourceIds.aiplugins[$k] $targetIds.aiplugins[$k] }
foreach ($k in $sourceIds.aimodels.Keys)  { Add-Guid 'aimodels'  $k $sourceIds.aimodels[$k]  $targetIds.aimodels[$k] }

# 3. Bots
foreach ($k in $sourceIds.bots.Keys) { Add-Guid 'bots' $k $sourceIds.bots[$k] $targetIds.bots[$k] }

# 4. Environment variables (matched by schemaname)
foreach ($k in $sourceIds.envVars.Keys) { Add-Guid 'envVars' $k $sourceIds.envVars[$k] $targetIds.envVars[$k] }

# 5. Connectors (custom)
foreach ($k in $sourceIds.connectors.Keys) { Add-Guid 'connectors' $k $sourceIds.connectors[$k] $targetIds.connectors[$k] }

# 6. Connection references (matched by logical name)
foreach ($k in $sourceIds.connectionRefs.Keys) { Add-Guid 'connectionRefs' $k $sourceIds.connectionRefs[$k] $targetIds.connectionRefs[$k] }

# 7. Connection IDs from connection-map (target side; source connection ids are not directly portable but referenced inside flows)
if ($connectionMap) {
    foreach ($k in $connectionMap.Keys) {
        $idMap.byKind.connections[$k] = @{ target = $connectionMap[$k].connectionId }
    }
}

# 8. URL map: optional explicit overrides + auto-detection placeholders
if ($UrlOverrideFile -and (Test-Path $UrlOverrideFile)) {
    $overrides = Read-PPJson -Path $UrlOverrideFile -AsHashtable
    foreach ($k in $overrides.Keys) { $idMap.urls[$k] = $overrides[$k] }
}

# Auto-detect: if source/target dynamics URLs differ, add a substitution rule for org host
$srcOrg = ([Uri]$cfg.sourceEnvUrl).Host
$tgtOrg = ([Uri]$cfg.targetEnvUrl).Host
if ($srcOrg -ne $tgtOrg) {
    $idMap.urls["https://$srcOrg"] = "https://$tgtOrg"
}

$outPath = Join-Path $cfg.outDir 'target\id-map.json'
Write-PPJson -InputObject $idMap -Path $outPath
Write-PPLog -Level Info -Message "id-map written: $outPath (mapped=$($idMap.guids.Count), unmapped=$($idMap.unmapped.Count))"
if ($idMap.unmapped.Count -gt 0) {
    Write-PPLog -Level Warn -Message "$($idMap.unmapped.Count) source IDs have no target match; review out/target/id-map.json -> unmapped"
}
