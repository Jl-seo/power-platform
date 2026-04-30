<#
.SYNOPSIS
    Inventories the target environment's identifiers (env-var defs, AI models,
    connectors, etc.) for matching against the source-ids during GUID repair.

.NOTES
    Run this after Phase 2 (connections created) but before Phase 3 import. Some
    target IDs (workflows, bots, env vars in solution) only exist after import,
    so those are filled by Patch-PostImportReferences.ps1 in the safety-net pass.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $Config
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
Import-Module (Join-Path $libDir 'PPThrottle.psm1') -Force
Import-Module (Join-Path $libDir 'PPSecrets.psm1') -Force
Import-Module (Join-Path $libDir 'PPAuth.psm1') -Force

$cfg = Read-PPConfig -Path $Config
Initialize-PPLogging -LogDir (Join-Path $cfg.outDir 'logs')
Initialize-PPSecrets -Config $cfg

$secret = Get-PPSecret -Name $cfg.secrets.spnClientSecret
$dvToken = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId `
    -Resource $cfg.targetEnvUrl -ClientSecret $secret
$headers = @{
    Authorization      = "Bearer $dvToken"
    'OData-MaxVersion' = '4.0'
    'OData-Version'    = '4.0'
    Accept             = 'application/json'
}
$apiBase = "$($cfg.targetEnvUrl.TrimEnd('/'))/api/data/v9.2"

function Invoke-Dv {
    param([string] $Path, [string] $Select = '')
    $uri = "$apiBase/$Path"
    if ($Select) { $uri += '?$select=' + [System.Web.HttpUtility]::UrlEncode($Select) }
    $all = @()
    while ($uri) {
        $resp = Invoke-PPRest -Method GET -Uri $uri -Headers $headers
        if ($resp.value) { $all += $resp.value }
        $uri = $resp.'@odata.nextLink'
    }
    return $all
}

$targetIds = @{
    capturedUtc    = (Get-Date).ToUniversalTime().ToString('o')
    targetEnv      = $cfg.targetEnvUrl
    aimodels       = @{}
    envVars        = @{}
    connectors     = @{}
    connectionRefs = @{}
    workflows      = @{}
    aiplugins      = @{}
    bots           = @{}
}

try { foreach ($m in Invoke-Dv -Path 'msdyn_aimodels' -Select 'msdyn_aimodelid,msdyn_name')                       { $targetIds.aimodels[$m.msdyn_name]            = $m.msdyn_aimodelid } } catch { Write-PPLog -Level Warn -Message "aimodels: $($_.Exception.Message)" }
try { foreach ($e in Invoke-Dv -Path 'environmentvariabledefinitions' -Select 'environmentvariabledefinitionid,schemaname') { $targetIds.envVars[$e.schemaname] = $e.environmentvariabledefinitionid } } catch { }
try { foreach ($c in Invoke-Dv -Path 'connectors'                     -Select 'connectorid,name')                          { $targetIds.connectors[$c.name]    = $c.connectorid } } catch { }
try { foreach ($c in Invoke-Dv -Path 'connectionreferences'           -Select 'connectionreferenceid,connectionreferencelogicalname') { $targetIds.connectionRefs[$c.connectionreferencelogicalname] = $c.connectionreferenceid } } catch { }
try { foreach ($w in Invoke-Dv -Path 'workflows' -Select 'workflowid,uniquename,category')                                  { if ($w.category -eq 5) { $targetIds.workflows[$w.uniquename] = $w.workflowid } } } catch { }
try { foreach ($p in Invoke-Dv -Path 'msdyn_aiplugins' -Select 'msdyn_aipluginid,msdyn_uniquename')                          { $targetIds.aiplugins[$p.msdyn_uniquename] = $p.msdyn_aipluginid } } catch { }
try { foreach ($b in Invoke-Dv -Path 'bots' -Select 'botid,schemaname')                                                      { $targetIds.bots[$b.schemaname] = $b.botid } } catch { }

$outPath = Join-Path $cfg.outDir 'target\target-ids.json'
Write-PPJson -InputObject $targetIds -Path $outPath
Write-PPLog -Level Info -Message "Target IDs written: $outPath"
