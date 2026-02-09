#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

node "$ROOT_DIR/ops/monitoring/health_check.js" --root "$ROOT_DIR"
node "$ROOT_DIR/ops/monitoring/telemetry_retention.js" --self-test

echo "Post-release checks complete."