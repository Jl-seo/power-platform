#Requires -Version 5.1
Set-StrictMode -Version 3.0

# Dual-track auth:
#  - SPN (client_credentials) for Dataverse / Power Apps RP / Flow API / Power Platform API
#  - Device-code admin for tenant-level toggles where SPN is insufficient

Import-Module (Join-Path $PSScriptRoot 'PPMigration.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'PPThrottle.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'PPSecrets.psm1') -Force

# Well-known public client used for device-code flows (Microsoft Azure CLI / pac CLI compatible).
$Script:PublicClientId = '1950a258-227b-4e31-a9cf-717495945fc2'

$Script:TokenCache = @{}   # key: "$tenant|$resource|$mode|$appId" -> @{ token=...; expiresOnUtc=... }

function _Get-CacheKey {
    param($Tenant, $Resource, $Mode, $AppId)
    return ("{0}|{1}|{2}|{3}" -f $Tenant, $Resource, $Mode, ($AppId | ForEach-Object { $_ }))
}

function _Get-CachedToken {
    param([string] $Key)
    if (-not $Script:TokenCache.ContainsKey($Key)) { return $null }
    $entry = $Script:TokenCache[$Key]
    if ($entry.expiresOnUtc -gt ([DateTime]::UtcNow.AddMinutes(5))) { return $entry.token }
    return $null
}

function _Set-CachedToken {
    param([string] $Key, [string] $Token, [int] $ExpiresInSec)
    $Script:TokenCache[$Key] = @{
        token        = $Token
        expiresOnUtc = [DateTime]::UtcNow.AddSeconds([Math]::Max(60, $ExpiresInSec - 60))
    }
    Add-PPLogRedaction -Values @($Token)
}

function Get-PPSpnToken {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $TenantId,
        [Parameter(Mandatory)][string] $AppId,
        [Parameter(Mandatory)][string] $Resource,    # e.g. https://orgxxx.crm.dynamics.com or https://service.powerapps.com
        [Parameter(Mandatory)][System.Security.SecureString] $ClientSecret
    )
    $key = _Get-CacheKey $TenantId $Resource 'spn' $AppId
    $cached = _Get-CachedToken $key
    if ($cached) { return $cached }

    $secret = ConvertFrom-PPSecureString $ClientSecret
    $scope = if ($Resource -match '/\.default$') { $Resource } else { ($Resource.TrimEnd('/') + '/.default') }
    $body = @{
        grant_type    = 'client_credentials'
        client_id     = $AppId
        client_secret = $secret
        scope         = $scope
    }
    try {
        $bodyEncoded = ($body.Keys | ForEach-Object { '{0}={1}' -f $_, [System.Web.HttpUtility]::UrlEncode($body[$_]) }) -join '&'
        $resp = Invoke-PPRest -Method POST `
            -Uri ("https://login.microsoftonline.com/{0}/oauth2/v2.0/token" -f $TenantId) `
            -Headers @{} `
            -Body $bodyEncoded `
            -ContentType 'application/x-www-form-urlencoded'
        _Set-CachedToken -Key $key -Token $resp.access_token -ExpiresInSec $resp.expires_in
        return $resp.access_token
    } finally { Remove-Variable secret -ErrorAction SilentlyContinue }
}

function Get-PPDeviceCodeToken {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $TenantId,
        [Parameter(Mandatory)][string] $Resource,  # scope without /.default suffix or with
        [string] $ClientId = $Script:PublicClientId
    )
    $key = _Get-CacheKey $TenantId $Resource 'device' $ClientId
    $cached = _Get-CachedToken $key
    if ($cached) { return $cached }

    if (Get-Module -ListAvailable -Name MSAL.PS) {
        Import-Module MSAL.PS -ErrorAction Stop
        $scope = if ($Resource -match '/\.default$') { $Resource } else { ($Resource.TrimEnd('/') + '/.default') }
        Write-PPLog -Level Info -Message "Acquiring device-code token for $scope (tenant $TenantId)"
        $tok = Get-MsalToken -ClientId $ClientId -TenantId $TenantId -DeviceCode -Scopes @($scope)
        $expIn = [int]($tok.ExpiresOn.UtcDateTime - [DateTime]::UtcNow).TotalSeconds
        _Set-CachedToken -Key $key -Token $tok.AccessToken -ExpiresInSec $expIn
        return $tok.AccessToken
    }

    # Fallback: raw v2.0 device code flow using Invoke-PPRest
    $scope = if ($Resource -match '/\.default$') { $Resource } else { ($Resource.TrimEnd('/') + '/.default') }
    $devResp = Invoke-PPRest -Method POST `
        -Uri ("https://login.microsoftonline.com/{0}/oauth2/v2.0/devicecode" -f $TenantId) `
        -Body ("client_id={0}&scope={1}" -f $ClientId, [System.Web.HttpUtility]::UrlEncode($scope)) `
        -ContentType 'application/x-www-form-urlencoded'
    Write-Host ""
    Write-Host $devResp.message -ForegroundColor Yellow
    Write-Host ""
    $deadline = [DateTime]::UtcNow.AddSeconds([int]$devResp.expires_in)
    while ([DateTime]::UtcNow -lt $deadline) {
        Start-Sleep -Seconds ([int]$devResp.interval)
        try {
            $tok = Invoke-PPRest -Method POST `
                -Uri ("https://login.microsoftonline.com/{0}/oauth2/v2.0/token" -f $TenantId) `
                -Body ("grant_type=urn:ietf:params:oauth:grant-type:device_code&client_id={0}&device_code={1}" -f $ClientId, $devResp.device_code) `
                -ContentType 'application/x-www-form-urlencoded' `
                -MaxAttempts 1
            _Set-CachedToken -Key $key -Token $tok.access_token -ExpiresInSec $tok.expires_in
            return $tok.access_token
        } catch {
            if ($_.Exception.Message -match 'authorization_pending|slow_down') { continue }
            throw
        }
    }
    throw "Device code authentication timed out"
}

function Clear-PPTokenCache {
    $Script:TokenCache.Clear()
    Write-PPLog -Level Info -Message "Token cache cleared"
}

Export-ModuleMember -Function Get-PPSpnToken, Get-PPDeviceCodeToken, Clear-PPTokenCache
