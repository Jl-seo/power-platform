<#
.SYNOPSIS
    FlowOps S1 read-only adapter — pulls REAL data from the DEX (default)
    environment and the tenant Inventory API, and writes flowops-data.json
    matching the mockup data contract (feature-design-v2.md §4.2).

    READ-ONLY by design: no PATCH/POST to any business table. The only write
    is the local JSON output file.

.DESCRIPTION
    Data sources:
      kpi / inventory[]  <- Power Platform Inventory API (Azure Resource Graph)
      tasks[]            <- DEX Dataverse: bots + cloud flows (category 5)
      runs[]             <- (optional -IncludeRuns) Flow API run history, top N per flow
      releases[]         <- empty in S1 (Pipelines not wired yet)

    Reuses the migration toolkit lib (PPAuth/PPThrottle/PPSecrets/PPDataverseQuery).
    Same config.psd1 as the migration toolkit (sourceEnvUrl = DEX).

.EXAMPLE
    .\Get-FlowOpsData.ps1 -Config ..\..\migration\templates\config.psd1 `
        -OutFile ..\mockup\flowops-data.json
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $Config,
    [string] $OutFile = (Join-Path $PSScriptRoot '..\mockup\flowops-data.json'),
    [switch] $IncludeRuns,
    [int] $RunsPerFlow = 5,
    [int] $MaxFlowsForRuns = 20
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

$libDir = Join-Path $PSScriptRoot '..\..\migration\scripts\lib'
Import-Module (Join-Path $libDir 'PPMigration.psm1')      -Force
Import-Module (Join-Path $libDir 'PPThrottle.psm1')       -Force
Import-Module (Join-Path $libDir 'PPSecrets.psm1')        -Force
Import-Module (Join-Path $libDir 'PPAuth.psm1')           -Force
Import-Module (Join-Path $libDir 'PPDataverseQuery.psm1') -Force

$cfg = Read-PPConfig -Path $Config
Initialize-PPLogging -LogDir (Join-Path $cfg.outDir 'logs')
Initialize-PPSecrets -Config $cfg
$secret = Get-PPSecret -Name $cfg.secrets.spnClientSecret

$data = @{
    meta      = @{ source = 'live'; syncedAt = (Get-Date).ToUniversalTime().ToString('o'); tenant = $cfg.tenantId; envName = 'DEX' }
    kpi       = @{ totalFlows = 0; totalApps = 0; totalAgents = 0; unregistered = 0 }
    tasks     = @()
    runs      = @()
    releases  = @()   # S1: empty until Pipelines wired (S3)
    inventory = @()
}

# ── 1) Inventory API (tenant-wide counts + resource list) — READ ONLY ──
Write-PPLog -Level Info -Message "Querying Power Platform Inventory API"
try {
    $ppToken = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId `
        -Resource 'https://api.powerplatform.com' -ClientSecret $secret
    $invBody = @{
        TableName = 'PowerPlatformResources'
        Clauses   = @()
        Options   = @{ Top = 1000 }
    }
    $invUri = 'https://api.powerplatform.com/resourcequery/resources/query?api-version=2024-10-01'
    $inv = Invoke-PPRest -Method POST -Uri $invUri `
        -Headers @{ Authorization = "Bearer $ppToken"; Accept = 'application/json' } `
        -Body $invBody
    foreach ($row in $inv.data) {
        $type = switch -Wildcard ($row.type) {
            'microsoft.powerautomate/*' { 'flow';  $data.kpi.totalFlows++;  break }
            'microsoft.powerapps/*'     { 'app';   $data.kpi.totalApps++;   break }
            'microsoft.copilotstudio/*' { 'agent'; $data.kpi.totalAgents++; break }
            default                     { $null }
        }
        if (-not $type) { continue }
        $props = $row.properties
        $data.inventory += @{
            name       = if ($props -and $props.PSObject.Properties.Name -contains 'displayName') { $props.displayName } else { $row.name }
            type       = $type
            env        = if ($props -and $props.PSObject.Properties.Name -contains 'environmentId') { $props.environmentId } else { '' }
            owner      = if ($props -and $props.PSObject.Properties.Name -contains 'ownerId') { $props.ownerId } else { '' }
            createdAt  = if ($props -and $props.PSObject.Properties.Name -contains 'createdAt') { $props.createdAt } else { '' }
            registered = $false   # S1: no task ledger yet, so everything is "unregistered"
        }
    }
    $data.kpi.unregistered = $data.inventory.Count
    Write-PPLog -Level Info -Message ("Inventory: flows={0} apps={1} agents={2}" -f $data.kpi.totalFlows, $data.kpi.totalApps, $data.kpi.totalAgents)
} catch {
    Write-PPLog -Level Warn -Message ("Inventory API failed (need PP API permission / license): {0}" -f $_.Exception.Message)
    $data.meta.inventoryError = $_.Exception.Message
}

