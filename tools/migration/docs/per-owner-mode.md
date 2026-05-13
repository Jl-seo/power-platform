# Per-Owner Copilot Migration Mode

다대다 워크플로: 기본환경의 모든 Copilot Studio 에이전트를 **각 소유자의 개인 Developer 환경**으로 분산 이관.

## 개요

```
[Default 환경 (1)]
   ├── bot A (owner: alice)  ─→  alice의 dev env
   ├── bot B (owner: bob)    ─→  bob의 dev env
   ├── bot C (owner: alice)  ─→  alice의 dev env
   └── bot D (owner: ghost)  ─→  skip (dev env 없음)
```

소유자는 Dataverse `bot._ownerid_value` → `systemuser.azureactivedirectoryobjectid` 로 자동 도출.
Developer 환경은 BAP admin API에서 `properties/environmentSku eq 'Developer'` 필터로 enum.
매핑 키: AAD ObjectId (실패 시 email fallback).

## 봇 단위 파이프라인 (각 봇마다 반복)

```
a. Get-PPCopilotDependencies   - 봇이 호출하는 흐름·AI 프롬프트·연결참조·환경변수·지식원·커스텀 커넥터·지식 파일 메타 추출
b. Build-PPConnectionBootstrap - target env에 만들 연결 목록 자동 생성 (커넥터별 SPN/OAuth/ApiKey 분류)
c. New-PPPerOwnerSolution      - 원본에 임시 솔루션 생성 + AddSolutionComponent
d. Disable-PPOwnerNotifications- target 환경의 알림 메일 차단
e. Export-PPSolutionRest       - 원본에서 base64 zip으로 export
f. New-PPConnections           - target에 연결 생성 (3-track)
g. Build-IdMap                 - source ↔ target ID 매핑
h. Unpack → Repair GUIDs → Pack → Set-DeploymentSettings → Import-PPSolutionRest
i. AI rebind → ref patch → 흐름 OFF 강제 → 지식원 파일 바이너리 복사
j. plan entry status 업데이트
```

## 산출물

```
out/
├── inventory/
│   ├── bots.json                       # 모든 봇 + 소유자
│   ├── dev-envs.json                   # 모든 Developer 환경 + 소유자
│   ├── migration-plan.json             # 단일 진실 공급원 (status 추적)
│   └── spn-registration.json           # SPN 등록 결과 (Initialize-PPSpnInDevEnvs 실행 시)
├── per-bot/<botId>/
│   ├── deps.json
│   ├── solution.meta.json
│   ├── <slnUnique>.zip
│   ├── <slnUnique>.repaired.zip
│   ├── <slnUnique>.deploymentSettings.json
│   ├── <targetEnvId>.connection-bootstrap.json
│   └── repair/                          # unpack된 솔루션 트리
├── target/                              # per-target 산출물 (id-map, connection-map 등)
├── state/state.json                     # 체크포인트
├── state/failures.jsonl                 # 봇 단위 실패 로그
├── logs/
├── migration-report.csv
└── migration-report.html
```

## 실행 (단계별)

```powershell
cd D:\jlseo\PPMigration

# 0) (1회) SPN을 모든 Developer 환경에 일괄 등록 — 인벤토리 먼저 받아야 함
.\scripts\Invoke-PPCopilotMigration.ps1 -Config .\templates\config.psd1 -Phase Inventory
.\scripts\Initialize-PPSpnInDevEnvs.ps1 -Config .\templates\config.psd1

# 1) Plan 생성
.\scripts\Invoke-PPCopilotMigration.ps1 -Config .\templates\config.psd1 -Phase Plan

# 2) 봇 1개로 dry-run 검증 권장
notepad .\templates\config.psd1   # onlyOwnerEmails = @('me@contoso.com')
.\scripts\Invoke-PPCopilotMigration.ps1 -Config .\templates\config.psd1 -Phase Migrate

# 3) 검증 OK면 onlyOwnerEmails 비우고 전체 실행
.\scripts\Invoke-PPCopilotMigration.ps1 -Config .\templates\config.psd1 -Phase All

# 4) 실패한 봇만 재시도
.\scripts\Invoke-PPCopilotMigration.ps1 -Config .\templates\config.psd1 -Phase Migrate -Resume

# 5) 특정 봇만
.\scripts\Invoke-PPCopilotMigration.ps1 -Config .\templates\config.psd1 -Phase Migrate -OnlyBots <botId>

# 6) (선택) 원본의 임시 솔루션 정리
notepad .\templates\config.psd1   # cleanupSourceSolutions = $true
.\scripts\Invoke-PPCopilotMigration.ps1 -Config .\templates\config.psd1 -Phase Cleanup
```

## config.psd1 핵심 필드 (per-owner 모드)

