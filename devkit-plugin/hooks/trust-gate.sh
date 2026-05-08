#!/usr/bin/env bash
# DevKit Trust Gate hook — PreToolUse 단계에서 안전 점검을 수행한다.
# W1~W4 동안은 **로그만 남기고 사용자 작업을 막지 않는다.**
# 차단 강화는 W5+ 이후 운영 환경에서.

set -u

LOG_DIR="${HOME}/.devkit"
LOG_FILE="${LOG_DIR}/trust-gate.log"
mkdir -p "${LOG_DIR}"

PAYLOAD="$(cat || true)"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

TOOL="$(printf '%s' "${PAYLOAD}" | grep -oE '"tool_name":"[^"]*"' | head -1 | sed 's/.*:"//;s/"$//' || true)"
COMMAND="$(printf '%s' "${PAYLOAD}" | grep -oE '"command":"[^"]*"' | head -1 | sed 's/.*:"//;s/"$//' || true)"

# 위험 신호 점검 (실제 차단은 안 함, 로그 라벨만)
RISK="none"
case "${COMMAND}" in
  *"rm -rf"*)        RISK="destructive_filesystem" ;;
  *"git push --force"*) RISK="force_push" ;;
  *"DROP TABLE"*|*"drop table"*) RISK="destructive_sql" ;;
  *"sudo "*)         RISK="privilege_escalation" ;;
esac

# 시크릿 평문 의심 (간단 휴리스틱)
case "${PAYLOAD}" in
  *"AKIA"*|*"sk_live_"*|*"-----BEGIN PRIVATE KEY-----"*)
    RISK="${RISK},secret_pattern" ;;
esac

printf '{"at":"%s","tool":"%s","risk":"%s","payload":%s}\n' \
  "${TS}" "${TOOL:-unknown}" "${RISK}" "${PAYLOAD:-{\}}" >> "${LOG_FILE}"

# 외부 텔레메트리 forward (옵션)
if [[ -n "${DEVKIT_TELEMETRY_ENDPOINT:-}" ]]; then
  AUTH=()
  [[ -n "${DEVKIT_TELEMETRY_TOKEN:-}" ]] && AUTH=(-H "Authorization: Bearer ${DEVKIT_TELEMETRY_TOKEN}")
  curl -sS -m 5 -H "Content-Type: application/json" "${AUTH[@]}" \
    -d "{\"at\":\"${TS}\",\"event\":\"trust_gate\",\"tool\":\"${TOOL}\",\"risk\":\"${RISK}\"}" \
    "${DEVKIT_TELEMETRY_ENDPOINT}" >/dev/null 2>&1 || true
fi

# ----------------------------------------------------------------------
# W5 차단 모드 — 환경변수 DEVKIT_TRUST_GATE_MODE 로 제어
#   log    (기본): 위 로그만 남기고 통과
#   warn   : 위험이면 stderr 경고 + 통과
#   block  : 위험이면 Claude Code hook 프로토콜로 ask 결정 반환
# 위험 아니면 어느 모드든 그대로 통과.
# ----------------------------------------------------------------------
MODE="${DEVKIT_TRUST_GATE_MODE:-log}"

if [[ "${RISK}" != "none" ]]; then
  case "${MODE}" in
    warn)
      printf '[devkit trust-gate] 경고: 위험 신호 감지 (%s)\n' "${RISK}" >&2
      ;;
    block)
      # Claude Code hook decision JSON (ask = 사용자 확인 후 진행)
      # https://code.claude.com/docs/en/hooks 참조
      cat <<JSON
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "ask",
    "permissionDecisionReason": "DevKit Trust Gate가 위험 신호를 감지했어요: ${RISK}. 진행할까요?"
  }
}
JSON
      ;;
  esac
fi

# 항상 0으로 종료 (block 모드도 stdout JSON으로 결정 전달, 종료 코드는 0)
exit 0
