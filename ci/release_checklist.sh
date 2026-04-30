#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

printf "\nRelease checklist (Pack 5)\n"
printf "================================\n"

printf "\n[1/3] Style check\n"
bash "$ROOT_DIR/ci/check_style.sh"

printf "\n[2/3] Test suite\n"
bash "$ROOT_DIR/ci/run_tests.sh"

printf "\n[3/3] Manual smoke checks\n"
cat <<'EOF'
- Launch index.html and confirm load without console errors
- Toggle RU/EN and verify UI text updates
- Open each modal and verify: Escape closes, Tab stays inside
- Verify merge popup copy, lesson progress labels, and Anki preview
- Confirm FPS stays stable with zombies + projectiles
- (B4 / solo-pipeline-yandex-vk#3) FX density slider: bigMenu → FX density.
  Set slider to 0%, 50%, 100%. For each value, trigger weather (storm/rain)
  and confirm:
    * 0%   — only whitelisted FX visible (projectiles, drones, fence HP bars,
             tutorial bubbles, weather, tank aura sprite). Procedural orbs
             scaled out, no exceptions in console.
    * 50%  — particle/decal density is visibly halved vs 100%, FPS improved.
    * 100% — visual parity with pre-slider builds (default behaviour).
  Repeat with Phaser overlay enabled (?usePhaser=1) and verify density is
  applied through Game.RenderRegistry in both render paths (no double-draw).
EOF

# solo-pipeline-yandex-vk#1 (batch#1, item 2): pre-submit Yandex Games guard.
# Run a fresh --yandex build and rely on `assertNoDevUrlLiterals` inside
# `ci/build_release.mjs` to abort if any dev-URL literal survives sanitisation.
# This catches new admin/debug code introduced after batch#1 before it hits
# the moderation queue.
printf "\n[Yandex pre-submit] dev-URL literal guard\n"
if command -v node >/dev/null 2>&1; then
  YANDEX_GUARD_OUT="${ROOT_DIR}/dist/release/_yandex_guard_$(date -u +%Y%m%d-%H%M%S)"
  if node "${ROOT_DIR}/ci/build_release.mjs" --out "${YANDEX_GUARD_OUT}" --yandex --no-zip; then
    printf "Yandex pre-submit guard passed (output: %s)\n" "${YANDEX_GUARD_OUT}"
  else
    printf "Yandex pre-submit guard FAILED — fix dev-URL leaks before submitting.\n" >&2
    exit 5
  fi
else
  printf "node not on PATH — skipping Yandex pre-submit guard (run bash ci/build_release.sh --yandex manually before publishing)\n" >&2
fi

printf "\nRelease checklist completed.\n"
