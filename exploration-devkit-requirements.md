# DevKit 요구사항 정의서

문서 버전: 0.1
작성일: 2026-05-08
관련 문서:
- 설계서: `exploration-devkit-design.md`
- Plugin 구현: `devkit-plugin/`
- 도메인 사전(내부): `devkit-plugin/CONTEXT.md`
- 사용자 화면 용어 정책: `devkit-plugin/references/glossary.md`

---

## 1. 개요

### 1.1 문서 목적
사내 개발 생산성 개선용 AI 기반 SDLC 도구 **DevKit**의 기능 / 비기능 요구사항을 정의한다. 설계서가 *"어떻게 만들지"* 라면, 이 문서는 *"무엇이 충족되어야 하는지"* 를 다룬다.

### 1.2 범위
- 포함: DevKit Builder Console(코드 IDE), Admin Console(웹), AI 식자재(스킬·MCP·Hook), 4 레이어 산출물, 퀄리티 루프, 다관점 리뷰, 거버넌스, 텔레메트리.
- 제외: 사용자가 DevKit으로 만들어내는 *최종 앱*의 도메인 요구사항(=각 LOB 앱의 별도 SRS).

### 1.3 용어
- **artifact**: 사용자가 만드는 한 단위 산출물(앱·기능·자동화).
- **IR**: 4 레이어 동시 표현을 위한 단일 진실(Intermediate Representation).
- **식자재**: AI가 사용자 의도 보고 자동 발동하는 스킬/MCP/Hook. 사용자에게 슬래시 노출 X.
- **Trust Gate**: 변경 영향 범위(sandbox/team/prod/external)별 안전 게이트.
- 사용자 노출 시 일반인 한국어 매핑은 `devkit-plugin/references/glossary.md` 참조.

---

## 2. 배경 및 목적

### 2.1 풀어야 할 문제
- 사내 개발자가 흔한 패턴(LOB CRUD, 알림, 승인 흐름, 컴포넌트)을 매번 처음부터 만든다.
- AI 바이브 코딩 도구가 *"vibe coding"* 의 단점(스코프 폭주, 모호 요구, 회귀)을 그대로 안고 있다.
- 시민 개발자/프로 개발자 분리 도구는 학습 곡선이 두 배. AI가 격차를 메울 수 있는데도 분리를 강제.

### 2.2 비즈니스 목적
- 동일 패턴 산출물의 평균 제작 시간 단축.
- 사내 라이브러리·템플릿·컴포넌트 재사용율 증가.
- 산출물 퀄리티 회귀 자동 감지로 사고 사전 차단.
- 사내 표준(보안/디자인/거버넌스)을 도구가 자동 강제 → 거버넌스 비용 감소.

### 2.3 측정 지표 (KPI)
- 신규 LOB 앱 1개 *기획→출시* 평균 소요 시간(목표: 1일 내).
- 사용자가 만든 산출물의 평가 게이트 1차 통과율(목표: 80%+).
- 템플릿/컴포넌트 재사용 호출 수(주간 trend 상승).
- 사용자당 AI 호출 토큰 비용(예산 내 유지).
- 사내 사고/회귀 건수(분기별 감소).

---

## 3. 이해관계자

### 3.1 사용자 그룹 (단일 모드 — 시민/프로 분리 X)
- **개인 작성자**: 자기 sandbox에서 산출물을 처음 만든다.
- **팀 협업자**: 팀 IR 저장소에 머지하며 함께 작업한다.
- **출시 책임자**: 실서비스/외부 노출 단계 통과를 결정한다.
- **감사자(auditor)**: 산출물 변경 이력과 게이트 결과를 읽는다.

### 3.2 운영자(Admin)
- DevKit 자체의 **화이트리스트**(템플릿/커넥터/컴포넌트), **DLP 정책**, **Trust Gate 룰**, **감사 로그**, **비용/쿼터**를 관리.
- 별도 Admin Console(별도 URL + 추가 MFA) 사용.

### 3.3 협력 시스템
- Microsoft Entra ID(SSO).
- Azure AI Foundry(LLM, Prompt Flow, Evaluation).
- Application Insights / Log Analytics / Power BI.
- Azure Container Apps / API Management / AI Search / Storage / Key Vault / App Configuration / ACR.
- GitHub(IR 저장 + Actions).
- 사외 커넥터(SMS/이메일/Teams 등) — 화이트리스트 통과 시.

