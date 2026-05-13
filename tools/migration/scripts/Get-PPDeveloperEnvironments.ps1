<#
.SYNOPSIS
    Lists every Developer-SKU environment in the tenant via BAP admin API,
    capturing each env's owner (AAD ObjectId + email) and instance URL.

    Output: out/inventory/dev-envs.json
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
}
Add-Type -AssemblyName System.Web

$libDir = Join-Path $PSScriptRoot 'lib'
Import-Module (Join-Path $libDir 'PPMigration.psm1') -Force
Import-Module (Join-Path $libDir 'PPThrottle.psm1')  -Force
Import-Module (Join-Path $libDir 'PPSecrets.psm1')   -Force
Import-Module (Join-Path $libDir 'PPAuth.psm1')      -Force
Import-Module (Join-Path $libDir 'PPAdminBap.psm1')  -Force

$cfg = Read-PPConfig -Path $Config
Initialize-PPLogging -LogDir (Join-Path $cfg.outDir 'logs')
Initialize-PPSecrets -Config $cfg

$secret = Get-PPSecret -Name $cfg.secrets.spnClientSecret
$bapToken = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId `
    -Resource 'https://api.bap.microsoft.com' -ClientSecret $secret

$devEnvs = Get-PPDeveloperEnvironments -Token $bapToken

$out = @{
    generatedUtc    = (Get-Date).ToUniversalTime().ToString('o')
    developerEnvs   = @($devEnvs | ForEach-Object {
        @{
            envId         = $_.envId
            envName       = $_.envName
            envUrl        = $_.envUrl
            ownerObjectId = $_.ownerObjectId
            ownerEmail    = $_.ownerEmail
            region        = $_.region
            sku           = $_.sku
            createdUtc    = $_.createdUtc
        }
    })
}

$outPath = Join-Path $cfg.outDir 'inventory\dev-envs.json'
Write-PPJson -InputObject $out -Path $outPath
Write-PPLog -Level Info -Message ("Developer envs inventoried: {0} -> {1}" -f $devEnvs.Count, $outPath)
