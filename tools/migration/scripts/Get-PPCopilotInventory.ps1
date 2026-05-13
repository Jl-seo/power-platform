<#
.SYNOPSIS
    Enumerates every Copilot Studio agent (bot) in the source environment along
    with its owner (systemuser internalemailaddress + AAD ObjectId).

    Output: out/inventory/bots.json
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
Import-Module (Join-Path $libDir 'PPMigration.psm1')      -Force
Import-Module (Join-Path $libDir 'PPThrottle.psm1')       -Force
Import-Module (Join-Path $libDir 'PPSecrets.psm1')        -Force
Import-Module (Join-Path $libDir 'PPAuth.psm1')           -Force
Import-Module (Join-Path $libDir 'PPDataverseQuery.psm1') -Force

$cfg = Read-PPConfig -Path $Config
Initialize-PPLogging -LogDir (Join-Path $cfg.outDir 'logs')
Initialize-PPSecrets -Config $cfg

$secret = Get-PPSecret -Name $cfg.secrets.spnClientSecret
$token = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId `
    -Resource $cfg.sourceEnvUrl -ClientSecret $secret

# Bots with owner expanded
$bots = Invoke-DvGetAll -EnvironmentUrl $cfg.sourceEnvUrl -Token $token `
    -EntitySet 'bots' `
    -Select 'botid,schemaname,name,componentstate,publishedon,_ownerid_value,createdon,modifiedon' `
    -Expand 'ownerid($select=internalemailaddress,azureactivedirectoryobjectid,fullname,systemuserid)'

$inventory = @{
    generatedUtc = (Get-Date).ToUniversalTime().ToString('o')
    sourceEnv    = @{ url = $cfg.sourceEnvUrl; id = $cfg.sourceEnvId }
    bots         = @()
}

foreach ($b in $bots) {
    $owner = if ($b.PSObject.Properties.Name -contains 'ownerid' -and $b.ownerid) { $b.ownerid } else { $null }
    $entry = @{
        botId         = $b.botid
        schemaname    = $b.schemaname
        name          = $b.name
        componentstate= $b.componentstate
        publishedon   = $b.publishedon
        createdon     = $b.createdon
        modifiedon    = $b.modifiedon
        ownerSystemUserId = $b._ownerid_value
        ownerEmail        = if ($owner) { $owner.internalemailaddress } else { $null }
        ownerObjectId     = if ($owner) { $owner.azureactivedirectoryobjectid } else { $null }
        ownerName         = if ($owner) { $owner.fullname } else { $null }
    }
    $inventory.bots += $entry
}

$outPath = Join-Path $cfg.outDir 'inventory\bots.json'
Write-PPJson -InputObject $inventory -Path $outPath
Write-PPLog -Level Info -Message ("Bots inventoried: {0} -> {1}" -f $inventory.bots.Count, $outPath)
