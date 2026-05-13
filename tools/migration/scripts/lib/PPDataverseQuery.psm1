#Requires -Version 5.1
Set-StrictMode -Version 3.0

<#
PPDataverseQuery.psm1 — Reusable Dataverse Web API helpers.
Centralizes header building, paged GET ($all), and $batch operations.
#>

Import-Module (Join-Path $PSScriptRoot 'PPMigration.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'PPThrottle.psm1') -Force

function Get-DvHeaders {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $Token,
        [switch] $WithIfMatch,
        [switch] $ReturnRepresentation
    )
    $h = @{
        Authorization      = "Bearer $Token"
        'OData-MaxVersion' = '4.0'
        'OData-Version'    = '4.0'
        Accept             = 'application/json'
    }
    if ($ReturnRepresentation) { $h['Prefer'] = 'return=representation' }
    if ($WithIfMatch)          { $h['If-Match'] = '*' }
    return $h
}

function Get-DvApiBase {
    param([Parameter(Mandatory)][string] $EnvironmentUrl)
    return "$($EnvironmentUrl.TrimEnd('/'))/api/data/v9.2"
}

function Invoke-DvGet {
    <#
    .SYNOPSIS  GET against Dataverse Web API. Returns a single object (no auto-pagination).
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $EnvironmentUrl,
        [Parameter(Mandatory)][string] $Token,
        [Parameter(Mandatory)][string] $Path,           # e.g. "bots(<id>)" or "bots?$select=botid"
        [hashtable] $ExtraHeaders
    )
    $headers = Get-DvHeaders -Token $Token
    if ($ExtraHeaders) { foreach ($k in $ExtraHeaders.Keys) { $headers[$k] = $ExtraHeaders[$k] } }
    return (Invoke-PPRest -Method GET -Uri ((Get-DvApiBase $EnvironmentUrl) + '/' + $Path) -Headers $headers)
}

function Invoke-DvGetAll {
    <#
    .SYNOPSIS  Pages through @odata.nextLink and returns the concatenated value array.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $EnvironmentUrl,
        [Parameter(Mandatory)][string] $Token,
        [Parameter(Mandatory)][string] $EntitySet,
        [string] $Select,
        [string] $Filter,
        [string] $Expand,
        [int]    $Top
    )
    $headers = Get-DvHeaders -Token $Token
    $qs = @()
    if ($Select) { $qs += '$select=' + [System.Web.HttpUtility]::UrlEncode($Select) }
    if ($Filter) { $qs += '$filter=' + [System.Web.HttpUtility]::UrlEncode($Filter) }
    if ($Expand) { $qs += '$expand=' + [System.Web.HttpUtility]::UrlEncode($Expand) }
    if ($Top)    { $qs += '$top='    + [int]$Top }
    $uri = (Get-DvApiBase $EnvironmentUrl) + '/' + $EntitySet
    if ($qs) { $uri += '?' + ($qs -join '&') }
    $all = @()
    while ($uri) {
        $resp = Invoke-PPRest -Method GET -Uri $uri -Headers $headers
        if ($resp.value) { $all += $resp.value }
        if ($resp.PSObject.Properties.Name -contains '@odata.nextLink') {
            $uri = $resp.'@odata.nextLink'
        } else { $uri = $null }
    }
    return $all
}

function Invoke-DvAction {
    <#
    .SYNOPSIS  POST a bound or unbound action and return the response.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $EnvironmentUrl,
        [Parameter(Mandatory)][string] $Token,
        [Parameter(Mandatory)][string] $Action,        # e.g. "ExportSolutionAsync" or "bots(<id>)/Microsoft.Dynamics.CRM.PublishBot"
        $Body
    )
    $headers = Get-DvHeaders -Token $Token -ReturnRepresentation
    return (Invoke-PPRest -Method POST -Uri ((Get-DvApiBase $EnvironmentUrl) + '/' + $Action) -Headers $headers -Body $Body)
}

function Invoke-DvPatch {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $EnvironmentUrl,
        [Parameter(Mandatory)][string] $Token,
        [Parameter(Mandatory)][string] $Path,           # e.g. "workflows(<id>)"
        [Parameter(Mandatory)] $Body
    )
    $headers = Get-DvHeaders -Token $Token -WithIfMatch
    return (Invoke-PPRest -Method PATCH -Uri ((Get-DvApiBase $EnvironmentUrl) + '/' + $Path) -Headers $headers -Body $Body)
}

Export-ModuleMember -Function Get-DvHeaders, Get-DvApiBase, Invoke-DvGet, Invoke-DvGetAll, Invoke-DvAction, Invoke-DvPatch
