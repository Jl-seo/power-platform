#Requires -Version 5.1
Set-StrictMode -Version 3.0

<#
PPConnectionRest.psm1 — REST replacement for `pac connection create -t -a -cs`
on the Dataverse-class connector. Uses the Power Apps RP environment-scoped
connection PUT endpoint with connectionParameters carrying the SPN credentials.

Caveat: connectionParameters schema for shared_commondataserviceforapps SPN
is partially undocumented. The shape used below matches what the maker portal
sends. If your tenant's CDS connector advertises different parameter names,
use Get-PPConnectionParameterSchema to introspect, then patch the body.
#>

Import-Module (Join-Path $PSScriptRoot 'PPMigration.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'PPThrottle.psm1') -Force

function Get-PPConnectionParameterSchema {
    <#
    .SYNOPSIS  Reads the connector definition to discover its
               connectionParameters[] schema (parameter names, types). Useful when
               an SPN connection PUT fails with "invalid parameter" — diff against
               this schema.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $Token,
        [Parameter(Mandatory)][string] $EnvironmentId,
        [Parameter(Mandatory)][string] $ConnectorId   # /providers/Microsoft.PowerApps/apis/<id>
    )
    $shortId = ($ConnectorId -replace '^.*/apis/', '')
    $base = 'https://api.powerapps.com'
    $apiVer = '2020-06-01'
    $uri = "$base/providers/Microsoft.PowerApps/apis/$shortId`?`$expand=properties/connectionParameters&api-version=$apiVer"
    $headers = @{ Authorization = "Bearer $Token" }
    return (Invoke-PPRest -Method GET -Uri $uri -Headers $headers).properties.connectionParameters
}

function New-PPConnectionSpn {
    <#
    .SYNOPSIS  Creates a Dataverse SPN connection in the target environment via
               REST PUT (no pac CLI). Returns @{ logicalName; connectionId;
               connectorId; authMode='SPN'; displayName }.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $Token,
        [Parameter(Mandatory)][string] $EnvironmentId,
        [Parameter(Mandatory)][string] $EnvironmentUrl,
        [Parameter(Mandatory)][string] $TenantId,
        [Parameter(Mandatory)][string] $AppId,
        [Parameter(Mandatory)][System.Security.SecureString] $ClientSecret,
        [Parameter(Mandatory)][string] $ConnectorId,    # /providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps
        [Parameter(Mandatory)][string] $ConnectionName, # logicalName-style id, MUST match the connection-reference logical name suffix
        [Parameter(Mandatory)][string] $DisplayName,
        [int] $PollSec = 5,
        [int] $MaxWaitMin = 5
    )
    $shortConnectorId = ($ConnectorId -replace '^.*/apis/', '')
    $base = 'https://api.powerapps.com'
    $apiVer = '2020-06-01'
    $uri = "$base/providers/Microsoft.PowerApps/apis/$shortConnectorId/connections/$([System.Web.HttpUtility]::UrlEncode($ConnectionName))?api-version=$apiVer"

    $headers = @{ Authorization = "Bearer $Token" }
    $secretPlain = ConvertFrom-PPSecureString $ClientSecret
    Add-PPLogRedaction -Values @($secretPlain)

    # Best-known shape for shared_commondataserviceforapps with SPN.  If your tenant uses a different
    # parameter set, use Get-PPConnectionParameterSchema and adjust the keys here.
    $connParams = @{
        'token:TenantId'         = $TenantId
        'token:clientId'         = $AppId
        'token:clientSecret'     = $secretPlain
        'token:resourceUri'      = $EnvironmentUrl
    }

    $body = @{
        properties = @{
            displayName          = $DisplayName
            environment          = @{
                id   = "/providers/Microsoft.PowerApps/environments/$EnvironmentId"
                name = $EnvironmentId
            }
            connectionParameters = $connParams
        }
    }

    Write-PPLog -Level Info -Message ("REST PUT connection {0} (SPN)" -f $ConnectionName)
    $resp = $null
    try {
        $resp = Invoke-PPRest -Method PUT -Uri $uri -Headers $headers -Body $body
    } finally {
        Remove-Variable secretPlain -ErrorAction SilentlyContinue
    }

    # Poll for Connected
    $deadline = [DateTime]::UtcNow.AddMinutes($MaxWaitMin)
    while ([DateTime]::UtcNow -lt $deadline) {
        Start-Sleep -Seconds $PollSec
        $check = Invoke-PPRest -Method GET -Uri $uri -Headers $headers
        $status = $null
        if ($check.properties.PSObject.Properties.Name -contains 'statuses' -and $check.properties.statuses) {
            $status = $check.properties.statuses[0].status
        }
        if ($status -eq 'Connected') {
            return @{
                logicalName  = $ConnectionName
                connectionId = $check.name
                connectorId  = $ConnectorId
                authMode     = 'SPN'
                displayName  = $DisplayName
            }
        }
        Write-PPLog -Level Debug -Message ("Connection {0} status: {1}" -f $ConnectionName, $status)
    }
    throw "SPN connection $ConnectionName did not reach Connected within $MaxWaitMin min"
}

Export-ModuleMember -Function Get-PPConnectionParameterSchema, New-PPConnectionSpn
