# PA 개발 프레임워크 설계서 — "FlowOps" (가칭)

> 개발 방법론(템플릿 v2) + Power Platform 어드민 자동화 + 프로젝트/산출물/코드 관리를
> 하나의 프레임워크로 통합. **"프레임워크를 따르기만 하면 일정관리·산출물·코드관리가 자동으로 따라온다"**

---

## 1. 핵심 가치 제안 (어필 포인트)

기존 PM 방식의 문제: 일정표 따로(엑셀), 산출물 따로(문서 수작업), 코드 따로(zip 파일 공유), 현황 파악은 회의로.

**FlowOps의 답: 개발 행위 자체가 관리 데이터를 만든다.**

| 관리 영역 | 기존 (수동) | FlowOps (자동) | 데이터 원천 |
|---|---|---|---|
| **일정 관리** | 엑셀 일정표, 주간회의로 갱신 | 과제 단계가 실제 개발 행위로 자동 전환 | 솔루션 생성=개발 착수, TEST 배포=개발 완료, PROD 배포=오픈 — Pipelines 이벤트가 자동 기록 |
| **목표/진척 관리** | 담당자 구두 보고 | 대시보드 실시간 (과제 수, 단계별 분포, 지연 과제 자동 표시) | Inventory API + 과제대장 + 배포이력 |
| **산출물 관리** | 문서 수작업 작성, 버전 뒤죽박죽 | **산출물 자동 생성** — 흐름정의서(솔루션 메타데이터에서), 테스트결과서(실행이력에서), 배포이력서(Pipelines 기록에서) | Dataverse Web API + 실행이력 테이블 |
| **코드 관리** | zip 파일 메일/공유폴더 | 배포 시마다 솔루션 자동 아카이브 + 버전 이력, 어느 시점이든 복원 가능 | Pipelines 아티팩트 + 솔루션 export 자동화 |
| **품질 관리** | 코드리뷰 회의 | 템플릿 준수 자동 검사 (LogFunc 포함 여부, 명명규칙, 하드코딩 검출) | Dataverse `workflow.clientdata` 파싱 |
| **운영 관리** | 오류 메일에 의존 | 실행 현황 실시간 + 죽은 과제 감지(Heartbeat) + 오류대장 | 실행이력 테이블 + 감시 흐름 |

**한 문장 요약**: 개발자는 템플릿대로 개발하고 파이프라인으로 배포할 뿐인데, PM 화면에는 일정·진척·산출물·코드 이력이 저절로 쌓인다.

---

## 2. 프레임워크 4계층 구조

```
┌────────────────────────────────────────────────────────────┐
│ L4. 거버넌스/PM 층  ── FlowOps 포털 (관리 화면)              │
│     과제대장 · 일정보드 · 산출물함 · 준수검사 · 대시보드      │
├────────────────────────────────────────────────────────────┤
│ L3. 실행/운영 층    ── 오케스트레이터 대체 프레임워크          │
│     실행이력 · 오류대장 · Heartbeat · SLA 감시 · 알림        │
├────────────────────────────────────────────────────────────┤
│ L2. ALM/코드 층     ── 릴리스 관리                           │
│     솔루션 표준 · Pipelines · 승인 게이트 · 코드 아카이브     │
├────────────────────────────────────────────────────────────┤
│ L1. 개발 표준 층    ── 템플릿 v2 (dev-template-standard.md)  │
│     8함수 템플릿 · 명명규칙 · 공통 라이브러리 · Config/자격증명│
└────────────────────────────────────────────────────────────┘
        모든 층의 데이터 저장소: Dataverse (FlowOps 전용 환경)
```

---

## 3. Power Platform 어드민 기능 연계 자동화 설계

### 3.1 연계 매핑 (전부 2026 공식 지원 API)

| # | FlowOps 기능 | Power Platform 기능/API | 자동화 방식 |
|---|---|---|---|
| A1 | 테넌트 리소스 인벤토리 | **Inventory API** (`resourcequery/resources/query`, Azure Resource Graph, 15분 신선도) | 감시 흐름이 주기 조회 → 과제대장과 대사(미등록 리소스 검출) |
| A2 | 배포 자동화 | **Power Platform Pipelines** | 개발자가 파이프라인 실행 → TEST/PROD 승격 |
| A3 | 배포 승인 게이트 | Pipelines 확장 트리거 `OnApprovalStarted` + Approvals 커넥터 | 승인 요청 자동 생성 → 팀장 Teams 승인 → `UpdateApprovalStatus` |
| A4 | 배포 시 일정 자동 갱신 | Pipelines 확장 트리거 `OnDeploymentCompleted` | 흐름이 과제대장 단계 자동 전환 (개발중→테스트, 테스트→운영) |
| A5 | 코드 아카이브 | `ExportSolutionAsync` (Dataverse Web API) | `OnDeploymentCompleted` 시 솔루션 자동 export → 버전 폴더/저장소에 보존 |
| A6 | 템플릿 준수 검사 | Dataverse Web API (`workflows.clientdata`, `solutioncomponents`) | 주기 검사 흐름: LogFunc 호출 존재, 명명규칙 정규식, 하드코딩 패턴 |
| A7 | DLP/커넥터 통제 | **환경 그룹 + Advanced Connector Policies API** (`environmentmanagement/environment-groups`) | 신규 환경 자동 그룹 편입, 정책 위반 알림 |
| A8 | 환경 수명주기 | Power Platform API (환경 생성/조회) + BAP admin API | 개인 개발환경 신청→승인→자동 생성 |
| A9 | 실행 모니터링 | 템플릿 LogFunc v2 → Dataverse 실행이력 | 과제 자신이 기록 (외부 폴링 불필요) + Heartbeat 감시 흐름 |
| A10 | 산출물 자동 생성 | Dataverse Web API (솔루션/흐름 메타데이터) + Word/PDF 커넥터 | 배포 시점에 흐름정의서·배포이력서 자동 생성 → 산출물함 저장 |
| A11 | 노코드 자동화 옵션 | **Power Platform for Admins V2 커넥터** | 위 A1~A8 상당수를 흐름에서 코딩 없이 호출 가능 |

