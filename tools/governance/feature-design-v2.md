# FlowOps 기능 설계 v2 — 개발관리 SW 벤치마크 기반

> 벤치마크: Jira / Azure DevOps / GitLab의 표준 기능 도메인을 기준으로 FlowOps 기능을 재설계.
> 각 기능 → Power Platform 어드민 기능 매핑 → 관리 프로세스 순 개발 계획 → DEX 실데이터 연동 → 리스크.

---

## 1. 기능 도메인 설계 (벤치마크 → FlowOps → PP 매핑)

일반 개발관리 SW의 10개 표준 도메인 기준. **굵은 항목**은 v1 설계에서 누락됐던 것.

| # | 도메인 (벤치마크 대응) | FlowOps 기능 | Power Platform 매핑 | 데이터 원천 |
|---|---|---|---|---|
| D1 | **과제/백로그 관리** (Jira Work Items) | 과제 등록·채번, 우선순위, 상태 워크플로, **변경요청(CR)** | Dataverse `fw_task` + BPF(비즈니스 프로세스 흐름)로 단계 강제 | 수동 등록 + 인벤토리 대사 |
| D2 | **일정/리소스 계획** (AzDO Boards) | **WBS 4단계 계획(분석/개발/테스트/오픈) baseline**, 간트/칸반, **개발자 부하 뷰**, 마일스톤 | Dataverse `fw_taskplan` + 배포 이벤트로 실적 자동 | 계획=수동 1회, 실적=Pipelines 트리거 |
| D3 | **형상/코드 관리** (Git/Repos) | 버전 아카이브, **버전 간 diff 뷰**, **Git 자동 커밋**, 복원 | `ExportSolutionAsync` 자동 아카이브 + **Dataverse Git integration**(솔루션 unpack 자동 커밋) + unpack 후 텍스트 diff | Pipelines `OnDeploymentCompleted` |
| D4 | **CI/CD** (Pipelines) | 배포 요청→승인→배포→**롤백**, 환경별 릴리스 트래킹 | **Power Platform Pipelines** + 확장 트리거(`OnApprovalStarted`/`OnDeploymentCompleted`) + Approvals | Pipelines 호스트 Dataverse |
| D5 | **품질/테스트** (Test Plans) | **테스트 케이스 관리, 실행 결과 기록, UAT 승인**, 준수검사(정적분석 대응), **코드리뷰 게이트** | Dataverse `fw_testcase`/`fw_testrun` + 준수검사 흐름(`workflow.clientdata` 파싱) + 승인 게이트에 리뷰 체크 포함 | TEST 환경 실행이력 자동 연결 |
| D6 | **이슈/SLA 관리** (ITSM) | 오류대장(S/B/D), 처리 배정, SLA 추적, **에스컬레이션 매트릭스** | Dataverse `fw_errorledger` + 알림 흐름 (Teams/메일, 지연 시 상급자) | LogFunc v2 |
| D7 | **운영/오케스트레이션** (RPA Orchestrator) | 실행이력, **실행 큐(우선순위·동시제어)**, **머신 풀 관리(상태·가동률)**, Heartbeat | `fw_runqueue`/`fw_machine` + 데스크톱 흐름 **머신 그룹**(제품 기능) + 디스패처 흐름 | LogFunc v2 + Flow API 머신 조회 |
| D8 | **성과/보고** (Dashboards) | **ROI 자동 산출(절감시간·FTE)**, **주간보고 자동 생성**, 경영 리포트 | 절감시간 = Σ(처리건수 × 건당수작업분) — `fw_runhistory`에서 매일 집계 흐름 / 주간보고 = Word 커넥터로 템플릿 채움 | 실행이력 + 과제대장(건당시간 1회 입력) |
| D9 | **지식/산출물** (Wiki) | 산출물함(자동생성 3종 + 수동), 템플릿·가이드 위키 | Dataverse `fw_deliverable` + SharePoint 문서고 연동 | 배포·실행 이벤트 |
| D10 | **관리/보안** (Admin) | **권한 모델(고객사별 데이터 분리)**, 테넌트 인벤토리, DLP, **감사 로그**, **라이선스 현황** | Dataverse **사업부(BU)+보안역할**로 고객사 분리 / Inventory API / 환경그룹 API / Dataverse 감사 기능 | BAP·Inventory·PP API |

