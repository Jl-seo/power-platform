<#
.SYNOPSIS
    Inventories every GUID, URL, and identifier in the source environment that
    might be embedded inside Copilot Studio agents, flows, or AI Builder prompts,
    so Repair-PPSolutionGuids.ps1 has a complete remap basis.

.DESCRIPTION
    Pulls via Dataverse Web API:
      - workflows (cloud flows)
      - msdyn_aiplugin / msdyn_aipluginversion / msdyn_aimodel / msdyn_aibuilderpromptpluginversion
      - bot / botcomponent / botcomponentcollection (Copilot Studio)
      - environmentvariabledefinition / environmentvariablevalue
      - connectionreference
      - connector (custom)
    Also walks unpacked solution folders for embedded URLs (SharePoint sites etc.)
    Output: out/source/source-ids.json + out/source/inventory.source.json
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

$sourceDir = Join-Path $cfg.outDir 'source'
if (-not (Test-Path $sourceDir)) { New-Item -ItemType Directory -Path $sourceDir -Force | Out-Null }

$secret = Get-PPSecret -Name $cfg.secrets.spnClientSecret
$dvToken = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId `
    -Resource $cfg.sourceEnvUrl -ClientSecret $secret
$headers = @{
    Authorization      = "Bearer $dvToken"
    'OData-MaxVersion' = '4.0'
    'OData-Version'    = '4.0'
    Accept             = 'application/json'
}
$apiBase = "$($cfg.sourceEnvUrl.TrimEnd('/'))/api/data/v9.2"

function Invoke-Dv {
    param([string] $Path, [string] $Select = '', [string] $Filter = '', [string] $Expand = '')
    $qs = @()
    if ($Select) { $qs += '$select=' + [System.Web.HttpUtility]::UrlEncode($Select) }
    if ($Filter) { $qs += '$filter=' + [System.Web.HttpUtility]::UrlEncode($Filter) }
    if ($Expand) { $qs += '$expand=' + [System.Web.HttpUtility]::UrlEncode($Expand) }
    $uri = "$apiBase/$Path"
    if ($qs) { $uri += '?' + ($qs -join '&') }
    $all = @()
    while ($uri) {
        $resp = Invoke-PPRest -Method GET -Uri $uri -Headers $headers
        if ($resp.value) { $all += $resp.value }
        $uri = $resp.'@odata.nextLink'
    }
    return $all
}

$inventory = @{
    workflows               = @()
    aiplugins               = @()
    aimodels                = @()
    aipromptVersions        = @()
    bots                    = @()
    botcomponents           = @()
    environmentVariableDefs = @()
    environmentVariableVals = @()
    connectionReferences    = @()
    connectors              = @()
    embeddedUrls            = @()
    capturedUtc             = (Get-Date).ToUniversalTime().ToString('o')
    sourceEnv               = $cfg.sourceEnvUrl
}

Write-PPLog -Level Info -Message "Inventory: workflows"
$inventory.workflows = Invoke-Dv -Path 'workflows' -Select 'workflowid,name,uniquename,category,statecode,clientdata' -Filter "category eq 5"

Write-PPLog -Level Info -Message "Inventory: AI Builder plugins/models"
try { $inventory.aiplugins        = Invoke-Dv -Path 'msdyn_aiplugins' -Select 'msdyn_aipluginid,msdyn_uniquename,msdyn_name,msdyn_schemaversion' } catch { Write-PPLog -Level Warn -Message "aiplugins query failed: $($_.Exception.Message)" }
try { $inventory.aimodels         = Invoke-Dv -Path 'msdyn_aimodels'  -Select 'msdyn_aimodelid,msdyn_name,msdyn_publishstate' } catch { Write-PPLog -Level Warn -Message "aimodels query failed: $($_.Exception.Message)" }
try { $inventory.aipromptVersions = Invoke-Dv -Path 'msdyn_aibuilderpromptpluginversions' -Select 'msdyn_aibuilderpromptpluginversionid,_msdyn_aimodel_value,_msdyn_aiplugin_value,msdyn_name' } catch { Write-PPLog -Level Warn -Message "ai prompt versions query failed: $($_.Exception.Message)" }

Write-PPLog -Level Info -Message "Inventory: Copilot bots/components"
try { $inventory.bots          = Invoke-Dv -Path 'bots' -Select 'botid,schemaname,name,publishedon' } catch { Write-PPLog -Level Warn -Message "bots query failed: $($_.Exception.Message)" }
try { $inventory.botcomponents = Invoke-Dv -Path 'botcomponents' -Select 'botcomponentid,name,componenttype,_parentbotid_value,data,schemaname' } catch { Write-PPLog -Level Warn -Message "botcomponents query failed: $($_.Exception.Message)" }

Write-PPLog -Level Info -Message "Inventory: environment variables / connection refs / connectors"
$inventory.environmentVariableDefs = Invoke-Dv -Path 'environmentvariabledefinitions' -Select 'environmentvariabledefinitionid,schemaname,displayname,type,defaultvalue'
$inventory.environmentVariableVals = Invoke-Dv -Path 'environmentvariablevalues'      -Select 'environmentvariablevalueid,_environmentvariabledefinitionid_value,value'
$inventory.connectionReferences    = Invoke-Dv -Path 'connectionreferences'           -Select 'connectionreferenceid,connectionreferencelogicalname,connectionreferencedisplayname,connectorid,connectionid'
try { $inventory.connectors        = Invoke-Dv -Path 'connectors' -Select 'connectorid,name,connectorinternalid,solutionid' } catch { Write-PPLog -Level Warn -Message "connectors query failed (may need higher privs): $($_.Exception.Message)" }

# Walk solution zips that were exported in this run for embedded URLs (SharePoint sites etc.)
Write-PPLog -Level Info -Message "Scanning exported solution zips for embedded URLs"
$urlPattern = 'https?://[^\s"<>'']+'
foreach ($zip in (Get-ChildItem -Path $sourceDir -Filter '*_unmanaged.zip' -ErrorAction SilentlyContinue)) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $tmp = Join-Path $env:TEMP ("ppinv-" + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tmp -Force | Out-Null
    try {
        [System.IO.Compression.ZipFile]::ExtractToDirectory($zip.FullName, $tmp)
        $children = Get-ChildItem -Path $tmp -Recurse -File -Include '*.yaml','*.json','*.xml' -ErrorAction SilentlyContinue
        foreach ($c in $children) {
            $text = [IO.File]::ReadAllText($c.FullName)
            $urlMatches = [regex]::Matches($text, $urlPattern)
            foreach ($m in $urlMatches) {
                $url = $m.Value
                if ($url -match 'sharepoint\.com|crm\d*\.dynamics\.com|powerapps\.com|powerautomate\.com') {
                    $inventory.embeddedUrls += @{ solution = $zip.BaseName; file = ($c.FullName.Substring($tmp.Length+1)); url = $url }
                }
            }
        }
    } finally {
        Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }
}
$inventory.embeddedUrls = $inventory.embeddedUrls | Sort-Object url -Unique

# Compose the source-ids.json (lighter map used by Repair-PPSolutionGuids)
$sourceIds = @{
    capturedUtc = $inventory.capturedUtc
    sourceEnv   = $inventory.sourceEnv
    workflows   = @{}
    aiplugins   = @{}
    aimodels    = @{}
    bots        = @{}
    envVars     = @{}
    connectors  = @{}
    connectionRefs = @{}
}
foreach ($w in $inventory.workflows)               { $sourceIds.workflows[$w.uniquename]    = $w.workflowid }
foreach ($p in $inventory.aiplugins)               { $sourceIds.aiplugins[$p.msdyn_uniquename] = $p.msdyn_aipluginid }
foreach ($m in $inventory.aimodels)                { $sourceIds.aimodels[$m.msdyn_name]     = $m.msdyn_aimodelid }
foreach ($b in $inventory.bots)                    { $sourceIds.bots[$b.schemaname]         = $b.botid }
foreach ($e in $inventory.environmentVariableDefs) { $sourceIds.envVars[$e.schemaname]      = $e.environmentvariabledefinitionid }
foreach ($c in $inventory.connectionReferences)    { $sourceIds.connectionRefs[$c.connectionreferencelogicalname] = $c.connectionreferenceid }
foreach ($c in $inventory.connectors)              { $sourceIds.connectors[$c.name]         = $c.connectorid }

Write-PPJson -InputObject $inventory -Path (Join-Path $sourceDir 'inventory.source.json')
Write-PPJson -InputObject $sourceIds -Path (Join-Path $sourceDir 'source-ids.json')
Write-PPLog -Level Info -Message "Source inventory written: $sourceDir\inventory.source.json"
Write-PPLog -Level Info -Message "Source IDs written: $sourceDir\source-ids.json"
