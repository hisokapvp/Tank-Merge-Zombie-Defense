#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR" || exit 1

fail=0

run_test() {
  local label="$1"
  local cmd="$2"
  echo "\n==> $label"
  if ! node "$cmd"; then
    echo "FAILED: $label"
    fail=1
  fi
}

run_test "Unit tests" "Test/tests.js"
run_test "Pack 1 (fire logic)" "Test/pack1/fireLogic.test.js"
run_test "Pack 1 (merge popup)" "Test/pack1/mergePopup.test.js"
run_test "Pack 1 (new game reset)" "Test/pack1/newGamePopupReset.test.js"
run_test "Pack 2" "Test/pack2/mergeAnimRegression.test.js"
run_test "Pack 2 (fire regression)" "Test/pack2/fireLogicRegression.test.js"
run_test "Pack 2 (telemetry)" "Test/pack2/telemetryExport.test.js"
run_test "Pack 3 (catalog)" "Test/pack3/catalog.test.js"
run_test "Pack 3 (SRS)" "Test/pack3/srs.test.js"
run_test "Pack 3 (Anki importer)" "Test/pack3/ankiImporter.test.js"
run_test "Pack 4 (calendar)" "Test/pack4/calendar.test.js"
run_test "Pack 4 (profiler)" "Test/pack4/perf_stress.test.js"

if [ "$fail" -ne 0 ]; then
  echo "\nSome tests failed."
  exit 1
fi

echo "\nAll tests passed."
