#Requires -Version 5.1
Set-StrictMode -Version 3.0

# Throttling-aware HTTP wrapper for Power Platform APIs.
# Honors Retry-After, applies exponential backoff, per-endpoint token buckets.

Import-Module (Join-Path $PSScriptRoot 'PPMigration.psm1') -Force

# Per-host token bucket. Conservative defaults; override via Set-PPThrottlePolicy.
$Script:Buckets = @{
    'default'                       = @{ MaxPerMinute = 300; LastReset = [DateTime]::UtcNow; Used = 0 }
    'api.flow.microsoft.com'        = @{ MaxPerMinute = 90;  LastReset = [DateTime]::UtcNow; Used = 0 }
    'api.powerapps.com'             = @{ MaxPerMinute = 120; LastReset = [DateTime]::UtcNow; Used = 0 }
    'api.powerplatform.com'         = @{ MaxPerMinute = 120; LastReset = [DateTime]::UtcNow; Used = 0 }
    'api.bap.microsoft.com'         = @{ MaxPerMinute = 120; LastReset = [DateTime]::UtcNow; Used = 0 }
}

function Set-PPThrottlePolicy {
    param(
        [Parameter(Mandatory)][string] $HostName,
        [Parameter(Mandatory)][int] $MaxPerMinute
    )
    $Script:Buckets[$HostName] = @{
        MaxPerMinute = $MaxPerMinute
        LastReset    = [DateTime]::UtcNow
        Used         = 0
    }
}

function Wait-PPThrottleSlot {
    param([Parameter(Mandatory)][string] $HostName)
    $key = if ($Script:Buckets.ContainsKey($HostName)) { $HostName } else { 'default' }
    $b   = $Script:Buckets[$key]
    $now = [DateTime]::UtcNow
    if (($now - $b.LastReset).TotalSeconds -ge 60) {
        $b.LastReset = $now
        $b.Used = 0
    }
    if ($b.Used -ge $b.MaxPerMinute) {
        $sleep = 60 - ($now - $b.LastReset).TotalSeconds
        if ($sleep -gt 0) {
            Write-PPLog -Level Debug -Message "Token bucket [$key] exhausted, sleeping ${sleep}s"
            Start-Sleep -Seconds ([int][Math]::Ceiling($sleep))
        }
        $b.LastReset = [DateTime]::UtcNow
        $b.Used = 0
    }
    $b.Used++
}

function Invoke-PPRest {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][ValidateSet('GET','POST','PUT','PATCH','DELETE')][string] $Method,
        [Parameter(Mandatory)][string] $Uri,
        [hashtable] $Headers = @{},
        $Body,
        [string] $ContentType = 'application/json; charset=utf-8',
        [int] $MaxAttempts = 6,
        [double] $InitialDelaySec = 1.5,
        [double] $MaxDelaySec = 60,
        [int] $TimeoutSec = 300
    )

    $u = [Uri]$Uri
    $bodyText = $null
    if ($null -ne $Body) {
        if ($Body -is [string]) { $bodyText = $Body }
        else { $bodyText = $Body | ConvertTo-Json -Depth 100 -Compress }
    }

    $attempt = 0
    while ($true) {
        $attempt++
        Wait-PPThrottleSlot -HostName $u.Host

        $params = @{
            Method          = $Method
            Uri             = $Uri
            Headers         = $Headers
            ContentType     = $ContentType
            UseBasicParsing = $true
            TimeoutSec      = $TimeoutSec
            ErrorAction     = 'Stop'
        }
        if ($null -ne $bodyText) { $params.Body = $bodyText }

        try {
            return Invoke-RestMethod @params
        } catch {
            $resp = $null
            $status = 0
            $retryAfter = $null
            if ($_.Exception.Response) {
                try {
                    $resp = $_.Exception.Response
                    $status = [int]$resp.StatusCode
                    if ($resp.Headers -and $resp.Headers['Retry-After']) {
                        $retryAfter = $resp.Headers['Retry-After']
                    }
                } catch { }
            }

            $isRetryable = ($status -in 408,429,500,502,503,504) -or
                           ($_.Exception.Message -match 'timeout|transient|temporary')

            if (-not $isRetryable -or $attempt -ge $MaxAttempts) {
                Write-PPLog -Level Error -Message ("HTTP {0} {1} failed (attempt {2}/{3}): status={4} msg={5}" -f $Method, $Uri, $attempt, $MaxAttempts, $status, $_.Exception.Message)
                throw
            }

            $delay = $null
            if ($retryAfter) {
                $tmp = 0
                if ([int]::TryParse($retryAfter, [ref]$tmp)) { $delay = [double]$tmp }
                else {
                    $dt = [DateTime]::MinValue
                    if ([DateTime]::TryParse($retryAfter, [ref]$dt)) {
                        $delay = ($dt.ToUniversalTime() - [DateTime]::UtcNow).TotalSeconds
                    }
                }
            }
            if ($null -eq $delay -or $delay -le 0) {
                $delay = [Math]::Min($MaxDelaySec, $InitialDelaySec * [Math]::Pow(2, $attempt - 1))
            }
            Write-PPLog -Level Warn -Message ("HTTP {0} retry {1}/{2} in {3}s (status={4})" -f $Method, $attempt, $MaxAttempts, [int]$delay, $status)
            Start-Sleep -Seconds ([int][Math]::Ceiling($delay))
        }
    }
}

Export-ModuleMember -Function Invoke-PPRest, Set-PPThrottlePolicy, Wait-PPThrottleSlot
