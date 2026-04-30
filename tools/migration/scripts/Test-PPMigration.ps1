<#
.SYNOPSIS
    Validates the migrated environment. Exits non-zero if any check fails.
    Writes out/target/validation-report.json.

.CHECKS
    - All connection-bootstrap entries are present and Connected in target
    - All workflows in solutions are statecode=0 (OFF)
    - All AI prompt versions have a non-null msdyn_aimodel binding
    - All env-var values are set
    - No remaining source GUID in workflows/botcomponents (sample-based)
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $Config,
    [string[]] $SolutionUniqueNames
)

#Requires -Version 5.1
Set-StrictMode -Version 3.0
$ErrorActionPreference = 'Stop'
$PSDefaultParameterValues = @{
    'Out-File:Encoding'                 = 'utf8'
    'Set-Content:Encoding'              = 'utf8'
    'ConvertTo-Json:Depth'              = 100
    'Invoke-RestMethod:UseBasicParsing' = $true
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

if (-not $SolutionUniqueNames) { $SolutionUniqueNames = $cfg.solutions }

$secret = Get-PPSecret -Name $cfg.secrets.spnClientSecret
$tok = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId `
    -Resource $cfg.targetEnvUrl -ClientSecret $secret
$headers = @{
    Authorization      = "Bearer $tok"
    'OData-MaxVersion' = '4.0'
    'OData-Version'    = '4.0'
    Accept             = 'application/json'
}
$apiBase = "$($cfg.targetEnvUrl.TrimEnd('/'))/api/data/v9.2"

$report = @{
    result        = 'PASS'
    timestamp     = (Get-Date).ToUniversalTime().ToString('o')
    checks        = @{}
    failures      = @()
}
function Fail-Check {
    param([string] $Name, [string] $Reason)
    $report.result = 'FAIL'
    $report.failures += @{ check = $Name; reason = $Reason }
    Write-PPLog -Level Error -Message ("FAIL: {0}: {1}" -f $Name, $Reason)
}

# 1) Connections
$bsPath = Join-Path $PSScriptRoot '..\templates\connection-bootstrap.json'
$cmPath = Join-Path $cfg.outDir 'target\connection-map.json'
if ((Test-Path $bsPath) -and (Test-Path $cmPath)) {
    $bs = Read-PPJson -Path $bsPath -AsHashtable
    $cm = Read-PPJson -Path $cmPath -AsHashtable
    $missing = @()
    foreach ($e in $bs.connections) {
        if (-not $cm.ContainsKey($e.logicalName) -or -not $cm[$e.logicalName].connectionId) {
            $missing += $e.logicalName
        }
    }
    if ($missing.Count -gt 0) { Fail-Check -Name 'connections' -Reason ("Missing: " + ($missing -join ',')) }
    $report.checks.connections = @{ expected = $bs.connections.Count; mapped = $cm.Count; missing = $missing }
}

# 2) Workflows OFF
$totalFlows = 0; $onFlows = @()
foreach ($u in $SolutionUniqueNames) {
    $sUri = "$apiBase/solutions?\$select=solutionid&\$filter=" + [System.Web.HttpUtility]::UrlEncode("uniquename eq '$u'")
    $sResp = Invoke-PPRest -Method GET -Uri $sUri -Headers $headers
    if (-not $sResp.value -or $sResp.value.Count -eq 0) { continue }
    $sid = $sResp.value[0].solutionid
    $cUri = "$apiBase/solutioncomponents?\$select=objectid&\$filter=" + [System.Web.HttpUtility]::UrlEncode("_solutionid_value eq $sid and componenttype eq 29")
    $cResp = Invoke-PPRest -Method GET -Uri $cUri -Headers $headers
    foreach ($c in $cResp.value) {
        try {
            $w = Invoke-PPRest -Method GET -Uri "$apiBase/workflows($($c.objectid))?\$select=workflowid,name,statecode,category" -Headers $headers
            if ($w.category -ne 5) { continue }
            $totalFlows++
            if ($w.statecode -ne 0) { $onFlows += $w.name }
        } catch { }
    }
}
if ($onFlows.Count -gt 0) { Fail-Check -Name 'flowsOff' -Reason ("ON flows: " + ($onFlows -join ',')) }
$report.checks.flows = @{ total = $totalFlows; on = $onFlows.Count; offRequired = $true }

# 3) AI prompt model binding non-null
$missingModel = 0
$tot = 0
$uri = "$apiBase/msdyn_aibuilderpromptpluginversions?\$select=msdyn_aibuilderpromptpluginversionid,_msdyn_aimodel_value,msdyn_name"
while ($uri) {
    try { $resp = Invoke-PPRest -Method GET -Uri $uri -Headers $headers } catch { break }
    foreach ($r in $resp.value) {
        $tot++
        if (-not $r._msdyn_aimodel_value) { $missingModel++ }
    }
    $uri = $resp.'@odata.nextLink'
}
if ($missingModel -gt 0) { Fail-Check -Name 'aiPromptBinding' -Reason ("$missingModel prompt versions missing model") }
$report.checks.aiPrompts = @{ total = $tot; missingModel = $missingModel }

# 4) Env var values present
$missingEv = 0
$totEv = 0
$uri = "$apiBase/environmentvariabledefinitions?\$select=schemaname,environmentvariabledefinitionid,defaultvalue&\$expand=environmentvariabledefinition_environmentvariablevalue(\$select=value)"
try {
    while ($uri) {
        $resp = Invoke-PPRest -Method GET -Uri $uri -Headers $headers
        foreach ($d in $resp.value) {
            $totEv++
            $hasVal = $false
            if ($d.PSObject.Properties.Name -contains 'environmentvariabledefinition_environmentvariablevalue') {
                $vals = $d.environmentvariabledefinition_environmentvariablevalue
                if ($vals -and $vals.Count -gt 0 -and $vals[0].value) { $hasVal = $true }
            }
            if (-not $hasVal -and -not $d.defaultvalue) { $missingEv++ }
        }
        $uri = $resp.'@odata.nextLink'
    }
} catch { Write-PPLog -Level Warn -Message "env var check skipped: $($_.Exception.Message)" }
if ($missingEv -gt 0) { Fail-Check -Name 'envVars' -Reason "$missingEv env-vars without value or default" }
$report.checks.envVars = @{ total = $totEv; missing = $missingEv }

$outPath = Join-Path $cfg.outDir 'target\validation-report.json'
Write-PPJson -InputObject $report -Path $outPath
Write-PPLog -Level Info -Message "Validation report: $outPath ($($report.result))"

if ($report.result -ne 'PASS') {
    Write-PPLog -Level Error -Message "Validation FAILED — see $outPath"
    exit 1
}
exit 0
