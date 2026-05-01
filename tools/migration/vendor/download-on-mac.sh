#!/usr/bin/env bash
# Download all migration toolkit dependencies from PowerShell Gallery + nuget.org.
# Run this on macOS (or any Unix with curl + unzip). Output goes into the
# adjacent vendor/modules and vendor/pac folders so the Windows side picks them
# up via Initialize-OfflineEnv.ps1.
#
# Usage:
#   bash download-on-mac.sh               # uses pinned versions below
#   PAC_VERSION=2.6.4 bash download-on-mac.sh
#
# After it finishes:
#   - vendor/modules/<Name>/<Version>/<Name>.psd1   (one folder per module)
#   - vendor/pac/pac.exe + DLLs
#
# Then sync the whole tools/migration folder to the Windows machine and run
# the orchestrator there. The .exe is a Windows binary; macOS won't execute it
# but extraction works fine and Windows runs it.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENDOR_DIR="${SCRIPT_DIR}"
MOD_DIR="${VENDOR_DIR}/modules"
PAC_DIR="${VENDOR_DIR}/pac"
TMP_DIR="${VENDOR_DIR}/_tmp"

mkdir -p "${MOD_DIR}" "${PAC_DIR}" "${TMP_DIR}"

# Pinned, known-good versions. Override by editing or via env var on the line.
MODULES=(
  "CredentialManager:2.0"
  "MSAL.PS:4.37.0.0"
  "Microsoft.PowerApps.Administration.PowerShell:2.0.180"
  "Microsoft.Graph.Authentication:2.15.0"
  "Microsoft.Graph.Applications:2.15.0"
  "Microsoft.Graph.Identity.SignIns:2.15.0"
)

PAC_VERSION="${PAC_VERSION:-2.6.4}"

PSG_BASE="https://www.powershellgallery.com/api/v2/package"
NUGET_BASE="https://www.nuget.org/api/v2/package"

color()   { printf "\033[%sm%s\033[0m\n" "$1" "$2"; }
ok()      { color "32" "  OK: $1"; }
info()    { color "36" "$1"; }
warn()    { color "33" "  WARN: $1"; }
die()     { color "31" "  FATAL: $1"; exit 1; }

download() {
  local url="$1" out="$2"
  curl -sSL --fail --retry 3 --retry-delay 2 --max-time 180 -o "${out}" "${url}"
  if [[ ! -s "${out}" ]]; then die "Empty download: ${out}"; fi
}

extract_nupkg_into() {
  local nupkg="$1" dest="$2"
  rm -rf "${dest}"
  mkdir -p "${dest}"
  unzip -qq -o "${nupkg}" -d "${dest}"
  # Strip nupkg metadata that the runtime doesn't need
  rm -rf "${dest}/_rels" "${dest}/package" "${dest}/[Content_Types].xml"
  rm -f  "${dest}"/*.nuspec
}

# ---- Modules ----
info "Downloading PowerShell modules into ${MOD_DIR}"
for entry in "${MODULES[@]}"; do
  name="${entry%%:*}"
  version="${entry##*:}"
  url="${PSG_BASE}/${name}/${version}"
  nupkg="${TMP_DIR}/${name}.${version}.nupkg"
  dest="${MOD_DIR}/${name}/${version}"
  info "  ${name} ${version}"
  if ! download "${url}" "${nupkg}"; then warn "skip ${name}"; continue; fi
  extract_nupkg_into "${nupkg}" "${dest}"
  if [[ -f "${dest}/${name}.psd1" ]]; then
    ok "${dest}/${name}.psd1"
  else
    warn "${name}.psd1 not at expected root in ${dest} (some packages nest deeper; usually OK)"
  fi
done

# ---- pac CLI ----
info "Downloading pac CLI ${PAC_VERSION}"
pac_nupkg="${TMP_DIR}/Microsoft.PowerApps.CLI.${PAC_VERSION}.nupkg"
pac_extract="${TMP_DIR}/pac-${PAC_VERSION}"
download "${NUGET_BASE}/Microsoft.PowerApps.CLI/${PAC_VERSION}" "${pac_nupkg}"
extract_nupkg_into "${pac_nupkg}" "${pac_extract}"

# Find pac.exe (could be tools/pac/pac.exe or tools/pac/<rid>/pac.exe)
pac_exe="$(find "${pac_extract}" -type f -name 'pac.exe' | head -n1 || true)"
if [[ -z "${pac_exe}" ]]; then
  die "pac.exe not found in ${pac_nupkg}. Try a different PAC_VERSION."
fi
pac_base="$(dirname "${pac_exe}")"
info "Staging pac binaries from ${pac_base} -> ${PAC_DIR}"
# Copy everything next to pac.exe
cp -f "${pac_base}/"* "${PAC_DIR}/" 2>/dev/null || true
# Native runtimes (if present) need to go along too
if [[ -d "${pac_base}/runtimes" ]]; then
  rm -rf "${PAC_DIR}/runtimes"
  cp -R "${pac_base}/runtimes" "${PAC_DIR}/"
fi
ok "${PAC_DIR}/pac.exe"

# ---- Manifest ----
{
  echo "{"
  echo "  \"generatedUtc\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\","
  echo "  \"pacVersion\":   \"${PAC_VERSION}\","
  echo "  \"modules\": ["
  first=1
  for entry in "${MODULES[@]}"; do
    name="${entry%%:*}"; version="${entry##*:}"
    [[ -d "${MOD_DIR}/${name}/${version}" ]] || continue
    [[ $first -eq 1 ]] && first=0 || echo ","
    printf "    {\"name\":\"%s\",\"version\":\"%s\"}" "${name}" "${version}"
  done
  echo
  echo "  ]"
  echo "}"
} > "${VENDOR_DIR}/manifest.json"

rm -rf "${TMP_DIR}"

color "32" ""
color "32" "Done. Sync the entire tools/migration folder to your Windows machine, then on Windows:"
echo "    cd D:\\jlseo\\PPMigration"
echo "    Get-ChildItem . -Recurse -Include *.ps1,*.psm1,*.psd1 | Unblock-File"
echo "    . .\\vendor\\Initialize-OfflineEnv.ps1"
echo "    pac --version"
