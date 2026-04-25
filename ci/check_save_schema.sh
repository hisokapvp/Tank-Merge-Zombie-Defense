#!/usr/bin/env bash
# ci/check_save_schema.sh — статическая проверка save-payload против assets/saveSchema.json.
#
# Поведение:
#   - без аргументов: запускает self-test (валидирует синтетический skeleton).
#   - с аргументами: каждый аргумент трактуется как путь к JSON save-файлу.
#
# Exit codes:
#   0 — schema parses + все payload'ы прошли валидацию.
#   1 — хотя бы один payload завалил валидацию.
#   2 — schema self-test упал (broken schema / broken validator).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

VALIDATOR="${REPO_ROOT}/tools/saveSchemaValidator.js"
SCHEMA="${REPO_ROOT}/assets/saveSchema.json"

if [[ ! -f "${VALIDATOR}" ]]; then
  echo "check_save_schema: validator not found at ${VALIDATOR}" >&2
  exit 2
fi
if [[ ! -f "${SCHEMA}" ]]; then
  echo "check_save_schema: schema not found at ${SCHEMA}" >&2
  exit 2
fi

if ! command -v node >/dev/null 2>&1; then
  echo "check_save_schema: node not in PATH; skipping (informational)." >&2
  exit 0
fi

if [[ "$#" -eq 0 ]]; then
  exec node "${VALIDATOR}" --schema "${SCHEMA}"
fi

exec node "${VALIDATOR}" --schema "${SCHEMA}" "$@"
