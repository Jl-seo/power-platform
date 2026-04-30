<#
.SYNOPSIS
    Re-binds AI Builder custom prompts to the correct target msdyn_aimodel after
    solution import. Reads source→target model mapping from id-map.json (kind
    `aimodels`) and patches msdyn_aibuilderpromptpluginversions rows in target.

.NOTES
    Does NOT activate, share, or expose the prompt — only fixes the model link.
    Operator activates manually after validation.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $Config,
    [string] $IdMapPath
)

#Requires -Version 5.1
Set-StrictMode -Version 3.0
$ErrorActionPreference = 'Stop'
$PSDefaultParameterValues = @{
    'Out-File:Encoding'                 = 'utf8'
    'Set-Content:Encoding'              = 'utf8'
    'ConvertTo-Json:Depth'              = 100
    'Invoke-RestMethod:UseBasicParsing' = $true
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

if (-not $IdMapPath) { $IdMapPath = Join-Path $cfg.outDir 'target\id-map.json' }
if (-not (Test-Path $IdMapPath)) { throw "id-map not found: $IdMapPath" }
$idMap = Read-PPJson -Path $IdMapPath -AsHashtable

if (-not $idMap.byKind.ContainsKey('aimodels') -or -not $idMap.byKind.aimodels) {
    Write-PPLog -Level Warn -Message "No aimodels mapping in id-map; nothing to rebind"
    return
}

$secret = Get-PPSecret -Name $cfg.secrets.spnClientSecret
$tok = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId `
    -Resource $cfg.targetEnvUrl -ClientSecret $secret
$headers = @{
    Authorization        = "Bearer $tok"
    'OData-MaxVersion'   = '4.0'
    'OData-Version'      = '4.0'
    Accept               = 'application/json'
    'If-Match'           = '*'
}
$apiBase = "$($cfg.targetEnvUrl.TrimEnd('/'))/api/data/v9.2"

# Build source-aimodelid -> target-aimodelid map
$modelMap = @{}
foreach ($k in $idMap.byKind.aimodels.Keys) {
    $entry = $idMap.byKind.aimodels[$k]
    if ($entry.source -and $entry.target) { $modelMap[$entry.source.ToLower()] = $entry.target.ToLower() }
}

# Pull all prompt versions and patch the ones whose model is a known source guid
$select = 'msdyn_aibuilderpromptpluginversionid,_msdyn_aimodel_value,msdyn_name'
$uri = "$apiBase/msdyn_aibuilderpromptpluginversions?\$select=" + [System.Web.HttpUtility]::UrlEncode($select)
$rebound = 0
$skipped = 0
while ($uri) {
    $resp = Invoke-PPRest -Method GET -Uri $uri -Headers $headers
    foreach ($row in $resp.value) {
        $current = if ($row.PSObject.Properties.Name -contains '_msdyn_aimodel_value' -and $row._msdyn_aimodel_value) { $row._msdyn_aimodel_value.ToLower() } else { $null }
        if (-not $current) { $skipped++; continue }
        if ($modelMap.ContainsKey($current)) {
            $newVal = $modelMap[$current]
            $patchUri = "$apiBase/msdyn_aibuilderpromptpluginversions($($row.msdyn_aibuilderpromptpluginversionid))"
            $body = @{ 'msdyn_aimodel@odata.bind' = "/msdyn_aimodels($newVal)" }
            try {
                Invoke-PPRest -Method PATCH -Uri $patchUri -Headers $headers -Body $body | Out-Null
                $rebound++
                Write-PPLog -Level Info -Message ("Rebound prompt {0} -> model {1}" -f $row.msdyn_name, $newVal)
            } catch {
                Write-PPLog -Level Warn -Message ("Failed to rebind {0}: {1}" -f $row.msdyn_name, $_.Exception.Message)
            }
        } else {
            $skipped++
            Write-PPLog -Level Debug -Message ("Skip prompt {0}: model {1} not in map" -f $row.msdyn_name, $current)
        }
    }
    $uri = $resp.'@odata.nextLink'
}
Write-PPLog -Level Info -Message ("Set-AIBuilderModelBinding: rebound={0} skipped={1}" -f $rebound, $skipped)
