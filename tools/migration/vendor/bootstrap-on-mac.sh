#!/usr/bin/env bash
# Bootstrap-on-Mac: produces a single zip ready to transfer to an
# air-gapped Windows VM. Does everything in one shot:
#   1) downloads the migration toolkit folder from GitHub
#   2) downloads all PowerShell module + pac CLI dependencies into vendor/
#   3) zips the whole thing as PPMigration-ready.zip
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Jl-seo/power-platform/claude/power-platform-migration-4c7fx/tools/migration/vendor/bootstrap-on-mac.sh | bash
#
# Output:
#   ./PPMigration-ready.zip   (transfer this single file to the Windows VM)
#
# Requirements: bash, curl, unzip. (Optional: git, for the cleaner sparse-checkout path.)

set -euo pipefail

REPO_OWNER="Jl-seo"
REPO_NAME="power-platform"
BRANCH="claude/power-platform-migration-4c7fx"
SUBDIR="tools/migration"
WORK_ROOT="${PWD}"
WORK_DIR="${WORK_ROOT}/PPMigration-build-$$"
OUT_DIR="${WORK_ROOT}/PPMigration"
OUT_ZIP="${WORK_ROOT}/PPMigration-ready.zip"

color()   { printf "\033[%sm%s\033[0m\n" "$1" "$2"; }
info()    { color "36" "[bootstrap] $1"; }
ok()      { color "32" "[bootstrap] $1"; }
warn()    { color "33" "[bootstrap] $1"; }
die()     { color "31" "[bootstrap] FATAL: $1"; exit 1; }

# Pre-flight checks
for cmd in curl unzip; do
  command -v "$cmd" >/dev/null 2>&1 || die "Missing required command: $cmd"
done

mkdir -p "${WORK_DIR}"
trap "rm -rf '${WORK_DIR}'" EXIT

info "Step 1/3: Fetching toolkit from github.com/${REPO_OWNER}/${REPO_NAME}@${BRANCH}"

if command -v git >/dev/null 2>&1; then
  info "  using git sparse-checkout (clean path)"
  git -C "${WORK_DIR}" init -q
  git -C "${WORK_DIR}" remote add origin "https://github.com/${REPO_OWNER}/${REPO_NAME}.git"
  git -C "${WORK_DIR}" config core.sparseCheckout true
  echo "${SUBDIR}/*" > "${WORK_DIR}/.git/info/sparse-checkout"
  git -C "${WORK_DIR}" fetch --depth 1 origin "${BRANCH}" -q
  git -C "${WORK_DIR}" checkout -q FETCH_HEAD
  SRC_DIR="${WORK_DIR}/${SUBDIR}"
else
  info "  git not found; falling back to codeload zip (downloads more, slower)"
  ZIP_URL="https://codeload.github.com/${REPO_OWNER}/${REPO_NAME}/zip/refs/heads/${BRANCH}"
  curl -fsSL --retry 3 -o "${WORK_DIR}/repo.zip" "${ZIP_URL}"
  unzip -qq "${WORK_DIR}/repo.zip" -d "${WORK_DIR}"
  SRC_DIR="$(find "${WORK_DIR}" -maxdepth 2 -type d -name 'migration' -path "*tools/migration" | head -n1)"
  [[ -n "${SRC_DIR}" ]] || die "Could not locate ${SUBDIR} inside repo zip"
fi

info "Step 2/3: Staging into ${OUT_DIR}"
rm -rf "${OUT_DIR}"
mkdir -p "${OUT_DIR}"
cp -R "${SRC_DIR}/." "${OUT_DIR}/"
chmod +x "${OUT_DIR}/vendor/"*.sh 2>/dev/null || true
ok "  staged $(find "${OUT_DIR}" -type f | wc -l | tr -d ' ') files"

info "Step 3/3: Downloading module + pac CLI dependencies"
bash "${OUT_DIR}/vendor/download-on-mac.sh"

info "Zipping ${OUT_DIR} -> ${OUT_ZIP}"
rm -f "${OUT_ZIP}"
( cd "${WORK_ROOT}" && zip -qr "${OUT_ZIP}" "$(basename "${OUT_DIR}")" )
ok "Created: ${OUT_ZIP}"
ls -lh "${OUT_ZIP}"

cat <<EOF

Transfer PPMigration-ready.zip to your Windows VM (RDP clipboard / shared folder / USB / web upload).
On the Windows VM (PowerShell 5.1, run as Administrator):

    Expand-Archive -Path PPMigration-ready.zip -DestinationPath D:\jlseo\ -Force
    cd D:\jlseo\PPMigration
    Get-ChildItem . -Recurse -Include *.ps1,*.psm1,*.psd1 | Unblock-File
    . .\vendor\Initialize-OfflineEnv.ps1     # should print mostly OK
    pac --version                            # should print pac version
    notepad .\templates\config.psd1          # then proceed with Phase 0..4

EOF
