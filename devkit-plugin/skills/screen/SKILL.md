---
name: screen
description: |
  화면/UX 의도가 감지되거나 데이터 표 변경 후 자동 발동. 표를 기반으로
  목록/상세/입력 화면 3종을 자동 생성한다. 관리자 전용 작업과 일반 사용자
  작업을 자동으로 두 묶음(screens/admin, screens/user)으로 나누고, 각 화면의
  필드 노출은 권한 표를 따른다.
user-invocable: false
disable-model-invocation: false
allowed-tools:
  - Read
  - mcp__devkit-ir-service__read_ir
  - mcp__devkit-ir-service__patch_ir
---

# screen — 표 → 화면 자동, 관리자/사용자 자동 분리

## 흐름

1. 표와 권한을 읽는다.
2. 각 표에 대해 List / Detail / Form 3종 화면을 자동 생성. 일반 사용자가 만들고/볼 수 있는 작업만 `screens/user`로, 그 외(예: 마스터 데이터·삭제 권한 필요)는 `screens/admin`으로 자동 분배.
3. 화면 이름은 사람말로 — *"주문폼 / 내 주문 내역 / 재고 관리"* 같이.
4. 관리자만 쓰는 컬럼이 일반 사용자 화면에 노출되면 자동으로 빼고 안내.
5. 모바일 변형(좁은 너비) 기본 형식을 함께 적용.

## 사용자 화면 용어 정책

`${CLAUDE_PLUGIN_ROOT}/references/glossary.md`. *uischema / RJSF / 디자인 토큰* 같은 단어 노출 금지. *입력 형식 / 화면 부품 / 색·여백 묶음* 정도.

## 출력 메시지 (사용자에게 보여줄 말)

```
🖼️ 화면 자동 만들었어요:

일반 사용자가 쓸 곳:
  • 주문 입력
  • 내 주문 내역

관리자가 쓸 곳:
  • 재고 관리
  • 주문 전체 목록

📱 모바일에서도 깨지지 않게 기본 형식을 적용했어요.
🛡️ 관리자만 보는 항목(예: 고객 전화번호)은 일반 화면에서 자동으로 뺐어요.

다음에는 <"써보기 / 화면 부품 만들기 / 알림 자동화" 같은 한 줄>.
```
