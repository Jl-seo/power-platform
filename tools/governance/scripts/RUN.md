# FlowOps 실데이터 반영 — 실행 명령서

목표: 테넌트 실데이터를 호출하여 FlowOps 데이터베이스(Dataverse)에 반영한다.
쓰기 대상은 FlowOps 테이블로 한정하며, DEX(기본환경)에는 쓰기 작업을 수행하지 않는다.

## 사전 조건

| 항목 | 확인 방법 |
|---|---|
| PowerShell 5.1 | `$PSVersionTable.PSVersion` |
| 서비스 주체(SPN) 구성 완료 | `config.psd1`의 `tenantId` / `spnAppId` 입력, 비밀은 secretBackend에 저장 |
| SPN 권한 | DEX: 읽기 가능 역할 / FlowOps 대상 환경: System Administrator(테이블 생성 필요) / 테넌트: Power Platform Administrator(Inventory API) |
| 저장소 최신화 | `tools/governance/scripts` 폴더 존재 확인 |

## 실행 절차 (순서대로)

```powershell
cd D:\jlseo\PPMigration\tools\governance\scripts
Get-ChildItem ..\..\ -Recurse -Include *.ps1,*.psm1,*.psd1 | Unblock-File

# [0] 연결 점검 (선택 — 최초 1회 권장)
powershell -ExecutionPolicy Bypass -File ..\..\migration\Test-PPSmokeTest.ps1

# [1] FlowOps 데이터베이스 초기화 — 테이블 3종 생성 (멱등: 재실행 시 건너뜀)
#     -FlowOpsEnvName: 환경 표시 이름(부분 일치)으로 자동 조회 — URL 몰라도 됨
powershell -ExecutionPolicy Bypass -File .\Initialize-FlowOpsDb.ps1 `
    -Config ..\..\migration\templates\config.psd1 `
    -FlowOpsEnvName 'DEX_DEV_Asia'

# [2] 실데이터 수집 및 DB 반영 — 인벤토리/과제 (실행 이력 포함 시 -IncludeRuns)
powershell -ExecutionPolicy Bypass -File .\Sync-FlowOpsData.ps1 `
    -Config ..\..\migration\templates\config.psd1 `
    -FlowOpsEnvName 'DEX_DEV_Asia' `
    -IncludeRuns

# [3] 결과 검증 (자동 출력 외 수동 확인)
#     - make.powerapps.com → 해당 환경 → 테이블 → FW 인벤토리 / FW 과제 / FW 실행이력
#     - UI 프로토타입 데이터 파일: ..\mockup\flowops-data.json (meta.source = "live" 확인)
```

## 정상 완료 판정 기준

1. `[1]` 출력에 3개 테이블의 EntitySetName이 표시됨
2. `[2]` 출력의 "반영 결과" 표에서 각 테이블의 신규/갱신/총 건수가 0이 아님
3. `flowops-data.json`의 `meta.source`가 `live`
4. 마지막 줄에 "DEX(기본환경)에는 쓰기 작업이 없었습니다" 확인

## 재실행/장애 시

| 상황 | 조치 |
|---|---|
| 재실행 | 그대로 다시 실행 — Upsert 방식이므로 중복 생성 없음 |
| Inventory API 실패(권한) | SPN에 Power Platform Administrator 역할 부여 후 재실행. 실패해도 과제 수집(2단계)은 계속 진행됨 |
| 테이블 생성 실패 | FlowOps 대상 환경에서 SPN이 System Administrator인지 확인 |
| 스로틀링(429) | 스크립트가 자동 재시도(Retry-After 준수). 반복 시 야간 실행 |
| 잘못 생성된 테이블 제거 | 해당 환경 → 솔루션 `fw_FlowOps` 삭제 (테이블 포함 일괄 제거) |

## 스케줄 자동화 (선택)

일 1회 자동 동기화가 필요한 경우 Windows 작업 스케줄러에 등록:

```powershell
schtasks /Create /TN "FlowOps-DailySync" /SC DAILY /ST 06:00 /TR `
  "powershell -ExecutionPolicy Bypass -File D:\jlseo\PPMigration\tools\governance\scripts\Sync-FlowOpsData.ps1 -Config D:\jlseo\PPMigration\tools\migration\templates\config.psd1 -FlowOpsEnvName 'DEX_DEV_Asia'"
```

이후 단계(4단계 양방향 연동)에서는 이 스크립트를 클라우드 흐름으로 대체하여 플랫폼 내부에서 자체 실행하도록 전환한다.