---

## 4. 사용 시나리오

### 4.1 핵심 시나리오 — LOB 앱 만들기
1. 사용자: *"고객이 상품을 주문하면 SMS 보내는 앱 만들어줘"*.
2. AI(자동): plan 스킬 → spec 초안. 모호점 있으면 clarify가 1~3개 묻기.
3. AI(자동): catalog-hint → 비슷한 사례(인사팀 예전 앱) 추천. 사용자 선택.
4. AI(자동): data → 데이터 표 자동(고객/주문/재고/상품) + PII 분류 + 권한.
5. AI(자동): api → CRUD + role 가드 자동 삽입. screen → admin/user 화면 자동 분리.
6. AI(자동): workflow → SMS 발송 자동화 시뮬레이션 카드.
7. AI(자동): test → 자동 검증, 헬스 카드 🟢/🟡/🔴.
8. AI(자동): critic → 6 차원 자가 비평, 약점 1~3개 카드.
9. 사용자가 카드 일부 수락 → refine → 부분 변경.
10. 사용자: *"팀에 보여주기"* → deploy → Trust Gate 자동 + 시뮬레이션 → 동의 후 출시 + 5초 Undo.

### 4.2 보조 시나리오
- **템플릿 사용**: 사용자가 *"승인 흐름 만들고 싶어"* → catalog-hint가 approval-flow 추천 → 그 자리에서 시작.
- **다관점 리뷰**: 큰 변경(IR diff 30%+)에서 multi-review가 자동 호출 → 기획자/디자이너/UX 의견 종합 카드 → 사용자가 반영할 의견 선택.
- **PCF 부품 추가**: *"별점 부품 만들어줘"* → component → manifest+index.ts 스캐폴드 → (옵션) `pac pcf push` 빌드·배포.
- **부분 피드백 반복**: 사용자가 *"이 화면 모바일에서 답답해"* → refine으로 해당 화면만 부분 수정. 사용자 이전 수정 보존.

---

## 5. 기능 요구사항 (FR)

