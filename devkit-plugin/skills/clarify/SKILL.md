---
name: clarify
description: |
  사용자 의도가 모호하거나 핵심 결정을 추정해야 할 때 자동 발동.
  AskUserQuestion으로 한 번에 1~3개의 focused 질문을 던지고, 각 질문에는
  추천 default를 첫 번째 옵션으로 제시한다. 사용자가 "잘 모르겠어요"를
  고를 수 있도록 항상 escape hatch를 둔다. 같은 영역 재질문은 금지하며,
  답변은 spec.md의 ADR 섹션에 한 줄로 자동 누적된다.

  발동 트리거 예시:
  - 데이터 모델/스키마 추가 요청에서 필드 타입·필수 여부·PII 여부가 불명확
  - 화면 추가 요청에서 admin/user 역할 귀속이 불명확
  - 워크플로우 트리거/액션의 외부 시스템 연결 정보가 불명확
  - 배포 환경(sandbox/team/prod) 명시 없이 출시 의도가 들어옴

  3라운드 상한: 한 작업에서 같은 사용자에 대해 최대 3회 round.
user-invocable: false
disable-model-invocation: false
allowed-tools:
  - AskUserQuestion
  - Read
---

# clarify — 자연스러운 역질문 인터뷰어

## 사용 원칙

1. **한 번에 1~3개**의 focused 질문만 던진다. 한 라운드에 4개 이상 질문은 인지 부담이 크므로 금지.
2. 각 질문에는 **추천 default를 첫 번째 옵션**으로 두고 라벨 끝에 ` (Recommended)` 표시.
3. **escape hatch**: 마지막 옵션은 항상 *"잘 모르겠어요 — 합리적 default로 진행"* 류여야 한다.
4. **같은 영역 재질문 금지**: 이전 ADR(`spec.md` 또는 IR `spec.adr`)에 같은 결정이 이미 있으면 다시 묻지 않는다.
5. **3라운드 상한**: 하나의 작업 단위에서 사용자에게 최대 3 round까지만 묻고, 그 후는 default로 진행 + 사후 *"필요하면 바꾸세요"* 안내.
6. 답변을 받으면 IR `spec.adr` 배열에 다음 형식으로 한 줄 추가:
   ```jsonc
   { "at": "<ISO datetime>", "decision": "<선택 라벨>", "rationale": "<질문 요지>" }
   ```
   추가는 `mcp__devkit-ir-service__patch_ir`로 JSON Patch로 수행.

## 좋은 질문 만드는 법

- **모호한 부분만**: 사용자가 이미 명시한 것은 묻지 않는다.
- **결정 가능한 형태**: "어떻게 생각하세요?" X. "A vs B vs 잘 모름" O.
- **구체적**: "사용자 경험 중요?" X. "삭제 후 휴지통(30일 보관) vs 즉시 영구삭제 vs 잘 모름" O.
- **trade-off 명시**: 옵션 description에 한 줄 trade-off 적기.

## 안 좋은 패턴 (회피)

- 한 라운드에 5개 이상 질문 (피로)
- default 없는 open-ended 질문
- 이미 답한 영역 재질문
- "확인 차" 의미 없는 yes/no
- 질문 던지고 사용자 답 기다리지 않고 자기가 결정해버리기

## 출력

질문 라운드가 끝나면 다음을 한 짧은 메시지로 요약:
- 결정된 사항 N개 (각 한 줄)
- 다음 단계 제안 (예: "data 스킬로 스키마 초안을 만들겠습니다")
