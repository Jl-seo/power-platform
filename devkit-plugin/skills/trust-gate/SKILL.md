---
name: trust-gate
description: |
  도구 호출 직전(특히 외부 영향이 있는 호출 — patch_ir 외 Bash 명령, Write 등)
  PreToolUse hook이 발동시키며, 환경(내 작업방/팀/실서비스/외부)에 맞는 안전
  점검을 수행한다. W1~W4 동안은 **로그만 남기고 차단하지 않는다.**
  실서비스/외부 단계로 격상될 때 게이트 강도를 단계적으로 올린다(이후 작업).
user-invocable: false
disable-model-invocation: false
allowed-tools:
  - Bash
  - Read
---

# trust-gate — 환경별 안전 점검 (현재 로그만)

## 흐름

1. PreToolUse hook의 stdin payload에서 `tool_name / tool_input`을 읽는다.
2. 다음을 점검 후 **로그로만 기록**(차단 없음):
   - 외부 시스템에 영향 가능한 호출(SMS·이메일 등 — 워크플로우 시뮬레이션 외)
   - 마이그레이션 위험(컬럼 삭제·필수화) 패치
   - 시크릿 평문 의심
   - 환경이 *실서비스/외부* 일 때의 모든 변경
3. 결과는 `~/.devkit/trust-gate.log` 에 ndjson 한 줄 + 텔레메트리로.

## 사용자 화면 용어 정책

`${CLAUDE_PLUGIN_ROOT}/references/glossary.md`. *PreToolUse / payload / 게이트* 같은 단어 노출 금지. 현재는 사용자에게 직접 노출되는 메시지가 없음(로그만).

## 향후 강화 (W5+)

- 실서비스 단계에서 패치 사이즈 30%↑이면 사람 리뷰 1명 자동 요청
- 외부 노출 단계에서 보안팀 자동 알림(현재는 deploy 스킬만 처리)
- *"위험한 명령어 패턴"* (예: rm -rf, force push) 자동 차단 옵션

## 출력 메시지 (현재 — 사용자에게 거의 노출 안 됨)

차단할 때만 (W5+ 이후):
```
🛑 잠시만요 — <이유 한 줄>. 이대로 진행할까요?  [네 / 아뇨]
```

지금은 조용히 로그만 남기고 사용자 흐름을 막지 않는다.