### 3.2 데이터 모델 (Dataverse — FlowOps 전용 환경)

```
fw_project        프로젝트   : 프로젝트코드, 고객사, PM, 기간, 상태
fw_task           과제대장   : 과제코드(채번), 프로젝트, 담당자, 단계, 계획/실적일, SLA, 스케줄
fw_deliverable    산출물     : 과제, 유형(정의서/테스트/배포이력), 파일, 자동생성여부, 버전
fw_release        배포이력   : 과제, 버전, 환경, 승인자, 배포일시, 솔루션 아카이브 링크
fw_runhistory     실행이력   : runId, 과제, 머신, 시작/종료, 상태, 처리/skip 건수
fw_errorledger    오류대장   : runId, 건 식별자, 분류(S/B/D), 처리상태
fw_compliance     준수검사   : 과제, 검사항목, 결과, 검사일
fw_config         설정      : 정책값 (SLA 기본, 알림 수신자, 검사 규칙)
```

### 3.3 자동화 흐름 목록 (플랫폼 자체도 흐름으로 구축 — dogfooding)

| 흐름 | 트리거 | 역할 |
|---|---|---|
| FW-일정동기화 | Pipelines `OnDeploymentCompleted` | 과제 단계 자동 전환 + 실적일 기록 |
| FW-승인게이트 | Pipelines `OnApprovalStarted` | Teams 승인 카드 → UpdateApprovalStatus |
| FW-코드아카이브 | Pipelines `OnDeploymentCompleted` | 솔루션 export → 버전 보존 + fw_release 기록 |
| FW-산출물생성 | fw_release 생성 시 | 흐름정의서/배포이력서 자동 생성 → fw_deliverable |
| FW-준수검사 | 일 1회 스케줄 | 템플릿 준수 검사 → fw_compliance + 위반 알림 |
| FW-인벤토리대사 | 일 1회 스케줄 | Inventory API ↔ 과제대장 대사 → 미등록 리소스 검출 |
| FW-Heartbeat | 15분 주기 | 예정 실행 누락 감지 → 담당자 알림 |
| FW-SLA감시 | fw_runhistory 갱신 시 | 실행시간 SLA 초과/실패 알림 |

---

## 4. 설계 목표 (측정 가능하게)

| # | 목표 | 지표 | 목표치 |
|---|---|---|---|
| G1 | 관리 데이터 수동 입력 최소화 | 과제대장 필드 중 자동 기록 비율 | 70%↑ (담당자 입력: 과제명·담당자·계획일 정도) |
| G2 | 산출물 자동화 | 표준 산출물 중 자동 생성 비율 | 3종 자동 (흐름정의서·테스트결과·배포이력) |
| G3 | 코드 이력 보존 | PROD 배포 버전의 솔루션 아카이브 보존율 | 100% |
| G4 | 배포 리드타임 | 배포 요청→PROD 반영 소요 | 수동 대비 50%↓ |
| G5 | 템플릿 준수 가시화 | 전체 과제 준수율 대시보드 표시 | 주 1회 자동 갱신 |
| G6 | 장애 인지 시간 | 과제 미실행/실패 → 담당자 인지 | 30분 이내 (Heartbeat) |
| G7 | 플랫폼 자체 유지비 | 별도 서버/인프라 | 0 (전부 Power Platform 내) |

---

## 5. 구축 단계 (로드맵)

```
Phase 1 (기반)    : Dataverse 테이블 + 템플릿 v2 배포 + LogFunc v2 (중앙 로깅)
Phase 2 (ALM)     : Pipelines 구성 + 승인 게이트 + 코드 아카이브 흐름
Phase 3 (자동화)  : 일정동기화 + 산출물 자동 생성 + 준수검사
Phase 4 (포털)    : FlowOps 포털 UI (대시보드/과제/산출물/모니터링)
Phase 5 (거버넌스): 인벤토리 대사 + DLP 연계 + Heartbeat/SLA
```

각 Phase는 독립 가치 제공 — Phase 1만 해도 중앙 실행 모니터링이 생기고, Phase 2만 해도 코드관리가 해결됨.
