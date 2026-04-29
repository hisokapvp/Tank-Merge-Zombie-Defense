#!/usr/bin/env bash
# ci/build_release.sh — deterministic release builder for Yandex Games SDK / static hosts.
#
# Pipeline (solo-pipeline-yandex-vk#2 / item 7):
#   1. Resolve OUT_ROOT (default `dist/release`) and TS (UTC, sortable).
#   2. Invoke `node ci/build_release.mjs --out "$OUT_DIR" [--yandex] [--no-zip]`.
#   3. The Node helper performs whitelist copy, computes per-file SHA-256,
#      injects ?v=<sha12> cache-busting markers into the copied index.html,
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

# Cross-platform deterministic zip is now produced by ci/build_release.mjs itself
# (solo-pipeline-yandex-vk#1 / item 1). PowerShell `Compress-Archive` and the
# Windows `zip` ports both wrote ZIP entries with backslash separators, which
# Yandex Games CDN treated as flat filenames -> mass 404 on /src/**, /assets/**,
# /vendor/**. The Node writer always emits forward-slash entries per APPNOTE.TXT.
if [[ "${DO_ZIP}" -eq 0 ]]; then
  EXTRA_FLAGS+=("--no-zip")
fi

printf "[build_release] OUT_DIR=%s\n" "${OUT_DIR}"
node "${ROOT_DIR}/ci/build_release.mjs" --root "${ROOT_DIR}" --out "${OUT_DIR}" "${EXTRA_FLAGS[@]}"

printf "[build_release] done.\n"
