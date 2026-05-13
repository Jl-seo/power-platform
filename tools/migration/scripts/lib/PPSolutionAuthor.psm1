#Requires -Version 5.1
Set-StrictMode -Version 3.0

<#
PPSolutionAuthor.psm1 — Create solutions and add components in source env.

Used to assemble a temporary per-owner solution containing one bot + its
direct dependencies, ready for export.
#>

Import-Module (Join-Path $PSScriptRoot 'PPMigration.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'PPDataverseQuery.psm1') -Force

# Component types relevant to the per-owner Copilot migration
$Script:ComponentType = @{
    Workflow                       = 29
    Connector                      = 372    # custom connector (canvas/cloud connector entity)
    EnvironmentVariableDefinition  = 380
    EnvironmentVariableValue       = 381
    Bot                            = 10039
    BotComponent                   = 10042
    AIPlugin                       = 10095
    AIPluginVersion                = 10096
    AIPluginOperation              = 10100
    KnowledgeSource                = 10104
    ConnectionReference            = 10119
}

function Get-PPComponentType { return $Script:ComponentType }

function Get-PPMigrationPublisher {
    <#
    .SYNOPSIS  Ensures the migration publisher exists in the source env. Returns its publisherid.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $EnvironmentUrl,
        [Parameter(Mandatory)][string] $Token,
        [string] $UniqueName  = 'pp_migration',
        [string] $DisplayName = 'PP Migration',
        [string] $Prefix      = 'pp'
    )
    $existing = Invoke-DvGetAll -EnvironmentUrl $EnvironmentUrl -Token $Token `
        -EntitySet 'publishers' -Select 'publisherid,uniquename,customizationprefix' `
        -Filter ("uniquename eq '{0}'" -f $UniqueName)
    if ($existing -and $existing.Count -gt 0) {
        Write-PPLog -Level Debug -Message "Publisher exists: $UniqueName"
        return $existing[0].publisherid
    }
    Write-PPLog -Level Info -Message "Creating publisher $UniqueName ($Prefix)"
    $body = @{
        uniquename            = $UniqueName
        friendlyname          = $DisplayName
        customizationprefix   = $Prefix
        customizationoptionvalueprefix = 12345
    }
    $created = Invoke-PPRest -Method POST `
        -Uri ((Get-DvApiBase $EnvironmentUrl) + '/publishers') `
        -Headers (Get-DvHeaders -Token $Token -ReturnRepresentation) `
        -Body $body
    return $created.publisherid
}

function New-PPSolution {
    <#
    .SYNOPSIS  Creates a new (Unmanaged) solution in the source environment.
    .OUTPUTS   The created solution's uniquename.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $EnvironmentUrl,
        [Parameter(Mandatory)][string] $Token,
        [Parameter(Mandatory)][string] $UniqueName,
        [Parameter(Mandatory)][string] $FriendlyName,
        [Parameter(Mandatory)][string] $PublisherId,
        [string] $Version = '1.0.0.0',
        [string] $Description
    )
    # Skip if already exists (idempotent re-run)
    $existing = Invoke-DvGetAll -EnvironmentUrl $EnvironmentUrl -Token $Token `
        -EntitySet 'solutions' -Select 'solutionid,uniquename' `
        -Filter ("uniquename eq '{0}'" -f $UniqueName)
    if ($existing -and $existing.Count -gt 0) {
        Write-PPLog -Level Info -Message "Solution exists: $UniqueName (skip create)"
        return $UniqueName
    }
    $body = @{
        uniquename                  = $UniqueName
        friendlyname                = $FriendlyName
        version                     = $Version
        'publisherid@odata.bind'    = "/publishers($PublisherId)"
    }
    if ($Description) { $body.description = $Description }
    Write-PPLog -Level Info -Message "Creating solution: $UniqueName"
    $resp = Invoke-PPRest -Method POST `
        -Uri ((Get-DvApiBase $EnvironmentUrl) + '/solutions') `
        -Headers (Get-DvHeaders -Token $Token -ReturnRepresentation) `
        -Body $body
    return $UniqueName
}

function Add-PPSolutionComponent {
    <#
    .SYNOPSIS  Adds one component to a solution via AddSolutionComponent unbound action.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $EnvironmentUrl,
        [Parameter(Mandatory)][string] $Token,
        [Parameter(Mandatory)][string] $SolutionUniqueName,
        [Parameter(Mandatory)][string] $ComponentId,    # GUID of the entity instance
        [Parameter(Mandatory)][int]    $ComponentType,  # int from $Script:ComponentType
        [switch] $AddRequiredComponents,
        [switch] $DoNotIncludeSubcomponents
    )
    $body = @{
        ComponentId               = $ComponentId
        ComponentType             = $ComponentType
        SolutionUniqueName        = $SolutionUniqueName
        AddRequiredComponents     = [bool]$AddRequiredComponents
        DoNotIncludeSubcomponents = [bool]$DoNotIncludeSubcomponents
    }
    try {
        Invoke-PPRest -Method POST `
            -Uri ((Get-DvApiBase $EnvironmentUrl) + '/AddSolutionComponent') `
            -Headers (Get-DvHeaders -Token $Token) `
            -Body $body | Out-Null
        Write-PPLog -Level Debug -Message ("Added component {0} ({1}) to {2}" -f $ComponentId, $ComponentType, $SolutionUniqueName)
        return $true
    } catch {
        # Components already in the solution return 4xx with a distinct message; treat as benign
        if ($_.Exception.Message -match 'already exists|0x80048473|0x8004F00C') {
            Write-PPLog -Level Debug -Message ("Component {0} already in {1} (skip)" -f $ComponentId, $SolutionUniqueName)
            return $true
        }
        Write-PPLog -Level Warn -Message ("AddSolutionComponent failed for {0} ({1}): {2}" -f $ComponentId, $ComponentType, $_.Exception.Message)
        throw
    }
}

function Remove-PPSolution {
    <#
    .SYNOPSIS  Deletes an unmanaged solution by uniquename.  Used for cleanup after success.
    #>
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [Parameter(Mandatory)][string] $EnvironmentUrl,
        [Parameter(Mandatory)][string] $Token,
        [Parameter(Mandatory)][string] $UniqueName
    )
    $sln = Invoke-DvGetAll -EnvironmentUrl $EnvironmentUrl -Token $Token `
        -EntitySet 'solutions' -Select 'solutionid' -Filter ("uniquename eq '{0}'" -f $UniqueName)
    if (-not $sln -or $sln.Count -eq 0) { return }
    if ($PSCmdlet.ShouldProcess($UniqueName, 'Delete solution')) {
        Invoke-PPRest -Method DELETE `
            -Uri ((Get-DvApiBase $EnvironmentUrl) + ('/solutions(' + $sln[0].solutionid + ')')) `
            -Headers (Get-DvHeaders -Token $Token) | Out-Null
        Write-PPLog -Level Info -Message "Deleted solution: $UniqueName"
    }
}

Export-ModuleMember -Function Get-PPComponentType, Get-PPMigrationPublisher, New-PPSolution, Add-PPSolutionComponent, Remove-PPSolution
