# DevKit — 4-Layer SDLC 도구 설계서

## Context
사내 개발 생산성 개선용 **AI 기반 SDLC 도구**(이하 "DevKit"). 한 사람이 **기획 → 개발(데이터·화면·워크플로우) → 테스트 → 배포**까지 한 도구에서 끝낼 수 있어야 한다. 사용자 등급 분리(시민/프로) 없음 — AI가 격차를 메운다.

요구사항 요약:
- ① 호출 성공/실패 추적, ② 자주 쓰이는 기능 분석, ③ 템플릿 공유.
- 기획→개발(데이터/화면/워크플로우)→테스트→배포 전 SDLC.
- Connection Reference + 환경변수 1급 시민.
- 미리보기/리뷰 1급 시민, 실개발 복잡성 존중(다중 파일, 부분 수락, 충돌, 롤백 등).
- 모르는 사람도 쉽게 — but **별도 모드 X**, 같은 도구 같은 UX.

---

## 1. 코어 메커니즘 — 4-Layer 양방향 편집 + IR(중간표현)

```
[L1 자연어]   [L2 다이어그램]   [L3 캔버스]   [L4 코드]
     │             │              │            │
     └─────────────┴──── IR ──────┴────────────┘
                       │
                  Git 저장 (시간여행)
```

- **IR이 Source of Truth.** 4 레이어는 모두 IR을 자기 식으로 렌더하는 뷰.
- 어느 레이어 편집 → IR 패치(JSON Patch RFC6902) → 나머지 레이어 자동 재렌더.
- 모든 IR 변경은 Git 커밋 → 모든 변경 시간여행 가능.
- 4 레이어 동시 표시(탭). 사용자가 편한 레이어에서 편집.

### 1.1 변환 비용 정책
| 변환 | 처리 방식 |
|---|---|
| L4 코드 ↔ IR | **결정적** (AST 파서 — TypeScript Compiler API, Roslyn 등) |
| L3 캔버스 ↔ IR | **결정적** (캔버스 모델 = IR 직접 매핑) |
| L2 다이어그램 ↔ IR | **결정적** (Mermaid/BPMN 생성기) |
| L1 자연어 ↔ IR | **AI 필수** (모호성 영역, Foundry LLM) |

→ AI 호출은 L1 변환에 집중. 부분 변환·diff 캐시.

### 1.2 모호성·충돌 처리
- L1 → IR 변환 시 AI가 한 가정을 **"AI 가정 카드"** 로 항상 노출. 사용자 한 줄짜리 카드를 보고 수정.
- 사용자 수정은 학습 신호로 텔레메트리 누적 → 같은 사용자/팀에 점진적 맞춤.
- **Escape Hatch**: IR로 못 담는 복잡 로직은 `escape/*.{ts,py,sql}` 에 opaque 블록으로 보존. 다른 레이어에선 회색 박스 *"여기는 코드만"* 표시.

---

## 2. IR 포맷 — 기존 표준 조합

| IR 섹션 | 표준 |
|---|---|
| 메타·인덱스 | `artifact.yaml` (자체 thin 헤더) |
| 의도/의사결정 | Markdown + ADR (frontmatter) |
| 데이터 | **JSON Schema 2020-12** |
| 동기 API | **OpenAPI 3.1** |
| 비동기/이벤트 | **AsyncAPI 2.6** |
| 워크플로우 | **BPMN 2.0** (XML, 시각화 표준) |
| 화면 | **JSON Schema + UI Schema** (RJSF 호환) |
| 배포 | Bicep/Helm-호환 매니페스트 + Connection/Variable 추상 레이어 |

