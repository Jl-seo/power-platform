# DevKit Plugin (W1 walking skeleton)

AI 바이브 코더용 SDLC 식자재. 사용자에게 슬래시 명령은 노출하지 않으며 description 매칭으로 모델이 자동 발동한다.

## 무엇이 들어있나

| 영역 | 위치 | 비고 |
|---|---|---|
| Plugin manifest | `.claude-plugin/plugin.json` | 이름·버전 |
| MCP 서버(IR service) | `bin/ir-server.js` | read/patch/validate/list_entities/diff_ir |
| IR JSON Schema | `schemas/ir.schema.json` | spec/roles/data/screens/components/workflows/deployment |
| 샘플 IR | `examples/lob/order-app.ir.json` | LOB 도메인(주문/재고/고객) 종횡 라인 |
| Skills | `skills/clarify/`, `skills/data/` | `user-invocable: false`, description 자동 발동 |
| MCP config | `.mcp.json` | `${CLAUDE_PLUGIN_ROOT}` 사용 |
| Hooks | `hooks/hooks.json`, `hooks/telemetry.sh` | PostToolUse + Stop 텔레메트리 |

## 빠른 점검

```bash
cd devkit-plugin
npm install
npm run smoke              # 의존성 + 샘플 IR 검증
npm run validate-sample    # 샘플 IR을 ir.schema.json 기준 검증
```

## Claude Code에 로드

로컬 개발 시:

```bash
claude --plugin-dir ./devkit-plugin
```

또는 사내 marketplace 등록 후 `/plugin install devkit`.

## 다음 (W2)

- L1↔IR AI 변환 + AI 가정 카드
- `critic` 자가 비평 스킬 (PostToolUse 자동)
- `refine` 자연어 피드백 → 부분 patch
- 평가 게이트 1·2단

## 참고

상위 설계: `../exploration-devkit-design.md` (§3.2 Skills는 AI 식자재, §4.3 대화 기반 퀄리티 개선 루프).
