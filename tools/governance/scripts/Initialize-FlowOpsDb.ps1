<#
.SYNOPSIS
    FlowOps 데이터베이스 초기화 — 지정한 Dataverse 환경에 FlowOps 테이블을 생성한다.
    (3단계: 전용 환경 구축의 최소 구성)

.DESCRIPTION
    Dataverse 메타데이터 API(EntityDefinitions)로 다음 테이블을 생성:
      fw_inventory   테넌트 리소스 인벤토리
      fw_task        과제 대장(초기: 봇/흐름 목록)
      fw_runhistory  실행 이력
    게시자/솔루션은 마이그레이션 툴킷의 PPSolutionAuthor 모듈을 재사용한다.
    멱등: 이미 존재하는 테이블은 건너뛴다. DEX(기본환경)에는 어떤 쓰기도 하지 않는다.

.EXAMPLE
    .\Initialize-FlowOpsDb.ps1 -Config ..\..\migration\templates\config.psd1 `
        -FlowOpsEnvUrl https://orgXXXX.crm.dynamics.com
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $Config,
    [string] $FlowOpsEnvUrl,
    [string] $SolutionUniqueName = 'fw_FlowOps'
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
Import-Module (Join-Path $libDir 'PPSolutionAuthor.psm1') -Force

$cfg = Read-PPConfig -Path $Config
Initialize-PPLogging -LogDir (Join-Path $cfg.outDir 'logs')
Initialize-PPSecrets -Config $cfg
if (-not $FlowOpsEnvUrl) { $FlowOpsEnvUrl = $cfg.targetEnvUrl }
$secret = Get-PPSecret -Name $cfg.secrets.spnClientSecret
$tok = Get-PPSpnToken -TenantId $cfg.tenantId -AppId $cfg.spnAppId -Resource $FlowOpsEnvUrl -ClientSecret $secret
$apiBase = Get-DvApiBase $FlowOpsEnvUrl

# 환경 기본 언어 확인 (레이블 LanguageCode 일치 필요)
$org = Invoke-PPRest -Method GET -Uri "$apiBase/organizations?`$select=languagecode" -Headers (Get-DvHeaders -Token $tok)
$lang = [int]$org.value[0].languagecode
Write-PPLog -Level Info -Message "FlowOps DB 대상: $FlowOpsEnvUrl (기본 언어 $lang)"

# 게시자 + 솔루션 보장 (기존 모듈 재사용)
$pubId = Get-PPMigrationPublisher -EnvironmentUrl $FlowOpsEnvUrl -Token $tok `
    -UniqueName 'fw_publisher' -DisplayName 'FlowOps' -Prefix 'fw'
$null = New-PPSolution -EnvironmentUrl $FlowOpsEnvUrl -Token $tok `
    -UniqueName $SolutionUniqueName -FriendlyName 'FlowOps Platform' -PublisherId $pubId

function _Label([string] $t) {
    return @{ '@odata.type' = 'Microsoft.Dynamics.CRM.Label'
              LocalizedLabels = @(@{ '@odata.type' = 'Microsoft.Dynamics.CRM.LocalizedLabel'; Label = $t; LanguageCode = $lang }) }
}
function _StrAttr([string] $schema, [string] $label, [int] $max = 400, [bool] $primary = $false) {
    $a = @{ '@odata.type' = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
            SchemaName = $schema; MaxLength = $max
            FormatName = @{ Value = 'Text' }
            DisplayName = (_Label $label)
            RequiredLevel = @{ Value = 'None' } }
    if ($primary) { $a.IsPrimaryName = $true; $a.RequiredLevel = @{ Value = 'ApplicationRequired' } }
    return $a
}

# 테이블 정의 (2단계 데이터 인터페이스 규격과 1:1)
$tables = @(
    @{ Schema='fw_inventory'; Display='FW 인벤토리'; Plural='FW 인벤토리 목록'; Attrs=@(
        (_StrAttr 'fw_name' '리소스명' 400 $true), (_StrAttr 'fw_sourceid' '원본 ID' 200),
        (_StrAttr 'fw_type' '유형' 50), (_StrAttr 'fw_envid' '환경 ID' 200),
        (_StrAttr 'fw_owner' '소유자' 300), (_StrAttr 'fw_createdat' '생성일' 60),
        (_StrAttr 'fw_registered' '과제 등록 여부' 10) ) },
    @{ Schema='fw_task'; Display='FW 과제'; Plural='FW 과제 대장'; Attrs=@(
        (_StrAttr 'fw_name' '과제명' 400 $true), (_StrAttr 'fw_code' '과제코드' 100),
        (_StrAttr 'fw_tasktype' '유형' 50), (_StrAttr 'fw_owner' '담당자' 300),
        (_StrAttr 'fw_stage' '단계' 10), (_StrAttr 'fw_status' '상태' 60),
        (_StrAttr 'fw_sourceid' '원본 ID' 200) ) },
    @{ Schema='fw_runhistory'; Display='FW 실행이력'; Plural='FW 실행이력 목록'; Attrs=@(
        (_StrAttr 'fw_name' '실행 ID' 400 $true), (_StrAttr 'fw_task' '과제' 400),
        (_StrAttr 'fw_starttime' '시작' 60), (_StrAttr 'fw_endtime' '종료' 60),
        (_StrAttr 'fw_status' '상태' 60), (_StrAttr 'fw_processed' '처리 건수' 20) ) }
)

$headers = Get-DvHeaders -Token $tok -ReturnRepresentation
$headers['MSCRM.SolutionUniqueName'] = $SolutionUniqueName

foreach ($t in $tables) {
    $logical = $t.Schema.ToLower()
    $exists = $false
    try {
        Invoke-PPRest -Method GET -Uri "$apiBase/EntityDefinitions(LogicalName='$logical')?`$select=EntitySetName" `
            -Headers (Get-DvHeaders -Token $tok) -MaxAttempts 1 | Out-Null
        $exists = $true
    } catch { }
    if ($exists) { Write-PPLog -Level Info -Message "테이블 존재: $logical (건너뜀)"; continue }

    Write-PPLog -Level Info -Message "테이블 생성: $logical"
    $body = @{ '@odata.type' = 'Microsoft.Dynamics.CRM.EntityMetadata'
        SchemaName = $t.Schema
        DisplayName = (_Label $t.Display); DisplayCollectionName = (_Label $t.Plural)
        Description = (_Label 'FlowOps 자동 생성 테이블')
        OwnershipType = 'UserOwned'; HasActivities = $false; HasNotes = $false
        Attributes = $t.Attrs }
    Invoke-PPRest -Method POST -Uri "$apiBase/EntityDefinitions" -Headers $headers -Body $body | Out-Null
    Write-PPLog -Level Info -Message "테이블 생성 완료: $logical"
}

# EntitySetName 확인 출력 (Sync 스크립트가 사용)
foreach ($t in $tables) {
    $logical = $t.Schema.ToLower()
    $def = Invoke-PPRest -Method GET -Uri "$apiBase/EntityDefinitions(LogicalName='$logical')?`$select=EntitySetName" `
        -Headers (Get-DvHeaders -Token $tok)
    Write-Host ("  {0}  ->  EntitySetName: {1}" -f $logical, $def.EntitySetName) -ForegroundColor Green
}
Write-Host ""
Write-Host "FlowOps DB 초기화 완료. 다음: Sync-FlowOpsData.ps1 실행" -ForegroundColor Green