### 2.1 IR 폴더 레이아웃
```
ir/
├── artifact.yaml             # id, version, owners, deps
├── spec.md                   # 의도, 액터, ADR
├── roles.yaml                # 역할/권한 정의 (admin/user 분리 1급 시민)
├── data/
│   └── schema.json           # JSON Schema 2020-12 (필드별 RBAC 메타 포함)
├── api/
│   └── openapi.yaml          # OpenAPI 3.1 (operationId별 role 게이트)
├── async/
│   └── asyncapi.yaml         # AsyncAPI 2.6
├── workflows/
│   └── *.bpmn                # BPMN 2.0
├── screens/
│   ├── admin/                # 관리 화면 — admin role 전용
│   │   └── *.uischema.json
│   └── user/                 # 사용자 화면 — user role
│       └── *.uischema.json
├── components/               # PCF 호환 컴포넌트 (커스텀 UI)
│   └── <component-id>/
│       ├── manifest.xml      # PCF Control Manifest (속성/이벤트 메타)
│       ├── index.ts          # 구현 (TS/React)
│       ├── style.css
│       ├── strings/          # 다국어
│       └── ControlManifest.Input.xml  # 빌드 입력
├── deployment/
│   ├── env/{sandbox,team,prod}.yaml
│   ├── connections.yaml      # Connection References
│   └── variables.yaml        # Environment Variables
└── escape/                   # opaque code blocks
    └── *.{ts,py,sql}
```

### 2.2 Connection References + Environment Variables (IR 내)

`deployment/connections.yaml`:
```yaml
connections:
  - name: db.primary           # 논리명(코드/IR이 보는 유일한 이름)
    kind: sql.azure
    bindings:                  # 환경별 실 바인딩 (시크릿은 Key Vault ref)
      sandbox: { keyvault: "kv-dev/db-conn-string" }
      team:    { keyvault: "kv-stg/db-conn-string" }
      prod:    { keyvault: "kv-prd/db-conn-string" }
  - name: notify.sms
    kind: connector.twilio     # 사전 화이트리스트만 선택 가능
    bindings: { ... }
```

`deployment/variables.yaml`:
```yaml
variables:
  - name: 매장명
    type: string
    required: true
    default: "본점"
    secret: false
    overrides: { sandbox: "테스트매장", prod: "본점" }
  - name: 알림_템플릿
    type: text
    secret: false
```

규칙:
- **시크릿 평문 저장 도구 차원에서 불가.** 시크릿 표시되면 자동 Key Vault ref만.
- **드리프트 감지**: 코드/IR이 참조하는 변수·연결과 카탈로그 정합성 검사 → 불일치 시 빌드 실패.
- **사용처 가시화**: 한 연결/변수 변경 시 영향받는 화면·워크플로우 목록 미리보기.

---

### 2.3 Role / 권한 — Admin/User 분리 1급 시민

`roles.yaml`:
```yaml
roles:
  - id: user
    label: "일반 사용자"
    description: "주문/조회 등 일상 업무"
  - id: admin
    label: "관리자"
    description: "마스터 데이터·정책·감사"
  - id: auditor
    label: "감사자"
    description: "읽기 전용, 감사 로그 접근"

permissions:
  data:
    고객:
      read:   [user, admin, auditor]
      create: [user, admin]
      update: [admin]                 # 사용자는 자기 레코드만 (rule 참조)
      delete: [admin]
      fields:
        주민번호: { read: [admin], write: [admin] }   # 필드 단위 RBAC
  api:
    "POST /orders":  [user, admin]
    "DELETE /orders/{id}": [admin]
  screens:
    "admin/*": [admin]                # 화면 prefix로 묶음
    "user/*":  [user, admin]          # admin은 user 화면도 접근
  workflows:
    "audit.export": [auditor, admin]

rules:
  - "user는 자기 user_id 매칭되는 고객 레코드만 update 가능"   # ABAC 룰 (자연어→자동 정책)
```

규칙:
- **데이터·API·화면·워크플로우 모든 IR 노드에 role 메타가 붙는다.**
- 화면은 `screens/admin/` vs `screens/user/` 폴더로 물리적 분리 → L3 캔버스에서 두 별도 워크스페이스로 표시.
- 코드 생성 시 모든 핸들러에 자동 role 가드(미들웨어) 삽입.
- L4 코드 편집 시 role 가드 누락이면 게이트2(구조검증) 실패.
- 자연어 *"이 화면은 관리자만"* → IR에 role 매핑 자동 패치.

