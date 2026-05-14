<#
.SYNOPSIS
    PP Migration smoke test — verifies PowerShell can do the basic things the
    toolkit needs, on a clean Windows VM with no modules / no pac CLI / no
    config file.

    Prompts interactively for the bare minimum inputs, runs 5 checks, and
    prints PASS / FAIL per check.  No persistent state, no side effects.

.DESCRIPTION
    Checks:
      1. SPN client_credentials token from login.microsoftonline.com
      2. Dataverse Web API reachable (WhoAmI)
      3. Bot inventory readable (top 5)
      4. Power Platform admin BAP API reachable (list environments)
      5. Developer environments enumerable + your dev env detectable

    Usage:
      powershell.exe -ExecutionPolicy Bypass -File .\Test-PPSmokeTest.ps1
#>
[CmdletBinding()] param()

#Requires -Version 5.1
Set-StrictMode -Version 3.0
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ErrorActionPreference = 'Stop'
$ProgressPreference   = 'SilentlyContinue'
Add-Type -AssemblyName System.Web

function _Read([string] $Label, [switch] $Secure) {
    if ($Secure) {
        $s = Read-Host -Prompt $Label -AsSecureString
        return $s
    }
    return (Read-Host -Prompt $Label).Trim()
}
function _PlainFromSecure([System.Security.SecureString] $S) {
    $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($S)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringAuto($b) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}
function _UrlEncode([string] $S) { return [System.Web.HttpUtility]::UrlEncode($S) }

$results = @{}
function _Pass($name, $detail) { $results[$name] = @{ ok = $true;  detail = $detail };  Write-Host ("PASS  {0,-30}  {1}" -f $name, $detail) -ForegroundColor Green }
function _Fail($name, $err)    { $results[$name] = @{ ok = $false; detail = "$err"   };  Write-Host ("FAIL  {0,-30}  {1}" -f $name, $err)    -ForegroundColor Red }

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PP Migration — smoke test"                                       -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "이 스크립트는 어떤 파일도 영구 저장하지 않습니다. 모듈 설치도 하지 않습니다."
Write-Host "5개 체크 통과하면 PowerShell만으로 마이그레이션 가능하다는 확인이 됩니다."
Write-Host ""

# ---- Inputs ----
$tenantId    = _Read 'Tenant ID (GUID)'
$sourceUrl   = _Read 'Source(default) Dataverse URL (예: https://orgXXX.crm.dynamics.com)'
$spnAppId    = _Read 'SPN Application ID (Entra app GUID)'
$spnSecSec   = _Read 'SPN Client Secret'      -Secure
$myEmail     = _Read 'Your email (테스트 필터; 비우면 전체 인벤토리)'
$spnSecret   = _PlainFromSecure $spnSecSec

if ($sourceUrl -notmatch '^https://') { $sourceUrl = "https://$sourceUrl" }
$sourceUrl = $sourceUrl.TrimEnd('/')

Write-Host ""
Write-Host "Inputs OK. Starting checks..." -ForegroundColor Cyan
Write-Host ""

