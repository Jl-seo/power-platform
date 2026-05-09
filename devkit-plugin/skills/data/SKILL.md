---
name: data
description: |
  데이터 모델(엔티티/필드/관계) 변경 의도가 감지되면 자동 발동.
  자연어 의도를 IR의 data 섹션에 대한 JSON Patch로 변환하고,
  검증 게이트(JSON Schema + RBAC + PII)를 통과시킨 뒤 ir-service MCP로
  부분 패치를 적용한다. 전체 IR을 다시 쓰지 않는다.

  발동 트리거 예시:
  - "고객에 전화번호 추가해줘"
  - "주문 테이블에 결제 상태 컬럼"
  - "재고 테이블 새로 만들기"
  - "상품에서 카테고리 분리하기"

  생성 직후 critic 스킬이 PostToolUse hook으로 자동 발동되어
  6 차원 자가 비평을 수행한다(§4.3).
user-invocable: false
disable-model-invocation: false
allowed-tools:
  - Read
  - Write
  - mcp__devkit-ir-service__read_ir
  - mcp__devkit-ir-service__patch_ir
  - mcp__devkit-ir-service__validate_ir
  - mcp__devkit-ir-service__list_entities
---

# data — 데이터 모델 부분 패치 작성기

## 흐름

1. **현재 IR 읽기** — `read_ir`로 현 IR을 가져온다. 사용자가 가리키는 artifact가 명확하지 않으면 워크스페이스에서 `*.ir.json` 단일 hit을 default로, 다중 hit 시 `clarify`로 한 번 묻는다.
2. **모호점 인터뷰** — 다음이 불명확하면 `clarify` 스킬로 한 번에 묻는다(최대 3개 질문):
   - 새 필드의 **타입**(string/number/integer/boolean/date/datetime/ref)
   - **필수 여부**(required true/false)
   - **PII 여부**(개인정보 보호 필요)
   - **RBAC**(read/write 가능 role 묶음)
   - 기존 엔티티 변경 시 **마이그레이션 영향**(컬럼 삭제 등 위험)
3. **JSON Patch 생성** — RFC6902 형식. 예: 필드 추가
   ```json
   [
     { "op": "add", "path": "/data/entities/0/fields/-",
       "value": { "name": "전화", "type": "string", "required": true, "pii": true,
                  "rbac": { "read": ["user","admin"], "write": ["admin"] } } }
   ]
   ```
4. **부분 적용** — `patch_ir` 호출. 서버가 적용 + 검증을 한 번에 처리한다.
5. **결과 요약** — 변경 사항 자연어 3줄 + RBAC/PII 적용 여부 명시.
6. (자동) PostToolUse hook이 `critic` 스킬을 발동시켜 자가 비평 수행.

## 결정 게이트

- **JSON Schema 검증**: `patch_ir` 서버가 자동 수행. 실패 시 patch 적용되지 않음.
- **RBAC 게이트**: 새 필드/엔티티에 `rbac` 미지정 + admin 단독 데이터로 추정되면 자동으로 admin-only로 잠그고 사용자에게 한 줄 알림.
- **PII 게이트**: 필드 이름/타입에서 PII 추정(전화/이메일/주민/주소/생년월일 등)되면 `pii: true` 자동 부여 + 알림.
- **마이그레이션 위험**: 컬럼 삭제/타입 변경/필수화는 위험 라벨, 사용자에 *"이전 데이터 있으면 backfill 전략 필요"* 경고.

## 안티패턴 회피

- `is_deleted` 같은 soft-delete 플래그 추가 의도 → 사내 표준은 audit table 분리. 경고 후 대안 제시.
- 한 엔티티에 30개 이상 필드 추가 → *"엔티티 분할 검토"* 제안.
- 동일 의미 컬럼 중복(예: `name`, `이름` 동시 존재) → 통합 제안.

## 사용자 화면 용어 정책

`${CLAUDE_PLUGIN_ROOT}/references/glossary.md` 따른다. *엔티티/필드/RBAC/PII/JSON Patch* 같은 단어는 사용자에게 그대로 노출 금지.

## 출력 메시지 템플릿 (사용자에게 보여줄 말)

```
✅ 됐어요 — <표 이름>에 <항목 N개> 추가했습니다.
🛡️ <항목 이름>은 개인정보로 보여서 관리자만 바꿀 수 있게 잠갔어요.
⚠️ 한 가지 봐주세요 — <위험 한 줄> (있을 때만)
```

**나쁜 예**: *"data.entities[0].fields에 phone(string,required,pii) 추가, RBAC write=[admin]"*
**좋은 예**: *"고객 표에 전화번호를 추가했어요. 개인정보라서 관리자만 바꿀 수 있어요."*