---

## 3. 시스템 구성 (HLD)

DevKit은 두 콘솔로 진입한다 — **Builder Console** (모든 사용자, 산출물 제작) / **Admin Console** (관리자, 거버넌스/정책).

```
[Builder Console]                       [Admin Console]
 (VSCode 확장 / 웹 IDE)                  (웹 전용)
 ── 4 레이어 동시 편집                    ── 거버넌스/정책/감사
        │                                       │
        └───────────────┬───────────────────────┘
                        ▼
                     [APIM] ── Entra ID 토큰 검증
                        │
                        ▼
[Backend: Azure Container Apps]
   ├─ IR Service        : IR CRUD + 패치 + 검증 + role 가드 자동 삽입
   ├─ Sync Engine       : 레이어↔IR 결정적 변환 + 충돌 해결(CRDT)
   ├─ AI Gateway        ─► [Azure AI Foundry: Prompt Flow + Models]
   ├─ Template Catalog  ─► [Azure AI Search] (벡터+키워드 인덱스)
   │                          ▲
   │                          └── [Templates Repo (Git)]
   ├─ Component Builder : PCF 빌드/패키지/배포 파이프라인
   ├─ Eval Runner       ─► [Foundry Evaluation SDK]
   ├─ Policy Service    : DLP, 화이트리스트, Trust Gate 룰 (Admin 관리)
   └─ Telemetry         ─► [Application Insights → Log Analytics → Power BI]

저장:
  - IR 저장: Git 모노레포 (artifact당 한 폴더)
  - 컴포넌트 빌드 산출물: ACR (이미지) + Blob (.zip 솔루션 패키지)
  - 시크릿: Key Vault (Private Endpoint)
  - 설정: App Configuration (정책 포함)

거버넌스 (Admin Console에서만 편집):
  - Entra ID: SSO + 그룹 RBAC (DevKit 자체 admin 권한)
  - DLP: AI Gateway에서 PII redaction + 화이트리스트 커넥터만 허용
  - 화이트리스트: 사용 가능 템플릿/커넥터/컴포넌트 목록 관리
  - Trust Gate 룰: §6 단계별 게이트 정책 편집
  - 감사 로그: 누가 언제 무엇을 빌드/배포했는지 (CoE audit log 패턴)
```

### 3.1 Builder Console vs Admin Console 분리

| 영역 | Builder | Admin |
|---|---|---|
| 산출물 만들기(IR 편집) | ✅ | ✅(읽기) |
| 4 레이어 편집 | ✅ | — |
| 템플릿 사용 | ✅ | ✅ |
| 템플릿 큐레이션/승인 | — | ✅ |
| 컴포넌트 사용 | ✅ | ✅ |
| 컴포넌트 화이트리스트 관리 | — | ✅ |
| 커넥터 사용 | ✅ | ✅ |
| 커넥터 화이트리스트 + DLP 정책 | — | ✅ |
| Trust Gate 통과 (게이트 작성자) | ✅ | ✅ |
| Trust Gate 룰 편집 | — | ✅ |
| 거버넌스 대시보드(§7) | 자기 산출물만 | 전체 |
| 감사 로그 | — | ✅ |
| 비용/쿼터 | 자기 사용량 | 전체 + 한도 설정 |

→ DevKit 자체의 admin/user 분리는 **Entra 그룹 + Policy Service**로 강제. Admin Console은 별도 URL + 추가 MFA.

---

## 4. 핵심 흐름 (Preview-First, IR 중심)

```
[1] Plan        의도 입력 + 컨텍스트/모델/비용 미리보기
[2] Generate    IR 패치 후보 생성 (스트리밍 + 취소)
[3] Evaluate    3단 게이트
[4] Preview     4-Layer 동시 미리보기 + 자연어 변경요약 + AI 가정 카드
[5] Apply       헝크 단위 부분 적용, 자동 스냅샷, 5초 Undo
[6] Verify      lint/type/test 후속 검사
[7] Feedback    outcome → 텔레메트리/학습
```

### 4.1 Preview 화면 — 시민/프로 모두 같은 화면

