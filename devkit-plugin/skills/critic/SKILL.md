---
name: critic
description: |
  IR 산출물이 변경된 직후(특히 mcp__devkit-ir-service__patch_ir 결과 도착 후)
  자동 발동되는 자가 비평. 6 차원(정확성/완전성/일관성/보안/UX/유지보수성) 점수와
  약점 항목을 결정적으로 계산하고, 이를 기반으로 사용자에게 1~3개의 짧은
  개선 제안 카드를 만든다. 사용자 동의가 있을 때만 refine 스킬로 패치를 적용한다.
user-invocable: false
disable-model-invocation: false
allowed-tools:
  - Bash
  - Read
  - mcp__devkit-ir-service__read_ir
---

# critic — 결정적 점수 + 사람말 개선 제안

## 흐름

1. 결정적 점수 계산 — 다음 명령으로 6 차원 점수와 finding 목록을 받는다.
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/bin/critic.js <ir-path>
   ```
2. 결과 JSON에서 `weakest` 배열의 상위 1~3개 차원만 사용자에게 노출.
3. 각 약점에 대해 다음 형식의 *카드* 한 개씩:
   ```
   [<차원>] (<점수>)
   • <문제 한 줄 요지>
   → 제안: <고치는 방법 한 줄>
   ```
4. 사용자가 카드 중 일부를 *"이거 고쳐줘"* 식으로 골라 수락하면, `refine` 스킬을 호출해 부분 패치 적용. 거절/스킵은 그대로 둔다.
5. 결과(점수+수락 카운트)를 텔레메트리에 흘릴 수 있도록 자연스럽게 마무리(stop hook이 받아간다).

## 사용자 화면 용어 정책

`${CLAUDE_PLUGIN_ROOT}/references/glossary.md`. 차원 이름도 한국어로 — *security → 보안 / ux → 사용성 / completeness → 빠진 곳 / consistency → 어긋남* 등.

## 출력 카드 예시 (사용자에게 보여줄 말)

```
한 가지만 봐주세요 — 보안

• 고객의 전화번호가 개인정보처럼 보여요.
  관리자만 바꿀 수 있도록 잠글까요?  [네 / 아뇨 / 나중에]
```

```
한 가지만 봐주세요 — 사용성

• 주문 화면에 일반 사용자가 못 바꾸는 항목이 보여요.
  관리자 화면으로 옮길까요?  [네 / 아뇨 / 나중에]
```

**나쁜 예**: *"[security] (0.50) PII 후보 미분류. RBAC write=[admin] 권장"*

## 안 좋은 패턴 (회피)

- 6 차원 모두 나열 (피로). 가장 약한 1~3 차원만.
- 이미 통과한 차원에 대한 칭찬 (잡음). 약점만 짧게.
- 사용자 동의 없이 자동으로 패치 적용 — 절대 금지.
- "잘 만들어졌어요" 같은 의미 없는 마무리.

## 종합 점수 활용

`overall`이 0.7 미만이거나 high-severity finding이 3개 이상이면 `multi-review` 스킬을 추가로 호출해 기획/디자이너/UX 페르소나 다관점 리뷰를 받는다.
