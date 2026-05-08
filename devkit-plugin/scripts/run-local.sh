#!/usr/bin/env bash
# DevKit 한 줄 실행 (macOS / Linux)
# 터미널에서 실행:
#   bash <(curl -fsSL https://raw.githubusercontent.com/Jl-seo/power-platform/claude/explore-power-platform-methods-3gfYL/devkit-plugin/scripts/run-local.sh)
#
# 또는 PR 브랜치를 이미 받았다면:
#   bash devkit-plugin/scripts/run-local.sh

set -euo pipefail

BRANCH="claude/explore-power-platform-methods-3gfYL"
REPO_URL="https://github.com/Jl-seo/power-platform.git"
WORKDIR="${HOME}/devkit-preview"
PORT="${PORT:-5173}"

step() { printf "\n\033[1;34m▸ %s\033[0m\n" "$*"; }
note() { printf "  \033[2m%s\033[0m\n" "$*"; }
fail() { printf "\n\033[1;31m❌ %s\033[0m\n" "$*"; exit 1; }

# 사전 준비물 점검
step "필요한 프로그램이 깔려 있는지 확인"
command -v git  >/dev/null 2>&1 || fail "git 이 없어요. https://git-scm.com/downloads 에서 설치 후 다시 실행."
command -v node >/dev/null 2>&1 || fail "Node.js 가 없어요. https://nodejs.org 에서 LTS 설치 후 다시 실행."
command -v npm  >/dev/null 2>&1 || fail "npm 이 없어요. Node.js 설치하면 같이 들어와요."
note "git $(git --version | awk '{print $3}'), node $(node --version), npm $(npm --version)"

# 브랜치 받기 / 갱신
if [[ -d "${WORKDIR}/.git" ]]; then
  step "이미 받은 폴더 확인 — 최신으로 갱신 (${WORKDIR})"
  git -C "${WORKDIR}" fetch origin "${BRANCH}" >/dev/null
  git -C "${WORKDIR}" checkout "${BRANCH}" >/dev/null 2>&1
  git -C "${WORKDIR}" reset --hard "origin/${BRANCH}" >/dev/null
else
  step "PR 브랜치 다운로드 (${WORKDIR})"
  git clone --branch "${BRANCH}" --depth 1 "${REPO_URL}" "${WORKDIR}"
fi

# 설치
cd "${WORKDIR}/devkit-plugin"
step "필요한 부속 설치 (1~2분)"
npm install --no-fund --no-audit

# 자체 점검
step "자체 점검"
npm run smoke

# 브라우저 자동 열기 (가능하면)
URL="http://localhost:${PORT}"
open_browser() {
  ( sleep 1.2
    if   command -v open    >/dev/null 2>&1; then open "${URL}"
    elif command -v xdg-open >/dev/null 2>&1; then xdg-open "${URL}"
    fi
  ) >/dev/null 2>&1 &
}

step "웹 서버 시작 — ${URL}"
note "끄려면 Ctrl+C"
open_browser
PORT="${PORT}" exec npm run web