- 상단 탭: `자연어 / 다이어그램 / 캔버스 / 코드` (4 레이어 동시 표시)
- 좌: 변경 요약(자연어 *"바뀐 점 3가지"*) + AI 가정 카드 + 출처 카드(어떤 spec/템플릿 참조)
- 우: 선택한 레이어의 before/after
  - 캔버스 탭: 화면 스크린샷 슬라이더
  - 코드 탭: diff 뷰
  - 다이어그램 탭: ERD/BPMN 비교
  - 자연어 탭: spec.md diff
- 헝크/노드 단위 `Accept / Skip / Edit` + 자유서술 부분 재생성
- Apply 직전 자동 `git stash` 스냅샷 → 5초 Undo 토스트

### 4.2 신뢰성 코어 (실개발 복잡성)
- **재시도**: `request_id` 멱등 키, 모델 5xx/timeout 시 백오프 + fallback 모델
- **Circuit breaker**: Foundry 장애 시 캐시된 마지막 성공 결과만
- **취소 안전**: 취소 시 모델 abort, 토큰 비용 발생분만 기록
- **다중 파일 부분 실패**: 게이트 통과한 파일만 적용 가능, 미통과는 review_needed

---

## 5. SDLC 단계별 — 무엇이 IR 어디로 들어가나

| 단계 | IR 섹션 | 도구가 하는 일 | 미리보기 |
|---|---|---|---|
| **기획** | `spec.md`, `roles.yaml`, `artifact.yaml` | 의도→spec 초안, 액터→role 매핑, 모호점 인터뷰, ADR 자동 기록 | Mermaid ERD/BPMN/와이어 + role 매트릭스 |
| **데이터** | `data/schema.json` | 자연어→JSON Schema, 관계 자동 추론, PII 자동 분류, 필드 단위 RBAC | ER 다이어그램 + 마이그레이션 SQL diff + 필드별 권한 칩 |
| **API** | `api/openapi.yaml` | 스키마→CRUD OpenAPI 자동 + role 가드 미들웨어 자동 삽입 | OpenAPI Swagger UI + operation별 role 표시 |
| **화면** | `screens/admin/*`, `screens/user/*` | 데이터→자동 List/Detail/Form, **admin/user 별도 워크스페이스 자동 생성**, 디자인토큰 강제 | Storybook 라이브 + 반응형 + role별 탭 전환 |
| **컴포넌트(PCF)** | `components/<id>/manifest.xml + index.ts` | 커스텀 UI 컴포넌트 스캐폴드, manifest↔코드↔IR 양방향, 빌드/패키지(.zip), 카탈로그 등록 | 컴포넌트 라이브 미리보기 + manifest 속성 폼 + 사용처 목록 |
| **워크플로우** | `workflows/*.bpmn`, `async/asyncapi.yaml` | IFTTT 카드↔BPMN 변환, role 게이트 자동, 시뮬레이션 트레이스 | BPMN 다이어그램 + 시뮬레이션 그림 |
| **테스트** | (생성 코드) | spec→테스트 매트릭스, role별 접근 제어 테스트 자동, 골든셋 갱신 | 케이스별 pass/fail + RBAC 매트릭스 충족 표시 |
| **배포** | `deployment/` | env 매니페스트 + Bicep/Terraform 산출, what-if 드라이런 | Bicep what-if + 영향 리소스 트리 |

### 5.1 PCF 컴포넌트 개발 라인 (상세)

PCF(PowerApps Component Framework) 패턴을 차용해 **재사용 가능한 커스텀 UI 컴포넌트**를 도구 안에서 만들고 카탈로그에 공유한다.

**컴포넌트 IR 구조** (`components/<id>/`):
```
manifest.xml          ← PCF Control Manifest (속성·이벤트·리소스 메타)
index.ts              ← 구현 (init/updateView/getOutputs/destroy 라이프사이클)
ControlManifest.Input.xml
strings/<locale>.resx ← 다국어
style.css
preview.png           ← 카탈로그 썸네일
```

