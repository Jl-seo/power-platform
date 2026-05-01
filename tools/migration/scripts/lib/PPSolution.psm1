#Requires -Version 5.1
Set-StrictMode -Version 3.0

<#
PPSolution.psm1 — pure-REST replacements for `pac solution export` and
`pac solution import`. Uses the documented Dataverse Web API actions:

  ExportSolutionAsync         POST /api/data/v9.2/ExportSolutionAsync
  DownloadSolutionExportData  POST /api/data/v9.2/DownloadSolutionExportData
  ImportSolutionAsync         POST /api/data/v9.2/ImportSolutionAsync
  AsyncOperation polling      GET  /api/data/v9.2/asyncoperations({id})

Hybrid: callers can `if (Test-PPPacAvailable)` to short-circuit to pac.
#>

Import-Module (Join-Path $PSScriptRoot 'PPMigration.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'PPThrottle.psm1') -Force

function Test-PPPacAvailable {
    [CmdletBinding()] param()
    return [bool](Get-Command pac -ErrorAction SilentlyContinue)
}

function _Wait-PPAsyncOp {
    param(
        [Parameter(Mandatory)][string] $ApiBase,
        [Parameter(Mandatory)][hashtable] $Headers,
        [Parameter(Mandatory)][string] $AsyncOperationId,
        [int] $TimeoutMin = 60,
        [int] $PollSec = 5,
        [string] $Label = 'asyncop'
    )
    $deadline = [DateTime]::UtcNow.AddMinutes($TimeoutMin)
    $lastMsg = ''
    while ([DateTime]::UtcNow -lt $deadline) {
        $uri = "$ApiBase/asyncoperations($AsyncOperationId)?`$select=statecode,statuscode,messagename,friendlymessage,_ownerid_value"
        $r = Invoke-PPRest -Method GET -Uri $uri -Headers $Headers
        $state  = [int]$r.statecode    # 0 Ready, 1 Suspended, 2 Locked, 3 Completed
        $status = [int]$r.statuscode   # ... 30 Succeeded, 31 Failed, 32 Cancelled
        if ($r.friendlymessage -and $r.friendlymessage -ne $lastMsg) {
            Write-PPLog -Level Debug -Message ("[{0}] {1}" -f $Label, $r.friendlymessage)
            $lastMsg = $r.friendlymessage
        }
        if ($state -eq 3) {
            if ($status -eq 30) { return $r }
            throw "$Label failed (statuscode=$status): $($r.friendlymessage)"
        }
        Start-Sleep -Seconds $PollSec
    }
    throw "$Label timed out after $TimeoutMin min (asyncop=$AsyncOperationId)"
}

function _Get-DvHeaders {
    param([Parameter(Mandatory)][string] $Token, [switch] $WithIfMatch)
    $h = @{
        Authorization      = "Bearer $Token"
        'OData-MaxVersion' = '4.0'
        'OData-Version'    = '4.0'
        Accept             = 'application/json'
        Prefer             = 'return=representation'
    }
    if ($WithIfMatch) { $h['If-Match'] = '*' }
    return $h
}

function Export-PPSolutionRest {
    <#
    .SYNOPSIS  Exports a solution as Unmanaged via REST and writes a zip to disk.
    .OUTPUTS   FileInfo of the produced zip.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $EnvironmentUrl,
        [Parameter(Mandatory)][string] $Token,
        [Parameter(Mandatory)][string] $SolutionName,
        [Parameter(Mandatory)][string] $OutZipPath,
        [switch] $Managed,
        [switch] $ExportAutoNumberingSettings,
        [switch] $ExportCalendarSettings,
        [switch] $ExportCustomizationSettings,
        [switch] $ExportEmailTrackingSettings,
        [switch] $ExportGeneralSettings,
        [switch] $ExportMarketingSettings,
        [switch] $ExportOutlookSynchronizationSettings,
        [switch] $ExportRelationshipRoles,
        [switch] $ExportIsvConfig,
        [switch] $ExportSales,
        [int] $TimeoutMin = 60
    )
    $apiBase = "$($EnvironmentUrl.TrimEnd('/'))/api/data/v9.2"
    $headers = _Get-DvHeaders -Token $Token

    Write-PPLog -Level Info -Message "Export (REST): $SolutionName -> $OutZipPath"
    $body = @{
        SolutionName = $SolutionName
        Managed      = [bool]$Managed
        ExportAutoNumberingSettings         = [bool]$ExportAutoNumberingSettings
        ExportCalendarSettings              = [bool]$ExportCalendarSettings
        ExportCustomizationSettings         = [bool]$ExportCustomizationSettings
        ExportEmailTrackingSettings         = [bool]$ExportEmailTrackingSettings
        ExportGeneralSettings               = [bool]$ExportGeneralSettings
        ExportMarketingSettings             = [bool]$ExportMarketingSettings
        ExportOutlookSynchronizationSettings= [bool]$ExportOutlookSynchronizationSettings
        ExportRelationshipRoles             = [bool]$ExportRelationshipRoles
        ExportIsvConfig                     = [bool]$ExportIsvConfig
        ExportSales                         = [bool]$ExportSales
    }
    $resp = Invoke-PPRest -Method POST -Uri "$apiBase/ExportSolutionAsync" -Headers $headers -Body $body
    $asyncOpId = $resp.AsyncOperationId
    $exportJobId = $resp.ExportJobId
    if (-not $asyncOpId) { throw "ExportSolutionAsync did not return AsyncOperationId" }

    _Wait-PPAsyncOp -ApiBase $apiBase -Headers $headers -AsyncOperationId $asyncOpId -TimeoutMin $TimeoutMin -Label "Export[$SolutionName]" | Out-Null

    $dl = Invoke-PPRest -Method POST -Uri "$apiBase/DownloadSolutionExportData" -Headers $headers `
            -Body @{ ExportJobId = $exportJobId }
    if (-not $dl.ExportSolutionFile) { throw "DownloadSolutionExportData did not return ExportSolutionFile" }

    $bytes = [Convert]::FromBase64String($dl.ExportSolutionFile)
    $dir = Split-Path -Parent $OutZipPath
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    [IO.File]::WriteAllBytes($OutZipPath, $bytes)
    Write-PPLog -Level Info -Message ("Export OK: {0} bytes -> {1}" -f $bytes.Length, $OutZipPath)
    return (Get-Item $OutZipPath)
}

function Convert-DeploymentSettingsToComponentParameters {
    <#
    .SYNOPSIS  Maps our deploymentSettings.json (pac format) into the
               ComponentParameters[] payload that ImportSolutionAsync expects.
    #>
    param([Parameter(Mandatory)][hashtable] $DeploymentSettings)
    $cp = New-Object System.Collections.ArrayList

    if ($DeploymentSettings.ContainsKey('ConnectionReferences')) {
        foreach ($ref in $DeploymentSettings.ConnectionReferences) {
            if (-not $ref.LogicalName -or -not $ref.ConnectionId) { continue }
            $null = $cp.Add(@{
                '@odata.type'                    = 'Microsoft.Dynamics.CRM.connectionreference'
                connectionreferencelogicalname   = $ref.LogicalName
                connectionid                     = $ref.ConnectionId
            })
        }
    }
    if ($DeploymentSettings.ContainsKey('EnvironmentVariables')) {
        foreach ($ev in $DeploymentSettings.EnvironmentVariables) {
            if (-not $ev.SchemaName) { continue }
            if ($null -eq $ev.Value -or $ev.Value -eq '') { continue }
            $null = $cp.Add(@{
                '@odata.type' = 'Microsoft.Dynamics.CRM.environmentvariablevalue'
                schemaname    = $ev.SchemaName
                value         = [string]$ev.Value
            })
        }
    }
    return ,$cp.ToArray()
}

function Import-PPSolutionRest {
    <#
    .SYNOPSIS  Imports a solution zip via ImportSolutionAsync, then waits.
               Does NOT activate workflows (PublishWorkflows=false) and does NOT
               convert to managed — both are by-design for the migration toolkit.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $EnvironmentUrl,
        [Parameter(Mandatory)][string] $Token,
        [Parameter(Mandatory)][string] $SolutionZipPath,
        [string] $DeploymentSettingsPath,
        [switch] $OverwriteUnmanagedCustomizations,
        [int] $TimeoutMin = 90
    )
    $apiBase = "$($EnvironmentUrl.TrimEnd('/'))/api/data/v9.2"
    $headers = _Get-DvHeaders -Token $Token

    if (-not (Test-Path $SolutionZipPath)) { throw "Zip not found: $SolutionZipPath" }
    $bytes = [IO.File]::ReadAllBytes($SolutionZipPath)
    $b64   = [Convert]::ToBase64String($bytes)
    $importJobId = [Guid]::NewGuid().ToString()

    $componentParams = @()
    if ($DeploymentSettingsPath -and (Test-Path $DeploymentSettingsPath)) {
        $ds = Read-PPJson -Path $DeploymentSettingsPath -AsHashtable
        $componentParams = Convert-DeploymentSettingsToComponentParameters -DeploymentSettings $ds
        Write-PPLog -Level Info -Message ("Mapped {0} ComponentParameters from settings" -f $componentParams.Count)
    }

    $body = @{
        CustomizationFile                = $b64
        OverwriteUnmanagedCustomizations = [bool]$OverwriteUnmanagedCustomizations
        PublishWorkflows                 = $false                      # keep flows OFF
        ImportJobId                      = $importJobId
        ConvertToManaged                 = $false                      # all-unmanaged migration
        SkipProductUpdateDependencies    = $false
        HoldingSolution                  = $false
        ComponentParameters              = $componentParams
    }

    Write-PPLog -Level Info -Message ("Import (REST): {0} bytes, ImportJobId={1}" -f $bytes.Length, $importJobId)
    $resp = Invoke-PPRest -Method POST -Uri "$apiBase/ImportSolutionAsync" -Headers $headers -Body $body
    $asyncOpId = $resp.AsyncOperationId
    if (-not $asyncOpId) { throw "ImportSolutionAsync did not return AsyncOperationId" }

    _Wait-PPAsyncOp -ApiBase $apiBase -Headers $headers -AsyncOperationId $asyncOpId -TimeoutMin $TimeoutMin -Label "Import[$([IO.Path]::GetFileName($SolutionZipPath))]" | Out-Null

    # Pull the import log for diagnostics
    try {
        $log = Invoke-PPRest -Method POST -Uri "$apiBase/RetrieveFormattedImportJobResults" -Headers $headers `
                -Body @{ ImportJobId = $importJobId }
        if ($log.FormattedResults) {
            $logDir = Split-Path -Parent $SolutionZipPath
            $logPath = Join-Path $logDir ("import-{0}.xml" -f $importJobId)
            $log.FormattedResults | Set-Content -Path $logPath -Encoding utf8
            Write-PPLog -Level Info -Message "Import log: $logPath"
        }
    } catch {
        Write-PPLog -Level Debug -Message "RetrieveFormattedImportJobResults skipped: $($_.Exception.Message)"
    }
    Write-PPLog -Level Info -Message "Import OK: $SolutionZipPath"
    return $importJobId
}

Export-ModuleMember -Function Test-PPPacAvailable, Export-PPSolutionRest, Import-PPSolutionRest, Convert-DeploymentSettingsToComponentParameters
