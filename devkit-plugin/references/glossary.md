# 사용자 화면 용어 정책 (Language Policy)

DevKit의 모든 스킬은 **사용자에게 말할 때 일반인 한국어**만 쓴다. 아래 표 왼쪽 단어가 사용자 메시지에 등장하면 안 된다. 오른쪽 표현으로 자동 번역해서 출력한다.

내부(IR 파일·코드·ADR)에는 원문을 유지해도 된다 — *식자재* 영역이라서.

## 금지 용어 → 사용자말

| 내부(금지) | 사용자에게 말할 때 |
|---|---|
| IR, intermediate representation | 설계도, 산출물 |
| JSON Patch, RFC6902 | 부분 수정, 변경 묶음 |
| JSON Schema | 형식 점검 |
| RBAC | 권한, 누가 보고/바꿀 수 있는지 |
| permissions / roles | 역할, 권한 |
| ADR | 결정 기록, 이렇게 정한 이유 |
| Trust Gate | 안전 점검, 관문 |
| gate1 schema | 형식 점검 |
| gate2 structure | 구조 점검 |
| gate3 golden-set / 회귀 | 기준 비교, 이전 좋은 결과와 비교 |
| verdict accepted | 통과 |
| verdict review_needed | 재검토 필요 |
| verdict rejected | 통과 못 함 |
| schema 검증 실패 | 형식이 안 맞아요 |
| validation | 점검 |
| PII | 개인정보 |
| OpenAPI / AsyncAPI / BPMN | API 명세 / 이벤트 명세 / 업무 흐름도 |
| PCF, Power Apps Component Framework | 재사용 화면 부품, 컴포넌트 |
| ManagedIdentity / Key Vault / Connection Reference | 안전한 접속 정보, 연결 |
| Environment Variable | 설정값, 환경별 설정 |
| Container Apps / Foundry / APIM | 서버, 모델, 게이트웨이 (꼭 필요할 때만 *"클라우드"* 정도) |
| MCP server / tool | 자동화 도구 (꼭 필요할 때만) |
| CRDT, OT | 동시 편집 (실현 방식은 숨김) |
| sandbox / team / prod | 내 작업방 / 팀 공용 / 실서비스 |
| dispatch, throttle, idempotency, circuit breaker | 자동 재시도, 끊기면 잠시 대기 |
| escape hatch, opaque block | 코드만 직접 작성하는 부분 |

## 표현 가이드

- **명사보단 동사**: *"검증을 수행"* X → *"점검합니다"* O.
- **한 문장 한 의미**: *"및", "또는"*으로 잇대지 말 것. 끊어 쓰기.
- **수동태 자제**: *"적용되었습니다"* X → *"적용했어요"* O.
- **존댓말 통일**: 스킬 출력은 항상 존댓말(`-요/-습니다`).
- **이모지 절제**: 상태 표시(✅/⚠️/❌) 외에는 사용 X.
- **문단 짧게**: 한 카드 3~5줄 이내.

## 사용자에게 보일 때 자주 쓰는 카드 형식

```
✅ 됐어요 — <한 줄 결과>
⚠️ 한 가지만 봐주세요 — <한 줄 우려> → <한 줄 제안>
❌ 못 했어요 — <한 줄 사유>
```

## 좋은 예 / 나쁜 예

- 나쁨: *"고객.전화 PII 후보 미분류, RBAC write=[admin] 적용 권장"*
- 좋음: *"고객의 전화번호는 개인정보예요. 관리자만 바꿀 수 있게 잠글까요?"*

- 나쁨: *"verdict: review_needed (gate2 high-severity 2건)"*
- 좋음: *"두 가지 점검해주세요. 자세히 알려드릴까요?"*

- 나쁨: *"IR 패치 12건 적용 후 schema validation 통과"*
- 좋음: *"바뀐 점 12개 모두 반영했어요. 형식 점검도 통과."*

## 모든 스킬에 공통 적용

각 스킬 SKILL.md의 *출력 메시지 템플릿* 은 위 표를 따른다. 내부 처리(MCP 호출 인자, 패치 본문 등)에는 원문을 그대로 쓴다 — 사용자 화면에 노출되지 않으므로.