**4 레이어 적용**:
- **L1 자연어**: *"별점 1~5 컴포넌트 만들어줘, 호버 효과 포함"* → manifest + index.ts 스켈레톤 자동.
- **L2 다이어그램**: 입력/출력 속성을 카드 그래프로 시각화.
- **L3 캔버스**: 컴포넌트 카탈로그에서 끌어 화면에 배치, 우측 패널에 manifest 속성 폼 자동 생성.
- **L4 코드**: index.ts 직접 편집 → manifest 메타 자동 sync(타입 추론).

**빌드/배포**:
- Component Builder가 `pac pcf push` 또는 자체 빌드(esbuild + manifest 검증)로 .zip 솔루션 패키지 산출.
- ACR/Blob에 산출물 저장, AI Search에 manifest 메타 인덱싱.
- 화이트리스트 등록은 Admin Console에서 승인.

**사용처 가시화**:
- 한 컴포넌트 변경 시 *"이 컴포넌트를 쓰는 화면 N개 / 프로젝트 M개"* 미리 표시.
- breaking change(manifest 시그니처 변경)는 게이트2에서 자동 차단, semver 강제.

**파워플랫폼 차용**: PCF manifest 표준(input/output 속성, dataset, 이벤트 핸들러 규약)을 그대로 사용 → 사내 컴포넌트가 향후 Power Apps에서도 재사용 가능.

각 단계 산출물은 다음 단계의 입력 컨텍스트로 자동 사용.

---

## 6. Trust Gate — 사람 등급 X, 변경 영향 범위 O

| 단계 | IR 변경 영향 | 게이트 |
|---|---|---|
| sandbox | 본인 환경만 | 없음 |
| 팀 공유 | 팀 IR 저장소 머지 | 자동 lint + AI 셀프리뷰 |
| 전사 출시 | prod 환경 배포 | 보안 스캔 + 사람 리뷰 1명(누구든) |
| 외부 노출 | 외부 트래픽 | 보안팀 자동 호출 + 컴플라이언스 체크 |

→ 시민/프로 분류 없이도 안전 보장. 도구가 자동 게이트 적용.

---

## 7. 텔레메트리 + 대시보드 (CoE 인벤토리 패턴)

### 7.1 이벤트 (Application Insights `customEvents`)
```jsonc
// devkit.invocation.complete
{
  "user_id": "alice@corp", "team": "platform-fe",
  "feature": "generate_screen", "template_id": "list-detail-form",
  "model": "gpt-4o", "latency_ms": 4321,
  "result": "success|fail|partial",
  "error_class": "compile_error|schema_mismatch|null",
  "request_id": "req-..."
}

// devkit.evaluation
{
  "request_id": "req-...", "template_id": "...",
  "gate1_compile": "pass|fail",
  "gate2_schema":  "pass|fail",
  "gate3_golden":  "pass|fail|partial",
  "verdict": "accepted|rejected|review_needed"
}

// devkit.feedback
{
  "request_id": "req-...",
  "outcome": "accepted|rejected|edited",
  "edit_distance": 0.18
}
```

### 7.2 Power BI 대시보드 3장
- **Top 사용**: 기능/템플릿/팀별 호출 수, 7일 trend, 챔피언 식별 (CoE `power-bi-monitor.md`)
- **품질**: 게이트별 pass율, 사용자 수락율, 에러 분포, 30일 미사용 템플릿 = 고아 (CoE `setup-orphan-components.md`)
- **비용**: 모델별 토큰·비용, 팀별 chargeback

---

## 8. 차용 패턴 — Power Platform → DevKit 매핑

