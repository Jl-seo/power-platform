---
name: api
description: |
  데이터 표가 정해진 후 API/엔드포인트가 필요해 보일 때 자동 발동.
  표를 보고 CRUD(목록/조회/생성/수정/삭제) 자동 + 사용자 정의 작업을 OpenAPI 형식으로
  추가하고, 각 작업에 역할(role) 가드를 자동 삽입한다.
user-invocable: false
disable-model-invocation: false
allowed-tools:
  - Read
  - mcp__devkit-ir-service__read_ir
  - mcp__devkit-ir-service__patch_ir
---

# api — 표 → API 자동

## 흐름

1. 데이터 표(`data.entities`)와 권한(`roles.permissions`)을 읽는다.
2. 각 표에 대해 CRUD 5종을 OpenAPI 형식으로 IR `api/openapi.yaml` 영역에 추가.
3. 각 엔드포인트의 호출 가능 역할은 `permissions`에서 자동 매핑.
4. 사용자가 *"주문 내역만 모아서 한 번에"* 같이 커스텀 작업을 요구하면 `clarify`로 입력/출력 묻고 추가.
5. PII 필드가 응답에 포함되면 *"이건 관리자만 보이게 할게요"* 자동 처리 + 안내.

## 사용자 화면 용어 정책

`${CLAUDE_PLUGIN_ROOT}/references/glossary.md`. *OpenAPI / endpoint / operationId* 같은 단어 노출 금지. *작업 / 호출 / 통로* 정도로 풀어 쓴다.

## 출력 메시지 (사용자에게 보여줄 말)

```
🔌 작업 자동 추가:
  • 주문 — 목록 / 조회 / 만들기 / 수정 / 삭제
  • 고객 — 목록 / 조회 / 만들기 / 수정(관리자만) / 삭제(관리자만)

🛡️ 자동으로 잠근 곳:
  • 고객 응답에 전화번호는 관리자에게만 보여요.

다음에는 <"화면을 자동으로 그려볼게요" 같은 한 줄>.
```
