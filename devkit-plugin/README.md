# DevKit Plugin

AI 바이브 코더용 SDLC 식자재. **사용자에게 슬래시 명령은 노출하지 않으며**, 모든 스킬은 description 매칭으로 모델이 자동 발동·체이닝한다.

설계 원칙·차용 출처는 상위 문서 `../exploration-devkit-design.md` 참조.

## 무엇이 들어있나

### 스킬 (16개, 모두 `user-invocable: false`)

| 분류 | 스킬 | 역할 |
|---|---|---|
| **인터뷰** | `clarify` | 1~3 라운드 역질문 + grill(깊이) 모드 |
| **SDLC 단계** | `plan` `data` `api` `screen` `component` `workflow` `test` `deploy` | 기획→데이터→API→화면→부품(PCF)→자동화→검증→출시 |
| **퀄리티 루프** | `critic` `refine` `eval` | 6 차원 자가 비평, 자연어 피드백 부분 패치, 3단 게이트 |
| **다관점 리뷰** | `review-pm` `review-designer` `review-ux` `multi-review` | 기획자/디자이너/UX 페르소나 + 종합 |
| **안전망** | `zoom-out` `trust-gate` | 큰 결정 직전 한발 물러나기 + PreToolUse 로그 |
| **부가** | `catalog-hint` | 사내 사례 추천 |

### MCP 서버 — `bin/ir-server.js`

도구: `read_ir / patch_ir / validate_ir / list_entities / diff_ir`. Ajv 2020-12 + fast-json-patch.

### 스크립트

| 명령 | 설명 |
|---|---|
| `npm run smoke` | 전체 점검 (server, critic, eval, renderers) |
| `npm run validate-sample` | 샘플 IR을 스키마 기준 검증 |
| `npm run critic` | LOB 샘플 자가 비평(JSON) |
| `npm run eval` | 3단 게이트 결과(JSON) |
| `npm run render-erd` | LOB 샘플의 ERD 다이어그램 (Mermaid) |
| `npm run render-bpmn` | LOB 샘플의 워크플로우 sequence (Mermaid) |

### IR 스키마 + LOB 샘플

- `schemas/ir.schema.json` — IR 루트 스키마 (spec/roles/data/api/async/workflows/screens/components/deployment).
- `examples/lob/order-app.ir.json` — 주문/재고/고객/상품 + roles + RBAC + connections + variables + workflow.

### 템플릿 카탈로그 — `references/templates/`

5개 시드 템플릿:

| ID | 설명 |
|---|---|
| `lob-crud` | LOB 기본형 (목록/상세/입력) |
| `auth-login` | SSO 로그인 + 권한 가드 |
| `notify-flow` | 이벤트 → SMS/메일/Teams 알림 |
| `pcf-rating` | PCF 표준 별점 부품 (manifest + index.ts + style + i18n) |
| `approval-flow` | 다단계 승인 + 감사 로그 |

`catalog-hint` 스킬이 사용자 의도와 매칭해 추천 카드로 노출.

### 도메인·언어 정책

- `CONTEXT.md` — 내부 도메인 사전 (Matt Pocock의 `skills` repo 패턴 차용).
- `references/glossary.md` — **사용자 화면 용어 정책**. IR/RBAC/PII/JSON Patch 같은 단어는 사용자에게 노출 금지, 일반인 한국어로 번역.

### Hooks

- `hooks/hooks.json` — PreToolUse(`trust-gate.sh`) + PostToolUse + Stop(`telemetry.sh`).
- `hooks/trust-gate.sh` — W1~W4: 로그만, 차단 없음. 위험 패턴(rm -rf, force push, drop table 등)은 risk 라벨로 마킹.
- `hooks/telemetry.sh` — `~/.devkit/telemetry.log` 에 ndjson append + (옵션) `DEVKIT_TELEMETRY_ENDPOINT` 로 forward.

### Web (대화하며 만들기 + Admin + Canvas + Dashboard)

- `web/server.js` — Express + WebSocket. 단일 서버에 네 영역 + 라이브 동시 접속.
- 라우트:
  - `/`           — 진입 화면 (4개 카드)
  - `/chat`       — **대화하며 만들기** (좌 채팅 / 우 미리보기 iframe). Bolt/v0/Lovable의 LOB 버전.
  - `/admin`      — 관리 화면 (화이트리스트 / 정책 편집 / 감사 로그 / 비용)
  - `/canvas`     — 화면 미리보기 + 양방향 편집 (한눈에 / ERD / 화면 카드 / 자동화 / 자가 점검)
  - `/dashboard`  — 대시보드 3장 (Chart.js: Top 사용 / 품질 / 비용)
  - `/api/chat` (POST), `/api/chat/mode`, `/api/templates`, `/policies` (GET/POST),
    `/audit`, `/cost`, `/dashboard`, `/ir/list`, `/ir/load`, `/ir/patch` (POST)
  - `/ws?path=<artifact>` — WebSocket presence + ir-patched 라이브 동기화

#### 대화하며 만들기 (`/chat`)
사용자가 자연어로 *"고객 표 만들어줘"* / *"주문에 결제상태 추가"* / *"점검해줘"* 식으로 말하면, AI가 우리 식자재(read_ir / patch_ir / validate_ir / list_entities / render_erd / render_bpmn / critic) 도구를 호출해 IR을 부분 수정합니다. WebSocket으로 우측 미리보기가 즉시 따라옵니다.

