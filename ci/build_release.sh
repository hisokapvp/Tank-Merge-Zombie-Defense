#!/usr/bin/env bash
# ci/build_release.sh — deterministic release builder for Yandex Games SDK / static hosts.
#
# Pipeline (solo-pipeline-yandex-vk#2 / item 7):
#   1. Resolve OUT_ROOT (default `dist/release`) and TS (UTC, sortable).
#   2. Invoke `node ci/build_release.mjs --out "$OUT_DIR" [--yandex] [--no-zip]`.
#   3. The Node helper performs whitelist copy, computes per-file SHA-256,
#      injects ?v=<sha8> cache-busting markers into the copied index.html,
#      writes release_manifest.json, optionally injects the Yandex SDK seam,
#      and creates a zip archive of the output folder.
#
# Hard invariants:
#   * `dist/release/staging/` (release mirror) must NEVER be edited by this
#     script — output goes to a NEW timestamped folder under `dist/release/`.
#   * No minify, no source maps, no bundler — copy-as-is to keep stack traces
#     readable in production (postmortem item 13).
#   * Whitelist only runtime-required artefacts (item 11): `index.html`,
#     `game.js`, `style.css`, `src/**`, `assets/**`. Excludes `Test/`, `ci/`,
#     `tools/`, `docs/`, `vendor/dev/`, `.venv`, `node_modules`, dev `.md`.
#
# Usage:
#   bash ci/build_release.sh                      # generic third-party host build
#   bash ci/build_release.sh --yandex             # inject Yandex Games SDK seam
#   OUT_TS=20260428-yandex-1 bash ci/build_release.sh --yandex   # custom suffix
#   bash ci/build_release.sh --no-zip             # skip zip step
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

OUT_ROOT="${OUT_ROOT:-${ROOT_DIR}/dist/release}"
TS="${OUT_TS:-$(date -u +%Y%m%d-%H%M%S)}"
OUT_DIR="${OUT_ROOT}/${TS}"

EXTRA_FLAGS=()
DO_ZIP=1
for arg in "$@"; do
  case "$arg" in
    --yandex)  EXTRA_FLAGS+=("--yandex") ;;
    --no-zip)  DO_ZIP=0 ;;
    --help|-h)
      grep '^# ' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      printf "Unknown flag: %s\n" "$arg" >&2
      exit 2
      ;;
  esac
done

if [[ "${OUT_DIR}" == */dist/release/staging* ]]; then
  printf "REFUSE: dist/release/staging/ is the existing release mirror and must NOT be overwritten.\n" >&2
  exit 3
fi

if ! command -v node >/dev/null 2>&1; then
  printf "ERROR: node is required to run ci/build_release.mjs.\n" >&2
  exit 4
fi

printf "[build_release] OUT_DIR=%s\n" "${OUT_DIR}"
node "${ROOT_DIR}/ci/build_release.mjs" --root "${ROOT_DIR}" --out "${OUT_DIR}" "${EXTRA_FLAGS[@]}"

if [[ "${DO_ZIP}" -eq 1 ]]; then
  ZIP_PATH="${OUT_DIR}.zip"
  printf "[build_release] zipping -> %s\n" "${ZIP_PATH}"
  if command -v zip >/dev/null 2>&1; then
    ( cd "${OUT_ROOT}" && zip -qr "${ZIP_PATH}" "${TS}" )
  elif command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -Command "Compress-Archive -Path '${OUT_DIR}\\*' -DestinationPath '${ZIP_PATH}' -Force" >/dev/null
  elif command -v pwsh >/dev/null 2>&1; then
    pwsh -NoProfile -Command "Compress-Archive -Path '${OUT_DIR}/*' -DestinationPath '${ZIP_PATH}' -Force" >/dev/null
  else
    printf "WARN: no zip / Compress-Archive available; skipping archive.\n" >&2
  fi
fi

printf "[build_release] done.\n"
