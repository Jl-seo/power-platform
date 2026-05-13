<#
.SYNOPSIS
    Generates a per-bot connection-bootstrap.json from deps.json for a given target env.
    Maps each connection reference's connectorId to an authMode using a known-connector
    classification table (SPN | OAuthInteractive | ApiKey).

    Output: out/per-bot/<botId>/<targetEnvId>.connection-bootstrap.json
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $Config,
    [Parameter(Mandatory)][string] $BotId,
    [Parameter(Mandatory)][string] $TargetEnvId
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

$depsPath = Join-Path $cfg.outDir ("per-bot\$BotId\deps.json")
if (-not (Test-Path $depsPath)) { throw "deps.json missing for bot $BotId" }
$deps = Read-PPJson -Path $depsPath -AsHashtable

# Classification table for common connectors. Anything else defaults to OAuthInteractive
# (most permissive: requires a one-time browser consent in the dev env).
$Spn = @(
    'shared_commondataserviceforapps',
    'shared_commondataservice'
)
$ApiKey = @(
    'shared_azureopenai',
    'shared_http',
    'shared_documentdb',     # Cosmos
    'shared_azureblob'
)
function _ClassifyAuthMode {
    param([string] $ConnectorId)
    if (-not $ConnectorId) { return 'OAuthInteractive' }
    $shortId = ($ConnectorId -replace '^.*/apis/', '').ToLower()
    if ($Spn    -contains $shortId) { return 'SPN' }
    if ($ApiKey -contains $shortId) { return 'ApiKey' }
    return 'OAuthInteractive'
}

$connections = @()
foreach ($cr in $deps.connRefs) {
    $authMode = _ClassifyAuthMode -ConnectorId $cr.connectorId
    $entry = @{
        logicalName = $cr.logicalName
        displayName = if ($cr.displayName) { $cr.displayName } else { $cr.logicalName }
        connectorId = $cr.connectorId
        authMode    = $authMode
    }
    if ($authMode -eq 'ApiKey') {
        $entry.parameters = @{
            # Operator should fill these per-connector (or via @secret:<name>) before running Bootstrap phase
            # Example for Azure OpenAI:
            #   azureOpenAIEndpoint = '...'
            #   azureOpenAIApiKey   = '@secret:azureOpenAIKey'
        }
    }
    $connections += $entry
}

$connectors = @()
foreach ($cc in $deps.customConnectors) {
    # Operator must place the swagger/properties/icon files locally and set paths here
    $connectors += @{
        displayName        = $cc.name
        connectorInternalId= $cc.connectorinternalid
        # Path placeholders — fill before running Bootstrap if installing custom connectors via REST
        apiDefinitionFile  = ''
        apiPropertiesFile  = ''
        iconFile           = ''
        solutionUniqueName = ''
    }
}

$bootstrap = @{
    generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
    botId        = $BotId
    targetEnvId  = $TargetEnvId
    connectors   = $connectors
    connections  = $connections
}

$outPath = Join-Path $cfg.outDir ("per-bot\$BotId\$TargetEnvId.connection-bootstrap.json")
Write-PPJson -InputObject $bootstrap -Path $outPath

$counts = @{}
foreach ($c in $connections) {
    if (-not $counts.ContainsKey($c.authMode)) { $counts[$c.authMode] = 0 }
    $counts[$c.authMode]++
}
$summary = ($counts.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ' '
Write-PPLog -Level Info -Message ("Bootstrap[{0}/{1}]: connections={2} ({3}); connectors={4} -> {5}" -f `
    $BotId, $TargetEnvId, $connections.Count, $summary, $connectors.Count, $outPath)
