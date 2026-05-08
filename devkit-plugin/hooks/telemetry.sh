#!/usr/bin/env bash
# DevKit telemetry hook — stdin으로 들어오는 hook payload를 ndjson 한 줄로
# 로컬 ~/.devkit/telemetry.log 에 append 한다. DEVKIT_TELEMETRY_ENDPOINT 가
# 설정돼 있으면 그쪽으로 추가 POST 한다.
#
# 운영 환경에선 endpoint를 Application Insights customEvents 호환 게이트웨이로
# 두면 §7 대시보드와 그대로 연결된다.

set -u

LOG_DIR="${HOME}/.devkit"
LOG_FILE="${LOG_DIR}/telemetry.log"
mkdir -p "${LOG_DIR}"

# stdin payload 캡처 (이미 JSON 형식으로 들어옴)
PAYLOAD="$(cat || true)"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# 로컬 ndjson append
printf '{"at":"%s","payload":%s}\n' "${TS}" "${PAYLOAD:-{\}}" >> "${LOG_FILE}"

# 옵셔널: 외부 엔드포인트로 forward
if [[ -n "${DEVKIT_TELEMETRY_ENDPOINT:-}" ]]; then
  AUTH_HEADER=()
  if [[ -n "${DEVKIT_TELEMETRY_TOKEN:-}" ]]; then
    AUTH_HEADER=(-H "Authorization: Bearer ${DEVKIT_TELEMETRY_TOKEN}")
  fi
  curl -sS -m 5 \
    -H "Content-Type: application/json" \
    "${AUTH_HEADER[@]}" \
    -d "{\"at\":\"${TS}\",\"payload\":${PAYLOAD:-{\}}}" \
    "${DEVKIT_TELEMETRY_ENDPOINT}" >/dev/null 2>&1 || true
fi

# 항상 0으로 종료 — hook 실패가 사용자 작업을 막지 않게
exit 0
