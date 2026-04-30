<#
.SYNOPSIS
    Phase 4 safety net. Walks bot components, AI plugin definitions, and flow
    client data in the target environment, finds any source GUID that is still
    embedded, and PATCHes them to the target GUID via Web API.

.DESCRIPTION
    Pre-import GUID repair (Repair-PPSolutionGuids.ps1) handles 99% of cases by
    rewriting the unpacked solution before pack/import. This script is the
    safety net that catches remaining stragglers — useful when the operator
    manually edits a bot post-import or when target resources only existed
    after import (so source-vs-target diffs only became resolvable now).
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $Config,
    [string] $IdMapPath
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

if (-not $IdMapPath) { $IdMapPath = Join-Path $cfg.outDir 'target\id-map.json' }
$idMap = Read-PPJson -Path $IdMapPath -AsHashtable
$guidMap = @{}
foreach ($k in $idMap.guids.Keys) { $guidMap[$k.ToLower()] = $idMap.guids[$k].ToLower() }
$urlMap = @{}
foreach ($k in $idMap.urls.Keys) { $urlMap[$k] = $idMap.urls[$k] }

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

$guidPattern = '(?i)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'

function Replace-Embedded {
    param([string] $Text)
    if (-not $Text) { return @{ text = $Text; changes = 0 } }
    $changes = 0
    $out = $Text

    # Enumerate matches, then replace each unique source guid with literal-string Replace
    # (avoids closure scope issues with [regex]::Replace MatchEvaluator on PS 5.1).
    # NOTE: avoid the automatic $matches variable.
    $guidMatches = [regex]::Matches($out, $guidPattern)
    if ($guidMatches.Count -gt 0) {
        $uniqueSrc = @{}
        foreach ($m in $guidMatches) {
            $g = $m.Groups[1].Value.ToLower()
            if ($guidMap.ContainsKey($g) -and -not $uniqueSrc.ContainsKey($g)) { $uniqueSrc[$g] = $true }
        }
        foreach ($g in $uniqueSrc.Keys) {
            $cnt = ([regex]::Matches($out, [regex]::Escape($g), [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)).Count
            if ($cnt -gt 0) {
                $out = [regex]::Replace($out, [regex]::Escape($g), $guidMap[$g], [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
                $changes += $cnt
            }
        }
    }
    foreach ($from in ($urlMap.Keys | Sort-Object -Descending @{Expression={$_.Length}})) {
        if ($out.Contains($from)) {
            $changes += ([regex]::Matches($out, [regex]::Escape($from))).Count
            $out = $out.Replace($from, $urlMap[$from])
        }
    }
    return @{ text = $out; changes = $changes }
}

function Patch-EntityField {
    param([string] $EntitySet, [string] $IdField, [string] $TextField)
    $select = "$IdField,$TextField"
    $uri = "$apiBase/$EntitySet`?\$select=" + [System.Web.HttpUtility]::UrlEncode($select)
    $patched = 0
    while ($uri) {
        $resp = Invoke-PPRest -Method GET -Uri $uri -Headers $headers
        foreach ($row in $resp.value) {
            $val = $null
            if ($row.PSObject.Properties.Name -contains $TextField) { $val = $row.$TextField }
            $r = Replace-Embedded -Text $val
            if ($r.changes -gt 0) {
                $patchUri = "$apiBase/$EntitySet($($row.$IdField))"
                $body = @{ $TextField = $r.text }
                try {
                    Invoke-PPRest -Method PATCH -Uri $patchUri -Headers $headers -Body $body | Out-Null
                    $patched++
                    Write-PPLog -Level Info -Message ("Patched {0}({1}): {2} replacements" -f $EntitySet, $row.$IdField, $r.changes)
                } catch {
                    Write-PPLog -Level Warn -Message ("Patch failed {0}({1}): {2}" -f $EntitySet, $row.$IdField, $_.Exception.Message)
                }
            }
        }
        $uri = $resp.'@odata.nextLink'
    }
    return $patched
}

$totals = @{}
$totals.workflows     = Patch-EntityField -EntitySet 'workflows'     -IdField 'workflowid'     -TextField 'clientdata'
$totals.botcomponents = Patch-EntityField -EntitySet 'botcomponents' -IdField 'botcomponentid' -TextField 'data'
try { $totals.aiplugins = Patch-EntityField -EntitySet 'msdyn_aiplugins' -IdField 'msdyn_aipluginid' -TextField 'msdyn_schemas' } catch { Write-PPLog -Level Warn -Message "msdyn_aiplugins patch skipped: $($_.Exception.Message)" }

Write-PPLog -Level Info -Message ("Patch-PostImportReferences: {0}" -f (($totals.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ', '))
