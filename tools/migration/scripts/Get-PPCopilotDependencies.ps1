<#
.SYNOPSIS
    For one bot in the source environment, discover the direct dependency graph:
      - botcomponents (topics, settings, language)
      - workflows (cloud flows directly invoked by bot topics or actions)
      - msdyn_aiplugins  (AI Builder prompts referenced by topics/actions)
      - connectionreferences (all connection refs used by bot's flows + bot itself)
      - environmentvariabledefinitions (all env vars referenced)
      - msdyn_knowledgesources (definitions; file binaries listed separately)
      - custom connectors (harvested from workflows' clientdata)
      - knowledgeFiles (annotation rows backing file-type knowledge sources)

    Output: out/per-bot/<botId>/deps.json
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $Config,
    [Parameter(Mandatory)][string] $BotId
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
$tok = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId `
    -Resource $cfg.sourceEnvUrl -ClientSecret $secret

$guidPattern = '(?i)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'

# 1) Bot record
$bot = Invoke-DvGet -EnvironmentUrl $cfg.sourceEnvUrl -Token $tok `
    -Path ("bots($BotId)?`$select=botid,schemaname,name")

# 2) Bot components (topics, language, settings, etc.)
$botComps = Invoke-DvGetAll -EnvironmentUrl $cfg.sourceEnvUrl -Token $tok `
    -EntitySet 'botcomponents' `
    -Select 'botcomponentid,name,componenttype,schemaname,data,_parentbotid_value' `
    -Filter ("_parentbotid_value eq $BotId")

# 3) Harvest GUIDs and connector ids from botcomponent.data + bot fields
$collectedGuids = @{}
$collectedConnectorIds = @{}
$collectedEnvVarSchemas = @{}

function _Collect-Guids {
    param([string] $Text)
    if (-not $Text) { return }
    $matches = [regex]::Matches($Text, $guidPattern)
    foreach ($m in $matches) { $collectedGuids[$m.Value.ToLower()] = $true }
    # Connector ids look like "/providers/Microsoft.PowerApps/apis/<id>" or "shared_<id>"
    foreach ($cmatch in [regex]::Matches($Text, '/providers/Microsoft\.PowerApps/apis/([A-Za-z0-9_]+)')) {
        $collectedConnectorIds[$cmatch.Groups[1].Value] = $true
    }
    # Env var schema references look like "{{environmentvariable:cr_xxx}}" or "$envvar:cr_xxx"
    foreach ($em in [regex]::Matches($Text, '(?i)environmentvariable[":]+([a-z][a-z0-9_]+)')) {
        $collectedEnvVarSchemas[$em.Groups[1].Value] = $true
    }
}
foreach ($c in $botComps) { _Collect-Guids -Text $c.data }

# 4) Workflows (cloud flows): match by GUID first, then $filter by ids and category eq 5
$workflows = @()
$wfIdsCandidate = @($collectedGuids.Keys)
if ($wfIdsCandidate.Count -gt 0) {
    # Chunk filter into groups of 20 to keep URL short
    $chunks = for ($i = 0; $i -lt $wfIdsCandidate.Count; $i += 20) {
        ,$wfIdsCandidate[$i..([Math]::Min($i + 19, $wfIdsCandidate.Count - 1))]
    }
    foreach ($chunk in $chunks) {
        $orFilter = ($chunk | ForEach-Object { "workflowid eq $_" }) -join ' or '
        $filter = "category eq 5 and ($orFilter)"
        try {
            $batch = Invoke-DvGetAll -EnvironmentUrl $cfg.sourceEnvUrl -Token $tok `
                -EntitySet 'workflows' -Select 'workflowid,name,uniquename,clientdata,statecode,category' `
                -Filter $filter
            $workflows += $batch
        } catch {
            Write-PPLog -Level Debug -Message "wf chunk filter failed: $($_.Exception.Message)"
        }
    }
}

# 4b) Harvest connector ids + env vars from workflow clientdata
foreach ($w in $workflows) { _Collect-Guids -Text $w.clientdata }

# 5) AI plugins referenced
$aiplugins = @()
$aiCandidate = @($collectedGuids.Keys)
if ($aiCandidate.Count -gt 0) {
    $chunks = for ($i = 0; $i -lt $aiCandidate.Count; $i += 20) {
        ,$aiCandidate[$i..([Math]::Min($i + 19, $aiCandidate.Count - 1))]
    }
    foreach ($chunk in $chunks) {
        $orFilter = ($chunk | ForEach-Object { "msdyn_aipluginid eq $_" }) -join ' or '
        try {
            $batch = Invoke-DvGetAll -EnvironmentUrl $cfg.sourceEnvUrl -Token $tok `
                -EntitySet 'msdyn_aiplugins' -Select 'msdyn_aipluginid,msdyn_uniquename,msdyn_name' `
                -Filter $orFilter
            $aiplugins += $batch
        } catch {
            Write-PPLog -Level Debug -Message "aiplugin chunk filter failed: $($_.Exception.Message)"
        }
    }
}

# 6) Connection references — by connectionreferenceid match or, more reliably, by listing all and checking workflow clientdata
$allConnRefs = Invoke-DvGetAll -EnvironmentUrl $cfg.sourceEnvUrl -Token $tok `
    -EntitySet 'connectionreferences' `
    -Select 'connectionreferenceid,connectionreferencelogicalname,connectionreferencedisplayname,connectorid'
$usedConnRefs = @()
foreach ($cr in $allConnRefs) {
    $crid = $cr.connectionreferenceid.ToLower()
    $logical = $cr.connectionreferencelogicalname
    if ($collectedGuids.ContainsKey($crid) -or
        ($workflows | Where-Object { $_.clientdata -and $_.clientdata.Contains($logical) })) {
        $usedConnRefs += $cr
    }
}

# 7) Environment variables (by schema name harvested + by referenced GUID)
$envVarDefs = @()
$allEnvVars = Invoke-DvGetAll -EnvironmentUrl $cfg.sourceEnvUrl -Token $tok `
    -EntitySet 'environmentvariabledefinitions' `
    -Select 'environmentvariabledefinitionid,schemaname,displayname,type'
foreach ($ev in $allEnvVars) {
    if ($collectedEnvVarSchemas.ContainsKey($ev.schemaname) -or $collectedGuids.ContainsKey($ev.environmentvariabledefinitionid.ToLower())) {
        $envVarDefs += $ev
    }
}

# 8) Knowledge sources (msdyn_knowledgesources) tied to this bot
$knowledgeSources = @()
try {
    $knowledgeSources = Invoke-DvGetAll -EnvironmentUrl $cfg.sourceEnvUrl -Token $tok `
        -EntitySet 'msdyn_knowledgesources' `
        -Select 'msdyn_knowledgesourceid,msdyn_name,msdyn_type,msdyn_url,_msdyn_botid_value' `
        -Filter ("_msdyn_botid_value eq $BotId")
} catch {
    Write-PPLog -Level Warn -Message ("knowledge sources query failed: {0}" -f $_.Exception.Message)
}

# 9) Custom connectors — for each connector id harvested, look up the connector entity (custom only)
$customConnectors = @()
$allConnectors = @()
try {
    $allConnectors = Invoke-DvGetAll -EnvironmentUrl $cfg.sourceEnvUrl -Token $tok `
        -EntitySet 'connectors' -Select 'connectorid,name,connectorinternalid,_solutionid_value'
} catch {
    Write-PPLog -Level Warn -Message ("connectors query failed (need custom-connector privileges): {0}" -f $_.Exception.Message)
}
foreach ($c in $allConnectors) {
    if ($collectedConnectorIds.ContainsKey($c.connectorinternalid)) {
        $customConnectors += $c
    }
}

# 10) Knowledge files (annotation rows) for file-type knowledge sources
$knowledgeFiles = @()
foreach ($ks in $knowledgeSources) {
    if ($ks.msdyn_type -in 4,5,6) {                  # heuristics: file/upload type codes vary; collect annotations regardless
        try {
            $notes = Invoke-DvGetAll -EnvironmentUrl $cfg.sourceEnvUrl -Token $tok `
                -EntitySet 'annotations' `
                -Select 'annotationid,filename,mimetype,filesize,documentbody' `
                -Filter ("_objectid_value eq $($ks.msdyn_knowledgesourceid)")
            foreach ($n in $notes) {
                $knowledgeFiles += @{
                    knowledgeSourceId = $ks.msdyn_knowledgesourceid
                    annotationId      = $n.annotationid
                    fileName          = $n.filename
                    mimeType          = $n.mimetype
                    sizeBytes         = $n.filesize
                }
            }
        } catch {
            Write-PPLog -Level Debug -Message ("annotations query for ks {0} failed: {1}" -f $ks.msdyn_knowledgesourceid, $_.Exception.Message)
        }
    }
}

