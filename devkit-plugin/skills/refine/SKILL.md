---
name: refine
description: |
  사용자가 산출물에 대해 자연어로 피드백을 주면 자동 발동.
  피드백이 가리키는 IR 노드를 식별하고, 영향 범위를 최소화한 JSON Patch
  (RFC6902)를 만들어 mcp__devkit-ir-service__patch_ir로 부분 적용한다.
  전체 재생성 절대 금지 — 사용자가 이전에 수정한 부분 유실 방지.
user-invocable: false
disable-model-invocation: false
allowed-tools:
  - Read
  - mcp__devkit-ir-service__read_ir
  - mcp__devkit-ir-service__patch_ir
  - mcp__devkit-ir-service__diff_ir
---

# refine — 자연어 피드백 → IR 부분 패치

## 흐름

1. **현재 IR 읽기** — `read_ir`로 baseline 확보.
2. **노드 식별** — 사용자 피드백이 가리키는 IR 경로 후보 1~3개 추출. 모호하면 `clarify`로 한 번 묻고 끝.
3. **최소 패치 작성** — 가능한 한 *해당 노드만* 변경. 같은 변경을 여러 곳에 흩지 말 것.
4. **Validation** — `patch_ir` 서버가 자동 검증. 실패 시 사용자에게 *"이 변경은 다른 부분과 충돌해요. 같이 바꿀까요?"* 확인.
5. **결과 요약** — 사용자에게 보여줄 말은 일반인 한국어. 예: *"고객 표의 전화번호를 '필수'로 바꿨어요."*

## 사용자 화면 용어 정책

`${CLAUDE_PLUGIN_ROOT}/references/glossary.md` 따름. 사용자에게 *patch/노드/엔티티/필드/IR* 같은 단어 노출 금지. *바꾸기/항목/표/설계도* 같은 일반 단어 사용.

## 출력 메시지 예

**좋음**: *"고객 표의 전화번호를 필수로 바꿨어요. 다른 부분은 그대로예요."*
**좋음**: *"이 부분만 바꿨어요. 마음에 안 드시면 '되돌리기' 한 번에 원래대로 돌아가요."*
**나쁨**: *"patch applied: /data/entities/0/fields/2/required true"*

## 절대 규칙

- **전체 IR 재작성 금지.** 항상 patch만.
- 사용자 이전 수정 위에 덮어쓰지 말 것 — `diff_ir`로 차이 먼저 확인.
- 한 라운드 패치는 **한 의도**로 묶을 것. 여러 의도면 분할.
- 패치 크기가 IR 노드 수의 30% 이상이면 *"변경 범위 큼 — 새 작업으로 진행 권장"* 알림.

## 안티패턴

- *"이 화면 다시 만들어줘"* → 전체 재생성 금지. 어느 부분이 마음에 안 드는지 `clarify`로 좁힌다.
- 사용자가 *"이거 좀 더 좋게"* 같이 막연한 피드백 → 1~2 후보 만들어 *"A vs B 중 어느 쪽?"* 비교 모드 진입.
