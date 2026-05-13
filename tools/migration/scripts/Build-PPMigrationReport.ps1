<#
.SYNOPSIS
    Builds a CSV + simple HTML report from migration-plan.json.

    Outputs:
      out/migration-report.csv
      out/migration-report.html
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $Config
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

$planPath = Join-Path $cfg.outDir 'inventory\migration-plan.json'
if (-not (Test-Path $planPath)) { throw "migration-plan.json not found" }
$plan = Read-PPJson -Path $planPath -AsHashtable

$rows = @()
foreach ($e in $plan.entries) {
    $rows += [pscustomobject]@{
        BotSchema       = $e.bot.schemaname
        BotName         = $e.bot.name
        OwnerEmail      = $e.owner.email
        OwnerObjectId   = $e.owner.aadObjectId
        TargetEnvId     = if ($e.target) { $e.target.envId } else { '' }
        TargetEnvUrl    = if ($e.target) { $e.target.envUrl } else { '' }
        Status          = $e.status
        Solution        = $e.solutionUniqueName
        ImportJobId     = $e.importJobId
        StartedUtc      = $e.startedUtc
        CompletedUtc    = $e.completedUtc
        Error           = $e.errorMessage
    }
}

$csvPath = Join-Path $cfg.outDir 'migration-report.csv'
$rows | Export-Csv -Path $csvPath -NoTypeInformation -Encoding utf8
Write-PPLog -Level Info -Message "CSV report: $csvPath"

# HTML report
$summary = $plan.summary
$counts = @{}
foreach ($r in $rows) {
    $s = if ($r.Status) { $r.Status } else { 'unknown' }
    if (-not $counts.ContainsKey($s)) { $counts[$s] = 0 }
    $counts[$s]++
}
$summaryHtml = ($counts.GetEnumerator() | Sort-Object Name | ForEach-Object {
    "<span class='badge {0}'>{0}: {1}</span>" -f $_.Key, $_.Value
}) -join ' '

$rowsHtml = ($rows | ForEach-Object {
    $cls = "status-$($_.Status)"
    "<tr class='{0}'><td>{1}</td><td>{2}</td><td>{3}</td><td>{4}</td><td>{5}</td><td>{6}</td><td>{7}</td><td>{8}</td><td title='{9}'>{10}</td></tr>" -f `
        $cls, $_.BotSchema, ($_.BotName -replace '<','&lt;'), $_.OwnerEmail,
        $_.TargetEnvUrl, $_.Status, $_.Solution, $_.StartedUtc, $_.CompletedUtc,
        ($_.Error -replace "'","&#39;"), (if ($_.Error) { ($_.Error.Substring(0, [Math]::Min(60,$_.Error.Length))) } else { '' })
}) -join "`n"

$html = @"
<!doctype html>
<html><head><meta charset='utf-8'><title>PP Copilot Migration Report</title>
<style>
body { font-family: -apple-system, Segoe UI, sans-serif; margin: 20px; }
.badge { display:inline-block; padding:4px 10px; margin-right:8px; border-radius:12px; font-size:12px; color:white; }
.badge.ready, .badge.success { background:#107c10; }
.badge.fail { background:#d13438; }
.badge.skip-no-env, .badge.skip-filtered, .badge.skip-excluded, .badge.in-progress { background:#605e5c; }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { padding: 6px 10px; border-bottom: 1px solid #eee; text-align: left; vertical-align: top; }
th { background:#f3f2f1; }
tr.status-success td { background:#f3f9f1; }
tr.status-fail td    { background:#fdf3f4; }
tr.status-skip-no-env td { background:#faf9f8; color:#605e5c; }
.small { color:#605e5c; font-size: 12px; }
</style></head><body>
<h1>Power Platform — Per-Owner Copilot Migration Report</h1>
<p class='small'>Generated $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')</p>
<p>$summaryHtml</p>
<table>
<thead><tr><th>Bot Schema</th><th>Bot Name</th><th>Owner</th><th>Target Env</th><th>Status</th><th>Solution</th><th>Started</th><th>Completed</th><th>Error</th></tr></thead>
<tbody>
$rowsHtml
</tbody></table>
</body></html>
"@
$htmlPath = Join-Path $cfg.outDir 'migration-report.html'
$html | Set-Content -Path $htmlPath -Encoding utf8
Write-PPLog -Level Info -Message "HTML report: $htmlPath"