| Power Platform 패턴 | 출처 파일 | DevKit 적용 |
|---|---|---|
| **Solution Format (zip = IR)** | `power-platform/alm/solution-concepts-alm.md`, `solution-layers-alm.md` | IR 폴더 구조 설계 참고 |
| **CoE 인벤토리 + 대시보드** | `guidance/coe/core-components.md`, `power-bi-monitor.md` | §7 텔레메트리·대시보드 |
| **고아/미사용 자동 표시** | `guidance/coe/setup-orphan-components.md` | §7 30일 미사용 템플릿 플래그 |
| **Test Engine 샘플 카탈로그** | `test-engine/samples.md`, `ai-authoring.md` | Template Catalog (AI Search 인덱스) |
| **AI Evaluation 3전략** | `test-engine/ai-evaluation.md` | §4 게이트 1/2/3 |
| **Connection References + Env Vars** | `power-platform/alm/environment-strategy-alm.md` | §2.2 deployment 섹션 |
| **Hook Extensions** | `guidance/alm-accelerator/setup-hook-extensions.md` | 템플릿 pre/post hook 슬롯 |
| **PCF Component Framework** | `power-platform/developer/component-framework/` (외부 표준) | §5.1 컴포넌트 IR + manifest 표준 그대로 차용 |
| **CoE Audit Log** | `guidance/coe/setup-auditlog.md` | Admin Console 감사 로그 패턴 |
| **Admin/Maker 분리** | `guidance/coe/admin-tasks-component.md` | Admin Console vs Builder Console 분리 |
| **운영 체크리스트** | `well-architected/operational-excellence/checklist.md` | 릴리즈 게이트 + SLI |
| **DLP/거버넌스** | `guidance/coe/`, `guidance/adoption/` | Trust Gate에 흡수 |
| ~~Fusion Development~~ | ~~`developer/fusion-development.md`~~ | **차용 폐기** (단일 모드) |
| ~~Citizen/Pro 분류~~ | — | **차용 폐기** |

---

## 9. PoC 단계 — LOB 앱(주문/재고/고객)으로 종횡 검증

### W1 — IR + L4↔IR 결정적 변환 (Walking Skeleton)
- 도메인: 주문/재고/고객 LOB
- IR 스키마 정의 (§2.1 폴더 구조)
- L4↔IR 결정적 변환만(TS AST 파서)
- 한 산출물 1개(주문 폼 화면) 종횡: spec→data→screen 1차 라인
- App Insights customEvent 1종(`invocation.complete`)
- DoD: 코드 편집 → IR 갱신 + 다른 레이어는 *"미구현"* 표시라도 페이지 동작

### W2 — L1↔IR(AI 변환) + AI 가정 카드 + 평가 게이트
- Foundry Prompt Flow로 L1→IR 변환
- AI 가정 카드 UI
- 게이트 1단(컴파일) + 게이트 2단(JSON Schema 검증)
- 모호성 케이스 10개로 평가 (golden set)
- DoD: 자연어 *"고객 추가에 전화번호 필수"* → IR 패치 + 가정 카드 노출

### W3 — L2 다이어그램 + L3 캔버스 + 4-Layer 동시 + Admin/User 화면 분리
- Mermaid ERD, BPMN 렌더러
- 캔버스(JSON Schema UI) 양방향
- 4 레이어 동시 표시 + 탭 전환
- `screens/admin/` vs `screens/user/` 별도 워크스페이스 동시 표시
- `roles.yaml` 기반 자동 role 가드 미들웨어 코드 생성
- 게이트 3단(golden-set 회귀)
- 템플릿 카탈로그 5개 (`templates/index.yaml`)
- Power BI 대시보드 1장(§7.2 Top 사용)
- DoD: *"이 화면은 관리자만"* 자연어 → admin 폴더로 이동 + 가드 자동 삽입

### W4 — PCF 컴포넌트 라인 + Admin Console + Trust Gate + Connection/Var
- **PCF 컴포넌트**: §5.1 manifest + index.ts 스캐폴드, 빌드 파이프라인, 카탈로그 등록
- **Admin Console**: 별도 웹 UI, 화이트리스트/DLP/Trust Gate 룰 편집, 감사 로그
- §6 Trust Gate 4단계 적용 (Policy Service)
- §2.2 connections.yaml/variables.yaml 환경 바인딩 동작
- Git 커밋 시간여행 + CRDT 동시편집(2인)
- 30일 미사용 템플릿/컴포넌트 자동 플래그
- DoD: Sandbox→팀→prod 한 경로 + admin이 PCF 컴포넌트 승인하면 builder가 즉시 사용 가능

