<#
.SYNOPSIS
    Restores per-flow owner notification settings from the snapshot taken by
    Disable-PPOwnerNotifications.ps1.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $Config
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

$cfg = Read-PPConfig -Path $Config
Initialize-PPLogging -LogDir (Join-Path $cfg.outDir 'logs')
Initialize-PPSecrets -Config $cfg

$snapshotPath = Join-Path $cfg.outDir 'state\notifications.snapshot.json'
if (-not (Test-Path $snapshotPath)) {
    Write-PPLog -Level Warn -Message "No snapshot at $snapshotPath; nothing to restore"
    return
}
$snapshot = Read-PPJson -Path $snapshotPath -AsHashtable
$secret = Get-PPSecret -Name $cfg.secrets.spnClientSecret

$apiVer = '2016-11-01'
foreach ($key in $snapshot.flows.Keys) {
    $rec = $snapshot.flows[$key]
    if ($null -eq $rec.flowFailureAlertSubscribed) { continue }   # never had it set; leave alone

    $envId = $rec.envId
    $flowName = ($key -split '/', 2)[1]
    $flowToken = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId `
        -Resource 'https://service.flow.microsoft.com' -ClientSecret $secret
    $headers = @{ Authorization = "Bearer $flowToken" }
    $patchUri = ("https://api.flow.microsoft.com/providers/Microsoft.ProcessSimple/environments/{0}/flows/{1}?api-version={2}" -f $envId, $flowName, $apiVer)
    $body = @{ properties = @{ flowFailureAlertSubscribed = [bool]$rec.flowFailureAlertSubscribed } }
    try {
        Invoke-PPRest -Method PATCH -Uri $patchUri -Headers $headers -Body $body | Out-Null
        Write-PPLog -Level Info -Message ("Restored {0} -> {1}" -f $flowName, $rec.flowFailureAlertSubscribed)
    } catch {
        Write-PPLog -Level Warn -Message ("Failed to restore {0}: {1}" -f $flowName, $_.Exception.Message)
    }
}
Write-PPLog -Level Info -Message "Restore-PPOwnerNotifications complete"
