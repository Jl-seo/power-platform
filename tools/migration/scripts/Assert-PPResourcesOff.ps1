<#
.SYNOPSIS
    Phase 4b. Forces every cloud flow in the named solutions to OFF (statecode=0)
    and reports any Copilot Studio agent in Published state without unpublishing
    (per the requirement, no automated unpublish — only audit and warn).

.DESCRIPTION
    PowerShell 5.1 + Web API.

    Flow OFF: PATCH /workflows({id}) { statecode: 0, statuscode: 1 }
    Bot status: GET bots; if `componentstate == 0` and the bot has been published
                (publishedon set), record a warning. We do not unpublish here.

    Output: out/target/off-report.json
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
    'If-Match'         = '*'
}
$apiBase = "$($cfg.targetEnvUrl.TrimEnd('/'))/api/data/v9.2"

$report = @{
    timestamp     = (Get-Date).ToUniversalTime().ToString('o')
    solutions     = @()
    flows         = @{ total = 0; off = 0; forcedOff = 0; failed = 0 }
    bots          = @{ total = 0; published = 0; draft = 0 }
    publishedBots = @()
}

# Resolve solutionid for each unique name
$solutionIds = @{}
foreach ($u in $SolutionUniqueNames) {
    $uri = "$apiBase/solutions?\$select=solutionid,uniquename&\$filter=" + [System.Web.HttpUtility]::UrlEncode("uniquename eq '$u'")
    $r = Invoke-PPRest -Method GET -Uri $uri -Headers $headers
    if ($r.value -and $r.value.Count -gt 0) {
        $solutionIds[$u] = $r.value[0].solutionid
        $report.solutions += @{ uniquename = $u; solutionid = $r.value[0].solutionid }
    }
}

# Flows: pull workflows that belong to one of the solutionids via solutioncomponent
foreach ($u in $solutionIds.Keys) {
    $sid = $solutionIds[$u]
    $compUri = "$apiBase/solutioncomponents?\$select=objectid,componenttype&\$filter=" + [System.Web.HttpUtility]::UrlEncode("_solutionid_value eq $sid and componenttype eq 29")
    $compResp = Invoke-PPRest -Method GET -Uri $compUri -Headers $headers
    foreach ($c in $compResp.value) {
        $wid = $c.objectid
        $wUri = "$apiBase/workflows($wid)?\$select=workflowid,name,uniquename,statecode,statuscode,category"
        try {
            $w = Invoke-PPRest -Method GET -Uri $wUri -Headers $headers
        } catch { continue }
        if ($w.category -ne 5) { continue }   # only Modern Flow
        $report.flows.total++
        if ($w.statecode -eq 0) { $report.flows.off++; continue }
        # ON → force OFF
        $patchUri = "$apiBase/workflows($wid)"
        $body = @{ statecode = 0; statuscode = 1 }
        try {
            Invoke-PPRest -Method PATCH -Uri $patchUri -Headers $headers -Body $body | Out-Null
            $report.flows.forcedOff++
            Write-PPLog -Level Info -Message ("Forced OFF: {0}" -f $w.name)
        } catch {
            $report.flows.failed++
            Write-PPLog -Level Warn -Message ("Failed to OFF {0}: {1}" -f $w.name, $_.Exception.Message)
        }
    }
}

# Bots: report published state (do NOT unpublish)
foreach ($u in $solutionIds.Keys) {
    $sid = $solutionIds[$u]
    $compUri = "$apiBase/solutioncomponents?\$select=objectid,componenttype&\$filter=" + [System.Web.HttpUtility]::UrlEncode("_solutionid_value eq $sid and componenttype eq 10039")  # 10039 = bot
    try {
        $compResp = Invoke-PPRest -Method GET -Uri $compUri -Headers $headers
    } catch { continue }
    foreach ($c in $compResp.value) {
        $bid = $c.objectid
        try {
            $b = Invoke-PPRest -Method GET -Uri "$apiBase/bots($bid)?\$select=botid,schemaname,name,publishedon" -Headers $headers
            $report.bots.total++
            if ($b.publishedon) {
                $report.bots.published++
                $report.publishedBots += @{ schemaname = $b.schemaname; name = $b.name; publishedon = $b.publishedon }
                Write-PPLog -Level Warn -Message ("Bot {0} is PUBLISHED (publishedon={1}). Not unpublishing automatically." -f $b.schemaname, $b.publishedon)
            } else {
                $report.bots.draft++
            }
        } catch { }
    }
}

$outPath = Join-Path $cfg.outDir 'target\off-report.json'
Write-PPJson -InputObject $report -Path $outPath
Write-PPLog -Level Info -Message ("Assert-PPResourcesOff: flows total={0} off={1} forced={2} failed={3}; bots total={4} published={5} draft={6}" -f $report.flows.total,$report.flows.off,$report.flows.forcedOff,$report.flows.failed,$report.bots.total,$report.bots.published,$report.bots.draft)