---

## 10. 위험·결정 사항

| 위험 | 완화 |
|---|---|
| IR 표현력 한계 (escape hatch 비중↑) | escape 비율 SLI로 측정, 30%↑ 알림 |
| 4 레이어 렌더 일관성 깨짐 | 결정적 변환 비중↑, golden set 회귀 |
| L1↔IR 모호성으로 잘못된 IR | AI 가정 카드 강제 노출, 사용자 수정 학습 |
| 성능 (매 편집 4 레이어 재렌더) | IR 패치 단위 부분 갱신, 캐시 |
| Foundry lock-in | 얇은 abstraction layer, 모델 교체 가능 |
| 시크릿 누출 | 도구 차원 평문 입력 칸 부재, Key Vault ref 강제 |
| 사용자 학습 곡선 | sensible default + 모르면 *"잘 모르겠어요"* 버튼 |

오픈 결정:
1. 모델: GPT-4o vs Claude on Foundry — A/B로 결정
2. 데이터 보존: App Insights 90일 → 장기는 ADX(필요 시)
3. CRDT 라이브러리: Yjs vs Automerge

---

## 11. 검증 (Verification)

- **W1**: VSCode 확장에서 코드 편집 → IR 변경이 Git에 커밋되고 다음 호출에서 같은 IR을 LLM 컨텍스트로 사용. Kusto에서 `customEvents | where customDimensions.request_id == "req-X"` 조회 가능.
- **W2**: 자연어 입력 1개 → IR 패치 1개 생성 + 가정 카드 노출. 골든셋 10개 중 8개 이상 사용자 *"의도 맞음"* 응답.
- **W3**: 같은 IR을 4 레이어 모두에서 일관되게 렌더. 한 레이어 편집 시 다른 3 레이어 동기화 시간 < 500ms.
- **W4**: Sandbox→팀→prod 경로에서 Trust Gate 자동 적용 확인. Connection/Variable 환경별 바인딩 자동 적용 확인. 30일 미사용 템플릿 알림 발송 확인.

---

## 12. Azure 리소스 목록

| 리소스 | 용도 | 비고 |
|---|---|---|
| Azure AI Foundry Hub + Project | LLM + Prompt Flow + Evaluation | Private Endpoint, Content Filter |
| Azure Container Apps | 백엔드 (IR/Sync/AI Gateway/Eval/Telemetry) | min replicas=1 |
| Azure API Management | 게이트웨이/Auth | Entra 검증 정책 |
| Azure AI Search | 템플릿 인덱스 | 벡터 + BM25 하이브리드 |
| Azure Storage (Blob) | 빌드 산출물, golden set | |
| Application Insights | 텔레메트리 | sampling 100% (초기) |
| Log Analytics Workspace | 로그 보관 | 90일 → Archive |
| Power BI Workspace | 대시보드 3장 | Direct Query |
| Key Vault | 시크릿, Connection refs | Private Endpoint |
| App Configuration | 런타임 설정 + feature flags | |
| Container Registry (ACR) | 이미지 | |
| GitHub | 모노레포(IR 저장) + Actions(CI/CD + 인덱싱 잡) | |
| Entra ID | SSO + 그룹 RBAC | |

---

## 13. 참고 파일 (Power Platform 레포)

- `power-platform/alm/solution-concepts-alm.md`, `solution-layers-alm.md` — IR 폴더 설계 참고
- `power-platform/alm/environment-strategy-alm.md` — 환경/Connection 설계
- `power-platform/guidance/coe/core-components.md`, `power-bi-monitor.md`, `setup-orphan-components.md` — 인벤토리/대시보드/고아 처리
- `power-platform/test-engine/samples.md`, `ai-authoring.md`, `ai-evaluation.md` — 카탈로그/AI 워크플로/3전략 평가
- `power-platform/well-architected/operational-excellence/checklist.md` — 운영 체크리스트
- `power-platform/guidance/alm-accelerator/setup-hook-extensions.md` — hook 패턴