$deps = @{
    botId = $BotId
    bot   = @{ schemaname = $bot.schemaname; name = $bot.name }
    capturedUtc = (Get-Date).ToUniversalTime().ToString('o')

    botComponentIds   = @($botComps | ForEach-Object { $_.botcomponentid })
    workflows         = @($workflows | ForEach-Object { @{ id = $_.workflowid; name = $_.name; uniquename = $_.uniquename } })
    aiplugins         = @($aiplugins | ForEach-Object { @{ id = $_.msdyn_aipluginid; name = $_.msdyn_name; uniquename = $_.msdyn_uniquename } })
    connRefs          = @($usedConnRefs | ForEach-Object { @{ id = $_.connectionreferenceid; logicalName = $_.connectionreferencelogicalname; displayName = $_.connectionreferencedisplayname; connectorId = $_.connectorid } })
    envVars           = @($envVarDefs | ForEach-Object { @{ id = $_.environmentvariabledefinitionid; schemaname = $_.schemaname; displayname = $_.displayname; type = $_.type } })
    knowledgeSources  = @($knowledgeSources | ForEach-Object { @{ id = $_.msdyn_knowledgesourceid; name = $_.msdyn_name; type = $_.msdyn_type; url = $_.msdyn_url } })
    customConnectors  = @($customConnectors | ForEach-Object { @{ id = $_.connectorid; name = $_.name; connectorinternalid = $_.connectorinternalid } })
    knowledgeFiles    = $knowledgeFiles
}

$outDir = Join-Path $cfg.outDir ("per-bot\$BotId")
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
$outPath = Join-Path $outDir 'deps.json'
Write-PPJson -InputObject $deps -Path $outPath
Write-PPLog -Level Info -Message ("Deps[{0}]: bc={1} wf={2} ai={3} cr={4} ev={5} ks={6} cc={7} kf={8} -> {9}" -f `
    $bot.schemaname, $deps.botComponentIds.Count, $deps.workflows.Count, $deps.aiplugins.Count, `
    $deps.connRefs.Count, $deps.envVars.Count, $deps.knowledgeSources.Count, `
    $deps.customConnectors.Count, $deps.knowledgeFiles.Count, $outPath)
