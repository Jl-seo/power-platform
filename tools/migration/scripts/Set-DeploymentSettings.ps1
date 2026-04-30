<#
.SYNOPSIS
    Merges a seed deploymentSettings.json with connection-map and env-var values
    to produce a fully populated settings file for `pac solution import`.

.DESCRIPTION
    Strict: fails if any ConnectionReference in the seed has no matching entry in
    connection-map.json (avoids the silent "interactive prompt at import" trap).
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $SeedFile,
    [Parameter(Mandatory)][string] $ConnectionMap,
    [string] $EnvVarFile,
    [Parameter(Mandatory)][string] $OutFile
)

#Requires -Version 5.1
Set-StrictMode -Version 3.0
$ErrorActionPreference = 'Stop'
$PSDefaultParameterValues = @{
    'Out-File:Encoding'    = 'utf8'
    'Set-Content:Encoding' = 'utf8'
    'ConvertTo-Json:Depth' = 100
}

$libDir = Join-Path $PSScriptRoot 'lib'
Import-Module (Join-Path $libDir 'PPMigration.psm1') -Force

if (-not (Test-Path $SeedFile))      { throw "Seed file not found: $SeedFile" }
if (-not (Test-Path $ConnectionMap)) { throw "Connection map not found: $ConnectionMap" }

$seed = Read-PPJson -Path $SeedFile      -AsHashtable
$cm   = Read-PPJson -Path $ConnectionMap -AsHashtable

$envVars = @{}
if ($EnvVarFile -and (Test-Path $EnvVarFile)) {
    $envVars = Read-PPJson -Path $EnvVarFile -AsHashtable
}

# Connection references: every ref in seed must have a target connection id
$missing = @()
if ($seed.ContainsKey('ConnectionReferences')) {
    foreach ($ref in $seed.ConnectionReferences) {
        $logical = $ref.LogicalName
        if ($cm.ContainsKey($logical) -and $cm[$logical].connectionId) {
            $ref.ConnectionId = $cm[$logical].connectionId
            if (-not $ref.ConnectorId) { $ref.ConnectorId = $cm[$logical].connectorId }
        } else {
            $missing += $logical
        }
    }
}
if ($missing.Count -gt 0) {
    throw ("Connection references not in connection-map.json: {0}" -f ($missing -join ', '))
}

# Environment variables: pull from EnvVarFile (logicalName -> value), or env vars (PP_EV_<name>)
if ($seed.ContainsKey('EnvironmentVariables')) {
    foreach ($ev in $seed.EnvironmentVariables) {
        $name = $ev.SchemaName
        $val = $null
        if ($envVars.ContainsKey($name)) { $val = $envVars[$name] }
        else {
            $envFromHost = [Environment]::GetEnvironmentVariable("PP_EV_$name", 'Process')
            if ($envFromHost) { $val = $envFromHost }
        }
        if ($null -ne $val) { $ev.Value = [string]$val }
        elseif (-not $ev.Value) {
            Write-PPLog -Level Warn -Message "Env var $name has no value; leaving blank"
        }
    }
}

Write-PPJson -InputObject $seed -Path $OutFile
Write-PPLog -Level Info -Message "Wrote populated settings: $OutFile"