**LLM 백엔드**: Azure AI Foundry (OpenAI-compatible endpoint). 환경변수:
```
AZURE_OPENAI_ENDPOINT       (예: https://<resource>.openai.azure.com)
AZURE_OPENAI_DEPLOYMENT     (모델 배포 이름, 예: gpt-4o)
AZURE_OPENAI_API_KEY        (또는 Entra ID 토큰)
AZURE_OPENAI_API_VERSION    (default 2024-08-01-preview)
```
4개 중 하나라도 빠지면 자동으로 **시뮬레이션 모드**(스텁)로 동작 — 시연/스크린샷용 데모 시나리오 작동.

#### 화면 미리 (스크린샷)
`docs/screenshots/` 에 다음 7장이 들어있어요:
- `01-home.png` — 진입 화면 (4개 카드)
- `02-chat.png` — 대화하며 만들기 (시뮬 모드 표시 + 좌/우 분할)
- `03-canvas.png` — 화면 미리보기 (한눈에)
- `04-dashboard.png` — 대시보드 3장
- `05-admin.png` — 관리 화면 (화이트리스트)
- `06-chat-demo.png` — 채팅 3턴 시연 (표 목록 → 결제상태 추가 → 점검) 좌 카드 + 우 라이브 미리보기
- `07-canvas-after-edit.png` — 데이터 탭, ERD 다이어그램 + 표·항목 편집기 + 결제상태 추가 반영 확인

#### 양방향 편집 (Canvas → IR)
- 데이터 탭에서 표 추가·이름 바꾸기·삭제 / 항목 추가·삭제. 모달로 입력 후 JSON Patch로 부분 저장.
- 다른 사용자가 같은 IR을 보고 있으면 *"👤 N명"* 표시 + 한쪽이 patch 적용 시 다른 쪽 즉시 갱신.

#### 정책 편집 (Admin → ~/.devkit/policies.json)
- Trust Gate 4 단계 + 적용 강도 + 시크릿 정책을 GUI에서 편집·저장.
- 도구가 다음 호출부터 새 정책을 따른다.

#### Trust Gate 모드 (환경변수)
- `DEVKIT_TRUST_GATE_MODE=log` (기본): 위험 라벨링만, 차단 없음
- `DEVKIT_TRUST_GATE_MODE=warn`: stderr 경고 + 통과
- `DEVKIT_TRUST_GATE_MODE=block`: 위험이면 Claude Code hook decision JSON 반환 → 사용자에게 *"진행할까요?"* 확인

#### 실행 / 점검
```bash
npm run web         # http://localhost:5173
npm run smoke:web   # 헤드리스 자기 점검
```
인증은 시범 — 운영 시 사내 SSO + 추가 MFA 필수(NFR-2.4).

## 로컬 컴퓨터에서 화면 보기 (가장 쉬운 길)

> 사전 준비: 컴퓨터에 [Node.js](https://nodejs.org)(LTS 버전)와 [Git](https://git-scm.com/downloads) 두 개가 깔려 있어야 해요. 한 번만 깔면 끝.

### macOS / Linux — 한 줄 복붙

터미널을 열고 아래 한 줄을 붙여넣으세요:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/Jl-seo/power-platform/claude/explore-power-platform-methods-3gfYL/devkit-plugin/scripts/run-local.sh)
```

자동으로 1) PR 다운로드 → 2) 부속 설치 → 3) 자체 점검 → 4) 웹 서버 시작 → 5) 브라우저 자동 오픈까지 됩니다.

### Windows — 한 번 더블클릭

1. PR을 받아서 `devkit-plugin\scripts\run-local.bat` 파일을 더블클릭하면 끝.
2. 안 받았다면 [PR 페이지](https://github.com/Jl-seo/power-platform/pull/1)에서 *Code → Download ZIP* 으로 받고, ZIP 푼 폴더에서 `run-local.bat` 더블클릭.

### 한 줄 복붙이 싫다면 — 4단계 수동

```bash
git clone -b claude/explore-power-platform-methods-3gfYL https://github.com/Jl-seo/power-platform.git
cd power-platform/devkit-plugin
npm install
npm run web
```

각 줄이 뭘 하는지:
1. `git clone …` — 깃허브에서 PR 브랜치를 **다운로드**합니다.
2. `cd …` — 다운받은 폴더 안 *devkit-plugin* 으로 **들어갑니다**.
3. `npm install` — 도구가 쓰는 부속을 **설치**합니다(1~2분).
4. `npm run web` — 웹 서버를 **켭니다**. 브라우저에서 `http://localhost:5173` 으로 열면 끝.

## 자체 점검 (선택)

서버 안 띄우고 결정적 부분만 빠르게 확인:

```bash
npm install
npm run smoke
```

## Claude Code에 로드 (개발자용)

로컬 개발:

```bash
claude --plugin-dir ./devkit-plugin
```

또는 사내 marketplace 등록 후 `/plugin install devkit`.

## 차용 출처

- **Microsoft Power Platform 문서** (이 레포) — Solution Format / CoE 인벤토리 / Test Engine samples / AI Evaluation 3전략 / PCF / Connection Reference. 매핑은 `../exploration-devkit-design.md` §8.
- **Matt Pocock — `mattpocock/skills`** — CONTEXT.md / ADR / grill-me(깊이 인터뷰) / zoom-out 패턴.
- **GitHub Spec-Kit / AWS Kiro / Cursor Plan Mode** — interview-first 트렌드 → `clarify` 자동 발동으로 사용자 노출 없이 흡수.
