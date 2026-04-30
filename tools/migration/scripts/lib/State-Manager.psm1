#Requires -Version 5.1
Set-StrictMode -Version 3.0

# Persistent checkpoint + failure log for resumable migration runs.

Import-Module (Join-Path $PSScriptRoot 'PPMigration.psm1') -Force

$Script:State = $null
$Script:StatePath = $null
$Script:FailuresPath = $null

function Initialize-PPState {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $StateDir,
        [string] $StateFileName = 'state.json',
        [string] $FailuresFileName = 'failures.jsonl'
    )
    if (-not (Test-Path $StateDir)) { New-Item -ItemType Directory -Path $StateDir -Force | Out-Null }
    $Script:StatePath = Join-Path $StateDir $StateFileName
    $Script:FailuresPath = Join-Path $StateDir $FailuresFileName
    if (Test-Path $Script:StatePath) {
        $Script:State = Read-PPJson -Path $Script:StatePath -AsHashtable
        Write-PPLog -Level Info -Message ("Resuming state from {0}: lastPhase={1} lastStep={2}" -f $Script:StatePath, $Script:State.lastPhase, $Script:State.lastStep)
    } else {
        $Script:State = @{
            lastPhase     = $null
            lastStep      = $null
            completed     = @{
                Notifications = @{}
                PreFlight     = @{}
                Bootstrap     = @{ connections = @{} }
                Apply         = @{ imported = @(); guidsRepaired = @() }
                PostFlight    = @{}
            }
            asyncJobs     = @{}
            schemaVersion = 1
            startedUtc    = (Get-Date).ToUniversalTime().ToString('o')
        }
        Save-PPState
    }
}

function Save-PPState {
    if (-not $Script:StatePath) { return }
    Write-PPJson -InputObject $Script:State -Path $Script:StatePath
}

function Get-PPState { return $Script:State }

function Set-PPStateField {
    param(
        [Parameter(Mandatory)][string] $Phase,
        [Parameter(Mandatory)][string] $Key,
        $Value
    )
    if (-not $Script:State.completed.ContainsKey($Phase)) {
        $Script:State.completed[$Phase] = @{}
    }
    $Script:State.completed[$Phase][$Key] = $Value
    $Script:State.lastPhase = $Phase
    $Script:State.lastStep  = $Key
    Save-PPState
}

function Test-PPStepDone {
    param(
        [Parameter(Mandatory)][string] $Phase,
        [Parameter(Mandatory)][string] $Key,
        $ExpectedValue
    )
    if (-not $Script:State.completed.ContainsKey($Phase)) { return $false }
    $node = $Script:State.completed[$Phase]
    if (-not $node.ContainsKey($Key)) { return $false }
    if ($null -ne $ExpectedValue -and $node[$Key] -ne $ExpectedValue) { return $false }
    return $true
}

function Add-PPCompletedItem {
    param(
        [Parameter(Mandatory)][string] $Phase,
        [Parameter(Mandatory)][string] $Key,
        [Parameter(Mandatory)] $Item
    )
    if (-not $Script:State.completed.ContainsKey($Phase)) { $Script:State.completed[$Phase] = @{} }
    $node = $Script:State.completed[$Phase]
    if (-not $node.ContainsKey($Key)) { $node[$Key] = @() }
    if ($node[$Key] -isnot [System.Collections.IList]) { $node[$Key] = @($node[$Key]) }
    if ($node[$Key] -notcontains $Item) { $node[$Key] += $Item }
    Save-PPState
}

function Set-PPAsyncJob {
    param(
        [Parameter(Mandatory)][string] $ResourceKey,
        [Parameter(Mandatory)][string] $JobId,
        [string] $Status = 'InProgress'
    )
    $Script:State.asyncJobs[$ResourceKey] = @{ importJobId = $JobId; status = $Status; updatedUtc = (Get-Date).ToUniversalTime().ToString('o') }
    Save-PPState
}

function Write-PPFailure {
    param(
        [Parameter(Mandatory)][string] $Phase,
        [Parameter(Mandatory)][string] $Step,
        [string] $Resource,
        [Parameter(Mandatory)][string] $Error
    )
    if (-not $Script:FailuresPath) { return }
    $entry = @{
        ts       = (Get-Date).ToUniversalTime().ToString('o')
        phase    = $Phase
        step     = $Step
        resource = $Resource
        error    = $Error
    }
    ($entry | ConvertTo-Json -Depth 10 -Compress) | Out-File -FilePath $Script:FailuresPath -Append -Encoding utf8
}

Export-ModuleMember -Function Initialize-PPState, Save-PPState, Get-PPState, Set-PPStateField, Test-PPStepDone, Add-PPCompletedItem, Set-PPAsyncJob, Write-PPFailure