```powershell
@{
    sourceEnvUrl  = 'https://orgDEFAULT.crm.dynamics.com'
    sourceEnvId   = '<default env GUID>'
    tenantId      = '<tenant GUID>'
    spnAppId      = '<SPN appId>'
    secretBackend = 'DPAPIFile'
    secrets       = @{ spnClientSecret = 'spn-secret' }
    outDir        = 'D:\jlseo\PPMigration\out'

    # Per-owner mode flags
    perOwnerMode         = $true
    solutionPrefix       = 'cr_AgentMig'
    publisherUniqueName  = 'pp_migration'
    publisherDisplayName = 'PP Migration'
    publisherPrefix      = 'pp'

    # Filters
    onlyOwnerEmails      = @()              # 비우면 전체
    excludeOwnerEmails   = @()              # 게스트/서비스 계정 제외

    cleanupSourceSolutions = $false
}
```

## 권한

- **테넌트 수준**: SPN에 `Power Platform Administrator` (BAP admin API용)
- **소스 (default) 환경**: SPN을 Application User + System Administrator
- **각 Developer 환경**: SPN을 Application User + System Administrator
  → `Initialize-PPSpnInDevEnvs.ps1` 가 BAP admin API의 `addUser` 액션으로 일괄 처리. 각 dev env의 소유자(개발자 본인)가 거부할 수도 있음 — 그 경우 admin이 강제로 추가하거나, 개발자 본인이 수동 추가

## 솔루션 명명 규칙

```
{solutionPrefix}_{ownerSlug}_{botSchemaSlug}_{yyyyMMddHHmm}
예: cr_AgentMig_johndoe_cr_supportbot_202605012130
```

## 종속성 처리 — 무엇이 포함/제외되나

| 종류 | 처리 |
|---|---|
| 봇 (bot) | ✅ 포함 (componenttype 10039) |
| 봇 컴포넌트 (topics, settings, language) | ✅ 포함 (10042) |
| 봇이 호출하는 흐름 (Modern Flow) | ✅ 포함 (29) |
| 흐름이 쓰는 연결참조 | ✅ 포함 (10119) + target에서 새 연결 생성 |
| AI Builder 프롬프트 | ✅ 포함 (10095) + 모델 재바인딩 |
| 환경변수 정의/값 | ✅ 포함 (380, 381) |
| 지식원 정의 (URL/Dataverse 검색) | ✅ 포함 (10104) |
| 지식원 업로드 파일 (PDF 등) | ✅ 별도 복사 (`Copy-PPKnowledgeFiles.ps1`) |
| 봇이 흐름 통해 호출하는 사용자 지정 커넥터 | ✅ 포함 (372) |
| 봇 아이콘/아바타 | ✅ bot 레코드 안에 들어있음 |
| 표준 커넥터 연결 | ❌ 솔루션 안 들어감, target에서 새 연결 |
| Dataverse 테이블 | ❌ 공유 자원으로 간주 |
| 캔버스 앱 | ❌ 별도 이관 프로세스 |
| 데스크톱 흐름 | ❌ 머신/액터 셋업이 별도 |
| 연결의 자격 증명 | ❌ export 안 됨 (보안) |

## 자주 일어나는 실패와 처리

| 증상 | status | 처리 |
|---|---|---|
| 소유자에게 dev 환경 없음 | `skip-no-env` | 운영자가 dev env 프로비저닝 후 재실행 |
| 종속성 추출 실패 | `fail` | 로그 확인, `Get-PPCopilotDependencies` 단독 실행으로 디버깅 |
| 솔루션 import async 60분 초과 | `fail` | `-Resume` 으로 재시도, 또는 더 큰 timeout |
| target dev env에 SPN 미등록 | `fail` (403) | `Initialize-PPSpnInDevEnvs.ps1` 재실행 |
| 봇 종속성에 다른 사람 흐름 참조 | `fail` | 운영자가 그 흐름의 소유자도 함께 처리 (현 도구는 1봇=1환경 원칙) |

## 핵심 데이터 모델

`migration-plan.json` 항목 구조:

```jsonc
{
  "bot":   { "id": "...", "schemaname": "cr_xxx", "name": "..." },
  "owner": { "email": "...", "aadObjectId": "...", "systemuserId": "..." },
  "target": { "envId": "...", "envUrl": "...", "name": "..." } | null,
  "status": "ready | in-progress | success | fail | skip-no-env | skip-filtered | skip-excluded",
  "deps": null,                    // 채워지면 deps 요약
  "solutionUniqueName": "...",
  "importJobId": "...",
  "errorMessage": null,
  "startedUtc": "...", "completedUtc": "..."
}
```

이 파일이 단일 진실 공급원. `-Resume` 시 이 파일의 `status` 보고 재처리 결정.
