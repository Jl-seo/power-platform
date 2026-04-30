#Requires -Version 5.1
Set-StrictMode -Version 3.0

# Common helpers for the PP migration toolkit. PowerShell 5.1 compatible.

$Script:LogContext = @{
    RunId    = (Get-Date -Format 'yyyyMMddTHHmmss')
    LogDir   = $null
    Redact   = @()
}

function Initialize-PPLogging {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $LogDir,
        [string] $RunId = $Script:LogContext.RunId
    )
    if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
    $Script:LogContext.LogDir = $LogDir
    $Script:LogContext.RunId  = $RunId
    Write-PPLog -Level Info -Message "Logging initialized at $LogDir"
}

function Add-PPLogRedaction {
    param([Parameter(Mandatory)][string[]] $Values)
    foreach ($v in $Values) {
        if ($v -and ($Script:LogContext.Redact -notcontains $v)) {
            $Script:LogContext.Redact += $v
        }
    }
}

function Write-PPLog {
    [CmdletBinding()]
    param(
        [ValidateSet('Debug','Info','Warn','Error')][string] $Level = 'Info',
        [Parameter(Mandatory)][string] $Message,
        [hashtable] $Data
    )
    $msg = $Message
    foreach ($r in $Script:LogContext.Redact) {
        if ($r) { $msg = $msg.Replace($r, '***REDACTED***') }
    }
    $line = '{0} [{1}] {2}' -f (Get-Date -Format 'o'), $Level, $msg
    switch ($Level) {
        'Error' { Write-Host $line -ForegroundColor Red }
        'Warn'  { Write-Host $line -ForegroundColor Yellow }
        'Debug' { Write-Verbose $line }
        default { Write-Host $line }
    }
    if ($Script:LogContext.LogDir) {
        $logFile = Join-Path $Script:LogContext.LogDir ("ppmigration-{0}.log" -f $Script:LogContext.RunId)
        $line | Out-File -FilePath $logFile -Append -Encoding utf8
        if ($Data) {
            $Data | ConvertTo-Json -Depth 100 -Compress | Out-File -FilePath $logFile -Append -Encoding utf8
        }
    }
}

function Convert-PSObjectToHashtable {
    param([Parameter(ValueFromPipeline)] $InputObject)
    process {
        if ($null -eq $InputObject) { return $null }
        if ($InputObject -is [hashtable]) { return $InputObject }
        if ($InputObject -is [System.Collections.IList] -and -not ($InputObject -is [string])) {
            return @($InputObject | ForEach-Object { Convert-PSObjectToHashtable $_ })
        }
        if ($InputObject -is [psobject]) {
            $h = @{}
            foreach ($p in $InputObject.PSObject.Properties) {
                $h[$p.Name] = Convert-PSObjectToHashtable $p.Value
            }
            return $h
        }
        return $InputObject
    }
}

function Read-PPJson {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $Path,
        [switch] $AsHashtable
    )
    if (-not (Test-Path $Path)) { throw "JSON file not found: $Path" }
    $raw = Get-Content -LiteralPath $Path -Raw -Encoding utf8
    $obj = $raw | ConvertFrom-Json
    if ($AsHashtable) { return Convert-PSObjectToHashtable $obj }
    return $obj
}

function Write-PPJson {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)] $InputObject,
        [Parameter(Mandatory)][string] $Path,
        [switch] $NoBom
    )
    $dir = Split-Path -Parent $Path
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $json = $InputObject | ConvertTo-Json -Depth 100
    if ($NoBom) {
        [IO.File]::WriteAllText($Path, $json, (New-Object Text.UTF8Encoding $false))
    } else {
        $json | Set-Content -LiteralPath $Path -Encoding utf8
    }
}

function ConvertTo-PPSecureString {
    param([Parameter(Mandatory)][string] $PlainText)
    return (ConvertTo-SecureString -String $PlainText -AsPlainText -Force)
}

function ConvertFrom-PPSecureString {
    param([Parameter(Mandatory)][System.Security.SecureString] $SecureString)
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

function Invoke-PPRetry {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][scriptblock] $Action,
        [int] $MaxAttempts = 5,
        [double] $InitialDelaySec = 1.5,
        [double] $MaxDelaySec = 60,
        [string[]] $RetryOnPattern = @('429','503','502','504','timeout','transient','throttle')
    )
    $attempt = 0
    while ($true) {
        $attempt++
        try {
            return & $Action
        } catch {
            $err = $_.Exception.Message
            $shouldRetry = $false
            foreach ($p in $RetryOnPattern) { if ($err -match $p) { $shouldRetry = $true; break } }
            if (-not $shouldRetry -or $attempt -ge $MaxAttempts) {
                Write-PPLog -Level Error -Message "Invoke-PPRetry exhausted (attempt $attempt/$MaxAttempts): $err"
                throw
            }
            $delay = [Math]::Min($MaxDelaySec, $InitialDelaySec * [Math]::Pow(2, $attempt - 1))
            Write-PPLog -Level Warn -Message "Retry $attempt/$MaxAttempts in ${delay}s: $err"
            Start-Sleep -Seconds $delay
        }
    }
}

function Test-PPGuid {
    param([string] $Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return $false }
    return [Guid]::TryParse($Value, [ref]([Guid]::Empty))
}

function Get-PPEnvironmentId {
    param([Parameter(Mandatory)][string] $EnvironmentUrl)
    # Extract the org id from the environment URL host (orgxxxx.crm.dynamics.com → orgxxxx)
    $u = [Uri]$EnvironmentUrl
    return ($u.Host -split '\.')[0]
}

function Read-PPConfig {
    param([Parameter(Mandatory)][string] $Path)
    if (-not (Test-Path $Path)) { throw "Config file not found: $Path" }
    return (Import-PowerShellDataFile -Path $Path)
}

Export-ModuleMember -Function `
    Initialize-PPLogging, Add-PPLogRedaction, Write-PPLog, `
    Convert-PSObjectToHashtable, Read-PPJson, Write-PPJson, `
    ConvertTo-PPSecureString, ConvertFrom-PPSecureString, `
    Invoke-PPRetry, Test-PPGuid, Get-PPEnvironmentId, Read-PPConfig