각 항목: ID / 제목 / 설명 / 우선순위(M=Must, S=Should, C=Could, W=Won't 1차).

### 5.1 사용자 인터페이스
- **FR-1.1 단일 자연어 대화창** [M] — 사용자에게 노출되는 인터페이스는 자연어 한 줄. 슬래시 명령 X.
- **FR-1.2 4 레이어 동시 표시** [S] — 자연어/다이어그램/캔버스/코드 4 레이어를 탭으로 전환·동시 표시. *L1 자연어 + L2 다이어그램 + L4 코드*는 W3 1차, L3 캔버스는 W4+.
- **FR-1.3 Before/After 미리보기** [M] — 모든 변경은 적용 전 미리보기 카드 표시(자연어 변경 요약 + 영향 항목 N개).
- **FR-1.4 5초 Undo** [M] — Apply 직후 5초간 *되돌리기* 토스트, 그 후엔 메뉴.
- **FR-1.5 Cost/토큰 사전 표시** [S] — 호출 전 예상 비용 안내.

### 5.2 4-Layer 양방향 편집 + IR
- **FR-2.1 IR 단일 진실** [M] — 모든 산출물은 `<id>.ir.json` 한 파일로 저장.
- **FR-2.2 결정적 변환** [M] — L4↔IR, L3↔IR, L2↔IR은 결정적(AST/렌더러). 실패 0%.
- **FR-2.3 AI 변환** [M] — L1↔IR만 AI. 변환 시 AI 가정 카드 강제 노출.
- **FR-2.4 부분 패치** [M] — 변경은 JSON Patch(RFC6902)로 부분 적용. 전체 재생성 금지.
- **FR-2.5 IR Git 커밋 + 시간여행** [S] — 모든 IR 변경은 Git 커밋으로 영속화.
- **FR-2.6 동시 편집(CRDT)** [C] — 2명 이상 동시 편집(W4+).
- **FR-2.7 Escape Hatch** [M] — IR로 못 담는 복잡 로직은 `escape/*.{ts,py,sql}` 보존.

### 5.3 SDLC 전 단계 지원
- **FR-3.1 기획**[M], **FR-3.2 데이터**[M], **FR-3.3 API**[M], **FR-3.4 화면**[M], **FR-3.5 컴포넌트(PCF)**[S], **FR-3.6 워크플로우**[M], **FR-3.7 테스트**[M], **FR-3.8 배포**[M] — 각 단계 스킬 1개 이상 자동 발동, 산출물은 IR의 해당 섹션에 저장.
- **FR-3.9 단계 간 자동 컨텍스트 전달** [M] — 다음 단계 호출 시 이전 산출물을 자동 컨텍스트로 주입.

### 5.4 대화 기반 퀄리티 개선
- **FR-4.1 자가 비평 자동** [M] — IR 변경 직후 critic 6 차원 점수 + 약점 카드(1~3개).
- **FR-4.2 자연어 피드백 → 부분 패치** [M] — refine 스킬, 전체 재생성 금지.
- **FR-4.3 Quality Scorecard 누적** [S] — 산출물별 점수 시계열 누적, 회귀 알림.
- **FR-4.4 안티패턴 사전 경고** [S] — 사내 안티패턴 카탈로그(yaml)에 매칭 시 생성 전 경고.
- **FR-4.5 비교 모드(A/B)** [C] — critic이 *"두 안 모두 합리적"* 판단 시 A/B 동시 생성 + 영역별 체리피킹.

### 5.5 다관점 리뷰 (페르소나 3종)
- **FR-5.1 review-pm** [M] — 기획자 페르소나(요구 정합성/스코프/가치/측정).
- **FR-5.2 review-designer** [M] — 디자이너 페르소나(시각 일관성/디자인시스템/시각 위계).
- **FR-5.3 review-ux** [M] — UX 디자이너 페르소나(사용자 흐름/빈 상태/에러 회복/접근성).
- **FR-5.4 multi-review 종합 카드** [M] — 3 페르소나 결과 종합, *공통 1 + 각자 1*.
- **FR-5.5 자동 발동 조건** [S] — critic overall < 0.7 / high finding 3+ / IR diff 30%+ / 사용자 의도에 *"리뷰/출시 전 점검"* 류 키워드.

### 5.6 거버넌스 / Trust Gate
- **FR-6.1 환경 단계 인지** [M] — sandbox/team/prod/external 단계 자동 추정 + clarify 확인.
- **FR-6.2 단계별 게이트 강도** [M] — sandbox(없음) / team(자동 점검) / prod(보안 스캔 + 사람 1명) / external(보안팀 자동 알림 + 컴플라이언스).
- **FR-6.3 화이트리스트 강제** [M] — 템플릿/커넥터/컴포넌트는 Admin이 승인한 것만 사용 가능.
- **FR-6.4 PreToolUse 로그** [M, W1~W4 한정] — 모든 도구 호출 직전 trust-gate.sh 실행, **차단 없이** 위험 라벨링 + 로그.
- **FR-6.5 위험 명령 차단(W5+)** [S] — destructive_filesystem / force_push / drop_table 등 자동 차단(설정 가능).
- **FR-6.6 시크릿 평문 금지** [M] — 도구 차원 평문 입력 칸 부재, Key Vault ref만 허용.

### 5.7 텔레메트리 / 분석
- **FR-7.1 호출 이벤트 기록** [M] — `devkit.invocation.complete` (user/team/feature/template/model/latency/result/error_class/request_id).
- **FR-7.2 평가 결과 기록** [M] — `devkit.evaluation` (gate1/2/3 + verdict).
- **FR-7.3 피드백 기록** [M] — `devkit.feedback` (outcome / edit_distance, 원문 hash).
- **FR-7.4 비평 결과 기록** [S] — `devkit.critique` (6 차원 점수 + suggestions count/accepted).
- **FR-7.5 Refine 기록** [S] — `devkit.refine` (affected nodes, patch size).
- **FR-7.6 Power BI 대시보드 3장** [M] — Top 사용 / 품질 / 비용.
- **FR-7.7 30일 미사용 자동 플래그** [S] — 템플릿/컴포넌트 orphan 자동 알림.
- **FR-7.8 옵션 외부 forward** [S] — `DEVKIT_TELEMETRY_ENDPOINT` 환경변수로 ndjson POST.

### 5.8 템플릿 카탈로그
- **FR-8.1 카탈로그 인덱스** [M] — `references/templates/index.yaml` 형식.
- **FR-8.2 자동 추천(catalog-hint)** [M] — 사용자 의도 키워드 매칭 후 1~3개 카드 추천.
- **FR-8.3 시드 5종** [M] — lob-crud / auth-login / notify-flow / pcf-rating / approval-flow.
- **FR-8.4 LLM 컨텍스트 자동 주입** [M] — 추천된 템플릿의 starter_ir/starter_dir을 호출 컨텍스트에 포함.
- **FR-8.5 사용자 선택 학습** [S] — 추천 수락/거절을 텔레메트리에 누적, 다음 추천 가중치.

### 5.9 Connection Reference + 환경변수
- **FR-9.1 논리명 추상화** [M] — 코드/IR은 `db.primary` 같은 논리명만 참조.
- **FR-9.2 환경별 바인딩** [M] — sandbox/team/prod 매니페스트로 환경별 실 바인딩 분리.
- **FR-9.3 Key Vault ref 강제** [M] — 시크릿 영역은 평문 X, KeyVault ref만.
- **FR-9.4 드리프트 감지** [S] — 코드 참조와 카탈로그 등록 정합성 검사 → 불일치 빌드 실패.
- **FR-9.5 사용처 미리보기** [S] — 한 연결/변수 변경 시 영향 화면·워크플로우 N개 미리 표시.

### 5.10 Admin Console
- **FR-10.1 별도 콘솔(웹)** [S] — Builder와 다른 URL + 추가 MFA.
- **FR-10.2 화이트리스트 관리** [M] — 템플릿/커넥터/컴포넌트 승인·반려.
- **FR-10.3 Trust Gate 룰 편집** [S] — 단계별 게이트 정책 GUI 편집.
- **FR-10.4 감사 로그** [M] — 누가/언제/무엇을 빌드·배포했는지(불변).
- **FR-10.5 비용/쿼터 한도** [S] — 팀별 토큰 한도 + 알림.

### 5.11 PCF 컴포넌트
- **FR-11.1 manifest + index.ts 스캐폴드** [M] — 표준 PCF 라이프사이클(init/updateView/getOutputs/destroy).
- **FR-11.2 다국어(strings/) + style.css** [M] — 한국어 1042 기본 포함.
- **FR-11.3 빌드/배포 (`pac pcf push`)** [S] — Power Platform CLI 설치 시 도구가 자동 실행. 미설치 시 명확한 안내.
- **FR-11.4 카탈로그 등록 + 승인** [S] — manifest 메타 AI Search 인덱싱, Admin 승인 후 화이트리스트 등록.
- **FR-11.5 Breaking change 차단** [M] — manifest 시그니처 변경은 게이트2 자동 fail, semver 강제.
- **FR-11.6 사용처 가시화** [S] — 한 컴포넌트 변경 시 영향 화면/프로젝트 N개 표시.

### 5.12 안전망 / 메타 스킬
- **FR-12.1 zoom-out 자동 발동** [M] — IR diff 30%+ / 새 외부 연결 / 비가역 작업 / prod·external 격상 / 의도 단편적인 경우.
- **FR-12.2 clarify 깊이 모드** [S] — multi-review/zoom-out이 *"한 번 더 정리"* 결과로 진입 요청 시 3라운드 cap 해제(grill 패턴).
- **FR-12.3 ADR 자동 누적** [M] — 사용자-AI 결정은 IR `spec.adr` 배열에 한 줄씩 자동 추가 → 다음 호출 컨텍스트에 자동 주입.

---

## 6. 비기능 요구사항 (NFR)

### 6.1 사용성
- **NFR-1.1** 사용자 화면에 IR/RBAC/PII/JSON Patch 같은 전문 약어 노출 금지(`glossary.md` 강제).
- **NFR-1.2** 모르는 답엔 *"잘 모르겠어요"* 옵션을 항상 제공(escape hatch).
- **NFR-1.3** 한 라운드 1~3 질문 상한(피로 방지). 깊이 모드만 예외.
- **NFR-1.4** 사용자 첫 호출에서 결과(미리보기)까지 30초 이내(평균).

### 6.2 안전성 / 보안
- **NFR-2.1** 시크릿 평문 입력 칸 도구 차원 부재.
- **NFR-2.2** Foundry/Container Apps Private Endpoint 의무.
- **NFR-2.3** AI Gateway에서 PII redaction 후에만 모델에 전송.
- **NFR-2.4** Admin Console 별도 URL + MFA.
- **NFR-2.5** Trust Gate 로그는 불변(append-only) + 90일 보관.

### 6.3 성능
- **NFR-3.1** 결정적 변환(L4↔IR, L3↔IR, L2↔IR) 500ms 이내.
- **NFR-3.2** AI 변환(L1↔IR) 평균 5초 이내, p95 15초 이내.
- **NFR-3.3** IR validate 200ms 이내(LOB 샘플 규모).
- **NFR-3.4** Power BI 대시보드 7일 trend 쿼리 5초 이내.

### 6.4 신뢰성
- **NFR-4.1** 모델 5xx/timeout 시 지수 백오프 3회 + fallback 모델.
- **NFR-4.2** Foundry 장애 시 circuit breaker → 캐시된 마지막 성공 결과만.
- **NFR-4.3** 부분 패치 실패 시 IR 무변경(트랜잭션).
- **NFR-4.4** 평가 게이트 자동 실패 시 IR 적용 차단.
- **NFR-4.5** 사용자 취소 시 모델 abort, 발생 토큰만 기록.

### 6.5 확장성
- **NFR-5.1** 스킬 추가는 plugin 디렉토리 한 폴더 추가로 끝(코드 변경 X).
- **NFR-5.2** 템플릿 추가는 `references/templates/index.yaml` + 폴더 추가로 끝.
- **NFR-5.3** 새 LLM 모델 교체는 abstraction layer 한 군데 변경.

### 6.6 유지보수성
- **NFR-6.1** SKILL.md 한 파일은 200 라인 이내(가독성).
- **NFR-6.2** 결정적 부분(critic/eval/render)은 LLM 호출 없이 단독 실행 가능 + 단위 점검.
- **NFR-6.3** IR 스키마 변경은 Major 버전 bump.

### 6.7 운영성
- **NFR-7.1** `npm run smoke` 한 번에 전체 자체 점검.
- **NFR-7.2** 텔레메트리 외부 forward 옵션(`DEVKIT_TELEMETRY_ENDPOINT`).
- **NFR-7.3** Admin Console에서 화이트리스트/정책/감사 한 화면.

### 6.8 접근성
- **NFR-8.1** 모든 사용자 화면 메시지는 키보드만으로 조작 가능.
- **NFR-8.2** 색만으로 의미 구분 금지(아이콘/텍스트 동반).
- **NFR-8.3** 한국어 1차, 다국어는 추후.

### 6.9 호환성
- **NFR-9.1** PCF manifest 표준 그대로 사용 → Power Apps 호환.
- **NFR-9.2** OpenAPI 3.1 / AsyncAPI 2.6 / BPMN 2.0 / JSON Schema 2020-12 표준 준수.
- **NFR-9.3** Claude Code Plugin 표준(`.claude-plugin/plugin.json`).

---

## 7. 제약사항 및 가정
- **C-1** 1차 LLM은 Azure AI Foundry(GPT-4o 또는 Claude on Foundry). 자체 호스팅 X.
- **C-2** 사용자 인증은 Microsoft Entra ID로 통일.
- **C-3** Trust Gate W1~W4는 *로그 only*(차단 X). W5+에서 차단 강도 단계적 격상.
- **C-4** 4 레이어 중 L3 캔버스(드래그 편집)는 풀 IDE 별도 영역 — Skills+Plugin만으로 시각 편집 불가.
- **C-5** CRDT 동시편집은 W4+. 그 전엔 단일 사용자 가정.
- **C-6** PCF 빌드는 사용자 머신에 `pac` CLI 설치 시에만 자동 실행.

---

## 8. 인수 기준 (Acceptance Criteria)

W1~W4 단계별:

### W1 — Walking Skeleton
- [x] LOB 샘플 IR이 `npm run smoke` 전부 통과.
- [x] MCP 서버가 read/patch/validate/list/diff 5종 도구 노출.
- [x] 패치 후 검증 자동, 실패 시 변경 무효.
- [x] 텔레메트리 hook이 ndjson 1줄 기록.

### W2 — Quality Loop
- [x] critic 결정적 점수 6 차원 출력.
- [x] eval 3단 게이트 verdict 출력.
- [x] refine 자연어 피드백 부분 patch 시나리오 작동.
- [x] clarify 깊이 모드 진입 가능.

### W3 — 4-Layer 동시 + admin/user 분리
- [x] L2 ERD/BPMN Mermaid 렌더 작동.
- [x] screens/admin/ vs screens/user/ 자동 분리.
- [x] 카탈로그 5종 + catalog-hint 추천 카드 작동.
- [x] L3 캔버스 1차 (읽기 전용 뷰어).
- [x] L3 캔버스 양방향 편집 1차: 표 추가·이름변경·삭제, 항목 추가·삭제 → JSON Patch.
- [ ] L3 캔버스 드래그·드롭 정렬 / 화면 워크플로우 시각 편집 — 추후.

### W4 — 거버넌스 / 컴포넌트
- [x] PCF 스캐폴드(manifest + index.ts + css + i18n) 생성.
- [x] PreToolUse trust-gate hook 위험 라벨링 + 로그.
- [x] multi-review 3 페르소나 + 종합 카드 정의.
- [x] Admin Console 웹 UI 1차 (화이트리스트 / 감사 로그 / 비용).
- [x] Admin Console 정책 GUI 편집 + 영속화 (`~/.devkit/policies.json`).
- [x] L3 Canvas 뷰어 (ERD / 화면 카드 / 자동화 / 자가 점검).
- [x] L3 Canvas 양방향 편집 1차 (표·항목 추가·수정·삭제).
- [x] WebSocket presence + ir-patched 라이브 동기화 (CRDT 1차 — 본격 Yjs는 추후).
- [x] 대시보드 3장 (Top 사용 / 품질 / 비용 — Chart.js).
- [x] W5 Trust Gate 차단 모드 (`DEVKIT_TRUST_GATE_MODE=block`) Claude Code hook decision JSON 반환.

### 운영 단계 (W5+)
- 골든셋 자동 갱신 + 회귀 알림.
- Power BI 3장 실데이터 연동 (현재는 로컬 Chart.js 대시보드로 1차 충족).
- [x] Trust Gate 차단 강도 환경변수 토글 가능. 운영 환경 적용은 정책 결정 후.
- 본격 CRDT(Yjs) 통합으로 IR 전체 동시 편집.

---

## 9. 우선순위 (MoSCoW 요약)

- **Must (M)**: 단일 자연어 대화, IR 단일 진실, 부분 패치, 결정적 변환, AI 변환, plan/data/api/screen/workflow/test/deploy 스킬, critic·refine·eval, 다관점 리뷰 3종, Trust Gate 단계별 강도, 화이트리스트, 시크릿 평문 금지, 텔레메트리 invocation/evaluation/feedback.
- **Should (S)**: 4 레이어 동시 표시, IR Git 커밋·시간여행, Quality Scorecard 누적, A/B 비교 모드(차후), Cost 사전 표시, Admin Console, 미사용 자동 플래그, PCF 빌드 자동, 사용처 가시화, 학습 메모리.
- **Could (C)**: CRDT 동시편집, A/B 비교 모드 자동, 비교/체리피킹 화면, 외부 marketplace 게시.
- **Won't (W4 안에는 안 함)**: 풀 시각 캔버스 드래그 편집(L3 후반), Admin Console 시각화 풀세트, 외부 노출 단계 게이트 자동화.

---

## 10. 변경 이력
- 0.1 (2026-05-08) — 초안 작성. 대화로 확정된 결정 사항 반영(단일 모드, 다관점 리뷰 페르소나=PM/디자이너/UX, 사용자 화면 용어 정책, 템플릿 5종, PCF 빌드 범위, Trust Gate W1~W4 로그 only).