### ROI 자동 산출 상세 (D8 — 핵심 차별화 요소)

```
과제 등록 시 1회 입력: 건당 수작업 소요(분), 건당 단가(선택)
매일 집계 흐름:  절감시간(일) = Σ 성공 처리건수 × 건당수작업분 ÷ 60
대시보드:        이번 달 절감 1,240h = 7.2 FTE = ₩58,000,000 (단가 입력 시)
주간보고:        과제별 절감·실행 안정성·지연 현황을 Word 템플릿에 자동 채움 → PM 검토 → 발송
```

---

## 2. 메뉴설계도 v2

```
FlowOps
├─ 🏠 홈            역할별 랜딩 (PM=성과+일정 / 개발자=내작업 / 운영자=실행현황 / 관리자=거버넌스)
├─ 📊 성과          ROI 대시보드 · 주간보고(자동생성) · 경영 리포트
├─ 📋 계획          프로젝트 · 과제 대장 · 일정 보드(간트|칸반) · 리소스 부하 · 변경요청
├─ 🛠 개발          내 작업 · 템플릿/라이브러리 카탈로그 · 준수 검사 · 코드리뷰
├─ 📦 형상/배포     코드 저장소(버전·diff·Git) · 배포 요청 · 승인함 · 배포 이력 · 롤백
├─ 🧪 테스트        테스트 케이스 · 실행 결과 · UAT 승인
├─ 📡 운영          실행 현황 · 실행 큐 · 머신 관리 · 오류 대장 · SLA · 알림 센터
├─ 📁 산출물/문서   산출물함 · 개발 가이드 · 위키
└─ 🛡 관리          테넌트 인벤토리 · 환경/DLP · 권한(고객사 분리) · 감사 로그 · 라이선스 · 설정
```

모바일(Teams 앱): 승인함 · 알림 · 실행 현황 3개만 — 조치용 최소 화면.

---

## 3. 관리 프로세스 순 개발 계획

관리 프로세스(계획→개발→검증→배포→운영→보고) 그대로 빌드 순서로.

| 단계 | 범위 | 만들 것 (테이블 / 흐름 / 화면) | 완료 기준 |
|---|---|---|---|
| **P1 계획** | D1+D2 | `fw_project` `fw_task` `fw_taskplan` / 채번 흐름 / 과제대장·간트 화면 | 과제 등록→채번→계획 수립이 포털에서 됨 |
| **P2 개발표준** | D5(준수) | 템플릿 v2 배포, LogFunc v2 / 준수검사 흐름 / 준수 화면 | 신규 과제 1개가 템플릿으로 개발되고 검사 통과 |
| **P3 형상/배포** | D3+D4 | Pipelines 구성 / 승인게이트·코드아카이브·일정동기화 흐름 / 저장소·승인함 화면 | TEST 배포 시 단계 자동 전환 + zip 자동 보존 |
| **P4 테스트** | D5 | `fw_testcase` `fw_testrun` / TEST 실행이력 자동 연결 / 테스트 화면 | 테스트결과서 자동 생성 |
| **P5 운영** | D6+D7 | `fw_runhistory` `fw_errorledger` `fw_runqueue` `fw_machine` / Heartbeat·SLA·디스패처 흐름 / 운영 화면 | 죽은 과제 30분 내 알림 + 큐 기반 실행 |
| **P6 성과** | D8 | ROI 집계 흐름 / 주간보고 생성 흐름 / 성과 대시보드 | 주간보고 1부가 자동 생성됨 |
| **P7 거버넌스** | D10 | 인벤토리 대사·DLP 연계 흐름 / BU 권한 구성 / 관리 화면 | 미등록 리소스 검출 + 고객사별 데이터 분리 확인 |

