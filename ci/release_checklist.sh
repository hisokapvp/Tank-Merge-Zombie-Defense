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
EOF

printf "\nRelease checklist completed.\n"
