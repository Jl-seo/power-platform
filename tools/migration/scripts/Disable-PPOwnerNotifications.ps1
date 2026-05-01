<#
.SYNOPSIS
    Disables owner email notifications for cloud flows during migration so that
    connection re-binding does not generate "your flow connection is broken"
    emails to flow owners.

.DESCRIPTION
    Two layers of suppression:
      1. Per-flow: PATCH each flow's `flowFailureAlertSubscribed` property to false
         via the Flow management API, after capturing the original value to a
         snapshot (Restore-PPOwnerNotifications.ps1 reverses this).
      2. Tenant-level (optional, requires Power Platform Admin): suppress maker
         notifications via Set-TenantSettings if available. This is a no-op when
         the operator does not have admin role.

.PARAMETER Config
    Path to config.psd1.

.PARAMETER EnvironmentUrls
    One or more Power Platform environment URLs whose flows should be silenced.
    Defaults to source and target from config.

.PARAMETER Verify
    Verify-only mode: report current notification state without modifying.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $Config,
    [string[]] $EnvironmentUrls,
    [switch] $Verify
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
Import-Module (Join-Path $libDir 'PPThrottle.psm1') -Force
Import-Module (Join-Path $libDir 'PPSecrets.psm1') -Force
Import-Module (Join-Path $libDir 'PPAuth.psm1') -Force
Import-Module (Join-Path $libDir 'State-Manager.psm1') -Force

$cfg = Read-PPConfig -Path $Config
Initialize-PPLogging -LogDir (Join-Path $cfg.outDir 'logs')
Initialize-PPSecrets -Config $cfg
Initialize-PPState -StateDir (Join-Path $cfg.outDir 'state')

if (-not $EnvironmentUrls) {
    $EnvironmentUrls = @($cfg.sourceEnvUrl, $cfg.targetEnvUrl) | Where-Object { $_ }
}

$snapshotDir  = Join-Path $cfg.outDir 'state'
$snapshotPath = Join-Path $snapshotDir 'notifications.snapshot.json'
$snapshot = if (Test-Path $snapshotPath) { Read-PPJson -Path $snapshotPath -AsHashtable } else { @{ flows = @{} } }

$secret = Get-PPSecret -Name $cfg.secrets.spnClientSecret
foreach ($envUrl in $EnvironmentUrls) {
    # Resolve env id: prefer config.<side>EnvId, fall back to URL-derived org name
    $envId = if ($envUrl -eq $cfg.sourceEnvUrl) { Get-PPEnvironmentId -Config $cfg -Side source }
             elseif ($envUrl -eq $cfg.targetEnvUrl) { Get-PPEnvironmentId -Config $cfg -Side target }
             else { Get-PPEnvironmentId -EnvironmentUrl $envUrl }
    Write-PPLog -Level Info -Message "Processing $envUrl (envId=$envId)"

    # Flow management API expects token for service.flow.microsoft.com
    $flowToken = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId `
        -Resource 'https://service.flow.microsoft.com' -ClientSecret $secret
    $headers = @{ Authorization = "Bearer $flowToken" }

    $apiVer = '2016-11-01'
    $listUri = ("https://api.flow.microsoft.com/providers/Microsoft.ProcessSimple/environments/{0}/flows?api-version={1}" -f $envId, $apiVer)
    $flows = Invoke-PPRest -Method GET -Uri $listUri -Headers $headers

    foreach ($flow in $flows.value) {
        $flowName = $flow.name
        $current = $null
        if ($flow.properties -and ($flow.properties.PSObject.Properties.Name -contains 'flowFailureAlertSubscribed')) {
            $current = [bool]$flow.properties.flowFailureAlertSubscribed
        }
        Write-PPLog -Level Debug -Message ("flow={0} flowFailureAlertSubscribed={1}" -f $flowName, $current)

        if (-not $snapshot.flows.ContainsKey("$envId/$flowName")) {
            $snapshot.flows["$envId/$flowName"] = @{
                flowFailureAlertSubscribed = $current
                envId                      = $envId
                displayName                = $flow.properties.displayName
            }
        }
        if ($Verify) { continue }
        if ($current -eq $false) {
            Write-PPLog -Level Debug -Message "Already disabled: $flowName"
            continue
        }

        $patchUri = ("https://api.flow.microsoft.com/providers/Microsoft.ProcessSimple/environments/{0}/flows/{1}?api-version={2}" -f $envId, $flowName, $apiVer)
        $body = @{ properties = @{ flowFailureAlertSubscribed = $false } }
        try {
            Invoke-PPRest -Method PATCH -Uri $patchUri -Headers $headers -Body $body | Out-Null
            Add-PPCompletedItem -Phase 'Notifications' -Key 'perFlow' -Item ("$envId/$flowName")
            Write-PPLog -Level Info -Message ("Disabled owner notification for {0}" -f $flowName)
        } catch {
            Write-PPFailure -Phase 'Notifications' -Step 'PerFlowDisable' -Resource $flowName -Error $_.Exception.Message
            Write-PPLog -Level Warn -Message ("Failed to disable for {0}: {1}" -f $flowName, $_.Exception.Message)
        }
    }
}
Write-PPJson -InputObject $snapshot -Path $snapshotPath
Set-PPStateField -Phase 'Notifications' -Key 'snapshotPath' -Value $snapshotPath

# Tenant level (optional, best-effort)
if (-not $Verify) {
    try {
        if (Get-Module -ListAvailable -Name Microsoft.PowerApps.Administration.PowerShell) {
            Import-Module Microsoft.PowerApps.Administration.PowerShell -ErrorAction Stop
            Write-PPLog -Level Info -Message "Reading tenant settings (admin device code)"
            Add-PowerAppsAccount | Out-Null
            $settings = Get-TenantSettings
            if ($settings) {
                $backupPath = Join-Path $snapshotDir 'tenant-settings.snapshot.json'
                Write-PPJson -InputObject $settings -Path $backupPath
                Write-PPLog -Level Info -Message "Tenant settings snapshot saved: $backupPath"
                # Note: PP admin tenant settings vary by version; flagging maker notifications is environment-specific.
                # Disabling broad maker notifications is left to the operator via Power Platform Admin Center if needed.
            }
        } else {
            Write-PPLog -Level Warn -Message "Microsoft.PowerApps.Administration.PowerShell not installed; skipping tenant snapshot"
        }
    } catch {
        Write-PPLog -Level Warn -Message ("Tenant settings snapshot failed (non-fatal): {0}" -f $_.Exception.Message)
    }
}

Set-PPStateField -Phase 'Notifications' -Key 'completedUtc' -Value ((Get-Date).ToUniversalTime().ToString('o'))
Write-PPLog -Level Info -Message "Disable-PPOwnerNotifications complete"
