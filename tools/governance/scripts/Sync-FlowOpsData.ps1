<#
.SYNOPSIS
    테넌트 실데이터 수집 및 FlowOps DB 반영 (읽기: 테넌트/DEX, 쓰기: FlowOps 테이블만)

.DESCRIPTION
    1) Inventory API로 테넌트 전체 리소스 조회  -> fw_inventory Upsert
    2) DEX Dataverse에서 봇/클라우드 흐름 조회   -> fw_task Upsert
    3) (-IncludeRuns) 흐름 실행 이력 조회        -> fw_runhistory Upsert
    4) 반영 결과 건수 검증 출력 + flowops-data.json 동시 갱신(UI용)

    Upsert 기준: fw_sourceid(원본 GUID) 일치 시 갱신, 없으면 생성. 재실행 안전(멱등).

.EXAMPLE
    .\Sync-FlowOpsData.ps1 -Config ..\..\migration\templates\config.psd1 `
        -FlowOpsEnvUrl https://orgXXXX.crm.dynamics.com -IncludeRuns
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $Config,
    [string] $FlowOpsEnvUrl,
    [string] $FlowOpsEnvName,
    [switch] $IncludeRuns,
    [int] $RunsPerFlow = 5,
    [int] $MaxFlowsForRuns = 20,
    [string] $JsonOutFile = (Join-Path $PSScriptRoot '..\mockup\flowops-data.json')
)

#Requires -Version 5.1
Set-StrictMode -Version 3.0
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ErrorActionPreference = 'Stop'
$PSDefaultParameterValues = @{ 'ConvertTo-Json:Depth' = 100; 'Invoke-RestMethod:UseBasicParsing' = $true }
Add-Type -AssemblyName System.Web

$libDir = Join-Path $PSScriptRoot '..\..\migration\scripts\lib'
Import-Module (Join-Path $libDir 'PPMigration.psm1')      -Force
Import-Module (Join-Path $libDir 'PPThrottle.psm1')       -Force
Import-Module (Join-Path $libDir 'PPSecrets.psm1')        -Force
Import-Module (Join-Path $libDir 'PPAuth.psm1')           -Force
Import-Module (Join-Path $libDir 'PPDataverseQuery.psm1') -Force

$cfg = Read-PPConfig -Path $Config
Initialize-PPLogging -LogDir (Join-Path $cfg.outDir 'logs')
Initialize-PPSecrets -Config $cfg
$secret = Get-PPSecret -Name $cfg.secrets.spnClientSecret
if ($FlowOpsEnvName) {
    Import-Module (Join-Path $libDir 'PPAdminBap.psm1') -Force
    $bapTok = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId -Resource 'https://api.bap.microsoft.com' -ClientSecret $secret
    $envInfo = Resolve-PPEnvironmentUrlByName -Token $bapTok -NamePattern $FlowOpsEnvName
    $FlowOpsEnvUrl = $envInfo.envUrl
    Write-PPLog -Level Info -Message "환경 이름 확인: $($envInfo.name) -> $FlowOpsEnvUrl"
}
if (-not $FlowOpsEnvUrl) { $FlowOpsEnvUrl = $cfg.targetEnvUrl }

# 전사 환경 ID -> 표시 이름 맵 (화면 필터용)
$envMap = @{}
try {
    Import-Module (Join-Path $libDir 'PPAdminBap.psm1') -Force
    $bapTok2 = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId -Resource 'https://api.bap.microsoft.com' -ClientSecret $secret
    foreach ($e in (Get-PPEnvironmentsAll -Token $bapTok2)) { $envMap[$e.name] = $e.properties.displayName }
    Write-PPLog -Level Info -Message "환경명 맵 확보: $($envMap.Count)개 환경"
} catch { Write-PPLog -Level Warn -Message "환경 목록 조회 실패(환경명 없이 진행): $($_.Exception.Message)" }

$fwTok  = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId -Resource $FlowOpsEnvUrl -ClientSecret $secret
$fwApi  = Get-DvApiBase $FlowOpsEnvUrl

function Get-SetName([string] $logical) {
    (Invoke-PPRest -Method GET -Uri "$fwApi/EntityDefinitions(LogicalName='$logical')?`$select=EntitySetName" `
        -Headers (Get-DvHeaders -Token $fwTok)).EntitySetName
}
$setInv  = Get-SetName 'fw_inventory'
$setTask = Get-SetName 'fw_task'
$setRun  = Get-SetName 'fw_runhistory'
Write-PPLog -Level Info -Message "FlowOps DB 테이블 확인: $setInv / $setTask / $setRun"

