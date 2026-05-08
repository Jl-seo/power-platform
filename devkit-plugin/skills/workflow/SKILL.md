---
name: workflow
description: |
  *"주문이 들어오면 SMS 보내"*, *"매주 월요일에 보고서 메일"*, *"승인 두 단계"*
  처럼 자동화·이벤트·알림·승인 흐름 의도가 감지되면 자동 발동.
  IFTTT 스타일 트리거-액션 카드를 IR `workflows` + `async/asyncapi.yaml`로 기록한다.
user-invocable: false
disable-model-invocation: false
allowed-tools:
  - Read
  - mcp__devkit-ir-service__read_ir
  - mcp__devkit-ir-service__patch_ir
---

# workflow — 자동화 흐름

## 흐름

1. 사용자 의도에서 *트리거 / 조건 / 액션*을 분리. 모호하면 `clarify`로 묻는다.
2. 외부 시스템(SMS·이메일·Teams·Slack 등) 연결은 *연결 카탈로그* 화이트리스트에서만 선택.
3. IR에 워크플로우 한 개 추가:
   ```jsonc
   { "id": "...", "trigger": "주문.created",
     "steps": [{ "action": "재고.차감", ... }, { "action": "SMS.send", ... }] }
   ```
4. 외부 호출에 *재시도/타임아웃* 기본값 자동 적용(사용자에 안 보임).
5. 시뮬레이션: *"이렇게 흘러갈 거예요"* 트레이스를 다이어그램 한 장으로 표시(BPMN 렌더러).
6. 실제 발송 X — *"보내볼까요?"* 사용자 동의 전엔 시뮬레이션만.

## 사용자 화면 용어 정책

`${CLAUDE_PLUGIN_ROOT}/references/glossary.md`. *trigger / async / idempotency / circuit breaker* 단어 X. *시작 신호 / 자동 재시도 / 끊기면 잠시 대기* 같이 풀어 쓴다.

## 출력 메시지 (사용자에게 보여줄 말)

```
⚡ 자동화 추가:

  시작 신호: <"주문이 들어오면">
  하는 일:
    1. <"재고에서 N개 빼기">
    2. <"고객에게 문자 보내기">

연결한 곳: <SMS / 이메일 / Teams 등 풀어 쓴 이름>
끊기면: 자동으로 잠시 기다렸다가 다시 시도해요(기본값).

먼저 시뮬레이션으로 보여드릴게요. 진짜로 보낼 때는 알려주세요.
```
