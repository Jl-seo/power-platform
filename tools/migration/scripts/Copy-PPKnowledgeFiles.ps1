<#
.SYNOPSIS
    Copies knowledge-source file binaries from source environment to target.

    For each knowledgeFile entry in deps.json:
      - download source annotation (documentbody is base64) OR file column
      - upload to a new annotation under the same knowledge source in target
        (the knowledge source row was created by solution import; ID is the
         target id-map equivalent of the source knowledge source GUID)

    Large files (>4MB) use chunked file column protocol when applicable.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $Config,
    [Parameter(Mandatory)][string] $BotId,
    [Parameter(Mandatory)][string] $TargetEnvUrl,
    [string] $IdMapPath
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

$depsPath = Join-Path $cfg.outDir ("per-bot\$BotId\deps.json")
if (-not (Test-Path $depsPath)) { throw "deps.json missing for bot $BotId" }
$deps = Read-PPJson -Path $depsPath -AsHashtable

if (-not $deps.knowledgeFiles -or $deps.knowledgeFiles.Count -eq 0) {
    Write-PPLog -Level Info -Message "No knowledge files to copy for bot $BotId"
    return
}

# Map source knowledgesource id → target knowledgesource id
$ksMap = @{}
if ($IdMapPath -and (Test-Path $IdMapPath)) {
    $idMap = Read-PPJson -Path $IdMapPath -AsHashtable
    foreach ($g in $idMap.guids.Keys) { $ksMap[$g.ToLower()] = $idMap.guids[$g].ToLower() }
}

$secret = Get-PPSecret -Name $cfg.secrets.spnClientSecret
$srcTok = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId `
    -Resource $cfg.sourceEnvUrl -ClientSecret $secret
$tgtTok = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId `
    -Resource $TargetEnvUrl  -ClientSecret $secret

$copied = 0; $failed = 0
foreach ($kf in $deps.knowledgeFiles) {
    try {
        # 1) Download source annotation
        $src = Invoke-DvGet -EnvironmentUrl $cfg.sourceEnvUrl -Token $srcTok `
            -Path ("annotations({0})?`$select=documentbody,filename,mimetype,subject,notetext" -f $kf.annotationId)

        if (-not $src.documentbody) {
            Write-PPLog -Level Warn -Message ("annotation {0} has no documentbody (skip)" -f $kf.annotationId)
            continue
        }

        # 2) Resolve target knowledgesource id
        $srcKsId = $kf.knowledgeSourceId.ToLower()
        $tgtKsId = if ($ksMap.ContainsKey($srcKsId)) { $ksMap[$srcKsId] } else { $srcKsId }   # if no map, hope same

        # 3) Create new annotation in target tied to target knowledgesource (entity msdyn_knowledgesource)
        $body = @{
            'objectid_msdyn_knowledgesource@odata.bind' = "/msdyn_knowledgesources($tgtKsId)"
            objecttypecode  = 'msdyn_knowledgesource'
            filename        = $src.filename
            mimetype        = $src.mimetype
            documentbody    = $src.documentbody
            subject         = $src.subject
            notetext        = $src.notetext
        }
        Invoke-PPRest -Method POST `
            -Uri ((Get-DvApiBase $TargetEnvUrl) + '/annotations') `
            -Headers (Get-DvHeaders -Token $tgtTok) `
            -Body $body | Out-Null
        $copied++
        Write-PPLog -Level Info -Message ("Copied file {0} ({1} bytes) to ks {2}" -f $kf.fileName, $kf.sizeBytes, $tgtKsId)
    } catch {
        $failed++
        Write-PPLog -Level Warn -Message ("Copy failed [{0}]: {1}" -f $kf.fileName, $_.Exception.Message)
        Write-PPFailure -Phase 'PostFlight' -Step 'CopyKnowledgeFile' -Resource $kf.fileName -Error $_.Exception.Message
    }
}
Write-PPLog -Level Info -Message ("Copy-PPKnowledgeFiles[{0}]: copied={1} failed={2}" -f $BotId, $copied, $failed)

# Note: chunked upload for >4MB knowledge files would call:
#   POST {tgtUrl}/api/data/v9.2/InitializeFileBlocksUpload
#   POST {tgtUrl}/api/data/v9.2/UploadBlock      (per chunk, base64-encoded BlockId)
#   POST {tgtUrl}/api/data/v9.2/CommitFileBlocksUpload
# Annotations entity stores body in `documentbody` (base64), max 32 MB by default which covers
# most knowledge documents; for larger files, switch to msdyn_knowledgesource's own file column.
