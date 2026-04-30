#Requires -Version 5.1
Set-StrictMode -Version 3.0

# Pluggable secret backend abstraction. PowerShell 5.1 compatible.
# Backends:
#   CredentialManager  - Windows Credential Manager (DPAPI). Requires CredentialManager module.
#   DPAPIFile          - ConvertFrom-SecureString file under %LOCALAPPDATA%\PPMigration.
#   KeyVault           - Az.KeyVault module. Requires Connect-AzAccount in caller.
#   Interactive        - Read-Host -AsSecureString every invocation.
#   EnvironmentVariable - process env var (least secure, quick start only).

Import-Module (Join-Path $PSScriptRoot 'PPMigration.psm1') -Force

$Script:SecretsConfig = @{
    Backend     = 'CredentialManager'
    Prefix      = 'PPMigration:'
    KeyVaultName = $null
    DpapiDir    = (Join-Path $env:LOCALAPPDATA 'PPMigration')
}

function Initialize-PPSecrets {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][hashtable] $Config
    )
    if ($Config.ContainsKey('secretBackend'))   { $Script:SecretsConfig.Backend = $Config.secretBackend }
    if ($Config.ContainsKey('secretPrefix'))    { $Script:SecretsConfig.Prefix  = $Config.secretPrefix }
    if ($Config.ContainsKey('keyVaultName'))    { $Script:SecretsConfig.KeyVaultName = $Config.keyVaultName }
    if ($Config.ContainsKey('secretsDir'))      { $Script:SecretsConfig.DpapiDir = $Config.secretsDir }

    if ($Script:SecretsConfig.Backend -eq 'DPAPIFile' -and -not (Test-Path $Script:SecretsConfig.DpapiDir)) {
        New-Item -ItemType Directory -Path $Script:SecretsConfig.DpapiDir -Force | Out-Null
    }
    Write-PPLog -Level Info -Message ("Secret backend: {0}" -f $Script:SecretsConfig.Backend)
}

function _Get-FullName {
    param([string] $Name)
    return ($Script:SecretsConfig.Prefix + $Name)
}

function Test-PPSecretExists {
    param([Parameter(Mandatory)][string] $Name)
    try {
        $null = Get-PPSecret -Name $Name -ErrorAction Stop
        return $true
    } catch { return $false }
}

function Set-PPSecret {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $Name,
        [Parameter(Mandatory)][System.Security.SecureString] $Secret,
        [string] $UserName = 'pp-migration'
    )
    $full = _Get-FullName $Name
    switch ($Script:SecretsConfig.Backend) {
        'CredentialManager' {
            if (-not (Get-Module -ListAvailable -Name CredentialManager)) {
                throw "CredentialManager module not available. Run: Install-Module CredentialManager -Scope CurrentUser"
            }
            Import-Module CredentialManager -ErrorAction Stop
            $plain = ConvertFrom-PPSecureString $Secret
            try {
                New-StoredCredential -Target $full -UserName $UserName -Password $plain -Persist LocalMachine | Out-Null
            } finally { Remove-Variable plain -ErrorAction SilentlyContinue }
        }
        'DPAPIFile' {
            $path = Join-Path $Script:SecretsConfig.DpapiDir ("{0}.sec" -f $Name)
            $Secret | ConvertFrom-SecureString | Set-Content -Path $path -Encoding ascii
        }
        'KeyVault' {
            if (-not $Script:SecretsConfig.KeyVaultName) { throw "keyVaultName not configured" }
            if (-not (Get-Command Set-AzKeyVaultSecret -ErrorAction SilentlyContinue)) {
                throw "Az.KeyVault module not loaded. Run: Import-Module Az.KeyVault; Connect-AzAccount"
            }
            Set-AzKeyVaultSecret -VaultName $Script:SecretsConfig.KeyVaultName -Name $Name -SecretValue $Secret | Out-Null
        }
        'EnvironmentVariable' {
            $plain = ConvertFrom-PPSecureString $Secret
            try { [Environment]::SetEnvironmentVariable("PP_$Name", $plain, 'Process') }
            finally { Remove-Variable plain -ErrorAction SilentlyContinue }
        }
        'Interactive' {
            throw "Interactive backend does not persist; use Get-PPSecret -Prompt instead."
        }
        default { throw "Unknown secret backend: $($Script:SecretsConfig.Backend)" }
    }
    Write-PPLog -Level Info -Message ("Secret '{0}' stored ({1})" -f $Name, $Script:SecretsConfig.Backend)
}