$stats = @{ inv = @{c=0;u=0}; task = @{c=0;u=0}; run = @{c=0;u=0} }
function Upsert([string] $setName, [string] $logicalName, [string] $sourceId, [hashtable] $fields, [hashtable] $stat) {
    $wh = Get-DvHeaders -Token $fwTok
    $pk = "${logicalName}id"    # Dataverse 기본키 = 논리명 + id
    $q  = "$fwApi/$setName`?`$select=$pk&`$filter=" +
          [System.Web.HttpUtility]::UrlEncode("fw_sourceid eq '$sourceId'")
    $found = $null
    try { $found = (Invoke-PPRest -Method GET -Uri $q -Headers $wh).value } catch { }
    if ($found -and $found.Count -gt 0) {
        $id = $found[0].$pk
        Invoke-PPRest -Method PATCH -Uri "$fwApi/$setName($id)" `
            -Headers (Get-DvHeaders -Token $fwTok -WithIfMatch) -Body $fields | Out-Null
        $stat.u++
    } else {
        Invoke-PPRest -Method POST -Uri "$fwApi/$setName" -Headers $wh -Body $fields | Out-Null
        $stat.c++
    }
}

$json = @{ meta = @{ source='live'; syncedAt=(Get-Date).ToUniversalTime().ToString('o'); tenant=$cfg.tenantId; envName='DEX' }
           kpi = @{ totalFlows=0; totalApps=0; totalAgents=0; unregistered=0 }
           tasks=@(); runs=@(); releases=@(); inventory=@() }

# ── 1) Inventory API (테넌트 전체, 읽기 전용) → fw_inventory ──
Write-PPLog -Level Info -Message "1/3 테넌트 인벤토리 수집 (Inventory API)"
try {
    $ppTok = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId -Resource 'https://api.powerplatform.com' -ClientSecret $secret
    $rows = @(); $skip = $null
    do {
        $opt = @{ Top = 1000 }; if ($skip) { $opt.SkipToken = $skip }
        $inv = Invoke-PPRest -Method POST -Uri 'https://api.powerplatform.com/resourcequery/resources/query?api-version=2024-10-01' `
            -Headers @{ Authorization = "Bearer $ppTok"; Accept = 'application/json' } `
            -Body @{ TableName='PowerPlatformResources'; Clauses=@(); Options=$opt }
        if ($inv.data) { $rows += $inv.data }
        $skip = if ($inv.PSObject.Properties.Name -contains 'skipToken') { $inv.skipToken } else { $null }
    } while ($skip)
    Write-PPLog -Level Info -Message "전사 리소스 수집: $($rows.Count)건 (전체 환경)"
    foreach ($row in $rows) {
        $type = switch -Wildcard ($row.type) {
            'microsoft.powerautomate/*' { $json.kpi.totalFlows++;  'flow' }
            'microsoft.powerapps/*'     { $json.kpi.totalApps++;   'app' }
            'microsoft.copilotstudio/*' { $json.kpi.totalAgents++; 'agent' }
            default { $null } }
        if (-not $type) { continue }
        $p = $row.properties
        $rec = @{ name = ($(if ($p.PSObject.Properties.Name -contains 'displayName' -and $p.displayName) { $p.displayName } else { $row.name }))
                  sourceid = $row.name; type = $type
                  env = ($(if ($p.PSObject.Properties.Name -contains 'environmentId') { $p.environmentId } else { '' }))
                  owner = ($(if ($p.PSObject.Properties.Name -contains 'ownerId') { $p.ownerId } else { '' }))
                  createdAt = ($(if ($p.PSObject.Properties.Name -contains 'createdAt') { [string]$p.createdAt } else { '' })) }
        $envNm = if ($envMap.ContainsKey($rec.env)) { $envMap[$rec.env] } else { $rec.env }
        $json.inventory += @{ name=$rec.name; type=$rec.type; env=$rec.env; envName=$envNm; owner=$rec.owner; createdAt=$rec.createdAt; registered=$false }
        Upsert $setInv 'fw_inventory' $rec.sourceid @{ fw_name=$rec.name.Substring(0,[Math]::Min(390,$rec.name.Length)); fw_sourceid=$rec.sourceid
            fw_type=$rec.type; fw_envid=$rec.env; fw_envname=$envNm; fw_owner=$rec.owner; fw_createdat=$rec.createdAt; fw_registered='false' } $stats.inv
    }
    $json.kpi.unregistered = $json.inventory.Count
} catch {
    Write-PPLog -Level Warn -Message "Inventory API 실패(권한/라이선스 확인 필요): $($_.Exception.Message)"
}

# ── 2) DEX 봇/흐름 (읽기 전용) → fw_task ──
Write-PPLog -Level Info -Message "2/3 DEX 리소스 수집 (Dataverse 읽기 전용)"
$dexTok = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId -Resource $cfg.sourceEnvUrl -ClientSecret $secret
$flows = @()
try {
    foreach ($b in (Invoke-DvGetAll -EnvironmentUrl $cfg.sourceEnvUrl -Token $dexTok -EntitySet 'bots' `
        -Select 'botid,schemaname,name,publishedon' -Expand 'ownerid($select=fullname)')) {
        $owner = if ($b.PSObject.Properties.Name -contains 'ownerid' -and $b.ownerid) { [string]$b.ownerid.fullname } else { '' }
        $st = if ($b.publishedon) { '운영' } else { '개발중' }
        $json.tasks += @{ code=$b.schemaname; name=$b.name; owner=$owner; stage=$(if($b.publishedon){5}else{3}); planned=''; actual=''; status=$st }
        Upsert $setTask 'fw_task' $b.botid @{ fw_name=$b.name; fw_code=$b.schemaname; fw_tasktype='agent'
            fw_owner=$owner; fw_stage=[string]$(if($b.publishedon){5}else{3}); fw_status=$st; fw_sourceid=$b.botid } $stats.task
    }
} catch { Write-PPLog -Level Warn -Message "봇 수집 실패: $($_.Exception.Message)" }
try {
    $flows = Invoke-DvGetAll -EnvironmentUrl $cfg.sourceEnvUrl -Token $dexTok -EntitySet 'workflows' `
        -Select 'workflowid,name,statecode' -Filter 'category eq 5' -Expand 'ownerid($select=fullname)'
    foreach ($w in $flows) {
        $owner = if ($w.PSObject.Properties.Name -contains 'ownerid' -and $w.ownerid) { [string]$w.ownerid.fullname } else { '' }
        $st = if ($w.statecode -eq 1) { '운영(ON)' } else { 'OFF' }
        $json.tasks += @{ code=$w.workflowid.Substring(0,8); name=$w.name; owner=$owner; stage=$(if($w.statecode -eq 1){5}else{3}); planned=''; actual=''; status=$st }
        Upsert $setTask 'fw_task' $w.workflowid @{ fw_name=$w.name; fw_code=$w.workflowid.Substring(0,8); fw_tasktype='flow'
            fw_owner=$owner; fw_stage=[string]$(if($w.statecode -eq 1){5}else{3}); fw_status=$st; fw_sourceid=$w.workflowid } $stats.task
    }
} catch { Write-PPLog -Level Warn -Message "흐름 수집 실패: $($_.Exception.Message)" }

# ── 3) (선택) 실행 이력 → fw_runhistory ──
if ($IncludeRuns -and $flows.Count -gt 0) {
    Write-PPLog -Level Info -Message "3/3 실행 이력 수집 (흐름당 최근 $RunsPerFlow건, 최대 $MaxFlowsForRuns개 흐름)"
    $flowTok = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId -Resource 'https://service.flow.microsoft.com' -ClientSecret $secret
    $envId = Get-PPEnvironmentId -Config $cfg -Side source
    $n = 0
    foreach ($w in $flows) {
        if ($n -ge $MaxFlowsForRuns) { break }; $n++
        try {
            $runs = Invoke-PPRest -Method GET -Headers @{ Authorization = "Bearer $flowTok" } `
                -Uri ("https://api.flow.microsoft.com/providers/Microsoft.ProcessSimple/environments/{0}/flows/{1}/runs?api-version=2016-11-01&`$top={2}" -f $envId, $w.workflowid, $RunsPerFlow)
            foreach ($r in $runs.value) {
                $json.runs += @{ runId=$r.name; task=$w.name; machine=''; start=$r.properties.startTime; end=$r.properties.endTime; processed=0; skipped=0; status=$r.properties.status }
                Upsert $setRun 'fw_runhistory' $r.name @{ fw_name=$r.name; fw_task=$w.name; fw_starttime=[string]$r.properties.startTime
                    fw_endtime=[string]$r.properties.endTime; fw_status=$r.properties.status; fw_processed='0'; fw_sourceid=$r.name } $stats.run
            }
        } catch { Write-PPLog -Level Debug -Message "실행 이력 생략($($w.name)): $($_.Exception.Message)" }
    }
}

# ── 검증 + 결과 ──
Write-PPJson -InputObject $json -Path $JsonOutFile
Write-Host ""
Write-Host "=== 반영 결과 (FlowOps DB: $FlowOpsEnvUrl) ===" -ForegroundColor Cyan
foreach ($pair in @(@('fw_inventory',$setInv,$stats.inv), @('fw_task',$setTask,$stats.task), @('fw_runhistory',$setRun,$stats.run))) {
    $cnt = (Invoke-PPRest -Method GET -Uri "$fwApi/$($pair[1])?`$count=true&`$top=1" -Headers (Get-DvHeaders -Token $fwTok)).'@odata.count'
    Write-Host ("  {0,-15} 신규 {1,4} / 갱신 {2,4} / DB 총 {3,5}건" -f $pair[0], $pair[2].c, $pair[2].u, $cnt) -ForegroundColor Green
}
Write-Host "  UI 데이터 파일: $JsonOutFile"
Write-Host ""
Write-Host "DEX(기본환경)에는 쓰기 작업이 없었습니다. 쓰기는 FlowOps 테이블에만 수행되었습니다." -ForegroundColor Green
