<#
.SYNOPSIS
    Drift detection: compares source inventory + connection-bootstrap with the
    target's current state. Produces reconcile-plan.json listing missing items
    and the corrective steps. With -Apply, runs the targeted fixes.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $Config,
    [switch] $Apply
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

$plan = @{
    timestamp = (Get-Date).ToUniversalTime().ToString('o')
    actions   = @()
}

# Missing connections?
$bsPath = Join-Path $PSScriptRoot '..\templates\connection-bootstrap.json'
$cmPath = Join-Path $cfg.outDir 'target\connection-map.json'
if ((Test-Path $bsPath) -and (Test-Path $cmPath)) {
    $bs = Read-PPJson -Path $bsPath -AsHashtable
    $cm = Read-PPJson -Path $cmPath -AsHashtable
    foreach ($e in $bs.connections) {
        if (-not $cm.ContainsKey($e.logicalName) -or -not $cm[$e.logicalName].connectionId) {
            $plan.actions += @{
                step      = 'NewConnection'
                logical   = $e.logicalName
                authMode  = $e.authMode
                command   = ".\scripts\New-PPConnections.ps1 -Config <cfg> -OnlyLogicalName $($e.logicalName)"
            }
        }
    }
}

# Missing solutions?
$secret = Get-PPSecret -Name $cfg.secrets.spnClientSecret
$tok = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId -Resource $cfg.targetEnvUrl -ClientSecret $secret
$headers = @{ Authorization = "Bearer $tok"; 'OData-MaxVersion' = '4.0'; 'OData-Version' = '4.0'; Accept = 'application/json' }
$apiBase = "$($cfg.targetEnvUrl.TrimEnd('/'))/api/data/v9.2"

foreach ($u in $cfg.solutions) {
    $uri = "$apiBase/solutions?\$select=solutionid&\$filter=" + [System.Web.HttpUtility]::UrlEncode("uniquename eq '$u'")
    $resp = Invoke-PPRest -Method GET -Uri $uri -Headers $headers
    if (-not $resp.value -or $resp.value.Count -eq 0) {
        $plan.actions += @{ step = 'ImportSolution'; solution = $u; command = ".\scripts\Invoke-FullMigration.ps1 -Phase Apply -OnlySolutions $u" }
    }
}

# Stale source GUIDs lingering?  Quick check: scan a sample of botcomponents
$sourceIdsPath = Join-Path $cfg.outDir 'source\source-ids.json'
if (Test-Path $sourceIdsPath) {
    $src = Read-PPJson -Path $sourceIdsPath -AsHashtable
    $sourceGuids = @{}
    foreach ($section in @('workflows','aiplugins','aimodels','bots','envVars','connectors','connectionRefs')) {
        if ($src.ContainsKey($section)) {
            foreach ($v in $src[$section].Values) { $sourceGuids[$v.ToLower()] = $section }
        }
    }
    $bcUri = "$apiBase/botcomponents?\$select=botcomponentid,name,data&\$top=50"
    try {
        $bc = Invoke-PPRest -Method GET -Uri $bcUri -Headers $headers
        foreach ($c in $bc.value) {
            if (-not $c.data) { continue }
            foreach ($g in $sourceGuids.Keys) {
                if ($c.data.ToLower().Contains($g)) {
                    $plan.actions += @{ step = 'PatchPostImport'; botcomponentid = $c.botcomponentid; sourceGuid = $g; command = ".\scripts\Patch-PostImportReferences.ps1 -Config <cfg>" }
                    break
                }
            }
        }
    } catch { Write-PPLog -Level Warn -Message "botcomponents sample scan failed: $($_.Exception.Message)" }
}

$planPath = Join-Path $cfg.outDir 'target\reconcile-plan.json'
Write-PPJson -InputObject $plan -Path $planPath
Write-PPLog -Level Info -Message "Reconcile plan: $planPath ($(($plan.actions).Count) actions)"

if ($Apply -and $plan.actions.Count -gt 0) {
    Write-PPLog -Level Info -Message "Executing reconcile actions"
    foreach ($a in $plan.actions) {
        switch ($a.step) {
            'NewConnection'  {
                & (Join-Path $PSScriptRoot 'New-PPConnections.ps1') -Config $Config -OnlyLogicalName $a.logical
            }
            'ImportSolution' {
                Write-PPLog -Level Warn -Message "ImportSolution requires running Phase Apply for $($a.solution); please re-run orchestrator"
            }
            'PatchPostImport' {
                & (Join-Path $PSScriptRoot 'Patch-PostImportReferences.ps1') -Config $Config
                break  # one pass covers everything
            }
        }
    }
}