function Get-PPSecret {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string] $Name,
        [switch] $AsPlainText,
        [switch] $Prompt
    )
    if ($Prompt -or $Script:SecretsConfig.Backend -eq 'Interactive') {
        $sec = Read-Host -Prompt "Enter secret '$Name'" -AsSecureString
        if ($AsPlainText) { return ConvertFrom-PPSecureString $sec }
        return $sec
    }

    $full = _Get-FullName $Name
    $secure = $null
    switch ($Script:SecretsConfig.Backend) {
        'CredentialManager' {
            Import-Module CredentialManager -ErrorAction Stop
            $cred = Get-StoredCredential -Target $full
            if (-not $cred) { throw "Secret not found: $Name (target=$full)" }
            $secure = $cred.Password
        }
        'DPAPIFile' {
            $path = Join-Path $Script:SecretsConfig.DpapiDir ("{0}.sec" -f $Name)
            if (-not (Test-Path $path)) { throw "Secret file not found: $path" }
            $secure = Get-Content -LiteralPath $path -Raw | ConvertTo-SecureString
        }
        'KeyVault' {
            if (-not (Get-Command Get-AzKeyVaultSecret -ErrorAction SilentlyContinue)) {
                throw "Az.KeyVault module not loaded"
            }
            $kvSec = Get-AzKeyVaultSecret -VaultName $Script:SecretsConfig.KeyVaultName -Name $Name
            if (-not $kvSec) { throw "KeyVault secret not found: $Name" }
            # Az.KeyVault returns SecretValue as SecureString in modern versions
            $secure = $kvSec.SecretValue
            if (-not $secure) { $secure = ConvertTo-PPSecureString $kvSec.SecretValueText }
        }
        'EnvironmentVariable' {
            $val = [Environment]::GetEnvironmentVariable("PP_$Name", 'Process')
            if (-not $val) { throw "Environment variable PP_$Name not set" }
            $secure = ConvertTo-PPSecureString $val
        }
        default { throw "Unknown secret backend: $($Script:SecretsConfig.Backend)" }
    }

    if ($AsPlainText) {
        $plain = ConvertFrom-PPSecureString $secure
        Add-PPLogRedaction -Values @($plain)
        return $plain
    }
    return $secure
}

function Remove-PPSecret {
    param([Parameter(Mandatory)][string] $Name)
    $full = _Get-FullName $Name
    switch ($Script:SecretsConfig.Backend) {
        'CredentialManager' {
            Import-Module CredentialManager -ErrorAction Stop
            try { Remove-StoredCredential -Target $full -ErrorAction Stop | Out-Null } catch {}
        }
        'DPAPIFile' {
            $path = Join-Path $Script:SecretsConfig.DpapiDir ("{0}.sec" -f $Name)
            if (Test-Path $path) { Remove-Item -LiteralPath $path -Force }
        }
        'KeyVault' {
            if (Get-Command Remove-AzKeyVaultSecret -ErrorAction SilentlyContinue) {
                Remove-AzKeyVaultSecret -VaultName $Script:SecretsConfig.KeyVaultName -Name $Name -Force -PassThru | Out-Null
            }
        }
        'EnvironmentVariable' {
            [Environment]::SetEnvironmentVariable("PP_$Name", $null, 'Process')
        }
    }
}

Export-ModuleMember -Function Initialize-PPSecrets, Set-PPSecret, Get-PPSecret, Remove-PPSecret, Test-PPSecretExists