각 단계는 독립 가치 — P1+P3만 해도 "일정 자동화+코드관리" 데모 가능.

---

## 4. DEX 실데이터 연동 설계

### 4.1 단계적 연동 (읽기부터, 쓰기는 마지막)

| 단계 | 내용 | DEX에 미치는 영향 | 산출물 |
|---|---|---|---|
| **1단계: UI 프로토타입** | 예시 데이터 기반 화면 검증 — 데이터 인터페이스 규격(`flowops-data.json`) 확정 | 없음 | 목업 v2 |
| **2단계: 읽기 전용 데이터 연동** | `Get-FlowOpsData.ps1`이 DEX에서 Inventory API + Dataverse를 **조회 전용**으로 호출하여 `flowops-data.json` 생성 → UI에 실데이터 표시 | **없음 (읽기만)** | 데이터 연동 스크립트 (`scripts/Get-FlowOpsData.ps1`) |
| **3단계: 전용 환경 구축** | FlowOps 전용 환경 신설 + `fw_*` 테이블 + 수집 흐름(스케줄 읽기) | 없음 (DEX는 소스일 뿐) | Dataverse 솔루션 |
| **4단계: 양방향 연동** | 과제 등록/승인/단계 전환 트랜잭션 + Pipelines 이벤트 수신 | FlowOps 환경에만 쓰기, **DEX에는 여전히 쓰기 없음** | 자동화 흐름 8종 |
| **5단계: 기존 과제 전환** | 기존 운영 과제에 LogFunc v2 적용 배포 (과제별 점진 전환) | 과제 재배포 필요 — 변경 통제 하에 | 편입 체크리스트 |

원칙: **DEX(기본환경)에 대한 쓰기 작업은 5단계 이전에 수행하지 않는다.** 플랫폼 데이터는 전부 FlowOps 전용 환경에.

### 4.2 데이터 인터페이스 규격 (UI ↔ 연동 스크립트)

```jsonc
// flowops-data.json — UI와 데이터 연동 스크립트가 공유하는 규격
{
  "meta":     { "source": "mock | live", "syncedAt": "ISO8601", "tenant": "...", "envName": "DEX" },
  "kpi":      { "totalFlows": 0, "totalApps": 0, "totalAgents": 0, "unregistered": 0 },
  "tasks":    [ { "code": "", "name": "", "owner": "", "stage": 1-5, "planned": "", "actual": "", "status": "" } ],
  "runs":     [ { "runId": "", "task": "", "machine": "", "start": "", "end": "", "processed": 0, "skipped": 0, "status": "" } ],
  "releases": [ { "task": "", "version": "", "env": "", "approver": "", "deployedAt": "" } ],
  "inventory":[ { "name": "", "type": "flow|app|agent", "env": "", "owner": "", "createdAt": "", "registered": false } ]
}
```

### 4.3 데이터 연동 스크립트가 호출하는 API

| 계약 필드 | 호출 | 비고 |
|---|---|---|
| `kpi.*`, `inventory[]` | `POST api.powerplatform.com/resourcequery/resources/query` (Inventory API) | SPN, 읽기 전용, 15분 신선도 |
| `tasks[]` (초기 단계에서는 봇/흐름 목록으로 대체) | DEX Dataverse `GET /bots`, `GET /workflows?category eq 5` | 기존 마이그레이션 툴킷 lib 재사용 |
| `runs[]` (2단계에서는 흐름 실행 이력) | Flow API `GET .../flows/{id}/runs` (상위 N건) | 스로틀 주의 — 과제당 최근 5건만 |
| `releases[]` | 2단계에서는 빈 배열 (Pipelines 미구성) | 4단계부터 수집 |

---

## 5. 연동 리스크 등록부

