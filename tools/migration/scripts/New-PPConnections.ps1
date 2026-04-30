<#
.SYNOPSIS
    Phase 2 (Bootstrap): provisions the connections required by the migration in
    the empty target environment.

.DESCRIPTION
    Reads templates/connection-bootstrap.json (or supplied -BootstrapFile) and
    creates each connection on the appropriate track:
      - SPN              : pac connection create -t -a -cs (Dataverse-class)
      - OAuthInteractive : Connection-Bootstrap.ps1 (REST PUT + consent URL poll)
      - ApiKey           : REST PUT with connectionParameters
    All connectors listed under `connectors` are installed first via
    pac connector create.
    Output: out/target/connection-map.json (logicalName -> connectionId).

.PARAMETER OnlyLogicalName
    Optional: only (re)create the named connection.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $Config,
    [string] $BootstrapFile,
    [string[]] $OnlyLogicalName
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
. (Join-Path $libDir 'Connection-Bootstrap.ps1')

$cfg = Read-PPConfig -Path $Config
Initialize-PPLogging -LogDir (Join-Path $cfg.outDir 'logs')
Initialize-PPSecrets -Config $cfg
Initialize-PPState   -StateDir (Join-Path $cfg.outDir 'state')

if (-not $BootstrapFile) {
    $BootstrapFile = Join-Path $PSScriptRoot '..\templates\connection-bootstrap.json'
}
if (-not (Test-Path $BootstrapFile)) { throw "Bootstrap file not found: $BootstrapFile" }
$bs = Read-PPJson -Path $BootstrapFile -AsHashtable

$targetDir = Join-Path $cfg.outDir 'target'
if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force | Out-Null }
$mapPath = Join-Path $targetDir 'connection-map.json'
$map = if (Test-Path $mapPath) { Read-PPJson -Path $mapPath -AsHashtable } else { @{} }

# Authenticate pac CLI to target env using the SPN
$secretPlain = Get-PPSecret -Name $cfg.secrets.spnClientSecret -AsPlainText
$authProfile = 'pp-target'
$authList = & pac auth list 2>&1
if ($authList -notmatch [Regex]::Escape($authProfile)) {
    & pac auth create --name $authProfile `
        --url $cfg.targetEnvUrl `
        --tenant $cfg.tenantId `
        --applicationId $cfg.spnAppId `
        --clientSecret $secretPlain | Out-Host
}
& pac auth select --name $authProfile | Out-Host

# Step 1: install custom connectors (if any) — must happen before connections that reference them.
if ($bs.ContainsKey('connectors') -and $bs.connectors) {
    foreach ($conn in $bs.connectors) {
        Write-PPLog -Level Info -Message "Installing custom connector: $($conn.displayName)"
        $args = @('connector','create',
                  '--environment', $cfg.targetEnvUrl,
                  '--api-definition-file', $conn.apiDefinitionFile,
                  '--api-properties-file',  $conn.apiPropertiesFile)
        if ($conn.iconFile)            { $args += @('--icon-file', $conn.iconFile) }
        if ($conn.solutionUniqueName)  { $args += @('--solution-unique-name', $conn.solutionUniqueName) }
        & pac @args
        if ($LASTEXITCODE -ne 0) {
            Write-PPFailure -Phase 'Bootstrap' -Step 'Connector' -Resource $conn.displayName -Error "pac connector create exit $LASTEXITCODE"
            throw "Connector install failed: $($conn.displayName)"
        }
    }
}

$envId = Get-PPEnvironmentId -EnvironmentUrl $cfg.targetEnvUrl

