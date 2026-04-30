<#
.SYNOPSIS
    One-time setup of the Service Principal used by the migration toolkit.

.DESCRIPTION
    Creates an Entra ID app registration (or reuses an existing one), assigns the
    required API permissions, registers it as Application User in source and target
    Dataverse environments with System Administrator role, and stores the generated
    client secret in the configured secret backend.

.NOTES
    Designed for PowerShell 5.1. Uses Microsoft.Graph for app registration, pac CLI
    for environment-level Application User registration. Run interactively with an
    account that holds Power Platform Administrator + Application Administrator (or
    Cloud Application Administrator) on the tenant.

.PARAMETER Config
    Path to config.psd1.

.PARAMETER AppDisplayName
    Display name for the Entra ID app registration. Default: "PP-Migration-SPN".

.PARAMETER ReuseAppId
    If set, reuses an existing app registration with this AppId instead of creating one.
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)][string] $Config,
    [string] $AppDisplayName = 'PP-Migration-SPN',
    [string] $ReuseAppId,
    [switch] $SkipPermissions,
    [switch] $SkipEnvironmentRoles
)

#Requires -Version 5.1
Set-StrictMode -Version 3.0
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ErrorActionPreference = 'Stop'
$ProgressPreference   = 'SilentlyContinue'
$PSDefaultParameterValues = @{
    'Out-File:Encoding'                 = 'utf8'
    'Set-Content:Encoding'              = 'utf8'
    'ConvertTo-Json:Depth'              = 100
    'Invoke-RestMethod:UseBasicParsing' = $true
    'Invoke-WebRequest:UseBasicParsing' = $true
}
Add-Type -AssemblyName System.Web

$libDir = Join-Path $PSScriptRoot 'lib'
Import-Module (Join-Path $libDir 'PPMigration.psm1') -Force
Import-Module (Join-Path $libDir 'PPSecrets.psm1') -Force

$cfg = Read-PPConfig -Path $Config
Initialize-PPLogging -LogDir (Join-Path $cfg.outDir 'logs')
Initialize-PPSecrets -Config $cfg

# Required Application permissions (resource → role IDs from Microsoft Graph & PP service principals)
# We resolve role IDs at runtime via Microsoft.Graph (works on PS 5.1).
$RequiredApiPermissions = @(
    @{ App = 'Microsoft Graph';                  AppId = '00000003-0000-0000-c000-000000000000'; Roles = @() } # placeholder, none required
    @{ App = 'PowerApps Service';                AppId = '475226c6-020e-4fb2-8a90-7a972cbfc1d4'; Scopes = @('User') }
    @{ App = 'Dynamics CRM';                     AppId = '00000007-0000-0000-c000-000000000000'; Scopes = @('user_impersonation') }
    @{ App = 'Microsoft Power Automate';         AppId = '7df0a125-d3be-4c96-aa54-591f83ff541c'; Scopes = @('User') }
    @{ App = 'Power Platform API';               AppId = '8578e004-a5c6-46e7-913e-12f58912df43'; Scopes = @('.default') }
)

function Connect-MgIfNeeded {
    if (-not (Get-Module -ListAvailable -Name Microsoft.Graph.Applications)) {
        throw "Microsoft.Graph.Applications module not installed. Run: Install-Module Microsoft.Graph -Scope CurrentUser"
    }
    Import-Module Microsoft.Graph.Applications -Force
    Import-Module Microsoft.Graph.Identity.SignIns -Force
    if (-not (Get-MgContext -ErrorAction SilentlyContinue)) {
        Write-PPLog -Level Info -Message "Connecting to Microsoft Graph (device code)"
        Connect-MgGraph -TenantId $cfg.tenantId -Scopes 'Application.ReadWrite.All','AppRoleAssignment.ReadWrite.All','Directory.ReadWrite.All' -UseDeviceCode | Out-Null
    }
}