| # | 리스크 | 시나리오 | 영향 | 완화 |
|---|---|---|---|---|
| R1 | **Dataverse API 한도 소모** | LogFunc v2가 건별 중앙 기록 → 대량 배치(1만건)가 SPN entitlement 잠식 | 타 자동화 지연/차단 | 기록 배치화(기본 50건당 1회+시작/종료), 진행 갱신은 상태 필드 PATCH만, 한도 모니터링 대시보드 |
| R2 | **Inventory API 신선도(15분)·스키마 변화** | 실시간 화면을 인벤토리로 만들면 최신 아님 / ARG 스키마 필드 추가·변경 | 화면 오표시 | 실시간=LogFunc 데이터, 인벤토리 화면엔 "동기화 시각" 상시 표기, 연동 스크립트에 스키마 버전 검증 |
| R3 | **SPN 권한 과다** | 테넌트 전체 읽기 SPN 유출 시 전체 리소스 노출 | 보안 사고 | 읽기 전용 단계 분리, 비밀 회전(6개월), Cred Manager/KV 보관, 감사 로그, CA 정책 |
| R4 | **DLP가 플랫폼 자신을 차단** | FlowOps 흐름이 쓰는 HTTP/Dataverse/Teams 커넥터가 DLP 정책에 걸림 | 플랫폼 정지 | FlowOps 전용 환경을 별도 환경그룹+전용 정책으로, 배포 전 DLP 시뮬레이션 |
| R5 | **Managed Environments 전제 기능** | 환경그룹·고급 커넥터 정책은 ME(유료) 필요 | 기능 축소 or 비용 증가 | 라이선스 매트릭스 사전 확정: ME 미보유 시 대체 경로(테넌트 DLP 수동 + 문서화) 설계에 명시 |
| R6 | **DEX 직접 쓰기 사고** | 연동 스크립트/흐름 결함으로 인한 기본환경 데이터 변조 | 운영 과제 영향 | 1~4단계에서는 DEX 대상 쓰기 코드를 구현하지 않음, SPN에 DEX는 읽기 역할만 부여(최소권한) |
| R7 | **개인정보 수집** | 소유자 이메일·이름이 플랫폼에 축적 | 컴플라이언스 | 수집 목적 고지, 표시 최소화(담당 화면 외 마스킹), 퇴사자 데이터 보존기간 정의 |
| R8 | **스로틀링(429)** | 인벤토리 대사+run 이력 조회가 몰림 | 수집 실패 | 야간 배치, Retry-After 준수(기존 PPThrottle 재사용), 과제당 조회 상한 |
| R9 | **Pipelines 제약** | 확장 트리거 미지원 리전/미설치, 개인 파이프라인은 확장 불가 | 일정 자동화 불가 | 사전 점검 스크립트, 반드시 커스텀 호스트 파이프라인 사용(개인 파이프라인 금지 규칙) |
| R10 | **계약 불일치(UI↔실데이터)** | 실데이터에 UI가 가정하지 않은 값(null 소유자, 한글 깨짐 등) | 화면 깨짐 | 데이터 계약에 null 규칙 명시, 어댑터가 계약 검증 후 출력, 샘플 실데이터로 2단계 조기 검증 |
| R11 | **기존 과제 편입 부담** | 운영 중 과제 재배포(LogFunc v2) 리스크 | 운영 장애 | 5단계(기존 과제 전환)를 과제별 점진 적용, 편입 전후 병행 모니터링 1주, 롤백 아카이브 확보 |

---

## 6. 이번 작업 산출물

1. 본 문서 (기능/메뉴/매핑/개발순서/연동/리스크)
2. UI 프로토타입 v2 — 메뉴 체계 v2 반영, 성과(ROI)·일정 보드·실행 큐/머신 화면 추가, "예시 데이터" 상태 배지
3. `scripts/Get-FlowOpsData.ps1` — 읽기 전용 데이터 연동 스크립트 (DEX → flowops-data.json, 기존 마이그레이션 공용 모듈 재사용)
