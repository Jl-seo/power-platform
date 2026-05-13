<#
.SYNOPSIS
    Registers the migration SPN as Application User with System Administrator
    role in EVERY developer environment listed in dev-envs.json.

    Required because each developer's personal env has its own Dataverse instance
    and the SPN must exist as application user there to read/write components.

    Idempotent: skips envs where the SPN is already registered.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $Config,
    [string[]] $OnlyEnvIds
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
}
Add-Type -AssemblyName System.Web

$libDir = Join-Path $PSScriptRoot 'lib'
Import-Module (Join-Path $libDir 'PPMigration.psm1')      -Force
Import-Module (Join-Path $libDir 'PPThrottle.psm1')       -Force
Import-Module (Join-Path $libDir 'PPSecrets.psm1')        -Force
Import-Module (Join-Path $libDir 'PPAuth.psm1')           -Force
Import-Module (Join-Path $libDir 'PPDataverseQuery.psm1') -Force

$cfg = Read-PPConfig -Path $Config
Initialize-PPLogging -LogDir (Join-Path $cfg.outDir 'logs')
Initialize-PPSecrets -Config $cfg

$devEnvsPath = Join-Path $cfg.outDir 'inventory\dev-envs.json'
if (-not (Test-Path $devEnvsPath)) { throw "dev-envs.json not found; run Get-PPDeveloperEnvironments first" }
$devEnvs = (Read-PPJson -Path $devEnvsPath -AsHashtable).developerEnvs

$secret = Get-PPSecret -Name $cfg.secrets.spnClientSecret

# Strategy:
# A) For each dev env, get a tenant-level admin token (BAP) and call
#    POST https://api.bap.microsoft.com/providers/Microsoft.BusinessAppPlatform/scopes/admin
#         /environments/{envId}/addUser?api-version=2020-10-01
#    body: { "ObjectId": "<spnAppId>", "RoleType": "Admin" }
#    This adds the SPN as Application User with System Administrator role.
# B) Skip if a Dataverse 'systemusers?$filter=applicationid eq <spnAppId>' query already returns a row.
$bapToken = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId `
    -Resource 'https://api.bap.microsoft.com' -ClientSecret $secret

$results = @()
foreach ($env in $devEnvs) {
    if ($OnlyEnvIds -and ($OnlyEnvIds -notcontains $env.envId)) { continue }
    if (-not $env.envUrl) {
        $results += @{ envId = $env.envId; status = 'skip-no-url' }
        continue
    }
    try {
        $envTok = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId `
            -Resource $env.envUrl -ClientSecret $secret
        $existing = Invoke-DvGetAll -EnvironmentUrl $env.envUrl -Token $envTok `
            -EntitySet 'systemusers' -Select 'systemuserid,applicationid' `
            -Filter ("applicationid eq $($cfg.spnAppId)")
        if ($existing -and $existing.Count -gt 0) {
            $results += @{ envId = $env.envId; status = 'already-registered'; systemuserid = $existing[0].systemuserid }
            Write-PPLog -Level Debug -Message ("SPN already in {0} ({1})" -f $env.envName, $env.envId)
            continue
        }
    } catch {
        # If we can't even read systemusers, the SPN is probably not yet an app user — proceed to add
        Write-PPLog -Level Debug -Message ("systemusers read failed for {0}: {1}" -f $env.envId, $_.Exception.Message)
    }

    try {
        $addUri = ("https://api.bap.microsoft.com/providers/Microsoft.BusinessAppPlatform/scopes/admin/environments/{0}/addUser?api-version=2020-10-01" -f $env.envId)
        $body = @{ ObjectId = $cfg.spnAppId; RoleType = 'Admin' }
        Invoke-PPRest -Method POST -Uri $addUri `
            -Headers @{ Authorization = "Bearer $bapToken"; Accept = 'application/json' } `
            -Body $body | Out-Null
        $results += @{ envId = $env.envId; status = 'registered' }
        Write-PPLog -Level Info -Message ("SPN registered in {0} ({1})" -f $env.envName, $env.envId)
    } catch {
        $results += @{ envId = $env.envId; status = 'fail'; error = $_.Exception.Message }
        Write-PPLog -Level Warn -Message ("addUser failed for {0}: {1}" -f $env.envId, $_.Exception.Message)
    }
}

$outPath = Join-Path $cfg.outDir 'inventory\spn-registration.json'
Write-PPJson -InputObject @{ generatedUtc = (Get-Date).ToUniversalTime().ToString('o'); results = $results } -Path $outPath
$ok = ($results | Where-Object { $_.status -in 'registered','already-registered' }).Count
Write-PPLog -Level Info -Message ("SPN dev-env registration: {0}/{1} OK -> {2}" -f $ok, $results.Count, $outPath)
