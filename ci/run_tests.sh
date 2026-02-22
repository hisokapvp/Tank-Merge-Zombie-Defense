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
run_test "Pack 3 (zombie spawn alive-only)" "Test/pack3/zombieSpawnAliveOnly.test.js"
run_test "Pack 4 (calendar)" "Test/pack4/calendar.test.js"
run_test "Pack 4 (profiler)" "Test/pack4/perf_stress.test.js"
run_test "Pack 5 (perf regression)" "Test/pack5/perf_regression.test.js"
run_test "Pack 5 (CI guard: Pack 3 included)" "Test/pack5/ci_includes_pack3.test.js"
run_test "Pack 6 (zombie road visuals removed)" "Test/pack6/zombieRoad_visuals_removed.test.js"
run_test "Pack 7 (adminFlags visibility)" "Test/pack7/adminFlags_visibility.test.js"
run_test "Pack 7 (adminDamagePoints visibility)" "Test/pack7/adminDamagePoints_visibility.test.js"
run_test "Pack 7 (release integrity)" "Test/pack7/release_integrity.test.js"
run_test "Pack 7 (analytics aggregation)" "Test/pack7/analytics_aggregation.test.js"
run_test "Pack 7 (fence square geometry)" "Test/pack7/fenceSquareGeometry.test.js"
run_test "Pack 7 (fence corner slots)" "Test/pack7/fenceCornerSlots.test.js"
run_test "Pack 7 (fence asset keys)" "Test/pack7/fenceAssetsCornersSides.test.js"
run_test "Pack 8 (talents v1->v2 migration)" "Test/pack8/talentsV2_migration.test.js"
run_test "Pack 8 (offline progress)" "Test/pack8/offlineProgress.test.js"
run_test "Pack 9 (offline modal UI/i18n)" "Test/pack9/offlineModal_ui_i18n.test.js"

if [ "$fail" -ne 0 ]; then
  echo "\nSome tests failed."
  exit 1
fi

echo "\nAll tests passed."
