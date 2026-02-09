#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="$ROOT_DIR/dist/release"
STAGING_DIR="$OUT_DIR/staging"
DATE_TAG="$(date +%Y%m%d)"
ZIP_NAME="tank-merge-zombie-defense-${DATE_TAG}.zip"
ZIP_PATH="$OUT_DIR/$ZIP_NAME"

rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"

cp "$ROOT_DIR/index.html" "$STAGING_DIR/"
cp "$ROOT_DIR/game.js" "$STAGING_DIR/"
cp "$ROOT_DIR/style.css" "$STAGING_DIR/"
cp "$ROOT_DIR/README.md" "$STAGING_DIR/"

cp -R "$ROOT_DIR/assets" "$STAGING_DIR/"
cp -R "$ROOT_DIR/src" "$STAGING_DIR/"

node "$ROOT_DIR/ops/release/generate_changelog.js" --out "$STAGING_DIR/CHANGELOG.md" || true

mkdir -p "$OUT_DIR"
if command -v zip >/dev/null 2>&1; then
  (cd "$STAGING_DIR" && zip -r "$ZIP_PATH" .)
else
  powershell.exe -NoProfile -Command "Compress-Archive -Path '$STAGING_DIR\\*' -DestinationPath '$ZIP_PATH' -Force" >/dev/null
fi

"$ROOT_DIR/ops/release/check_release_integrity.sh" "$ZIP_PATH"

echo "Release created: $ZIP_PATH"
