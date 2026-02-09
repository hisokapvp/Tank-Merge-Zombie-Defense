#!/usr/bin/env bash
set -euo pipefail

ZIP_PATH="${1:-}"
if [ -z "$ZIP_PATH" ]; then
  echo "Usage: $0 <zip_path>" >&2
  exit 1
fi

if [ ! -f "$ZIP_PATH" ]; then
  echo "Missing release zip: $ZIP_PATH" >&2
  exit 1
fi

list_zip() {
  if command -v unzip >/dev/null 2>&1; then
    unzip -l "$ZIP_PATH" | awk '{print $4}'
  else
    powershell.exe -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::OpenRead('$ZIP_PATH').Entries | ForEach-Object { $_.FullName }"
  fi
}

check_zip_test() {
  if command -v unzip >/dev/null 2>&1; then
    unzip -t "$ZIP_PATH" >/dev/null
  fi
}

REQUIRED_FILES=(
  "index.html"
  "game.js"
  "style.css"
  "README.md"
)

ZIP_LIST="$(list_zip)"

check_zip_test

fail=0
for f in "${REQUIRED_FILES[@]}"; do
  if ! printf '%s\n' "$ZIP_LIST" | grep -Fxq "$f"; then
    echo "Missing in zip: $f" >&2
    fail=1
  fi
done

if ! printf '%s\n' "$ZIP_LIST" | grep -Eq '^assets/'; then
  echo "Missing assets/ in zip" >&2
  fail=1
fi

if ! printf '%s\n' "$ZIP_LIST" | grep -Eq '^src/'; then
  echo "Missing src/ in zip" >&2
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  exit 1
fi

echo "Release integrity OK: $ZIP_PATH"