foreach ($entry in $bs.connections) {
    $logical = $entry.logicalName
    if ($OnlyLogicalName -and ($OnlyLogicalName -notcontains $logical)) { continue }

    if ($map.ContainsKey($logical) -and $map[$logical].connectionId) {
        Write-PPLog -Level Info -Message "Connection $logical already in map (id=$($map[$logical].connectionId)) — skipping"
        continue
    }

    Write-PPLog -Level Info -Message ("Provisioning connection {0} (mode={1})" -f $logical, $entry.authMode)

    switch ($entry.authMode) {
        'SPN' {
            try {
                $args = @('connection','create',
                          '--name', $entry.displayName,
                          '--tenant-id', $cfg.tenantId,
                          '--application-id', $cfg.spnAppId,
                          '--client-secret', $secretPlain,
                          '--environment', $cfg.targetEnvUrl,
                          '--connector-id', ($entry.connectorId -replace '^.*/apis/', ''))
                $out = & pac @args 2>&1
                if ($LASTEXITCODE -ne 0) { throw "pac connection create failed: $($out -join "`n")" }
                # Parse the new connection id from pac output (also retrieve via list as a fallback)
                $connId = $null
                $listJson = & pac connection list --environment $cfg.targetEnvUrl --json 2>&1
                if ($LASTEXITCODE -eq 0) {
                    $arr = ($listJson -join "`n") | ConvertFrom-Json
                    $found = $arr | Where-Object { $_.DisplayName -eq $entry.displayName }
                    if ($found) { $connId = ($found | Select-Object -First 1).ConnectionId }
                }
                if (-not $connId) {
                    foreach ($l in $out) {
                        if ($l -match '([0-9a-f-]{36})') { $connId = $matches[1]; break }
                    }
                }
                if (-not $connId) { throw "Could not determine connection id for $logical" }
                $map[$logical] = @{ connectionId = $connId; connectorId = $entry.connectorId; authMode = 'SPN'; displayName = $entry.displayName }
                Add-PPCompletedItem -Phase 'Bootstrap' -Key 'connections' -Item $logical
            } catch {
                Write-PPFailure -Phase 'Bootstrap' -Step 'NewConnectionSPN' -Resource $logical -Error $_.Exception.Message
                throw
            }
        }
        'OAuthInteractive' {
            try {
                $params = @{}
                if ($entry.ContainsKey('parameters') -and $entry.parameters) { $params = $entry.parameters }
                $result = New-PPOAuthConnection `
                    -EnvironmentId $envId `
                    -EnvironmentUrl $cfg.targetEnvUrl `
                    -TenantId $cfg.tenantId `
                    -ConnectorId $entry.connectorId `
                    -ConnectionName $logical `
                    -DisplayName $entry.displayName `
                    -ConnectionParameters $params
                $map[$logical] = $result
                Add-PPCompletedItem -Phase 'Bootstrap' -Key 'connections' -Item $logical
            } catch {
                Write-PPFailure -Phase 'Bootstrap' -Step 'NewConnectionOAuth' -Resource $logical -Error $_.Exception.Message
                throw
            }
        }
        'ApiKey' {
            try {
                $params = @{}
                if ($entry.ContainsKey('parameters') -and $entry.parameters) {
                    foreach ($k in @($entry.parameters.Keys)) {
                        $v = $entry.parameters[$k]
                        if ($v -is [string] -and $v.StartsWith('@secret:')) {
                            $secName = $v.Substring(8)
                            $params[$k] = (Get-PPSecret -Name $secName -AsPlainText)
                        } else { $params[$k] = $v }
                    }
                }
                $result = New-PPOAuthConnection `
                    -EnvironmentId $envId `
                    -EnvironmentUrl $cfg.targetEnvUrl `
                    -TenantId $cfg.tenantId `
                    -ConnectorId $entry.connectorId `
                    -ConnectionName $logical `
                    -DisplayName $entry.displayName `
                    -ConnectionParameters $params
                $result.authMode = 'ApiKey'
                $map[$logical] = $result
                Add-PPCompletedItem -Phase 'Bootstrap' -Key 'connections' -Item $logical
            } catch {
                Write-PPFailure -Phase 'Bootstrap' -Step 'NewConnectionApiKey' -Resource $logical -Error $_.Exception.Message
                throw
            }
        }
        default { throw "Unknown authMode: $($entry.authMode)" }
    }
    Write-PPJson -InputObject $map -Path $mapPath
}

Remove-Variable secretPlain -ErrorAction SilentlyContinue
Set-PPStateField -Phase 'Bootstrap' -Key 'completedUtc' -Value ((Get-Date).ToUniversalTime().ToString('o'))
Write-PPLog -Level Info -Message "New-PPConnections complete; map at $mapPath"
