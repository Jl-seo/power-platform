---
name: plan
description: |
  새 앱/기능 의도를 사용자가 처음 말했고 설계도(spec/roles)가 아직 없을 때 자동 발동.
  의도를 한 문장으로 정리하고 핵심 액터·결정사항을 spec.md/roles.yaml 초안으로 기록.
  모호한 부분은 clarify 스킬을 자동 호출해 1~3개 질문으로 좁힌다.
user-invocable: false
disable-model-invocation: false
allowed-tools:
  - Read
  - Write
  - mcp__devkit-ir-service__read_ir
  - mcp__devkit-ir-service__patch_ir
---

# plan — 의도 → 설계도 초안

## 흐름

1. 워크스페이스에서 `*.ir.json`이 없으면 새 IR 파일을 만든다(`<artifact-id>.ir.json`).
2. 사용자 의도를 한 문장으로 정리해 `spec.intent`로 기록.
3. 핵심 액터(누가 사용?)와 외부 시스템(SMS/이메일/외부 API 등)을 묻는 게 필요하면 `clarify` 호출. 보통은 *user / admin / auditor* 기본값.
4. 첫 결정사항(예: *"실시간 SMS는 비동기 OK / 동기 필요?"*)을 결정 기록(ADR)으로 한 줄 추가.
5. 다음 단계 후보(데이터 표 만들기 / 화면 그리기) 한 줄 안내.

## 사용자 화면 용어 정책

`${CLAUDE_PLUGIN_ROOT}/references/glossary.md`. *artifact / spec / actors / role / IR* 같은 단어는 풀어 쓴다 — *산출물 / 개요 / 사용자 / 역할 / 설계도*.

## 출력 메시지 (사용자에게 보여줄 말)

```
✏️ 한 문장 정리:
  "<사용자 의도 한 줄>"

이렇게 쓸 사람: <user / admin / auditor 풀어 쓴 이름들>
연결할 곳: <SMS / 이메일 / 외부 API 등, 있으면>

결정 한 가지: <ADR 한 줄>

다음에는 <"데이터 표를 만들어볼게요" 같은 자연어 한 줄>.
```
