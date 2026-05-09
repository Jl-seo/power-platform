# DevKit Domain Context

> AI 식자재(스킬)가 공유하는 *내부* 도메인 언어. 사용자 화면 노출용 어휘는 별도(`references/glossary.md`).
> Matt Pocock's `skills` repo의 CONTEXT.md 패턴을 차용 — 짧은 도메인 사전이 verbosity를 줄이고 산출물 일관성을 높인다.

## 핵심 개념

- **artifact**: 사용자가 만드는 한 개 단위(앱·기능·자동화). `<id>.ir.json` 파일 하나에 1:1 대응.
- **IR (Intermediate Representation)**: artifact의 4 레이어 동시 표현을 위한 진실 저장소. 루트 스키마는 `schemas/ir.schema.json`.
- **Layers**:
  - L1 자연어 (spec/ADR), L2 다이어그램(ERD/BPMN), L3 캔버스(화면), L4 코드.
  - L4↔IR, L3↔IR, L2↔IR은 **결정적 변환**. L1↔IR만 **AI 변환**.
- **ADR**: artifact 결정 기록. IR `spec.adr[]` 배열 한 줄 한 줄.
- **Connection Reference**: 환경별 실 바인딩이 따로 있는 논리 연결명. 예: `db.primary`.
- **Environment Variable**: 환경별 override 가능한 설정값. 시크릿은 평문 저장 금지(KeyVault ref만).
- **Trust Gate**: 변경 영향 범위 기반 게이트(sandbox/team/prod/external). W1~W4는 로그만.

## 스킬 분류

- **인터뷰**: `clarify` (얕음, 3라운드 cap) — 깊이 필요하면 `clarify`가 사용자에게 *"더 깊이 짚어볼까요?"* 한 번 물은 후 cap 해제.
- **SDLC 단계**: `plan / data / api / screen / component / workflow / test / deploy`.
- **퀄리티 루프**: `critic / refine / eval`.
- **다관점 리뷰**: `review-pm / review-designer / review-ux` + `multi-review`.
- **안전망**: `zoom-out` (큰 결정 직전 한발 물러나기), `trust-gate` (PreToolUse 로그).
- **부가**: `catalog-hint` (사내 사례 추천).

## 자주 등장하는 약어 (내부)

| 약어 | 의미 |
|---|---|
| IR  | Intermediate Representation |
| ADR | Architecture Decision Record |
| RBAC | Role-Based Access Control |
| PII | Personally Identifiable Information |
| PCF | Power Apps Component Framework |
| MCP | Model Context Protocol |

이 약어들은 SKILL.md/스크립트/주석에서는 자유롭게 쓰되, **사용자 메시지에는 절대 노출 금지**(`references/glossary.md` 참고).

## 식자재 원칙

1. **사용자 슬래시 노출 X** — 모든 스킬 `user-invocable: false`. 모델이 description 매칭으로 자동 선택·체이닝.
2. **부분 패치만** — 전체 IR 재생성 금지. 사용자 이전 수정 보존이 최우선.
3. **자가 비평 후 사용자 동의** — `critic`이 약점 찾아도 자동 패치 금지. *"고칠까요?"* 카드로 동의 후에만 적용.
4. **시뮬레이션 먼저** — 외부 영향 있는 작업(메일·SMS·배포)은 사용자 동의 전엔 시뮬레이션만.
5. **5초 Undo + 자동 스냅샷** — Apply 직전 자동 스냅샷, 5초 Undo 토스트 항상.
6. **다관점 리뷰는 큰 변경 시만** — 자동 발동 조건은 §multi-review SKILL.md.

## 차용 출처

- Power Platform 문서 — 차용 매핑은 `../exploration-devkit-design.md` §8.
- Matt Pocock `skills` repo — CONTEXT/ADR/grill-me/zoom-out 패턴.
- GitHub Spec-Kit / AWS Kiro / Cursor Plan Mode — interview-first 트렌드를 `clarify` 자동 발동으로 흡수.
