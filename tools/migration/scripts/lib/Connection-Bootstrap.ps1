#Requires -Version 5.1
Set-StrictMode -Version 3.0

# OAuth interactive bootstrap for connectors that cannot use SPN
# (SharePoint, Office 365 Users, Outlook, Teams, Approvals, Planner, etc.)
#
# Usage:
#   . .\lib\Connection-Bootstrap.ps1
#   New-PPOAuthConnection -EnvironmentId orgxxx -EnvironmentUrl https://orgxxx.crm.dynamics.com `
#       -TenantId <tenant> -DisplayName 'SharePoint (bootstrap)' `
#       -ConnectorId '/providers/Microsoft.PowerApps/apis/shared_sharepointonline' `
#       -ConnectionName cr_sharedsharepointonline_xxxx

Import-Module (Join-Path $PSScriptRoot 'PPMigration.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'PPThrottle.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'PPAuth.psm1') -Force

function New-PPOAuthConnection {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $EnvironmentId,
        [Parameter(Mandatory)][string] $EnvironmentUrl,
        [Parameter(Mandatory)][string] $TenantId,
        [Parameter(Mandatory)][string] $ConnectorId,    # /providers/Microsoft.PowerApps/apis/shared_sharepointonline
        [Parameter(Mandatory)][string] $ConnectionName, # logicalName-style identifier
        [Parameter(Mandatory)][string] $DisplayName,
        [hashtable] $ConnectionParameters = @{},
        [int] $PollSeconds = 5,
        [int] $MaxWaitMin = 10
    )

    $token = Get-PPDeviceCodeToken -TenantId $TenantId -Resource 'https://service.powerapps.com'
    $headers = @{ Authorization = "Bearer $token" }

    $apiVer = '2020-06-01'
    $base = 'https://api.powerapps.com'
    $shortConnectorId = ($ConnectorId -replace '^.*/apis/', '')
    $uri = "{0}/providers/Microsoft.PowerApps/apis/{1}/connections/{2}?api-version={3}" -f `
           $base, $shortConnectorId, [System.Web.HttpUtility]::UrlEncode($ConnectionName), $apiVer

    $body = @{
        properties = @{
            displayName          = $DisplayName
            environment          = @{ id   = "/providers/Microsoft.PowerApps/environments/$EnvironmentId"; name = $EnvironmentId }
            connectionParameters = $ConnectionParameters
        }
    }

    Write-PPLog -Level Info -Message "Creating connection $ConnectionName via Power Apps RP"
    $resp = Invoke-PPRest -Method PUT -Uri $uri -Headers $headers -Body $body

    $consentUrl = $null
    if ($resp.properties -and $resp.properties.PSObject.Properties.Name -contains 'consentLink') {
        $consentUrl = $resp.properties.consentLink
    } elseif ($resp.properties -and $resp.properties.PSObject.Properties.Name -contains 'consentLinks') {
        $consentUrl = ($resp.properties.consentLinks | Select-Object -First 1).link
    }
    if ($consentUrl) {
        Write-Host ""
        Write-Host "Open this URL in a browser to consent (run by an authorized user):" -ForegroundColor Yellow
        Write-Host $consentUrl -ForegroundColor Cyan
        Write-Host ""
        try { Start-Process $consentUrl } catch { }
    }

    $deadline = [DateTime]::UtcNow.AddMinutes($MaxWaitMin)
    while ([DateTime]::UtcNow -lt $deadline) {
        Start-Sleep -Seconds $PollSeconds
        $check = Invoke-PPRest -Method GET -Uri $uri -Headers $headers
        $status = $null
        if ($check.properties.PSObject.Properties.Name -contains 'statuses' -and $check.properties.statuses) {
            $status = $check.properties.statuses[0].status
        }
        Write-PPLog -Level Debug -Message ("Connection {0} status: {1}" -f $ConnectionName, $status)
        if ($status -eq 'Connected') {
            $connId = $check.name
            Write-PPLog -Level Info -Message ("Connection {0} ready (id={1})" -f $ConnectionName, $connId)
            return @{
                logicalName  = $ConnectionName
                connectionId = $connId
                connectorId  = $ConnectorId
                authMode     = 'OAuthInteractive'
                displayName  = $DisplayName
            }
        }
    }
    throw "OAuth connection $ConnectionName did not reach Connected within $MaxWaitMin min"
}
