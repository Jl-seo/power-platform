---
name: eval
description: |
  IR 변경이 적용된 후 또는 사용자가 *"점검해줘"* 류 의도를 보일 때 자동 발동.
  3단 평가 게이트(gate1 schema / gate2 structure / gate3 golden-set)를 실행하고,
  verdict(accepted / review_needed / rejected)와 차원별 점수를 사용자에게 한 줄로 보고.
user-invocable: false
disable-model-invocation: false
allowed-tools:
  - Bash
---

# eval — 3단 게이트 러너

## 흐름

```bash
node ${CLAUDE_PLUGIN_ROOT}/bin/eval-runner.js <ir-path>
```

또는 골든셋 디렉토리 지정:

```bash
node ${CLAUDE_PLUGIN_ROOT}/bin/eval-runner.js <ir-path> --goldens-dir <dir>
```

## 사용자 화면 용어 정책

`${CLAUDE_PLUGIN_ROOT}/references/glossary.md`. *gate / verdict / schema / golden-set* 같은 단어는 사용자에게 노출 금지.

## 결과 매핑 (사용자에게 보여줄 말)

- 통과(accepted): *"점검 통과 ✅ 다 좋아요."*
- 재검토 필요(review_needed): *"⚠️ 두 가지만 봐주세요. 자세히 알려드릴까요?"*
  - 그 다음 `critic`이 약점 1~3개를 카드로 보여줌.
- 통과 못 함(rejected): *"❌ 형식이 맞지 않는 부분이 있어요: <한 줄 사유>"*

## 골든셋 정책

- `goldens/<artifact-id>.ir.json` 파일이 있으면 회귀 비교(JSON Patch).
- 차이가 있어도 무조건 reject 하지 않고 `review_needed`로 격상 — 사용자가 의도한 변경일 수 있음.
- 골든셋 자동 갱신은 사용자가 명시적으로 수락한 경우만(refine 거치지 않고 직접 갱신 금지).

## 텔레메트리

eval 결과 JSON은 stop hook이 자동으로 텔레메트리 로그에 추가한다(별도 작업 불필요).