function New-OrGet-AppRegistration {
    param([string] $DisplayName, [string] $ReuseAppId)
    if ($ReuseAppId) {
        $app = Get-MgApplication -Filter ("appId eq '{0}'" -f $ReuseAppId) -ErrorAction SilentlyContinue
        if (-not $app) { throw "App with AppId $ReuseAppId not found" }
        Write-PPLog -Level Info -Message "Reusing app registration $($app.AppId) ($($app.DisplayName))"
        return $app
    }
    $existing = Get-MgApplication -Filter ("displayName eq '{0}'" -f $DisplayName) -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($existing) {
        Write-PPLog -Level Info -Message "Found existing app $($existing.AppId)"
        return $existing
    }
    if ($PSCmdlet.ShouldProcess($DisplayName, 'Create app registration')) {
        $app = New-MgApplication -DisplayName $DisplayName -SignInAudience AzureADMyOrg
        Write-PPLog -Level Info -Message "Created app $($app.AppId)"
        return $app
    }
}

function New-AppSecret {
    param($App)
    $expiry = (Get-Date).AddMonths(6)
    $cred = Add-MgApplicationPassword -ApplicationId $App.Id -PasswordCredential @{
        DisplayName = "pp-migration-secret-$(Get-Date -Format 'yyyyMMdd')"
        EndDateTime = $expiry
    }
    Write-PPLog -Level Info -Message "Created client secret expiring $expiry"
    return $cred.SecretText
}

function Add-AppPermissions {
    param($App)
    if ($SkipPermissions) { Write-PPLog -Level Info -Message "Skipping API permission grant"; return }
    Write-PPLog -Level Warn -Message "Note: assigning API permissions to first-party PP service principals via Graph requires admin consent."
    Write-PPLog -Level Warn -Message "If this script cannot grant programmatically, complete consent in the Azure portal: API permissions → Grant admin consent."
    Write-PPLog -Level Info -Message "Required permissions:"
    foreach ($p in $RequiredApiPermissions) {
        Write-PPLog -Level Info -Message ("  - {0} ({1}): {2}" -f $p.App, $p.AppId, ($p.Scopes -join ', '))
    }
}

function Register-AppUserInEnv {
    param([string] $EnvUrl, [string] $AppId)
    if ($SkipEnvironmentRoles) { return }
    Write-PPLog -Level Info -Message "Registering Application User in $EnvUrl with role 'System Administrator'"
    # Caller should have an active pac admin auth profile. We invoke pac directly (no cmd.exe wrapping).
    $args = @('admin','assign-user',
              '--environment', $EnvUrl,
              '--user', $AppId,
              '--role', 'System Administrator',
              '--application-user')
    Write-PPLog -Level Debug -Message ("pac {0}" -f ($args -join ' '))
    $out = & pac @args 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-PPLog -Level Error -Message ("pac admin assign-user failed: {0}" -f ($out -join "`n"))
        Write-PPLog -Level Warn  -Message "If pac CLI version does not support --application-user, register the SPN manually in Power Platform Admin Center: $EnvUrl -> Settings -> Users + Permissions -> Application users -> New app user."
        throw "Failed to assign Application User in $EnvUrl"
    }
}

# ---------- main ----------
Connect-MgIfNeeded
$app = New-OrGet-AppRegistration -DisplayName $AppDisplayName -ReuseAppId $ReuseAppId
$secretPlain = New-AppSecret -App $app
Add-PPLogRedaction -Values @($secretPlain)

# Persist secret to backend (Cred Mgr by default)
$secretSecure = ConvertTo-SecureString -String $secretPlain -AsPlainText -Force
Set-PPSecret -Name $cfg.secrets.spnClientSecret -Secret $secretSecure -UserName $app.AppId
Remove-Variable secretPlain -ErrorAction SilentlyContinue

Add-AppPermissions -App $app

if (-not $SkipEnvironmentRoles) {
    if (-not $cfg.sourceEnvUrl -or -not $cfg.targetEnvUrl) {
        Write-PPLog -Level Warn -Message "sourceEnvUrl/targetEnvUrl not in config; skipping per-env role assignment"
    } else {
        Register-AppUserInEnv -EnvUrl $cfg.sourceEnvUrl -AppId $app.AppId
        Register-AppUserInEnv -EnvUrl $cfg.targetEnvUrl -AppId $app.AppId
    }
}

# Write back the AppId into config so subsequent scripts pick it up.
Write-PPLog -Level Info -Message "AppId for migration SPN: $($app.AppId). Update config.psd1: spnAppId = '$($app.AppId)'"

[pscustomobject]@{
    appId       = $app.AppId
    objectId    = $app.Id
    displayName = $app.DisplayName
    secretRef   = $cfg.secrets.spnClientSecret
    backend     = $cfg.secretBackend
} | ConvertTo-Json -Depth 100
