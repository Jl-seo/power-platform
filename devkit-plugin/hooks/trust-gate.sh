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

# 항상 0으로 종료 — 차단 안 함
exit 0