# Helper: get token
function _GetToken([string] $Resource) {
    $scope = if ($Resource -match '/\.default$') { $Resource } else { ($Resource.TrimEnd('/') + '/.default') }
    $body = ("grant_type=client_credentials&client_id={0}&client_secret={1}&scope={2}" -f `
             $spnAppId, (_UrlEncode $spnSecret), (_UrlEncode $scope))
    $uri = "https://login.microsoftonline.com/$tenantId/oauth2/v2.0/token"
    $r = Invoke-RestMethod -Method POST -Uri $uri -Body $body `
            -ContentType 'application/x-www-form-urlencoded' -UseBasicParsing -ErrorAction Stop
    return $r.access_token
}

# ---- Check 1: SPN token from Dataverse audience ----
$dvToken = $null
try {
    $dvToken = _GetToken $sourceUrl
    _Pass 'spn-token-dataverse' ("token length={0}" -f $dvToken.Length)
} catch {
    _Fail 'spn-token-dataverse' $_.Exception.Message
    Write-Host ""
    Write-Host "이 단계가 실패하면 나머지가 다 막힙니다. 원인:" -ForegroundColor Yellow
    Write-Host "  - Tenant ID / SPN App ID / Client Secret 중 하나가 오타"
    Write-Host "  - Entra 앱에 admin consent가 부여되지 않음"
    Write-Host "  - 회사 방화벽이 login.microsoftonline.com을 막음"
    return
}

# ---- Check 2: WhoAmI ----
$apiBase = "$sourceUrl/api/data/v9.2"
$dvHeaders = @{
    Authorization      = "Bearer $dvToken"
    'OData-MaxVersion' = '4.0'
    'OData-Version'    = '4.0'
    Accept             = 'application/json'
}
try {
    $who = Invoke-RestMethod -Method GET -Uri "$apiBase/WhoAmI" -Headers $dvHeaders -UseBasicParsing -ErrorAction Stop
    _Pass 'dataverse-whoami' ("UserId={0} OrgId={1}" -f $who.UserId, $who.OrganizationId)
} catch {
    _Fail 'dataverse-whoami' $_.Exception.Message
    Write-Host "  → SPN이 소스 환경에 Application User로 등록되지 않았거나 권한 부족" -ForegroundColor Yellow
}

# ---- Check 3: Read bots ----
try {
    $top = if ($myEmail) { 50 } else { 5 }
    $filter = ''
    $expand = '$expand=ownerid($select=internalemailaddress,azureactivedirectoryobjectid,fullname)'
    $uri = "$apiBase/bots?`$top=$top&`$select=botid,schemaname,name,publishedon&$expand"
    $bots = Invoke-RestMethod -Method GET -Uri $uri -Headers $dvHeaders -UseBasicParsing -ErrorAction Stop
    $count = if ($bots.value) { @($bots.value).Count } else { 0 }
    _Pass 'dataverse-bots-list' ("returned {0}" -f $count)
    if ($count -gt 0) {
        Write-Host ""
        Write-Host "  샘플 봇 (최대 5개):" -ForegroundColor DarkGray
        $bots.value | Select-Object -First 5 | ForEach-Object {
            $ownerEmail = if ($_.ownerid) { $_.ownerid.internalemailaddress } else { '(no owner)' }
            $pub = if ($_.publishedon) { 'Published' } else { 'Draft' }
            Write-Host ("    {0,-32}  owner: {1,-30}  {2}" -f $_.schemaname, $ownerEmail, $pub)
        }
        if ($myEmail) {
            $mine = @($bots.value | Where-Object {
                $_.ownerid -and $_.ownerid.internalemailaddress -and `
                $_.ownerid.internalemailaddress.ToLower() -eq $myEmail.ToLower()
            })
            Write-Host ""
            Write-Host ("  본인({0}) 소유 봇: {1}개" -f $myEmail, $mine.Count) -ForegroundColor Cyan
            if ($mine.Count -gt 0) {
                $mine | Select-Object -First 5 | ForEach-Object {
                    Write-Host ("    → {0}  ({1})" -f $_.schemaname, $_.botid)
                }
            }
        }
    }
} catch {
    _Fail 'dataverse-bots-list' $_.Exception.Message
}

# ---- Check 4: BAP admin token + env list ----
$bapToken = $null
try {
    $bapToken = _GetToken 'https://api.bap.microsoft.com'
    _Pass 'spn-token-bap' ("token length={0}" -f $bapToken.Length)
} catch {
    _Fail 'spn-token-bap' $_.Exception.Message
    Write-Host "  → SPN에 Power Platform Administrator 역할 부여 필요" -ForegroundColor Yellow
}

# ---- Check 5: Developer environments ----
if ($bapToken) {
    try {
        $bapHeaders = @{ Authorization = "Bearer $bapToken"; Accept = 'application/json' }
        $uri = "https://api.bap.microsoft.com/providers/Microsoft.BusinessAppPlatform/scopes/admin/environments?api-version=2020-10-01&`$filter=" + (_UrlEncode "properties/environmentSku eq 'Developer'")
        $env = Invoke-RestMethod -Method GET -Uri $uri -Headers $bapHeaders -UseBasicParsing -ErrorAction Stop
        $devCount = if ($env.value) { @($env.value).Count } else { 0 }
        _Pass 'bap-dev-envs-list' ("returned {0} Developer environments" -f $devCount)
        if ($devCount -gt 0) {
            Write-Host ""
            Write-Host "  샘플 dev 환경 (최대 5개):" -ForegroundColor DarkGray
            $env.value | Select-Object -First 5 | ForEach-Object {
                $owner = ''
                if ($_.properties -and $_.properties.PSObject.Properties.Name -contains 'createdBy' -and $_.properties.createdBy) {
                    $owner = $_.properties.createdBy.email
                }
                $url = ''
                if ($_.properties -and $_.properties.PSObject.Properties.Name -contains 'linkedEnvironmentMetadata' -and $_.properties.linkedEnvironmentMetadata) {
                    $url = $_.properties.linkedEnvironmentMetadata.instanceUrl
                }
                Write-Host ("    {0,-36}  owner: {1,-30}  {2}" -f $_.properties.displayName, $owner, $url)
            }
            if ($myEmail) {
                $mine = @($env.value | Where-Object {
                    $_.properties.createdBy -and $_.properties.createdBy.email -and `
                    $_.properties.createdBy.email.ToLower() -eq $myEmail.ToLower()
                })
                Write-Host ""
                Write-Host ("  본인({0}) dev 환경: {1}개" -f $myEmail, $mine.Count) -ForegroundColor Cyan
                if ($mine.Count -gt 0) {
                    $myEnv = $mine[0].properties
                    Write-Host ("    → {0}  URL: {1}" -f $myEnv.displayName, $myEnv.linkedEnvironmentMetadata.instanceUrl)
                }
            }
        }
    } catch {
        _Fail 'bap-dev-envs-list' $_.Exception.Message
        Write-Host "  → SPN에 Power Platform Administrator 역할 부여 또는 token audience 검토" -ForegroundColor Yellow
    }
}

# ---- Summary ----
Remove-Variable spnSecret -ErrorAction SilentlyContinue
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
$pass = ($results.GetEnumerator() | Where-Object { $_.Value.ok }).Count
$fail = ($results.GetEnumerator() | Where-Object { -not $_.Value.ok }).Count
$color = if ($fail -eq 0) { 'Green' } else { 'Yellow' }
Write-Host ("  Result: {0} PASS / {1} FAIL" -f $pass, $fail) -ForegroundColor $color
Write-Host "================================================================" -ForegroundColor Cyan
if ($fail -eq 0) {
    Write-Host ""
    Write-Host "전부 PASS. PowerShell + REST 만으로 마이그레이션 가능합니다." -ForegroundColor Green
    Write-Host "다음 단계는 templates\config.psd1 를 채워서 Invoke-PPCopilotMigration.ps1 실행." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "실패 항목 위에 있는 노란색 힌트 확인하시고 그 부분만 고치시면 됩니다." -ForegroundColor Yellow
}
Write-Host ""