# ── 2) DEX Dataverse: bots + cloud flows as provisional "tasks" — READ ONLY ──
Write-PPLog -Level Info -Message "Querying DEX Dataverse (bots + flows)"
$dvToken = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId `
    -Resource $cfg.sourceEnvUrl -ClientSecret $secret
try {
    $bots = Invoke-DvGetAll -EnvironmentUrl $cfg.sourceEnvUrl -Token $dvToken `
        -EntitySet 'bots' -Select 'botid,schemaname,name,publishedon,createdon' `
        -Expand 'ownerid($select=fullname,internalemailaddress)'
    foreach ($b in $bots) {
        $owner = if ($b.PSObject.Properties.Name -contains 'ownerid' -and $b.ownerid) { $b.ownerid.fullname } else { '' }
        $data.tasks += @{
            code = $b.schemaname; name = $b.name; owner = $owner; type = 'agent'
            stage = if ($b.publishedon) { 5 } else { 3 }
            planned = ''; actual = if ($b.publishedon) { ([datetime]$b.publishedon).ToString('MM-dd') } else { '' }
            status = if ($b.publishedon) { '운영' } else { '개발중' }
        }
    }
} catch { Write-PPLog -Level Warn -Message ("bots query failed: {0}" -f $_.Exception.Message) }

$flows = @()
try {
    $flows = Invoke-DvGetAll -EnvironmentUrl $cfg.sourceEnvUrl -Token $dvToken `
        -EntitySet 'workflows' -Select 'workflowid,name,statecode,createdon' `
        -Filter 'category eq 5' `
        -Expand 'ownerid($select=fullname)'
    foreach ($w in $flows) {
        $owner = if ($w.PSObject.Properties.Name -contains 'ownerid' -and $w.ownerid) { $w.ownerid.fullname } else { '' }
        $data.tasks += @{
            code = $w.workflowid.Substring(0,8); name = $w.name; owner = $owner; type = 'flow'
            stage = if ($w.statecode -eq 1) { 5 } else { 3 }
            planned = ''; actual = ''
            status = if ($w.statecode -eq 1) { '운영(ON)' } else { 'OFF' }
        }
    }
} catch { Write-PPLog -Level Warn -Message ("flows query failed: {0}" -f $_.Exception.Message) }

# ── 3) (optional) recent runs via Flow API — READ ONLY, throttle-capped ──
if ($IncludeRuns -and $flows.Count -gt 0) {
    Write-PPLog -Level Info -Message "Querying flow run history (top $RunsPerFlow per flow, max $MaxFlowsForRuns flows)"
    $flowToken = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId `
        -Resource 'https://service.flow.microsoft.com' -ClientSecret $secret
    $envId = Get-PPEnvironmentId -Config $cfg -Side source
    $checked = 0
    foreach ($w in $flows) {
        if ($checked -ge $MaxFlowsForRuns) { break }
        $checked++
        try {
            $uri = ("https://api.flow.microsoft.com/providers/Microsoft.ProcessSimple/environments/{0}/flows/{1}/runs?api-version=2016-11-01&`$top={2}" -f $envId, $w.workflowid, $RunsPerFlow)
            $runs = Invoke-PPRest -Method GET -Uri $uri -Headers @{ Authorization = "Bearer $flowToken" }
            foreach ($r in $runs.value) {
                $data.runs += @{
                    runId = $r.name; task = $w.name; machine = ''
                    start = $r.properties.startTime; end = $r.properties.endTime
                    processed = 0; skipped = 0
                    status = $r.properties.status
                }
            }
        } catch { Write-PPLog -Level Debug -Message ("runs for {0} skipped: {1}" -f $w.name, $_.Exception.Message) }
    }
}

# ── 4) Contract validation + output ──
foreach ($t in $data.tasks) {
    if ($null -eq $t.owner) { $t.owner = '' }       # null rule per contract (R10)
}
Write-PPJson -InputObject $data -Path $OutFile
Write-PPLog -Level Info -Message ("flowops-data.json written: {0} (tasks={1} inventory={2} runs={3})" -f `
    $OutFile, $data.tasks.Count, $data.inventory.Count, $data.runs.Count)
Write-Host ""
Write-Host "READ-ONLY snapshot complete. No writes were made to DEX." -ForegroundColor Green
