#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ROOT_DIR

node - <<'NODE'
const fs = require('fs');
const path = require('path');

const root = process.env.ROOT_DIR || process.cwd();
const targets = ['src', 'Test', 'ci'];
const ignoreDirs = new Set(['node_modules', '.git']);
const bad = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoreDirs.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.isFile()) {
      if (!/\.(js|css|html|md|sh)$/.test(entry.name)) continue;
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (/[ \t]+$/.test(lines[i])) {
          bad.push({ file: fullPath, line: i + 1 });
        }
      }
    }
  }
}

for (const target of targets) {
  const dir = path.join(root, target);
  if (fs.existsSync(dir)) walk(dir);
}

if (bad.length) {
  console.error('Trailing whitespace found:');
  for (const item of bad) {
    const rel = path.relative(root, item.file).replace(/\\/g, '/');
    console.error('  ' + rel + ':' + item.line);
  }
  process.exit(1);
}

console.log('Style check passed.');
NODE
