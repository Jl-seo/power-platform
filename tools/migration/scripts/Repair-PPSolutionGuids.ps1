<#
.SYNOPSIS
    Walks an unpacked solution tree and replaces every source GUID and embedded
    URL with its target equivalent, using id-map.json. Idempotent: only matches
    source GUIDs.

.DESCRIPTION
    Targets these files:
      - bots/<botSchemaName>/topics/*.yaml
      - bots/<botSchemaName>/knowledgeSources/*.json
      - bots/<botSchemaName>/aiplugins/*.json
      - Workflows/*.json (Power Automate flow definitions)
      - Workflows/*.xml
      - environmentvariabledefinitions/*.xml
      - environmentvariabledefinitions/*/environmentvariablevalues/*.xml
      - aiplugins/*.json
      - Other/Solution.xml, Other/Customizations.xml
      - any file containing http/https URLs that match url-map keys

    Diff log is written to <Folder>/.repair-diff.log so the operator can audit.

.PARAMETER Folder
    Unpacked solution folder (output of `pac solution unpack`).

.PARAMETER IdMap
    Path to id-map.json produced by Build-IdMap.ps1.

.PARAMETER DryRun
    Show changes without writing back.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $Folder,
    [Parameter(Mandatory)][string] $IdMap,
    [switch] $DryRun
)

#Requires -Version 5.1
Set-StrictMode -Version 3.0
$ErrorActionPreference = 'Stop'
$PSDefaultParameterValues = @{
    'Out-File:Encoding'    = 'utf8'
    'Set-Content:Encoding' = 'utf8'
    'ConvertTo-Json:Depth' = 100
}

$libDir = Join-Path $PSScriptRoot 'lib'
Import-Module (Join-Path $libDir 'PPMigration.psm1') -Force

if (-not (Test-Path $Folder)) { throw "Folder not found: $Folder" }
if (-not (Test-Path $IdMap))  { throw "IdMap not found: $IdMap" }

$map = Read-PPJson -Path $IdMap -AsHashtable
$guidMap = @{}
foreach ($k in $map.guids.Keys) { $guidMap[$k.ToLower()] = $map.guids[$k].ToLower() }

# Add connection refs: replace connection-reference GUIDs in flow JSON
if ($map.byKind.ContainsKey('connectionRefs')) {
    foreach ($k in $map.byKind.connectionRefs.Keys) {
        $entry = $map.byKind.connectionRefs[$k]
        if ($entry.source -and $entry.target) { $guidMap[$entry.source.ToLower()] = $entry.target.ToLower() }
    }
}

$urlMap = @{}
foreach ($k in $map.urls.Keys) { $urlMap[$k] = $map.urls[$k] }

$diffPath = Join-Path $Folder '.repair-diff.log'
'' | Set-Content -LiteralPath $diffPath -Encoding utf8

$guidPattern = '(?i)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'

$totalFiles = 0
$changedFiles = 0
$totalReplacements = 0

$includeExt = @('.json','.yaml','.yml','.xml','.txt')

# Use foreach statement (parent-scope) so counters persist across iterations.
$files = Get-ChildItem -Path $Folder -Recurse -File | Where-Object { $includeExt -contains $_.Extension.ToLower() }

foreach ($file in $files) {
    $totalFiles++
    $path = $file.FullName
    $orig = [IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    $text = $orig
    $localCount = 0

    # GUID replacements: enumerate matches first, replace with single pass per unique source guid.
    # NOTE: avoid the automatic $matches variable - use $guidMatches.
    $guidMatches = [regex]::Matches($text, $guidPattern)
    if ($guidMatches.Count -gt 0) {
        $uniqueSrc = @{}
        foreach ($m in $guidMatches) {
            $g = $m.Groups[1].Value.ToLower()
            if ($guidMap.ContainsKey($g) -and -not $uniqueSrc.ContainsKey($g)) {
                $uniqueSrc[$g] = $true
            }
        }
        foreach ($g in $uniqueSrc.Keys) {
            $count = ([regex]::Matches($text, [regex]::Escape($g), [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)).Count
            if ($count -gt 0) {
                $text = [regex]::Replace($text, [regex]::Escape($g), $guidMap[$g], [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
                $localCount += $count
            }
        }
    }

    # URL replacements (longest key first to avoid prefix collisions)
    foreach ($from in ($urlMap.Keys | Sort-Object -Descending @{Expression={$_.Length}})) {
        if ($text.Contains($from)) {
            $count = ([regex]::Matches($text, [regex]::Escape($from))).Count
            $text = $text.Replace($from, $urlMap[$from])
            $localCount += $count
        }
    }

    if ($text -ne $orig) {
        $changedFiles++
        $totalReplacements += $localCount
        $rel = $path.Substring($Folder.Length).TrimStart('\','/')
        ("{0}: {1} replacements" -f $rel, $localCount) | Out-File -FilePath $diffPath -Append -Encoding utf8
        if (-not $DryRun) {
            [IO.File]::WriteAllText($path, $text, (New-Object Text.UTF8Encoding $false))
        }
    }
}

Write-PPLog -Level Info -Message ("Repair-PPSolutionGuids: scanned={0} changed={1} replacements={2} dryRun={3}" -f $totalFiles, $changedFiles, $totalReplacements, $DryRun.IsPresent)
Write-PPLog -Level Info -Message "Diff log: $diffPath"
