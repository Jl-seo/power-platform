#Requires -Version 5.1
Set-StrictMode -Version 3.0

<#
PPAdminBap.psm1 — Power Platform admin (BAP) API wrappers.

Used to enumerate Developer environments and resolve their metadata
(owner, instance URL, region) for the per-owner Copilot migration.

Endpoint base:  https://api.bap.microsoft.com
Token audience: https://api.bap.microsoft.com  (acquire via Get-PPSpnToken)
#>

Import-Module (Join-Path $PSScriptRoot 'PPMigration.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'PPThrottle.psm1') -Force

$Script:BapBase = 'https://api.bap.microsoft.com'
$Script:ApiVer  = '2020-10-01'

function _BapHeaders {
    param([Parameter(Mandatory)][string] $Token)
    return @{
        Authorization = "Bearer $Token"
        Accept        = 'application/json'
    }
}

function Get-PPEnvironmentsAll {
    <#
    .SYNOPSIS  Lists every environment in the tenant via BAP admin API.
    .OUTPUTS   PSCustomObject[] of environment records.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $Token,
        [string] $Filter,
        [string] $Expand = 'properties/linkedEnvironmentMetadata,permissions'
    )
    $headers = _BapHeaders -Token $Token
    $all = @()
    $qs = @("api-version=$Script:ApiVer")
    if ($Filter) { $qs += '$filter=' + [System.Web.HttpUtility]::UrlEncode($Filter) }
    if ($Expand) { $qs += '$expand=' + [System.Web.HttpUtility]::UrlEncode($Expand) }
    $uri = "$Script:BapBase/providers/Microsoft.BusinessAppPlatform/scopes/admin/environments?" + ($qs -join '&')
    while ($uri) {
        $resp = Invoke-PPRest -Method GET -Uri $uri -Headers $headers
        if ($resp.value) { $all += $resp.value }
        $uri = $resp.nextLink
    }
    return $all
}

function Get-PPEnvironment {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $Token,
        [Parameter(Mandatory)][string] $EnvironmentId
    )
    $headers = _BapHeaders -Token $Token
    $uri = "$Script:BapBase/providers/Microsoft.BusinessAppPlatform/scopes/admin/environments/$EnvironmentId`?api-version=$Script:ApiVer&`$expand=properties/linkedEnvironmentMetadata,permissions"
    return (Invoke-PPRest -Method GET -Uri $uri -Headers $headers)
}

function Get-PPDeveloperEnvironments {
    <#
    .SYNOPSIS  Returns Developer-SKU environments with owner mapping.
    .OUTPUTS   Array of @{ envId; envName; envUrl; ownerObjectId; ownerEmail; region; createdUtc }.
    #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string] $Token)

    # environmentSku for personal dev envs is 'Developer' (also seen as 'Trial-Internal' for some legacy)
    $envs = Get-PPEnvironmentsAll -Token $Token -Filter "properties/environmentSku eq 'Developer'"
    Write-PPLog -Level Info -Message ("BAP: {0} Developer environments found" -f $envs.Count)

    $result = @()
    foreach ($e in $envs) {
        $props = $e.properties
        $owner = $null
        $ownerEmail = $null
        # Several places carry owner identity; check in order
        if ($props.PSObject.Properties.Name -contains 'createdBy' -and $props.createdBy) {
            $owner      = $props.createdBy.id
            $ownerEmail = $props.createdBy.email
        }
        if ((-not $owner) -and $props.PSObject.Properties.Name -contains 'principal' -and $props.principal) {
            $owner      = $props.principal.id
            $ownerEmail = $props.principal.email
        }
        if ((-not $owner) -and $props.PSObject.Properties.Name -contains 'linkedEnvironmentMetadata' -and $props.linkedEnvironmentMetadata) {
            $lm = $props.linkedEnvironmentMetadata
            if ($lm.PSObject.Properties.Name -contains 'createdBy' -and $lm.createdBy) {
                $owner      = $lm.createdBy.id
                $ownerEmail = $lm.createdBy.email
            }
        }

        $url = $null
        if ($props.PSObject.Properties.Name -contains 'linkedEnvironmentMetadata' -and $props.linkedEnvironmentMetadata) {
            $url = $props.linkedEnvironmentMetadata.instanceUrl
        }

        $result += [pscustomobject]@{
            envId          = $e.name                                            # GUID
            envName        = $props.displayName
            envUrl         = $url
            ownerObjectId  = $owner
            ownerEmail     = $ownerEmail
            region         = $props.azureRegion
            sku            = $props.environmentSku
            createdUtc     = $props.createdTime
        }
    }
    return $result
}

Export-ModuleMember -Function Get-PPEnvironmentsAll, Get-PPEnvironment, Get-PPDeveloperEnvironments
